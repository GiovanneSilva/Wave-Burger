import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 10 (fichas_tecnicas /
 * ficha_tecnica_items). O mais importante desta suíte é o índice único
 * PARCIAL que garante apenas uma versão "corrente" por produto — a
 * garantia central de BR-005 (versionamento/imutabilidade).
 */
describe('Migration Etapa 10 — FichaTecnica (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let userId: string;
  let productId: string;
  let ingredientId: string;

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
    productId = randomUUID();
    ingredientId = randomUUID();

    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [userId, orgId, 'Admin', `admin-${userId}@waveburger.dev`, 'hash'],
    );
    await client.query(
      `INSERT INTO products (id, organization_id, name, sale_price, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [productId, orgId, 'Smash Burger', '28.90'],
    );
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, average_cost, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [ingredientId, orgId, 'Carne Bovina', 'kg', '30.0000'],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE ficha_tecnica_items, fichas_tecnicas, ingredients, products, users, organizations CASCADE;',
    );
  });

  async function insertFicha(version: number, isCurrent: boolean) {
    return client.query(
      `INSERT INTO fichas_tecnicas (id, product_id, version, is_current, ingredients_cost, total_cost, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`,
      [randomUUID(), productId, version, isCurrent, '4.8000', '4.8000', userId],
    );
  }

  it('cria a versão 1 como corrente, com item calculado corretamente (exemplo RF-005)', async () => {
    const ft = await insertFicha(1, true);
    const ftId = ft.rows[0].id;

    const item = await client.query(
      `INSERT INTO ficha_tecnica_items (id, ficha_tecnica_id, ingredient_id, quantity, unit, cost_snapshot, line_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING line_cost`,
      [randomUUID(), ftId, ingredientId, '0.1600', 'kg', '30.0000', '4.8000'],
    );

    expect(item.rows[0].line_cost).toBe('4.8000');
  });

  it('BLOQUEIA uma segunda versão "corrente" para o mesmo produto (índice único parcial)', async () => {
    await insertFicha(1, true);

    await expect(insertFicha(2, true)).rejects.toThrow(/duplicate key value/i);
  });

  it('PERMITE criar a versão 2 corrente depois de desativar a versão 1 (fluxo real de versionamento)', async () => {
    const ft1 = await insertFicha(1, true);
    await client.query(`UPDATE fichas_tecnicas SET is_current = false WHERE id = $1`, [
      ft1.rows[0].id,
    ]);

    await expect(insertFicha(2, true)).resolves.toBeDefined();
  });

  it('rejeita duas versões com o mesmo número para o mesmo produto', async () => {
    await insertFicha(1, false);

    await expect(insertFicha(1, false)).rejects.toThrow(/unique constraint/i);
  });

  it('rejeita item com ingredient_id inexistente (FK)', async () => {
    const ft = await insertFicha(1, true);

    await expect(
      client.query(
        `INSERT INTO ficha_tecnica_items (id, ficha_tecnica_id, ingredient_id, quantity, unit, cost_snapshot, line_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), ft.rows[0].id, randomUUID(), '0.16', 'kg', '30.00', '4.80'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('CASCADE: apagar a ficha técnica remove seus itens automaticamente', async () => {
    const ft = await insertFicha(1, true);
    const ftId = ft.rows[0].id;
    await client.query(
      `INSERT INTO ficha_tecnica_items (id, ficha_tecnica_id, ingredient_id, quantity, unit, cost_snapshot, line_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), ftId, ingredientId, '0.16', 'kg', '30.00', '4.80'],
    );

    await client.query(`DELETE FROM fichas_tecnicas WHERE id = $1`, [ftId]);

    const remaining = await client.query(
      `SELECT COUNT(*) FROM ficha_tecnica_items WHERE ficha_tecnica_id = $1`,
      [ftId],
    );
    expect(Number(remaining.rows[0].count)).toBe(0);
  });

  it('RESTRICT: impede apagar um ingrediente referenciado por um item de ficha técnica', async () => {
    const ft = await insertFicha(1, true);
    await client.query(
      `INSERT INTO ficha_tecnica_items (id, ficha_tecnica_id, ingredient_id, quantity, unit, cost_snapshot, line_cost) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), ft.rows[0].id, ingredientId, '0.16', 'kg', '30.00', '4.80'],
    );

    await expect(
      client.query(`DELETE FROM ingredients WHERE id = $1`, [ingredientId]),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('RESTRICT: impede apagar um produto que possui ficha técnica', async () => {
    await insertFicha(1, true);

    await expect(client.query(`DELETE FROM products WHERE id = $1`, [productId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
