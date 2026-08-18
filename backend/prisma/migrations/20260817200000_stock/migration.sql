-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MovementSource" AS ENUM ('PURCHASE', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('LOSS', 'WASTE', 'INVENTORY', 'CORRECTION', 'RETURN');

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "current_quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "source" "MovementSource" NOT NULL,
    "adjustment_reason" "AdjustmentReason",
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity_standard_unit" DECIMAL(14,4) NOT NULL,
    "purchase_id" UUID,
    "performed_by_user_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    -- RF-017: "motivo será obrigatório" para ajuste manual.
    CONSTRAINT "stock_movements_reason_required_for_adjustment" CHECK (
        "source" <> 'MANUAL_ADJUSTMENT' OR "adjustment_reason" IS NOT NULL
    ),
    -- BR-006: toda entrada de compra deve referenciar a compra de origem.
    CONSTRAINT "stock_movements_purchase_required_for_purchase_source" CHECK (
        "source" <> 'PURCHASE' OR "purchase_id" IS NOT NULL
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_business_unit_id_ingredient_id_key" ON "stock_balances"("business_unit_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "stock_balances_business_unit_id_idx" ON "stock_balances"("business_unit_id");

-- CreateIndex
CREATE INDEX "stock_balances_ingredient_id_idx" ON "stock_balances"("ingredient_id");

-- CreateIndex
CREATE INDEX "stock_movements_business_unit_id_idx" ON "stock_movements"("business_unit_id");

-- CreateIndex
CREATE INDEX "stock_movements_ingredient_id_idx" ON "stock_movements"("ingredient_id");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_user_id_fkey" FOREIGN KEY ("performed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enforce append-only at the database level (claude/CLAUDE.md, Secao 6:
-- "movimentacoes de estoque nao permitem UPDATE/DELETE de registros ja
-- confirmados"). Mesma tecnica de audit_logs (Etapa 7).

CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements e append-only: UPDATE/DELETE nao sao permitidos (claude/CLAUDE.md, Secao 6).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_prevent_update
BEFORE UPDATE ON "stock_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_stock_movement_mutation();

CREATE TRIGGER stock_movements_prevent_delete
BEFORE DELETE ON "stock_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_stock_movement_mutation();
