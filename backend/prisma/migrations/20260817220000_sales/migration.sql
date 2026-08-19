-- Etapa 16: extensao dos enums existentes (pontos de extensao ja
-- planejados nas Etapas 13/14).
--
-- IMPORTANTE: o PostgreSQL nao permite usar um valor de enum recem-criado
-- na MESMA transacao em que ele foi adicionado (erro 55P04 "unsafe use
-- of new value"). Como o Prisma aplica cada arquivo migration.sql dentro
-- de uma unica transacao, esses ALTER TYPE precisam estar num arquivo
-- separado do que os utiliza (ver migration seguinte,
-- 20260817220001_sales_tables).
ALTER TYPE "MovementSource" ADD VALUE 'SALE';
ALTER TYPE "FinancialCategory" ADD VALUE 'VENDAS';
