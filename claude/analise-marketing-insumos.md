# Wave Burger — Insumos para a Tela de Análise de Marketing

> Documento de referência (19/09/2026), guardado para planejar futuramente uma "tela de análise de marketing". Combina o conteúdo de um documento de pesquisa enviado pelo usuário (`claude/reference-docs/estrategias-vendas-precificacao-anuncios.docx`) com pesquisa complementar feita especificamente sobre o iFood (o canal principal do Wave Burger) e sobre testes de preço/oferta com pouco tráfego (a realidade prática do Wave Burger, diferente dos exemplos do documento original, que assumem escala de rede grande). **Isso não é um plano de implementação ainda** — é material salvo para quando decidirmos planejar essa tela.

---

## 1. Resumo do documento enviado

O documento (denso, ~1300 linhas, bem referenciado com estudos acadêmicos e casos reais) cobre seis técnicas de precificação em anúncios, cada uma com mecanismo, melhor uso e risco principal:

| Técnica | Mecanismo | Melhor uso | Risco principal |
|---|---|---|---|
| Preço psicológico (R$X,99) | Efeito do dígito à esquerda | Varejo, produtos comparáveis | Sacrificar margem sem efeito |
| Ancoragem ("De R$X por R$Y") | Preço de referência | Quando existe referência legítima | Âncora artificial/enganosa |
| Desconto | Redução do sacrifício percebido | Ativação, liquidação | Erosão de margem — um desconto de 20% sobre um produto com margem de 40% reduz a contribuição unitária em 50%, não 20% |
| Bundle/combo | Comparação soma vs. conjunto | Cross-sell, fast food | Canibalização |
| Preço dinâmico | Adaptação a demanda/horário | Alta elasticidade | Percepção de injustiça — ver o caso Wendy's abaixo |
| Menu engineering | Popularidade × margem de contribuição | Fast food | — |

**Pontos que mais se conectam com o Wave Burger:**

- **O caso Wendy's (2024)**: comentários do CEO sobre "dynamic pricing" foram interpretados como possibilidade de cobrar mais em horário de pico — reação pública forte o suficiente pra empresa esclarecer publicamente que não faria isso. Lição: desconto em horário de baixo movimento é seguro; cobrar mais em horário de pico é arriscado, mesmo que economicamente equivalente.
- **Recomendação central do documento**: testar preço em função de lucro incremental, não conversão pura — métrica primária sugerida é margem de contribuição por visita/clique, não ROAS de faturamento bruto (que pode mostrar um "vencedor falso": promoção eleva receita atribuída enquanto destrói margem).
- **Menu engineering** é a mesma matriz (Estrela/Cavalo de Carga/Enigma/Cão) que já implementamos na tela "Engenharia de Cardápio" — o documento reforça a mesma lógica com uma nuance: um item com CMV % alto não é necessariamente ruim se gera contribuição absoluta elevada.
- **Compliance no Brasil**: o CDC exige que preço comparativo ("de/por") seja verdadeiro e comprovável — nunca fabricar uma âncora fictícia. O Decreto 5903/2006 proíbe anunciar parcela ("12x de R$29,90") sem mostrar o total, exigindo que o consumidor calcule sozinho. O CDC também proíbe venda casada — bundle e upsell precisam ser genuinamente opcionais, nunca condição obrigatória.
- **Framework de decisão proposto**: primeiro define o preço que maximiza contribuição econômica; só depois decide a forma de apresentação (arredondado, âncora, desconto, bundle); depois testa em quais segmentos/canais/horários o efeito se mantém; só então considera automatizar.

---

## 2. Complemento: ferramentas reais do iFood (não cobertas no documento original)

O documento cobre Google Ads, Meta e Mercado Livre em profundidade, mas nada específico do iFood — que é o canal onde o Wave Burger de fato vende. Pesquisei isso separadamente. O Portal do Parceiro tem uma área chamada Central de Crescimento, reunindo:

| Ferramenta | O que faz |
|---|---|
| Campanha Inteligente | Usa dados/algoritmo do próprio iFood pra direcionar investimento promocional automaticamente pras ofertas com maior potencial de retorno |
| Cupom Flexível | O mais configurável — valor mínimo de pedido, categorias participantes, horário de validade, tipo de cliente (novo/recorrente), duração — o investimento pode ser só da loja ou compartilhado com o iFood |
| iFood Anúncios | Mídia paga dentro do app — posiciona a loja em busca, categoria e home, sem precisar reduzir preço (diferencial importante: é visibilidade paga, não desconto) |
| Taxa de Entrega Flexível / Entrega Grátis | Configura gratuidade de entrega (ex.: condicional a valor mínimo de pedido) |
| Clube iFood | Programa de benefícios/assinatura do próprio iFood — lojas selecionadas participam oferecendo cupons padronizados (ex.: 25% off limitado a R$10) em troca de visibilidade/fidelização |
| Desconto em Item | Define um valor máximo de investimento; participação fica automática dentro desse limite |

Uma fonte (Saipos, integradora de sistemas de restaurante) cita que promoções no iFood podem aumentar vendas em até 30%, especialmente em datas como Black Friday — número de fornecedor de tecnologia, vale tratar como estimativa de mercado, não dado auditado.

Conexão direta com o que já existe no sistema: os campos Sale.salesChannel, Sale.marketingCampaignCode e Sale.discountType/discountValue (Etapa de pedidos externos) já capturam boa parte do que seria necessário pra depois cruzar "qual cupom/campanha do iFood gerou qual venda, com qual margem real".

---

## 3. Complemento: testando com pouco tráfego (a realidade prática do Wave Burger)

O documento enviado inclui uma metodologia estatística robusta pra teste A/B (cálculo de tamanho de amostra, exemplo de ~13 a 24 mil cliques necessários por variante). Isso é dimensionado pra escala de rede grande — não é realista pro volume de pedidos do Wave Burger hoje. Pesquisei especificamente alternativas pra esse cenário.

O consenso das fontes especializadas em otimização de conversão: um site pequeno não deveria nem tentar rodar teste A/B tradicional — a recomendação comum é só valer a pena a partir de milhares de visitantes por variante; abaixo disso, o teste fica meses sem atingir significância estatística.

Alternativas recomendadas pra esse cenário:

- Teste grande, não pequeno: com pouco volume, só dá pra enxergar diferenças grosseiras — não vale testar detalhe fino (cor de botão), vale testar mudança estrutural (ex.: combo novo vs. sem combo), que gera um efeito grande o suficiente pra ser percebido mesmo com poucos dados
- Comparação sequencial (antes/depois): em vez de dividir tráfego simultaneamente, aplica a mudança e compara um período "antes" com um período "depois" de duração comparável, controlando por sazonalidade, dia da semana e eventos especiais
- Abordagem qualitativa em paralelo: conversas diretas com cliente, observação de pedido, formam hipótese mais fundamentada antes mesmo de testar
- Teste sequencial de uma variação de cada vez: em vez de testar 3 opções simultâneas (que dilui ainda mais o pouco tráfego), testa uma de cada vez contra o que já existe

Isso é coerente com o documento original, que já recomenda testar uma hipótese por vez — só que a versão de "pouco tráfego" precisa ser ainda mais disciplinada: mudança estrutural clara, comparação sequencial no tempo, controlando sazonalidade, em vez do split simultâneo com milhares de cliques que o documento assume como padrão.

---

## 4. Ideias iniciais para quando formos planejar a tela (não é plano ainda)

Só pra não perder o raciocínio de onde isso poderia ir, sem comprometer nada:

- Painel cruzando salesChannel × marketingCampaignCode × margem de contribuição (a mesma métrica que já calculamos na Engenharia de Cardápio) — pra saber se um código de campanha específico trouxe venda com margem boa ou só volume com desconto
- Comparação sequencial "antes/depois" de uma mudança de oferta, já que teste A/B simultâneo provavelmente não faz sentido no volume atual
- Espaço pra registrar, manualmente, o que foi testado no Portal do Parceiro do iFood (Cupom Flexível, iFood Anúncios, etc.) — já que esses dados vivem na plataforma do iFood, não no nosso sistema, e a Fase 4 da integração iFood (financeiro) ainda está pausada
- Checklist de compliance (CDC/Decreto 5903) antes de publicar qualquer peça com preço "de/por" ou parcelamento

---

## Fontes consultadas (pesquisa complementar desta sessão)

- https://blog-parceiros.ifood.com.br/promocao-ifood/
- https://blog-parceiros.ifood.com.br/cupom-de-desconto-ifood/
- https://blog-parceiros.ifood.com.br/como-fazer-promocao-no-ifood/
- https://blog-parceiros.ifood.com.br/central-de-crescimento/
- https://saipos.com/integracoes/ifood/ifood-promocao
- https://saipos.com/integracoes/ifood/cupom-ifood
- https://www.convert.com/blog/a-b-testing/i-dont-have-enough-traffic-to-a-b-test-now-what/
- https://portent.com/blog/cro/how-you-can-run-a-b-tests-on-low-traffic-sites.htm
- https://www.customerimpact.be/en/blog/ab-testing-low-traffic/
- https://cxl.com/blog/ab-testing-alternatives/

O documento original enviado pelo usuário (com suas próprias fontes, incluindo Reuters, Google Ads Help, Meta Business Help, ResearchGate e legislação brasileira) está preservado integralmente em claude/reference-docs/estrategias-vendas-precificacao-anuncios.docx.
