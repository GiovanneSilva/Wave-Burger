-- =============================================================
-- Wave Burger — RESET COMPLETO DE DADOS (uso ao encerrar os testes)
-- =============================================================
--
-- NÃO usar em produção sem revisar — isso é irreversível.
--
-- Diferente do reset-purchases-and-sales.sql (que só zerava
-- compras/vendas mantendo o catálogo), este script apaga o
-- CATÁLOGO INTEIRO — ingredientes, produtos, fichas técnicas,
-- fornecedores — além de tudo que é transacional.
--
-- O que é APAGADO:
--   - Todas as vendas, compras (e itens), movimentações de estoque,
--     saldo de estoque, lançamentos financeiros
--   - Todos os ingredientes, produtos, fichas técnicas (e seus itens)
--   - Todos os fornecedores (e vínculos fornecedor↔ingrediente)
--
-- O que é PRESERVADO (para você continuar logando e usando o sistema):
--   - Organização, Unidade de negócio
--   - Usuários, Perfis (Roles), Permissões, vínculos usuário↔perfil
--   - Log de auditoria (histórico é mantido por padrão — é
--     justamente o que a Etapa 7 do projeto define como
--     "auditoria serve para segurança e diagnóstico". Se quiser
--     apagar isso também, veja o bloco opcional no final.)

BEGIN;

-- 1. Lançamentos financeiros (referenciam compra/venda)
DELETE FROM financial_entries;

-- 2. Movimentações de estoque — TRUNCATE obrigatório (tabela
--    append-only, gatilho de imutabilidade da Etapa 13 bloqueia DELETE)
TRUNCATE TABLE stock_movements;

-- 3. Saldo de estoque (referencia ingrediente — precisa sair antes)
DELETE FROM stock_balances;

-- 4. Itens de compra, depois compras
DELETE FROM purchase_items;
DELETE FROM purchases;

-- 5. Vendas
DELETE FROM sales;

-- 6. Vínculo fornecedor↔ingrediente, depois fornecedores
DELETE FROM supplier_ingredients;
DELETE FROM suppliers;

-- 7. Itens de ficha técnica, depois fichas técnicas
DELETE FROM ficha_tecnica_items;
DELETE FROM fichas_tecnicas;

-- 8. Produtos
DELETE FROM products;

-- 9. Ingredientes
DELETE FROM ingredients;

COMMIT;

-- ---------------------------------------------------------------
-- OPCIONAL: descomente para também apagar o log de auditoria
-- (histórico de quem criou/alterou o quê). Por padrão, o script
-- preserva isso — não afeta o cadastro de dados novos, e serve como
-- registro do período de testes. Só apague se realmente quiser um
-- histórico 100% limpo.
-- ---------------------------------------------------------------
-- DELETE FROM audit_logs;
