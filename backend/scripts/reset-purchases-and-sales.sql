-- =============================================================
-- Wave Burger — zera dados de COMPRAS e VENDAS (uso em dev/teste)
-- =============================================================
--
-- NÃO usar em produção sem revisar — isso é irreversível.
--
-- O que é ZERADO:
--   - Todas as compras (purchases, purchase_items)
--   - Todas as vendas (sales)
--   - Lançamentos financeiros GERADOS por compra/venda (mantém
--     lançamentos manuais, como "Aluguel de agosto" — FinancialEntry
--     não é append-only, então dá pra ser seletivo aqui)
--   - TODAS as movimentações de estoque (stock_movements) — inclusive
--     ajustes manuais de perda/desperdício/etc. Isso é inevitável:
--     stock_movements tem um gatilho no Postgres que bloqueia
--     UPDATE/DELETE linha a linha (imutabilidade proposital, Etapa 13);
--     só TRUNCATE consegue limpar essa tabela, e TRUNCATE não permite
--     filtrar por origem (PURCHASE/SALE/MANUAL_ADJUSTMENT).
--   - Saldo de estoque de todos os ingredientes volta a 0 (não faria
--     sentido manter saldo positivo sem nenhum histórico de
--     movimentação que o justifique).
--
-- O que é PRESERVADO:
--   - Ingredientes, Produtos, Fichas Técnicas, Fornecedores, Usuários,
--     vínculos Fornecedor↔Ingrediente, Organização/Unidade de negócio.
--   - `Ingredient.averageCost` / `lastCost` / `lastPurchaseDate` NÃO são
--     resetados — continuam com o último valor que a compra apagada
--     tinha calculado. Se quiser zerar isso também, veja o bloco
--     comentado no final do arquivo.

BEGIN;

-- 1. Lançamentos financeiros originados de compra ou venda
DELETE FROM financial_entries
WHERE purchase_id IS NOT NULL OR sale_id IS NOT NULL;

-- 2. Movimentações de estoque — TRUNCATE é obrigatório (tabela append-only)
TRUNCATE TABLE stock_movements;

-- 3. Zera o saldo de estoque de todos os ingredientes
UPDATE stock_balances SET current_quantity = 0;

-- 4. Itens de compra, depois as compras em si
DELETE FROM purchase_items;
DELETE FROM purchases;

-- 5. Vendas
DELETE FROM sales;

COMMIT;

-- ---------------------------------------------------------------
-- OPCIONAL: descomente para também zerar o custo médio/último custo
-- dos ingredientes (volta ao estado de "recém-cadastrado", sem
-- histórico de compra nenhuma). Rode separadamente, fora da transação
-- acima, só se quiser mesmo esse reset mais agressivo.
-- ---------------------------------------------------------------
-- UPDATE ingredients
-- SET average_cost = NULL, last_cost = NULL, last_purchase_date = NULL;
