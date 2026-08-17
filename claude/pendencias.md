# Pendências e decisões em aberto — Wave Burger

Este arquivo rastreia decisões de negócio ainda não fechadas. Nenhuma delas deve ser resolvida unilateralmente durante a implementação — apenas sinalizadas quando um módulo esbarrar nelas.

## Do Documento Mestre (Seção 12)

| ID | Descrição | Módulo impactado |
|----|-----------|-------------------|
| PD-001 | Política para venda sem estoque: bloquear ou apenas sinalizar | Estoque, Vendas |
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
| PD-009 | Não existe "capítulo de integração iFood" no Documento Mestre v0.1, apesar de citado no guia de implementação (Etapa 20). Precisa ser produzido/validado antes da Etapa 20. | Integração iFood |
| PD-010 | Não há RF formal para o módulo de Venda/Pedido manual (campos, fluxo de desconto, etc.) — só aparece como efeito colateral no Modelo de Domínio e em UC-004/UC-005. Confirmar escopo com o usuário antes da Etapa 16. | Vendas |
| PD-011 | Não há regra definida de conversão de unidades entre compra (ex.: kg, caixa), cadastro do ingrediente (unidade padrão) e ficha técnica (quantidade usada). | Ingredientes, Compras, Ficha Técnica |

## Como usar este arquivo

Ao chegar em uma etapa de implementação que dependa de um item acima, o agente deve parar, sinalizar a pendência específica e aguardar decisão do usuário antes de prosseguir — nunca inventar um comportamento temporário que viole a regra de negócio associada.

Quando uma pendência for resolvida, mover a linha para a tabela "Resolvidas" abaixo, com a data e a decisão tomada, e sinalizar a atualização correspondente no Documento Mestre.

## Resolvidas

_(nenhuma até o momento)_
