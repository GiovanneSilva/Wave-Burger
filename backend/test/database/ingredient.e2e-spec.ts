import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 8 (ingredients).
 * Mesma abordagem das etapas anteriores — valida via SQL direto,
 * independente do binário do query engine do Prisma.
 */
describe('Migration Etapa 8 — Ingredient (estrutural)', () => {
  let client: Client;
  let orgId: string;

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
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
  });

  afterEach(async () => {
    await client.query('TRUNCATE ingredients, organizations CASCADE;');
  });

  it('cria um ingrediente com custo em decimal preciso (sem arredondamento float)', async () => {
    const result = await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, minimum_stock, average_cost, last_cost, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING average_cost, last_cost, minimum_stock`,
      [randomUUID(), orgId, 'Carne Bovina', 'kg', '5.000', '30.1234', '30.1234'],
    );

    expect(result.rows[0].average_cost).toBe('30.1234');
    expect(result.rows[0].last_cost).toBe('30.1234');
    expect(result.rows[0].minimum_stock).toBe('5.000');
  });

  it('rejeita dois ingredientes com o mesmo nome na mesma organização (fonte única da verdade)', async () => {
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), orgId, 'Carne Bovina', 'kg'],
    );

    await expect(
      client.query(
        `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), orgId, 'Carne Bovina', 'kg'],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('permite o mesmo nome de ingrediente em organizations diferentes', async () => {
    const orgBId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgBId,
      'Outra Organização',
    ]);

    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), orgId, 'Queijo Cheddar', 'kg'],
    );

    await expect(
      client.query(
        `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), orgBId, 'Queijo Cheddar', 'kg'],
      ),
    ).resolves.toBeDefined();
  });

  it('rejeita ingrediente com organization_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), randomUUID(), 'Fantasma', 'kg'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('inativa (is_active=false) sem excluir o registro (RF-003 aplicado por consistência)', async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [id, orgId, 'Carne Bovina', 'kg'],
    );

    await client.query(`UPDATE ingredients SET is_active = false WHERE id = $1`, [id]);

    const result = await client.query(`SELECT is_active FROM ingredients WHERE id = $1`, [id]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].is_active).toBe(false);
  });

  it('impede apagar uma organization que possui ingredientes (ON DELETE RESTRICT)', async () => {
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), orgId, 'Carne Bovina', 'kg'],
    );

    await expect(client.query(`DELETE FROM organizations WHERE id = $1`, [orgId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
