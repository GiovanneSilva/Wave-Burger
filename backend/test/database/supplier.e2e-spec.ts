import { Client } from 'pg';
import { randomUUID } from 'crypto';

/**
 * Testes estruturais da migration da Etapa 11 (suppliers /
 * supplier_ingredients). O ponto mais importante é o índice único
 * PARCIAL que garante só um fornecedor preferencial por ingrediente
 * (RF-012), mesma técnica usada na Etapa 10 para "versão corrente".
 */
describe('Migration Etapa 11 — Supplier (estrutural)', () => {
  let client: Client;
  let orgId: string;
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
    ingredientId = randomUUID();
    await client.query(`INSERT INTO organizations (id, name, updated_at) VALUES ($1, $2, now())`, [
      orgId,
      'Wave Burger LTDA',
    ]);
    await client.query(
      `INSERT INTO ingredients (id, organization_id, name, standard_unit, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [ingredientId, orgId, 'Carne Bovina', 'kg'],
    );
  });

  afterEach(async () => {
    await client.query(
      'TRUNCATE supplier_ingredients, suppliers, ingredients, organizations CASCADE;',
    );
  });

  async function insertSupplier(name: string) {
    const result = await client.query(
      `INSERT INTO suppliers (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now()) RETURNING id`,
      [randomUUID(), orgId, name],
    );
    return result.rows[0].id;
  }

  it('cria um fornecedor e vincula a um ingrediente', async () => {
    const supplierId = await insertSupplier('Frigorífico A');

    const result = await client.query(
      `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, $4) RETURNING is_preferred`,
      [randomUUID(), supplierId, ingredientId, false],
    );

    expect(result.rows[0].is_preferred).toBe(false);
  });

  it('rejeita dois fornecedores com o mesmo nome na mesma organização', async () => {
    await insertSupplier('Frigorífico A');

    await expect(insertSupplier('Frigorífico A')).rejects.toThrow(/unique constraint/i);
  });

  it('BLOQUEIA dois fornecedores preferenciais para o mesmo ingrediente (índice único parcial, RF-012)', async () => {
    const supplierA = await insertSupplier('Frigorífico A');
    const supplierB = await insertSupplier('Frigorífico B');

    await client.query(
      `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, true)`,
      [randomUUID(), supplierA, ingredientId],
    );

    await expect(
      client.query(
        `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, true)`,
        [randomUUID(), supplierB, ingredientId],
      ),
    ).rejects.toThrow(/duplicate key value/i);
  });

  it('PERMITE múltiplos fornecedores não-preferenciais para o mesmo ingrediente (RF-012)', async () => {
    const supplierA = await insertSupplier('Frigorífico A');
    const supplierB = await insertSupplier('Frigorífico B');

    await client.query(
      `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, false)`,
      [randomUUID(), supplierA, ingredientId],
    );

    await expect(
      client.query(
        `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, false)`,
        [randomUUID(), supplierB, ingredientId],
      ),
    ).resolves.toBeDefined();
  });

  it('rejeita o mesmo par fornecedor+ingrediente duas vezes', async () => {
    const supplierId = await insertSupplier('Frigorífico A');
    await client.query(
      `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, false)`,
      [randomUUID(), supplierId, ingredientId],
    );

    await expect(
      client.query(
        `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, false)`,
        [randomUUID(), supplierId, ingredientId],
      ),
    ).rejects.toThrow(/unique constraint/i);
  });

  it('CASCADE: apagar o fornecedor remove seus vínculos com ingredientes', async () => {
    const supplierId = await insertSupplier('Frigorífico A');
    await client.query(
      `INSERT INTO supplier_ingredients (id, supplier_id, ingredient_id, is_preferred) VALUES ($1, $2, $3, false)`,
      [randomUUID(), supplierId, ingredientId],
    );

    await client.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId]);

    const remaining = await client.query(
      `SELECT COUNT(*) FROM supplier_ingredients WHERE supplier_id = $1`,
      [supplierId],
    );
    expect(Number(remaining.rows[0].count)).toBe(0);
  });

  it('rejeita fornecedor com organization_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO suppliers (id, organization_id, name, updated_at) VALUES ($1, $2, $3, now())`,
        [randomUUID(), randomUUID(), 'Fantasma'],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('inativa (is_active=false) sem excluir o fornecedor', async () => {
    const supplierId = await insertSupplier('Frigorífico A');

    await client.query(`UPDATE suppliers SET is_active = false WHERE id = $1`, [supplierId]);

    const result = await client.query(`SELECT is_active FROM suppliers WHERE id = $1`, [
      supplierId,
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].is_active).toBe(false);
  });
});
