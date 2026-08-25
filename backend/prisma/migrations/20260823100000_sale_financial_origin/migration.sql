-- Integracao iFood (planejamento, claude/ifood-integration-plan.md):
-- fundacao de schema para Fase 1/2 - distinguir venda/lancamento
-- MANUAL de IFOOD, e agrupar multiplas Sale de um mesmo pedido do
-- iFood via external_order_id.
--
-- CREATE TYPE + uso imediato no mesmo arquivo e seguro aqui (diferente
-- do problema da Etapa 16/PD-55P04): aquele problema era especifico de
-- ALTER TYPE ... ADD VALUE em enum JA EXISTENTE. Aqui o enum e novo.

-- CreateEnum
CREATE TYPE "SaleOrigin" AS ENUM ('MANUAL', 'IFOOD');

-- AlterTable: sales
ALTER TABLE "sales" ADD COLUMN "origin" "SaleOrigin" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "sales" ADD COLUMN "external_order_id" TEXT;

-- CreateIndex
CREATE INDEX "sales_external_order_id_idx" ON "sales"("external_order_id");

-- AlterTable: financial_entries
ALTER TABLE "financial_entries" ADD COLUMN "origin" "SaleOrigin" NOT NULL DEFAULT 'MANUAL';
