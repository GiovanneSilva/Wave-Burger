-- Integracao iFood — Fase 2 (Order Polling). Precisa saber qual loja
-- (merchant) consultar em segundo plano, sem depender de alguem digitar
-- isso a cada execucao do polling.

-- AlterTable
ALTER TABLE "business_units" ADD COLUMN "ifood_merchant_id" TEXT;
