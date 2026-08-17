-- CreateTable
CREATE TABLE "ingredients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "standard_unit" TEXT NOT NULL,
    "storage_location" TEXT,
    "minimum_stock" DECIMAL(12,3),
    "average_cost" DECIMAL(12,4),
    "last_cost" DECIMAL(12,4),
    "last_purchase_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_organization_id_name_key" ON "ingredients"("organization_id", "name");

-- CreateIndex
CREATE INDEX "ingredients_organization_id_idx" ON "ingredients"("organization_id");

-- AddForeignKey
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
