-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "payment_terms" TEXT,
    "average_delivery_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ingredients" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_name_key" ON "suppliers"("organization_id", "name");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_ingredients_supplier_id_ingredient_id_key" ON "supplier_ingredients"("supplier_id", "ingredient_id");

-- CreateIndex
CREATE INDEX "supplier_ingredients_supplier_id_idx" ON "supplier_ingredients"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_ingredients_ingredient_id_idx" ON "supplier_ingredients"("ingredient_id");

-- CreateIndex: apenas um fornecedor "preferencial" por ingrediente (RF-012).
-- Indice parcial: mesma tecnica usada em fichas_tecnicas (Etapa 10).
CREATE UNIQUE INDEX "supplier_ingredients_ingredient_id_preferred_key" ON "supplier_ingredients"("ingredient_id") WHERE "is_preferred" = true;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
