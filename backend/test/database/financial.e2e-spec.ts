import { Client } from 'pg';
import { randomUUID } from 'crypto';

describe('Migration Etapa 14 — FinancialEntry (estrutural)', () => {
  let client: Client;
  let orgId: string;
  let businessUnitId: string;
  let userId: string;
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
      'TRUNCATE financial_entries, purchases, suppliers, users, business_units, organizations CASCADE;',
    );
  });

  it('cria um lançamento PAYABLE com status default PENDING', async () => {
    const result = await client.query(
      `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, gross_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, 'PAYABLE', 'MATERIA_PRIMA', 'Compra de carne', 150, $4, now()) RETURNING status`,
      [randomUUID(), orgId, businessUnitId, userId],
    );

    expect(result.rows[0].status).toBe('PENDING');
  });

  it('rejeita categoria fora do enum FinancialCategory (RF-023)', async () => {
    await expect(
      client.query(
        `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, gross_amount, created_by_user_id, updated_at)
         VALUES ($1, $2, $3, 'PAYABLE', 'IMPOSTOS', 'x', 1, $4, now())`,
        [randomUUID(), orgId, businessUnitId, userId],
      ),
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('rejeita status fora do enum FinancialEntryStatus', async () => {
    await expect(
      client.query(
        `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, gross_amount, status, created_by_user_id, updated_at)
         VALUES ($1, $2, $3, 'PAYABLE', 'ALUGUEL', 'x', 1, 'APPROVED', $4, now())`,
        [randomUUID(), orgId, businessUnitId, userId],
      ),
    ).rejects.toThrow(/invalid input value for enum/i);
  });

  it('vincula um lançamento a uma compra (BR-007)', async () => {
    const result = await client.query(
      `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, supplier_id, purchase_id, gross_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, 'PAYABLE', 'MATERIA_PRIMA', 'Compra confirmada', $4, $5, 150, $6, now()) RETURNING purchase_id`,
      [randomUUID(), orgId, businessUnitId, supplierId, purchaseId, userId],
    );

    expect(result.rows[0].purchase_id).toBe(purchaseId);
  });

  it('permite editar (UPDATE) um lançamento — NÃO é append-only, diferente de audit_logs/stock_movements', async () => {
    const id = randomUUID();
    await client.query(
      `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, gross_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, 'PAYABLE', 'ALUGUEL', 'Aluguel', 2000, $4, now())`,
      [id, orgId, businessUnitId, userId],
    );

    await expect(
      client.query(`UPDATE financial_entries SET status = 'PAID', settled_at = now() WHERE id = $1`, [
        id,
      ]),
    ).resolves.toBeDefined();

    const result = await client.query(`SELECT status FROM financial_entries WHERE id = $1`, [id]);
    expect(result.rows[0].status).toBe('PAID');
  });

  it('rejeita lançamento com business_unit_id inexistente (FK)', async () => {
    await expect(
      client.query(
        `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, gross_amount, created_by_user_id, updated_at)
         VALUES ($1, $2, $3, 'PAYABLE', 'ALUGUEL', 'x', 1, $4, now())`,
        [randomUUID(), orgId, randomUUID(), userId],
      ),
    ).rejects.toThrow(/foreign key constraint/i);
  });

  it('RESTRICT: impede apagar um fornecedor referenciado por um lançamento', async () => {
    await client.query(
      `INSERT INTO financial_entries (id, organization_id, business_unit_id, type, category, description, supplier_id, gross_amount, created_by_user_id, updated_at)
       VALUES ($1, $2, $3, 'PAYABLE', 'MATERIA_PRIMA', 'x', $4, 1, $5, now())`,
      [randomUUID(), orgId, businessUnitId, supplierId, userId],
    );

    await expect(client.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId])).rejects.toThrow(
      /foreign key constraint/i,
    );
  });
});
