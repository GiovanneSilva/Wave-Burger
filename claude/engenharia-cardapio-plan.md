# Wave Burger — Plano: Tela "Engenharia de Cardápio"

> Documento de planejamento (19/09/2026), a partir da pesquisa sobre estratégia de precificação apresentada na conversa. Nenhum código foi escrito ainda — este é o plano.

---

## 1. O que essa tela cobre, dos pontos que trouxe na pesquisa

| Ponto da pesquisa | Como vira funcionalidade na tela |
|---|---|
| Matriz de Kasavana & Smith (Estrela/Cavalo de Carga/Enigma/Cão) | Classificação automática de cada produto ativo, cruzando popularidade (vendas no período) × margem de contribuição (com custo **atual**, não o congelado) |
| Threshold de 10% pra decidir quando agir | Lista separada de produtos com **deriva de custo** acima de um limite configurável (padrão 10%) — usa o mecanismo `costDrifted` que já existe (aba Custos do produto), só que agregado pra todo o cardápio numa tela só |
| Revisão periódica, não reativa | A tela é uma ferramenta de consulta sob demanda — você olha quando quiser (ex.: na sua rotina mensal), o sistema não te interrompe |
| Segmentar o aumento, não % igual pra tudo | A matriz já naturalmente aponta *quais* produtos merecem atenção — os "Cavalos de Carga", não o cardápio inteiro |
| Preço diferente por canal (iFood vs direto) | **Limitação honesta**: ainda não dá pra mostrar a margem líquida real pós-comissão do iFood — isso depende da Fase 4 da integração iFood (Financeiro/Settlement), que está pausada aguardando a homologação financeira. A tela mostra a mesma margem bruta pra todos os canais por enquanto, com uma nota visível sobre essa limitação |

---

## 2. O que já existe e pode ser reaproveitado

`AnalyticsService.getMostProfitableProducts` já calcula, por produto ativo, a margem e o lucro estimado usando o **custo atual** dos ingredientes (não o congelado da versão da ficha técnica) — é literalmente metade do trabalho da matriz já pronta. Falta só:
1. Juntar a contagem de vendas no período (popularidade)
2. Calcular a média de popularidade e de margem entre todos os produtos (a matriz é relativa ao seu próprio cardápio, não um número fixo da indústria)
3. Classificar cada produto num dos 4 quadrantes
4. Trazer também o `costDrifted` (que `getCurrentCostSummary` já devolve) pra alimentar a segunda parte da tela

---

## 3. Modelo de cálculo proposto

Para cada produto ativo, no período selecionado (padrão: últimos 30 dias):

```
popularidade      = quantidade de vendas do produto no período
margemContribuição = preço de venda − custo atual (com preço de ingrediente de hoje)

médiaPopularidade  = média da popularidade entre todos os produtos ativos
médiaMargem        = média da margemContribuição entre todos os produtos ativos

categoria:
  Estrela        → popularidade ≥ média E margem ≥ média
  Cavalo de Carga → popularidade ≥ média E margem <  média   (candidato principal a reprecificar)
  Enigma         → popularidade <  média E margem ≥ média   (reposicionar no cardápio, não repreçar)
  Cão            → popularidade <  média E margem <  média   (candidato a remover/reformular)
```

Separadamente, **deriva de custo** por produto: diferença entre o custo congelado da versão atual da ficha técnica e o custo recalculado com preços de hoje — sinalizado quando ultrapassar o limite (padrão 10%, ajustável na tela).

---

## 4. Telas propostas

### Tela principal: `/menu-engineering`

- **Filtro de período** (7/30/60/90 dias, ou intervalo customizado) — define a janela usada pra calcular popularidade
- **Bloco 1 — Matriz**: tabela agrupada pelos 4 quadrantes (Estrela, Cavalo de Carga, Enigma, Cão), cada produto com popularidade, margem de contribuição, e uma ação sugerida por categoria (ex.: Cavalo de Carga → "considerar reprecificar")
- **Bloco 2 — Deriva de custo**: lista separada de produtos cujo custo já mudou mais que o limite configurado desde a última versão da ficha técnica, com o link direto pra criar uma nova versão
- **Nota de limitação**: aviso fixo sobre a análise por canal ainda não considerar a comissão real do iFood

---

## 5. Perguntas antes de eu começar a codar

1. **Período padrão de popularidade**: 30 dias parece razoável — concorda, ou prefere outro?
2. **Limite de deriva de custo padrão**: 10% (o número que a pesquisa indicou) — concorda?
3. **Onde entra na barra lateral**: como item próprio ("Engenharia de Cardápio"), ou dentro de "BI/Indicadores" já existente?
4. **Formato visual da matriz**: tabela agrupada por quadrante (mais simples, mais fácil de agir) ou também um gráfico de dispersão visual (mais trabalho, sem biblioteca de gráfico ainda no projeto)?
