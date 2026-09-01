-- Integracao iFood — fluxo de autorizacao Distribuido (correcao da
-- Fase 0/1: o app registrado no Portal Developer usa o fluxo com
-- /oauth/userCode + authorizationCode, nao client_credentials como
-- assumido inicialmente). refresh_token precisa ser persistido, nao
-- so cacheado em memoria.

-- CreateTable
CREATE TABLE "ifood_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ifood_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ifood_credentials_organization_id_key" ON "ifood_credentials"("organization_id");

-- AddForeignKey
ALTER TABLE "ifood_credentials" ADD CONSTRAINT "ifood_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
