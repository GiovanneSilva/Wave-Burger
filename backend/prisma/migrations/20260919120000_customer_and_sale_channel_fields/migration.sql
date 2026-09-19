-- Pedidos por fora do iFood (claude/pedidos-externos-plan.md): novo
-- modelo Customer + campos opcionais em Sale para capturar canal de
-- venda, metodo de pagamento, codigo de campanha e observacoes.
--
-- CREATE TYPE + uso imediato no mesmo arquivo e seguro aqui (enums
-- novos, nao ALTER TYPE ADD VALUE em enum existente).

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'TELEFONE', 'PRESENCIAL', 'SITE_PROPRIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'VALE_REFEICAO', 'OUTRO');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "neighborhood" TEXT,
    "postal_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- NULLs nao conflitam entre si em index unico no Postgres, por padrao
-- - varios clientes sem telefone informado (organization_id, NULL)
-- convivem sem violar essa constraint. E exatamente o comportamento
-- que precisamos (telefone opcional).
CREATE UNIQUE INDEX "customers_organization_id_phone_key" ON "customers"("organization_id", "phone");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: sales
ALTER TABLE "sales" ADD COLUMN "customer_id" UUID;
ALTER TABLE "sales" ADD COLUMN "sales_channel" "SalesChannel";
ALTER TABLE "sales" ADD COLUMN "payment_method" "PaymentMethod";
ALTER TABLE "sales" ADD COLUMN "marketing_campaign_code" TEXT;
ALTER TABLE "sales" ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
