# Pendências e decisões em aberto — Wave Burger

Este arquivo rastreia decisões de negócio ainda não fechadas. Nenhuma delas deve ser resolvida unilateralmente durante a implementação — apenas sinalizadas quando um módulo esbarrar nelas.

## Do Documento Mestre (Seção 12)

| ID | Descrição | Módulo impactado |
|----|-----------|-------------------|
| PD-002 | Metodologia definitiva de custo médio e tratamento de variações | Ingredientes, Compras |
| PD-003 | Como custos indiretos (energia, gás, mão de obra) entram na ficha técnica | Ficha Técnica |
| PD-004 | Quando e como ocorre a integração automática com iFood | Integração iFood |
| PD-005 | Papel exato de planilhas (Excel/Sheets) vs. banco de dados na fase inicial | Operação geral |
| PD-006 | Regime e regras tributárias | Financeiro |
| PD-007 | Política de promoções: limites de margem, aprovação, comportamento | Produtos, Financeiro |
| PD-008 | Canais e responsáveis pelos diferentes alertas/notificações | BI, Estoque |

## Identificadas durante a leitura inicial (Etapa 1), fora da lista formal do Documento Mestre

| ID | Descrição | Módulo impactado |
|----|-----------|-------------------|
| PD-009 | Não existe "capítulo de integração iFood" no Documento Mestre v0.1, apesar de citado no guia de implementação (Etapa 20). **Parcialmente endereçada em 23/08/2026**: pesquisa completa sobre a Merchant-API do iFood (módulos, autenticação, catálogo, pedidos, financeiro, homologação) documentada em `claude/ifood-integration-plan.md`. Ainda em aberto: as decisões de negócio da Seção 9 desse documento (modelo de autenticação, webhook vs polling, modelo de venda com múltiplos itens, fonte da verdade financeira, ordem de implementação) — nenhuma foi confirmada pelo usuário ainda, então nenhum código de integração deve ser escrito. | Integração iFood |
| PD-011 | Não há regra definida de conversão de unidades entre compra (ex.: kg, caixa), cadastro do ingrediente (unidade padrão) e ficha técnica (quantidade usada). | Ingredientes, Compras, Ficha Técnica |
| PD-012 | Inconsistência descoberta em 23/08/2026 ao implementar "quantidade entregável" no Dashboard: o custo da ficha técnica (RF-004) infla a quantidade por `lossPercentage` (perda estimada), mas a baixa de estoque real na venda (RF-016/BR-009, Etapa 16) NÃO aplica esse mesmo ajuste — o sistema pode estar subestimando o consumo real de estoque a cada venda quando o produto tem perda estimada configurada. Precisa decisão: aplicar `lossPercentage` também na baixa de estoque, ou manter como está e documentar que `lossPercentage` afeta só o custo exibido, não o controle físico de estoque. | Vendas, Estoque, Ficha Técnica |

## Como usar este arquivo

Ao chegar em uma etapa de implementação que dependa de um item acima, o agente deve parar, sinalizar a pendência específica e aguardar decisão do usuário antes de prosseguir — nunca inventar um comportamento temporário que viole a regra de negócio associada.

Quando uma pendência for resolvida, mover a linha para a tabela "Resolvidas" abaixo, com a data e a decisão tomada, e sinalizar a atualização correspondente no Documento Mestre.

## Resolvidas

| ID | Descrição | Decisão | Data |
|----|-----------|---------|------|
| PD-001 | Política para venda sem estoque: bloquear ou apenas sinalizar | **Permitir e sinalizar.** A venda nunca é bloqueada por falta de estoque — o consumo é aplicado mesmo que o saldo fique negativo, e a venda registra `hadInsufficientStock=true` + lista de ingredientes afetados (`stockWarnings`) na resposta da API e no log de auditoria. Implementado em `StockService.applyMovement` via parâmetro `allowNegative`, usado apenas por Vendas — Compras e ajustes manuais continuam bloqueando saldo negativo (BR-010 inalterado para esses casos). | 2026-08-17 (Etapa 16) |
| PD-010 | Não há RF formal para o módulo de Venda/Pedido manual (campos, fluxo de desconto, etc.) | Escopo confirmado com o usuário antes da Etapa 16: (1) uma venda representa um único produto (produto + quantidade + preço + data) — não um pedido com múltiplos itens; (2) desconto simples incluído (tipo percentual ou fixo + valor). Modelo `Sale` implementado com esse escopo. Pedidos com múltiplos itens/carrinho ficam para evolução futura, se solicitado. | 2026-08-17 (Etapa 16) |
