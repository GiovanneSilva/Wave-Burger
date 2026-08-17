-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "internal_code" TEXT,
    "category" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "sale_price" DECIMAL(12,2),
    "promotional_price" DECIMAL(12,2),
    "promotional_period_start" TIMESTAMP(3),
    "promotional_period_end" TIMESTAMP(3),
    "final_weight" DECIMAL(10,3),
    "average_prep_time_minutes" INTEGER,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_name_key" ON "products"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_internal_code_key" ON "products"("organization_id", "internal_code");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
