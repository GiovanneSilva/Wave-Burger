-- Etapa 16: extensao dos enums existentes (pontos de extensao ja
-- planejados nas Etapas 13/14).
ALTER TYPE "MovementSource" ADD VALUE 'SALE';
ALTER TYPE "FinancialCategory" ADD VALUE 'VENDAS';

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit_price_snapshot" DECIMAL(12,2) NOT NULL,
    "gross_amount" DECIMAL(14,4) NOT NULL,
    "discount_type" "DiscountType",
    "discount_value" DECIMAL(12,4),
    "discount_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,4) NOT NULL,
    "sale_date" TIMESTAMP(3) NOT NULL,
    "had_insufficient_stock" BOOLEAN NOT NULL DEFAULT false,
    "sold_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_organization_id_idx" ON "sales"("organization_id");

-- CreateIndex
CREATE INDEX "sales_business_unit_id_idx" ON "sales"("business_unit_id");

-- CreateIndex
CREATE INDEX "sales_product_id_idx" ON "sales"("product_id");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "sales"("sale_date");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_user_id_fkey" FOREIGN KEY ("sold_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddColumn: rastreabilidade de estoque/financeiro ate a venda de origem.
ALTER TABLE "stock_movements" ADD COLUMN "sale_id" UUID;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "financial_entries" ADD COLUMN "sale_id" UUID;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Consistencia: MANUAL_ADJUSTMENT continua exigindo motivo; agora
-- tambem exigimos que SALE sempre referencie a venda de origem (mesmo
-- padrao do CHECK ja existente para PURCHASE).
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_purchase_required_for_purchase_source";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_source_reference_required" CHECK (
    ("source" <> 'PURCHASE' OR "purchase_id" IS NOT NULL) AND
    ("source" <> 'SALE' OR "sale_id" IS NOT NULL)
);
