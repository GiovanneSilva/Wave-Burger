import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 9 (products).
 * Mesma abordagem das etapas anteriores.
 */
describe('Migration Etapa 9 — Product (estrutural)', () => {
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
    await client.query('TRUNCATE products, organizations CASCADE;');
  });

  it('cria um produto com status DRAFT por padrão (UC-001)', async () => {
    const result = await client.query(
      `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now()) RETURNING status`,
      [randomUUID(), orgId, 'Smash Burger'],
    );

    expect(result.rows[0].status).toBe('DRAFT');
  });

  it('rejeita um status fora do enum ProductStatus', async () => {
    await expect(
      client.query(
        `INSERT INTO products (id, organization_id, name, status, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), orgId, 'Produto Inválido', 'PUBLISHED'],
      ),
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('rejeita dois produtos com o mesmo nome na mesma organização', async () => {
    await client.query(
      `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [randomUUID(), orgId, 'Smash Burger'],
    );

    await expect(
      client.query(
        `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), orgId, 'Smash Burger'],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('permite múltiplos produtos sem internal_code (NULL não conflita com unique)', async () => {
    await client.query(
      `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [randomUUID(), orgId, 'Produto A'],
    );

    await expect(
      client.query(
        `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), orgId, 'Produto B'],
      ),
    ).resolves.toBeDefined();
  });

  it('rejeita internal_code duplicado quando informado', async () => {
    await client.query(
      `INSERT INTO products (id, organization_id, name, internal_code, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [randomUUID(), orgId, 'Produto A', 'SB-001'],
    );

    await expect(
      client.query(
        `INSERT INTO products (id, organization_id, name, internal_code, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [randomUUID(), orgId, 'Produto B', 'SB-001'],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('armazena preço com precisão decimal correta (sem arredondamento float)', async () => {
    const result = await client.query(
      `INSERT INTO products (id, organization_id, name, sale_price, updated_at) VALUES ($1, $2, $3, $4, now()) RETURNING sale_price`,
      [randomUUID(), orgId, 'Smash Burger', '28.90'],
    );

    expect(result.rows[0].sale_price).toBe('28.90');
  });

  it('rejeita produto com organization_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), randomUUID(), 'Fantasma'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('transita status para ACTIVE/INACTIVE via UPDATE (simulando ativação/inativação)', async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO products (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [id, orgId, 'Smash Burger'],
    );

    await client.query(`UPDATE products SET status = 'ACTIVE' WHERE id = $1`, [id]);
    let result = await client.query(`SELECT status FROM products WHERE id = $1`, [id]);
    expect(result.rows[0].status).toBe('ACTIVE');

    await client.query(`UPDATE products SET status = 'INACTIVE' WHERE id = $1`, [id]);
    result = await client.query(`SELECT status FROM products WHERE id = $1`, [id]);
    expect(result.rows[0].status).toBe('INACTIVE');
  });
});
