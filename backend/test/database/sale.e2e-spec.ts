import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 16 (sales + extensões dos
 * enums MovementSource/FinancialCategory). O mais importante: o CHECK
 * constraint atualizado que agora também exige sale_id quando
 * source='SALE' (mesma técnica já usada para PURCHASE desde a Etapa 13).
 */
describe('Migration Etapa 16 — Sale (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let businessUnitId: string;
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
    businessUnitId = randomUUID();
    userId = randomUUID();
    productId = randomUUID();
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
      `INSERT INTO products (id, organization_id, name, sale_price, status, updated_at) VALUES ($1, $2, $3, $4, 'ACTIVE', now())`,
      [productId, orgId, 'Smash Burger', '28.90'],
    );
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [ingredientId, orgId, 'Carne Bovina', 'kg'],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE financial_entries, stock_movements, sales, products, ingredients, users, business_units, organizations CASCADE;',
    );
  });

  async function insertSale() {
    const result = await client.query(
      `INSERT INTO sales (id, organization_id, business_unit_id, product_id, quantity, unit_price_snapshot, gross_amount, net_amount, sale_date, sold_by_user_id)
       VALUES ($1, $2, $3, $4, 2, 28.90, 57.80, 57.80, now(), $5) RETURNING id`,
      [randomUUID(), orgId, businessUnitId, productId, userId],
    );
    return result.rows[0].id;
  }

  it('cria uma venda com sucesso', async () => {
    const saleId = await insertSale();
    expect(saleId).toBeDefined();
  });

  it('BLOQUEIA movimentação de estoque source=SALE sem sale_id (CHECK constraint)', async () => {
    await expect(
      client.query(
        `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, performed_by_user_id)
         VALUES ($1, $2, $3, 'OUT', 'SALE', 0.16, 'kg', 0.16, $4)`,
        [randomUUID(), businessUnitId, ingredientId, userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('BLOQUEIA movimentação source=PURCHASE sem purchase_id (constraint consolidado ainda vale)', async () => {
    await expect(
      client.query(
        `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, performed_by_user_id)
         VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4)`,
        [randomUUID(), businessUnitId, ingredientId, userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('PERMITE movimentação SALE com sale_id, mesmo levando o saldo a negativo (PD-001)', async () => {
    const saleId = await insertSale();

    const result = await client.query(
      `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, sale_id, performed_by_user_id)
       VALUES ($1, $2, $3, 'OUT', 'SALE', 0.32, 'kg', 0.32, $4, $5) RETURNING id`,
      [randomUUID(), businessUnitId, ingredientId, saleId, userId],
    );

    expect(result.rows).toHaveLength(1);
  });

  it('cria lançamento financeiro categoria VENDAS vinculado a uma venda', async () => {
    const saleId = await insertSale();

    const result = await client.query(
      `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, sale_id, gross_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, 'RECEIVABLE', 'VENDAS', 'Venda registrada', $4, 57.80, $5, now()) RETURNING category`,
      [randomUUID(), orgId, businessUnitId, saleId, userId],
    );

    expect(result.rows[0].category).toBe('VENDAS');
  });

  it('rejeita venda com product_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO sales (id, organization_id, business_unit_id, product_id, quantity, unit_price_snapshot, gross_amount, net_amount, sale_date, sold_by_user_id)
         VALUES ($1, $2, $3, $4, 1, 28.90, 28.90, 28.90, now(), $5)`,
        [randomUUID(), orgId, businessUnitId, randomUUID(), userId],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('RESTRICT: impede apagar um produto referenciado por uma venda', async () => {
    await insertSale();

    await expect(client.query(`DELETE FROM products WHERE id = $1`, [productId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });

  it('discount_type/discount_value são opcionais (venda sem desconto)', async () => {
    const result = await client.query(
      `INSERT INTO sales (id, organization_id, business_unit_id, product_id, quantity, unit_price_snapshot, gross_amount, net_amount, sale_date, sold_by_user_id)
       VALUES ($1, $2, $3, $4, 1, 28.90, 28.90, 28.90, now(), $5) RETURNING discount_type, discount_amount`,
      [randomUUID(), orgId, businessUnitId, productId, userId],
    );

    expect(result.rows[0].discount_type).toBeNull();
    expect(result.rows[0].discount_amount).toBe('0.0000');
  });
});
