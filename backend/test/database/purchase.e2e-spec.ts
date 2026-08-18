import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 12 (purchases / purchase_items).
 */
describe('Migration Etapa 12 — Purchase (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let businessUnitId: string;
  let userId: string;
  let supplierId: string;
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
    businessUnitId = randomUUID();
    userId = randomUUID();
    supplierId = randomUUID();
    ingredientId = randomUUID();

    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO business_units (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [businessUnitId, orgId, 'Unidade Principal'],
    );
    await client.query(
      `INSERT INTO users (id, organization_id, name, email, password_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [userId, orgId, 'Admin', `admin-${userId}@waveburger.dev`, 'hash'],
    );
    await client.query(
      `INSERT INTO suppliers (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [supplierId, orgId, 'Frigorífico A'],
    );
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [ingredientId, orgId, 'Carne Bovina', 'kg'],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE purchase_items, purchases, ingredients, suppliers, users, business_units, organizations CASCADE;',
    );
  });

  async function insertPurchase(status: string) {
    const result = await client.query(
      `INSERT INTO purchases (id, organization_id, business_unit_id, supplier_id, purchase_date, status, total_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, $4, now(), $5, $6, $7, now()) RETURNING id`,
      [randomUUID(), orgId, businessUnitId, supplierId, status, '150.0000', userId],
    );
    return result.rows[0].id;
  }

  it('cria uma compra DRAFT com item e total correto', async () => {
    const purchaseId = await insertPurchase('DRAFT');
    const item = await client.query(
      `INSERT INTO purchase_items (id, purchase_id, ingredient_id, quantity, unit, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING total_price`,
      [randomUUID(), purchaseId, ingredientId, '5.0000', 'kg', '30.0000', '150.0000'],
    );

    expect(item.rows[0].total_price).toBe('150.0000');
  });

  it('rejeita status fora do enum PurchaseStatus', async () => {
    await expect(
      client.query(
        `INSERT INTO purchases (id, organization_id, business_unit_id, supplier_id, purchase_date, status, total_amount, created_by_user_id, updated_at) VALUES ($1, $2, $3, $4, now(), $5, $6, $7, now())`,
        [randomUUID(), orgId, businessUnitId, supplierId, 'PENDING', '0', userId],
      ),
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('transita DRAFT -> CONFIRMED com confirmed_by_user_id e confirmed_at preenchidos', async () => {
    const purchaseId = await insertPurchase('DRAFT');

    await client.query(
      `UPDATE purchases SET status = 'CONFIRMED', confirmed_by_user_id = $1, confirmed_at = now() WHERE id = $2`,
      [userId, purchaseId],
    );

    const result = await client.query(
      `SELECT status, confirmed_by_user_id, confirmed_at FROM purchases WHERE id = $1`,
      [purchaseId],
    );
    expect(result.rows[0].status).toBe('CONFIRMED');
    expect(result.rows[0].confirmed_by_user_id).toBe(userId);
    expect(result.rows[0].confirmed_at).not.toBeNull();
  });

  it('rejeita item com ingredient_id inexistente (FK)', async () => {
    const purchaseId = await insertPurchase('DRAFT');

    await expect(
      client.query(
        `INSERT INTO purchase_items (id, purchase_id, ingredient_id, quantity, unit, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), purchaseId, randomUUID(), '5', 'kg', '30', '150'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('CASCADE: apagar a compra remove seus itens', async () => {
    const purchaseId = await insertPurchase('DRAFT');
    await client.query(
      `INSERT INTO purchase_items (id, purchase_id, ingredient_id, quantity, unit, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), purchaseId, ingredientId, '5', 'kg', '30', '150'],
    );

    await client.query(`DELETE FROM purchases WHERE id = $1`, [purchaseId]);

    const remaining = await client.query(
      `SELECT COUNT(*) FROM purchase_items WHERE purchase_id = $1`,
      [purchaseId],
    );
    expect(Number(remaining.rows[0].count)).toBe(0);
  });

  it('RESTRICT: impede apagar um ingrediente referenciado por um item de compra', async () => {
    const purchaseId = await insertPurchase('DRAFT');
    await client.query(
      `INSERT INTO purchase_items (id, purchase_id, ingredient_id, quantity, unit, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), purchaseId, ingredientId, '5', 'kg', '30', '150'],
    );

    await expect(client.query(`DELETE FROM ingredients WHERE id = $1`, [ingredientId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });

  it('RESTRICT: impede apagar um fornecedor referenciado por uma compra', async () => {
    await insertPurchase('DRAFT');

    await expect(client.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });

  it('rejeita compra com business_unit_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO purchases (id, organization_id, business_unit_id, supplier_id, purchase_date, status, total_amount, created_by_user_id, updated_at) VALUES ($1, $2, $3, $4, now(), $5, $6, $7, now())`,
        [randomUUID(), orgId, randomUUID(), supplierId, 'DRAFT', '0', userId],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });
});
