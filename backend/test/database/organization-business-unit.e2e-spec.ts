import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 5 (Organization/BusinessUnit).
 *
 * Usa o driver `pg` diretamente em vez do Prisma Client porque este teste
 * precisa validar a migration SQL de forma independente do binário do
 * query engine do Prisma. Não substitui o uso do Prisma Client na aplicação.
 *
 * Requer um banco PostgreSQL acessível via DATABASE_URL com a migration
 * da Etapa 5 já aplicada (ver prisma/migrations/20260817120000_init_organization_business_unit).
 */
describe('Migration Etapa 5 — Organization / BusinessUnit (estrutural)', () => {
  let client: Client;

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

  afterEach(async () => {
    await client.query('TRUNCATE business_units, organizations CASCADE;');
  });

  it('cria uma organization com UUID e timestamps', async () => {
    const result = await client.query(
      `INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now()) RETURNING id, name, created_at`,
      [randomUUID(), 'Wave Burger LTDA'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('Wave Burger LTDA');
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
  });

  it('cria uma business unit vinculada a uma organization', async () => {
    const orgId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);

    const result = await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now()) RETURNING id, organization_id, name`,
      [randomUUID(), orgId, 'Unidade Principal'],
    );

    expect(result.rows[0].organization_id).toBe(orgId);
    expect(result.rows[0].name).toBe('Unidade Principal');
  });

  it('rejeita business unit com organization_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), randomUUID(), 'Unidade Fantasma'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('rejeita duas business units com o mesmo nome na mesma organization (unique)', async () => {
    const orgId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [randomUUID(), orgId, 'Unidade Centro'],
    );

    await expect(
      client.query(
        `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), orgId, 'Unidade Centro'],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('permite o mesmo nome de business unit em organizations diferentes', async () => {
    const orgAId = randomUUID();
    const orgBId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgAId,
      'Organização A',
    ]);
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgBId,
      'Organização B',
    ]);

    await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [randomUUID(), orgAId, 'Unidade Padrão'],
    );

    await expect(
      client.query(
        `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), orgBId, 'Unidade Padrão'],
      ),
    ).resolves.toBeDefined();
  });

  it('impede apagar uma organization que possui business units (ON DELETE RESTRICT)', async () => {
    const orgId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [randomUUID(), orgId, 'Unidade Principal'],
    );

    await expect(client.query(`DELETE FROM organizations WHERE id = $1`, [orgId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
