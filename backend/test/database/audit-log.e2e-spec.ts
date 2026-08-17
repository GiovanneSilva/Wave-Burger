import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 7 (audit_logs).
 *
 * Mesma abordagem das Etapas 5 e 6: valida a migration via SQL direto,
 * independente do binário do query engine do Prisma. A lógica de
 * chamada do AuditService já é coberta por audit.service.spec.ts.
 *
 * Esta suíte é a que mais importa nesta etapa: valida que a garantia de
 * append-only (claude/CLAUDE.md, Seção 6) é aplicada pelo próprio banco,
 * não apenas por convenção de aplicação.
 */
describe('Migration Etapa 7 — AuditLog (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    client = new Client({
      connectionString:
        process.env.DATABASE_URL ??
        'postgresql://waveburger:waveburger@localhost:5432/waveburger?schema=public',
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    orgId = randomUUID();
    userId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [userId, orgId, 'Administrador', `admin-${userId}@waveburger.dev`, 'hash'],
    );
  });

  afterEach(async () => {
    await client.query('TRUNCATE audit_logs, users, organizations CASCADE;');
  });

  it('registra uma entrada de auditoria com valores anterior/posterior em JSON', async () => {
    const logId = randomUUID();
    const result = await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id, previous_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, action, previous_value, new_value`,
      [
        logId,
        orgId,
        userId,
        'UPDATE',
        'User',
        userId,
        JSON.stringify({ name: 'Antigo' }),
        JSON.stringify({ name: 'Novo' }),
      ],
    );

    expect(result.rows[0].action).toBe('UPDATE');
    expect(result.rows[0].previous_value).toEqual({ name: 'Antigo' });
    expect(result.rows[0].new_value).toEqual({ name: 'Novo' });
  });

  it('rejeita audit log com user_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), orgId, randomUUID(), 'CREATE', 'User', randomUUID()],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('BLOQUEIA UPDATE em audit_logs (append-only, aplicado pelo banco)', async () => {
    const logId = randomUUID();
    await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [logId, orgId, userId, 'CREATE', 'User', userId],
    );

    await expect(
      client.query(`UPDATE audit_logs SET action = 'HACKED' WHERE id = $1`, [logId]),
    ).rejects.toThrow(/append-only/i);

    const check = await client.query(`SELECT action FROM audit_logs WHERE id = $1`, [logId]);
    expect(check.rows[0].action).toBe('CREATE');
  });

  it('BLOQUEIA DELETE em audit_logs (append-only, aplicado pelo banco)', async () => {
    const logId = randomUUID();
    await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [logId, orgId, userId, 'CREATE', 'User', userId],
    );

    await expect(client.query(`DELETE FROM audit_logs WHERE id = $1`, [logId])).rejects.toThrow(
      /append-only/i,
    );

    const check = await client.query(`SELECT id FROM audit_logs WHERE id = $1`, [logId]);
    expect(check.rows).toHaveLength(1);
  });

  it('permite consultar o histórico de uma entidade específica ordenado por data', async () => {
    const entityId = randomUUID();
    await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - interval '1 hour')`,
      [randomUUID(), orgId, userId, 'CREATE', 'Ingredient', entityId],
    );
    await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [randomUUID(), orgId, userId, 'UPDATE', 'Ingredient', entityId],
    );

    const result = await client.query(
      `SELECT action FROM audit_logs WHERE entity = $1 AND entity_id = $2 ORDER BY created_at DESC`,
      ['Ingredient', entityId],
    );

    expect(result.rows.map((r) => r.action)).toEqual(['UPDATE', 'CREATE']);
  });

  it('impede apagar um usuário que possui audit logs (ON DELETE RESTRICT)', async () => {
    await client.query(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, entity, entity_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), orgId, userId, 'LOGIN', 'User', userId],
    );

    await expect(client.query(`DELETE FROM users WHERE id = $1`, [userId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
