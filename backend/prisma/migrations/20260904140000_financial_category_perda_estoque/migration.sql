-- Nova categoria financeira para lançamento automático de perda de
-- estoque (StockLossFinancialListener). Isolada em sua própria
-- migration, sem nenhum uso do valor na mesma transação — mesma regra
-- aprendida na Etapa 16 (PD-55P04): ALTER TYPE ... ADD VALUE não pode
-- ser usado na mesma transação em que o novo valor é referenciado.

-- AlterEnum
ALTER TYPE "FinancialCategory" ADD VALUE 'PERDA_ESTOQUE';
