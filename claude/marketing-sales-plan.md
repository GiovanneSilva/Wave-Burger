# Wave Burger — Plano de Sistema de Marketing & Vendas

> Documento de planejamento (25/08/2026), a partir da análise do "Plano de Marketing Wave Lanches — Mogi das Cruzes, 90 dias". Foco confirmado pelo usuário: **região de Mogi das Cruzes**. Nenhum código foi escrito ainda — este é o plano, seguindo o mesmo processo já usado para a integração iFood (pesquisa/análise → arquitetura proposta → confirmação → implementação incremental).

---

## 1. O que o plano de marketing pede, resumido

O documento analisado (16 páginas) define:
- **Mercado-alvo**: Mogi das Cruzes, 451.505 habitantes, renda familiar média R$3.533/mês, 14 concorrentes diretos mapeados
- **Dois polos geográficos prioritários**: Centro Cívico/Jardim Armênia (IPD 80) e Vila Mogilar (IPD 74)
- **5 personas**: Universitário(a) da UMC, Família em casa, Trabalhador do polo Vila Mogilar, Visitante do Mogi Shopping/hóspede, Fitness do Alto Ipiranga
- **6 canais de aquisição**: Meta Ads, Google Ads, Google Business Profile, iFood, WhatsApp, Influenciadores locais
- **6 ofertas com atribuição rastreável**: Primeira Wave, Combo Universitário, Combo Família, Wave da Semana, Recompra, Creator Code (cupom por influenciador)
- **Um dashboard de métricas organizado por 7 etapas de funil** (Seção 11 do documento, a peça central pro que você pediu):

| Etapa | KPIs pedidos |
|---|---|
| Alcance | CPM, alcance local, frequência, visualizações de vídeo |
| Interesse | CTR, visitas ao perfil, cliques no cardápio, conversas iniciadas |
| Conversão | Pedidos, CAC, taxa conversa→pedido, ticket médio |
| Operação | Tempo de preparo/entrega, erros, faltas, reembolsos |
| Reputação | Nota, volume de avaliações, tempo de resposta |
| Retenção | Recompra 30/60/90d, cupom de retorno, LTV |
| Geografia | Pedidos por CEP/bairro/raio |

---

## 2. Fronteira honesta: o que o Wave Burger pode controlar vs. o que vive fora

Essa distinção é a decisão arquitetural mais importante deste plano — sem ela, corremos o risco de tentar reconstruir o Meta Ads Manager dentro do nosso sistema.

| Etapa do funil | Onde o dado realmente existe | O que o Wave Burger pode fazer |
|---|---|---|
| **Alcance** | Dentro do Meta Ads / Google Ads — CPM, alcance, frequência são métricas de mídia paga que só essas plataformas medem | **Entrada manual** (o usuário digita o número semanal, copiado do Meta Ads Manager) — não temos integração com a API de anúncios (seria um projeto à parte, do tamanho da integração iFood) |
| **Interesse** | Idem — CTR, visitas ao perfil vêm do Instagram/Meta | Entrada manual, mesma lógica |
| **Conversão** | **Aqui sim é nosso** — `Sale` já existe (Etapa 16); falta só capturar a **origem** (campanha/cupom) e o **cliente** | Automático, construindo em cima do que já existe |
| **Operação** | **100% nosso** — tempo de preparo/entrega, erro, falta, reembolso são dados operacionais do próprio pedido | Automático, novo campo/registro por venda |
| **Reputação** | Vive no Google/iFood (avaliação do cliente lá, não no nosso sistema) | Entrada manual (nota e nº de avaliações copiados periodicamente), a não ser que se decida construir scraping/API — não recomendo agora |
| **Retenção** | **Nosso, se capturarmos identidade do cliente** — hoje `Sale` não sabe quem comprou | Automático, depois que existir `Customer` |
| **Geografia** | **Nosso, se capturarmos CEP/bairro** — hoje `Sale` não tem endereço nenhum | Automático (manual na venda direta; automático via iFood, Fase 2 do plano de integração já em andamento — pedido do iFood já traz endereço) |

**Conclusão prática**: o sistema que vou propor cobre de verdade **Conversão, Operação, Retenção e Geografia** (que são dados que só nós temos) e oferece uma **tela de lançamento manual simples** para Alcance/Interesse/Reputação (números que vêm de fora, mas que você quer ver lado a lado com o resto, pra calcular CAC de verdade).

---

## 3. Por que não um "CRM de vendas" tradicional

Você deixou em aberto o formato ("pode ser em formato de CRM de vendas ou você pode sugerir outro"). Minha recomendação: **não** um CRM B2B clássico (com pipeline de oportunidade, estágios "Lead → Qualificado → Proposta → Fechado", funil de vendedor). Esse modelo existe pra vendas consultivas, com ciclo longo e um vendedor humano conduzindo a negociação — não é o caso do Wave Burger, que é **delivery B2C de compra por impulso, ticket baixo (R$25-40), decisão em minutos**.

O que o próprio documento pede, na prática, é mais próximo de um **Painel de Atribuição, Clientes e Geografia** — um CRM "leve", focado em:
- Saber **quem** compra (nome/telefone, pra reconhecer recompra)
- Saber **de onde** veio o pedido (campanha/cupom/canal)
- Saber **onde** o cliente está (CEP/bairro, pra decidir onde investir a próxima verba — literalmente a "decisão do dia 90" que o documento define)
- Saber se a **operação** está entregando a promessa (a lacuna competitiva que o próprio estudo de mercado identificou como o maior problema dos concorrentes)

---

## 4. Modelo de dados proposto (novo)

```prisma
model Customer {
  id             String   @id @default(uuid())
  organizationId String
  name           String
  phone          String              // WhatsApp, identificador principal
  neighborhood   String?             // bairro (Centro Cívico, Vila Mogilar, etc.)
  postalCode     String?             // CEP — o "dado mais valioso após 60-90 dias", segundo o próprio estudo
  firstSaleAt    DateTime?
  createdAt      DateTime @default(now())

  sales Sale[]

  @@unique([organizationId, phone])  // mesmo telefone = mesmo cliente
}

enum MarketingChannel {
  META_ADS
  GOOGLE_ADS
  WHATSAPP
  IFOOD
  INFLUENCER
  ORGANIC
  GOOGLE_BUSINESS_PROFILE
}

model Campaign {
  id         String            @id @default(uuid())
  organizationId String
  name       String                     // "Combo Universitário — Semana 5"
  channel    MarketingChannel
  startDate  DateTime
  endDate    DateTime?
  budget     Decimal?
  active     Boolean           @default(true)

  coupons Coupon[]
}

model Coupon {
  id            String        @id @default(uuid())
  organizationId String
  code          String                    // "PRIMEIRAWAVE", "CRIADOR-JOAO"
  campaignId    String?
  discountType  DiscountType?             // reaproveita o enum que Sale já usa
  discountValue Decimal?
  usageLimit    Int?
  usedCount     Int           @default(0)
  active        Boolean       @default(true)

  campaign Campaign? @relation(fields: [campaignId], references: [id])
  sales    Sale[]

  @@unique([organizationId, code])
}

// Novos campos em Sale (aditivo, não quebra nada existente):
//   customerId  String?   — opcional, pra não forçar toda venda manual a exigir cliente
//   couponId    String?   — substitui/complementa discountType+discountValue quando a venda usa um cupom real
//   neighborhood/postalCode — capturados na hora da venda (ou herdados do Customer)

model OrderIncident {
  id        String   @id @default(uuid())
  saleId    String
  type      IncidentType   // LATE, WRONG_ITEM, COLD_FOOD, REFUND, NO_RESPONSE
  notes     String?
  createdAt DateTime @default(now())

  sale Sale @relation(fields: [saleId], references: [id])
}

enum IncidentType {
  LATE
  WRONG_ITEM
  COLD_FOOD
  REFUND
  NO_RESPONSE
}

// Entrada manual para Alcance/Interesse/Reputação (dados que vivem fora)
model CampaignMetricSnapshot {
  id           String   @id @default(uuid())
  campaignId   String
  weekStart    DateTime
  cpm          Decimal?
  reach        Int?
  frequency    Decimal?
  ctr          Decimal?
  profileVisits Int?
  googleRating  Decimal?
  googleReviewCount Int?
  createdAt    DateTime @default(now())

  campaign Campaign @relation(fields: [campaignId], references: [id])
}
```

**Decisão de compatibilidade**: `Sale.customerId` e `Sale.couponId` seriam **opcionais** — a venda manual rápida (Etapa 16) continua funcionando exatamente como hoje, sem exigir cliente. Preencher fica mais rico com o tempo (e, quando a integração iFood chegar na Fase 2 do outro plano, o pedido do iFood já traz nome/telefone/endereço do cliente automaticamente — populando `Customer` sozinho).

---

## 5. Telas novas propostas

Seguindo a mesma estrutura de funil do documento (Seção 11), não uma tela genérica de "CRM":

| Tela | O que mostra |
|---|---|
| **Marketing → Visão Geral** | Os 7 blocos do funil, um do lado do outro — automáticos (Conversão/Operação/Retenção/Geografia) misturados com os manuais (Alcance/Interesse/Reputação) |
| **Marketing → Clientes** | Lista de `Customer`, com contagem de compras, LTV, última compra — a base pra medir recompra 30/60/90d |
| **Marketing → Campanhas & Cupons** | CRUD de `Campaign`/`Coupon`, e onde lançar as métricas semanais manuais (CPM, alcance etc.) |
| **Marketing → Geografia** | Pedidos agrupados por bairro/CEP — visualização direta da "decisão do dia 90" (onde concentrar a próxima verba) |
| **Vendas (tela já existente)** | Ganha um campo opcional de cliente (nome/telefone) e cupom na hora de registrar a venda |

---

## 6. Como isso conecta com o que já existe

- **`Sale.origin` (MANUAL/IFOOD)**, criado na Fase 0/1 da integração iFood, continua funcionando igual — `Campaign`/`Coupon` é uma camada adicional de atribuição, não substitui isso
- **Desconto (`discountType`/`discountValue`)**, já existente desde a Etapa 16, continua valendo para desconto avulso sem cupom — `Coupon` é usado quando o desconto vem de uma promoção rastreável de verdade
- **Ficha Técnica/Estoque**: nenhuma mudança — o novo módulo só observa vendas já registradas, não interfere no cálculo de custo/margem

---

## 7. Fases de implementação sugeridas

| Fase | O quê | Risco |
|---|---|---|
| 1 | `Customer` + campo opcional na tela de Vendas (nome/telefone) | Baixo — puramente aditivo |
| 2 | `Campaign` + `Coupon` + vínculo com `Sale` | Baixo — mesma lógica |
| 3 | `OrderIncident` (registro de falha operacional) | Baixo |
| 4 | Dashboard "Marketing → Visão Geral" (funil completo, incluindo lançamento manual de Alcance/Interesse/Reputação) | Médio — a tela com mais peças novas |
| 5 | Tela "Marketing → Geografia" (agrupamento por bairro/CEP) | Baixo — depende só do CEP já capturado nas fases anteriores |

---

## 8. Perguntas antes de eu começar a codar

1. **Cliente obrigatório ou opcional na venda manual?** Recomendo opcional (não travar o fluxo rápido que já existe), mas confirma.
2. **Nome do módulo/item na sidebar**: "Marketing", "Marketing & Clientes", outro nome?
3. **Prioridade de fase**: seguir a ordem sugerida (Cliente → Campanha/Cupom → Incidente → Dashboard → Geografia), ou prefere começar por outra parte?
4. **Entrada manual de Alcance/Interesse/Reputação**: faz sentido pra você ter isso dentro do sistema (pra calcular CAC unificado), ou prefere deixar esses números só no Meta Ads Manager mesmo e nosso sistema focar só no que é automático (Conversão/Operação/Retenção/Geografia)?
