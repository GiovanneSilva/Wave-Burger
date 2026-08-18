import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 13 (stock_balances /
 * stock_movements). O mais importante: o trigger append-only (mesma
 * técnica de audit_logs, Etapa 7) e os CHECK constraints que reforçam
 * RF-017 (motivo obrigatório) e BR-006 (compra obrigatória na entrada).
 */
describe('Migration Etapa 13 — Stock (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let businessUnitId: string;
  let userId: string;
  let ingredientId: string;
  let supplierId: string;
  let purchaseId: string;

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
    ingredientId = randomUUID();
    supplierId = randomUUID();
    purchaseId = randomUUID();

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
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [ingredientId, orgId, 'Carne Bovina', 'kg'],
    );
    await client.query(
      `INSERT INTO suppliers (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
      [supplierId, orgId, 'Frigorífico A'],
    );
    await client.query(
      `INSERT INTO purchases (id, organization_id, business_unit_id, supplier_id, purchase_date, status, total_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, $4, now(), 'CONFIRMED', 150, $5, now())`,
      [purchaseId, orgId, businessUnitId, supplierId, userId],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE stock_movements, stock_balances, purchases, suppliers, ingredients, users, business_units, organizations CASCADE;',
    );
  });

  it('rejeita MANUAL_ADJUSTMENT sem adjustment_reason (RF-017, CHECK constraint)', async () => {
    await expect(
      client.query(
        `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, performed_by_user_id)
         VALUES ($1, $2, $3, 'OUT', 'MANUAL_ADJUSTMENT', 1, 'kg', 1, $4)`,
        [randomUUID(), businessUnitId, ingredientId, userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('rejeita PURCHASE sem purchase_id (BR-006, CHECK constraint)', async () => {
    await expect(
      client.query(
        `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, performed_by_user_id)
         VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4)`,
        [randomUUID(), businessUnitId, ingredientId, userId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it('cria entrada de compra válida com adjustment_reason nulo (permitido para PURCHASE)', async () => {
    const result = await client.query(
      `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, purchase_id, performed_by_user_id)
       VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4, $5) RETURNING adjustment_reason`,
      [randomUUID(), businessUnitId, ingredientId, purchaseId, userId],
    );

    expect(result.rows[0].adjustment_reason).toBeNull();
  });

  it('BLOQUEIA UPDATE em stock_movements (append-only, mesma técnica de audit_logs)', async () => {
    const movId = randomUUID();
    await client.query(
      `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, purchase_id, performed_by_user_id)
       VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4, $5)`,
      [movId, businessUnitId, ingredientId, purchaseId, userId],
    );

    await expect(
      client.query(`UPDATE stock_movements SET quantity = 999 WHERE id = $1`, [movId]),
    ).rejects.toThrow(/append-only/i);
  });

  it('BLOQUEIA DELETE em stock_movements (append-only)', async () => {
    const movId = randomUUID();
    await client.query(
      `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, purchase_id, performed_by_user_id)
       VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4, $5)`,
      [movId, businessUnitId, ingredientId, purchaseId, userId],
    );

    await expect(
      client.query(`DELETE FROM stock_movements WHERE id = $1`, [movId]),
    ).rejects.toThrow(/append-only/i);
  });

  it('rejeita dois saldos para o mesmo par unidade+ingrediente (unique)', async () => {
    await client.query(
      `INSERT INTO stock_balances (id, business_unit_id, ingredient_id, current_quantity, updated_at) VALUES ($1, $2, $3, 5, now())`,
      [randomUUID(), businessUnitId, ingredientId],
    );

    await expect(
      client.query(
        `INSERT INTO stock_balances (id, business_unit_id, ingredient_id, current_quantity, updated_at) VALUES ($1, $2, $3, 10, now())`,
        [randomUUID(), businessUnitId, ingredientId],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('rejeita movimentação com ingredient_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO stock_movements (id, business_unit_id, ingredient_id, direction, source, quantity, unit, quantity_standard_unit, purchase_id, performed_by_user_id)
         VALUES ($1, $2, $3, 'IN', 'PURCHASE', 5, 'kg', 5, $4, $5)`,
        [randomUUID(), businessUnitId, randomUUID(), purchaseId, userId],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });
});
