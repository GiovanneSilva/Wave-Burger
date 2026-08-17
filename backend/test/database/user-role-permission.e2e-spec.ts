import { Client } from 'pg';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Testes estruturais da migration da Etapa 6 (User/Role/Permission).
 *
 * Usa o driver `pg` diretamente pelo mesmo motivo da Etapa 5: valida a
 * migration e as relações independentemente do binário do query engine do
 * Prisma. A lógica de autenticação/autorização em si já é coberta pelos
 * testes unitários de auth.service.spec.ts e permissions.guard.spec.ts,
 * que rodam com PrismaService/UsersService mockados.
 *
 * Requer um banco PostgreSQL acessível via DATABASE_URL com as migrations
 * da Etapa 5 e Etapa 6 já aplicadas.
 */
describe('Migration Etapa 6 — User / Role / Permission (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let businessUnitId: string;

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
    businessUnitId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [businessUnitId, orgId, 'Unidade Principal'],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE user_roles, role_permissions, users, roles, permissions, business_units, organizations CASCADE;',
    );
  });

  it('cria um usuário vinculado a organization e business unit', async () => {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash('senha-correta-teste', 10);

    const result = await client.query(
      `INSERT INTO users (id, organization_id, business_unit_id, name, email, password_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id, email, is_active`,
      [userId, orgId, businessUnitId, 'Administrador', 'admin@waveburger.dev', passwordHash],
    );

    expect(result.rows[0].email).toBe('admin@waveburger.dev');
    expect(result.rows[0].is_active).toBe(true);
  });

  it('rejeita dois usuários com o mesmo e-mail (unique)', async () => {
    const passwordHash = await bcrypt.hash('senha', 10);
    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [randomUUID(), orgId, 'Usuário 1', 'duplicado@waveburger.dev', passwordHash],
    );

    await expect(
      client.query(
        `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
        [randomUUID(), orgId, 'Usuário 2', 'duplicado@waveburger.dev', passwordHash],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('resolve papéis e permissões de um usuário via join (o mesmo shape usado por UsersService.findByEmailWithAuth)', async () => {
    const userId = randomUUID();
    const roleId = randomUUID();
    const permissionId = randomUUID();
    const passwordHash = await bcrypt.hash('senha-correta-teste', 10);

    await client.query(
      `INSERT INTO users (id, organization_id, business_unit_id, name, email, password_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [userId, orgId, businessUnitId, 'Administrador', 'admin@waveburger.dev', passwordHash],
    );
    await client.query(`INSERT INTO roles (id, name, updated_at) VALUES ($1, $2, now())`, [
      roleId,
      'ADMIN',
    ]);
    await client.query(`INSERT INTO permissions (id, key) VALUES ($1, $2)`, [
      permissionId,
      'users:manage',
    ]);
    await client.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`, [
      roleId,
      permissionId,
    ]);
    await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
      userId,
      roleId,
    ]);

    const result = await client.query(
      `SELECT u.email, r.name AS role_name, p.key AS permission_key
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE u.email = $1`,
      ['admin@waveburger.dev'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].role_name).toBe('ADMIN');
    expect(result.rows[0].permission_key).toBe('users:manage');
  });

  it('valida senha com bcrypt.compare a partir do hash armazenado (mesma checagem do AuthService)', async () => {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash('senha-correta-teste', 10);

    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [userId, orgId, 'Administrador', 'admin@waveburger.dev', passwordHash],
    );

    const result = await client.query(`SELECT password_hash FROM users WHERE email = $1`, [
      'admin@waveburger.dev',
    ]);
    const storedHash = result.rows[0].password_hash;

    await expect(bcrypt.compare('senha-correta-teste', storedHash)).resolves.toBe(true);
    await expect(bcrypt.compare('senha-errada', storedHash)).resolves.toBe(false);
  });

  it('impede apagar uma organization que possui usuário vinculado (ON DELETE RESTRICT)', async () => {
    const passwordHash = await bcrypt.hash('senha', 10);
    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [randomUUID(), orgId, 'Administrador', 'admin@waveburger.dev', passwordHash],
    );

    await expect(client.query(`DELETE FROM organizations WHERE id = $1`, [orgId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
