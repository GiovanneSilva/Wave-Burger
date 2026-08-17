-- CreateTable
CREATE TABLE "fichas_tecnicas" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "ingredients_cost" DECIMAL(12,4) NOT NULL,
    "total_cost" DECIMAL(12,4) NOT NULL,
    "cmv_percentage" DECIMAL(9,4),
    "markup" DECIMAL(10,4),
    "margin_percentage" DECIMAL(9,4),
    "estimated_profit" DECIMAL(12,4),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficha_tecnica_items" (
    "id" UUID NOT NULL,
    "ficha_tecnica_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "loss_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cost_snapshot" DECIMAL(12,4) NOT NULL,
    "line_cost" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "ficha_tecnica_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fichas_tecnicas_product_id_version_key" ON "fichas_tecnicas"("product_id", "version");

-- CreateIndex
CREATE INDEX "fichas_tecnicas_product_id_idx" ON "fichas_tecnicas"("product_id");

-- CreateIndex: apenas uma versao "corrente" por produto (BR-005 / RF-007).
-- Indice parcial: Prisma nao expressa isto na sintaxe estavel do schema,
-- mas o PostgreSQL aplica normalmente.
CREATE UNIQUE INDEX "fichas_tecnicas_product_id_current_key" ON "fichas_tecnicas"("product_id") WHERE "is_current" = true;

-- CreateIndex
CREATE INDEX "ficha_tecnica_items_ficha_tecnica_id_idx" ON "ficha_tecnica_items"("ficha_tecnica_id");

-- CreateIndex
CREATE INDEX "ficha_tecnica_items_ingredient_id_idx" ON "ficha_tecnica_items"("ingredient_id");

-- AddForeignKey
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "fichas_tecnicas_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_items" ADD CONSTRAINT "ficha_tecnica_items_ficha_tecnica_id_fkey" FOREIGN KEY ("ficha_tecnica_id") REFERENCES "fichas_tecnicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_tecnica_items" ADD CONSTRAINT "ficha_tecnica_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
