# Wave Burger × iFood — Plano de Integração

> Documento de pesquisa e planejamento (23/08/2026). Resolve parcialmente PD-009 (documentar o que a API do iFood oferece) e serve de insumo para PD-004 (quando/como ocorre a integração). **Nenhuma decisão de negócio aqui foi implementada em código ainda** — é material de estudo para decisão consciente, conforme a regra do próprio projeto de não implementar integração sem definição prévia (Etapa 20).

---

## 1. O que é a Merchant-API do iFood

O iFood expõe um conjunto de APIs REST para parceiros (lojistas/integradoras) sob o domínio `merchant-api.ifood.com.br`, organizadas por **módulos independentes**. Cada módulo tem sua própria documentação, critérios de homologação e, em alguns casos, versionamento próprio (ex.: Catalog v1 legado vs v2 atual).

Módulos relevantes para um restaurante (a vertical "Restaurante" — **não** confundir com a vertical "Mercado/Groceries", que tem uma API mais antiga e diferente, o **SiteMercado Integrador (SMI)**, com regras próprias de rate limit e payload):

| Módulo | O que faz |
|---|---|
| **Authentication** | Emissão e renovação de token de acesso (OAuth-like) |
| **Merchant** | Dados da loja: horários, status operacional em tempo real, pausas |
| **Catalog** | Cardápio: categorias, itens, complementos, preço, disponibilidade, estoque |
| **Order** | Ciclo de vida do pedido: confirmar, preparar, despachar, cancelar |
| **Events** | Mecanismo de entrega de eventos de pedido (polling ou webhook) |
| **Financial** | Vendas, eventos financeiros, conciliação, repasse, antecipação |
| **Logistics** | Operação de entrega (relevante só se formos gerenciar entregador próprio) |
| **Review** | Avaliações de produtos/loja |
| **Picking** | Exclusivo de Mercado — não se aplica a nós |

---

## 2. Autenticação

### Dois modelos de aplicativo — decisão que precisa ser tomada antes de codar

| | **Centralizado** | **Distribuído** |
|---|---|---|
| Acesso a múltiplas lojas | Sim, mesma credencial | Autenticação por loja |
| Webhook (evento empurrado) | ✅ Disponível | ❌ Não disponível — só polling |
| Complexidade de implementação | Menor (uma única credencial) | Maior (fluxo de autorização por loja, com código de vínculo) |

**Para o Wave Burger (uma única loja hoje, arquitetura multi-unidade pensada para o futuro):** o modelo **Centralizado** parece o mais adequado — é mais simples, permite Webhook (evento chega sozinho, sem precisar ficar perguntando a cada 30s), e ainda funciona perfeitamente se abrirmos uma segunda unidade depois (mesma credencial, múltiplas lojas). **Isso é uma recomendação, não uma decisão tomada — precisa da sua confirmação.**

### Fluxo (resumo)
1. App é cadastrado no Portal do Parceiro/Developer, gera `client_id` + `client_secret`
2. Requisição de token via Authentication API (Bearer token, usado em toda chamada)
3. Token expira e precisa ser renovado periodicamente
4. Sempre que uma nova loja autoriza o app, é preciso solicitar um **novo token** (o antigo não ganha a permissão nova automaticamente) — propagação pode levar até 10 minutos

### Requisito de cadastro
- **Só aceita CNPJ** (Pessoa Jurídica) — cadastro de Pessoa Física/Estudante (CPF) é recusado na homologação. Isso significa que o Wave Burger precisa estar formalizado como empresa para seguir com a integração real (é bem provável que já esteja, mas vale confirmar).

---

## 3. Módulo Merchant — dados da loja

- Lista lojas vinculadas ao token (`GET /merchant/v1.0/merchants`)
- Consulta status operacional em tempo real (aberta/fechada/pausada)
- Gerencia horários de funcionamento e pausas temporárias
- **Atenção operacional:** se a integração não fizer polling regular de eventos, a loja pode ser marcada como **offline automaticamente** e parar de receber pedido — isso é um requisito de disponibilidade contínua do nosso lado, não só um "nice to have".

---

## 4. Módulo Catalog — cardápio, preço, estoque

Estrutura em 3 níveis: **catálogo → categoria → item**. Um item pode ter complementos, e preço/disponibilidade diferentes por canal de venda (ex.: Entrega vs Retirada).

### Pontos mais relevantes pro Wave Burger

- **Código externo (PDV)**: cada item pode carregar um identificador nosso (o `Product.id` do nosso sistema, por exemplo) — é o campo que permite mapear "item do iFood" ↔ "produto no Wave Burger" sem ambiguidade.
- **Inventário por produto**: dá pra configurar uma quantidade máxima vendável por produto. Quando esgota, o iFood marca automaticamente como **"Fora de Stock"** e para de vender, sem precisarmos pausar manualmente. **Isso conecta diretamente com o nosso indicador "quanto dá pra entregar hoje"** (Etapa recente) — poderíamos empurrar esse número pro iFood automaticamente.
- **Atualização de preço/status**: endpoints específicos (`PATCH /items/price`, `PATCH /items/status`) para mudanças pontuais, sem reenviar o cardápio inteiro — importante pra performance.
- **Operações em lote (batch) assíncronas**, com endpoint próprio pra acompanhar o resultado.
- Suporte a Pizza (grupos obrigatórios de tamanho/massa/borda/sabor) e Combo — não é o nosso caso inicial (hamburgueria simples), mas documentado caso o cardápio cresça.

---

## 5. Módulo Order + Events — recebendo e processando pedidos

### Como os pedidos chegam
Os pedidos chegam como **eventos**, não como um "pedido completo" direto. O fluxo típico:
1. Evento `PLACED`/`CONFIRMED` aparece no polling (ou chega via webhook)
2. Sistema busca os detalhes completos: `GET /order/v1.0/orders/{id}`
3. Sistema confirma o pedido: `POST /order/v1.0/orders/{id}/confirm`
4. Pedido segue por eventos de status até entrega/retirada, ou pode ser cancelado em qualquer etapa

### Polling vs Webhook
- **Polling**: `GET /events:polling`, recomendado **a cada 30 segundos**. Cada evento precisa de confirmação (`POST /acknowledgment`) — sem isso, o evento continua aparecendo. Eventos desaparecem depois de 8 horas se nunca confirmados.
- **Webhook**: só disponível no modelo Centralizado — o iFood empurra o evento pro nosso endpoint configurado, sem precisar ficar perguntando.

### O que o pedido detalhado traz
Informações gerais, loja, cliente, itens, complementos, cupons, taxas, total, pagamento, endereço de entrega/retirada, agendamento — dado suficientemente rico pra, em tese, criar automaticamente uma `Sale` no nosso sistema (ou um novo tipo de origem de venda, já que hoje `Sale` só suporta produto único — pedido do iFood pode ter múltiplos itens, isso é uma diferença de modelo importante, ver Seção 7).

---

## 6. Módulo Financial — o que mais nos interessa pro módulo Financeiro

Cadeia de APIs pensada pra conciliação financeira ponta a ponta (venda → repasse):

| API | O que entrega |
|---|---|
| **Sales** | Informações gerais sobre as vendas da loja |
| **Financial Events** | Fluxo de caixa (créditos/débitos) por período de apuração, quase em tempo real, com data prevista de pagamento |
| **Reconciliation** | Mesma finalidade da anterior, em formato **CSV** |
| **Reconciliation On Demand** | Igual, mas **sob demanda** (não precisa esperar o ciclo automático) |
| **Settlement** | Valor **líquido** de fato repassado à loja, e o que compõe esse fechamento (ex.: taxa iFood Entrega, promoção incentivada pelo iFood vs pela loja) |
| **Antecipation** | Antecipar o repasse (padrão é D+30) via iFood Pago — não disponível para pagamento via Vale Refeição/Alimentação |

**Isso mapeia quase diretamente pro nosso DRE (Etapa 14):** a linha "taxas" do nosso DRE (que hoje usa a categoria `PLATAFORMA` como proxy) poderia, com essa integração, vir de dado real do iFood em vez de lançamento manual — e a Settlement API já separa exatamente os conceitos que precisamos (taxa de entrega, promoção patrocinada pelo iFood vs pela loja).

---

## 7. Mapeamento: dado do iFood → nosso sistema

| Dado do iFood | Onde encaixa no Wave Burger | Observação |
|---|---|---|
| Item do Catalog (nome, preço, código externo) | `Product` | Código externo = `Product.id`, evita duplicar cadastro |
| Evento de pedido confirmado + detalhe completo | `Sale` | **Gap de modelo:** hoje `Sale` é 1 produto por venda (Etapa 16, decisão deliberada); pedido do iFood tem múltiplos itens — precisaria virar N `Sale`s por pedido, ou evoluir o modelo pra suportar itens múltiplos |
| Estoque do nosso sistema (`StockBalance`) | Inventário do Catalog | Enviar nosso saldo (ou o "quanto dá pra entregar hoje") pro iFood pausar item automaticamente |
| Settlement/Financial Events | `FinancialEntry` (RECEIVABLE) | Substituiria/complementaria o lançamento automático que já existe via `sale.registered` — precisaria decidir se a fonte da verdade da receita passa a ser o iFood ou continua sendo nossa venda registrada manualmente |
| Status da loja (aberta/pausada) | Novo conceito — não existe hoje no Wave Burger | Precisaríamos de uma tela/lógica de "status operacional" |

---

## 8. Requisitos operacionais que a integração impõe (não é só "chamar uma API")

- **Disponibilidade contínua**: polling a cada 30s ou webhook sempre ativo — se parar, a loja pode ficar offline sozinha no iFood
- **Ambiente de teste primeiro**: iFood disponibiliza app de teste com lojas fictícias para desenvolvimento, **antes** de qualquer homologação
- **Homologação é obrigatória e tem processo formal**: só pode ser solicitada quando o app já está "pronto" — os testes avaliam o app como um todo, não só as chamadas de API isoladas. Precisa abrir chamado, aguardar agendamento, e reprovações exigem correção antes de nova tentativa.
- **CNPJ obrigatório** para o cadastro de desenvolvedor

---

## 9. Decisões que ainda precisam da sua confirmação (novos PDs a registrar)

Seguindo a mesma regra que já aplicamos pro módulo de Vendas (PD-010): não vou implementar nada disso sem confirmar com você primeiro. Peço que decida:

1. **Modelo de autenticação**: Centralizado (recomendo) ou Distribuído? — **✅ Confirmado em 01/09/2026: Centralizado.** Usuário tem acesso aos dois modelos + lojas de teste; testou brevemente o fluxo Distribuído (chegou a ser implementado e depois revertido), mas decidiu por Centralizado — mais simples, sem passo manual de autorização, e com suporte a Webhook.
2. **Entrega de eventos**: Webhook (precisa de endpoint público exposto, com HTTPS) ou Polling (mais simples de rodar, mas exige um processo rodando sempre)?
3. **Modelo de venda**: vale a pena evoluir `Sale` pra suportar múltiplos itens por pedido (mudança de esquema real), ou criar N vendas por pedido do iFood como solução de curto prazo?
4. **Fonte da verdade financeira**: quando vier pedido do iFood, o lançamento financeiro nasce do nosso evento `sale.registered` (como hoje) ou passa a vir direto da Settlement API do iFood (mais preciso, mas exige esperar o ciclo de repasse)?
5. **Escopo da primeira fase**: sugestão de ordem de implementação (ver Seção 10) — concorda com essa priorização?

---

## 10. Sugestão de fases de implementação (para quando formos codar)

1. **Cadastro no Portal Developer + ambiente de teste** — sem tocar em código do Wave Burger ainda, só configuração e entendimento prático
2. **Catalog**: exportar nosso catálogo de `Product` pro iFood (unidirecional, o mais simples de começar)
3. **Order + Events**: receber pedido do iFood e criar `Sale`(s) automaticamente — aqui que a decisão do item 3 da Seção 9 se torna concreta
4. **Estoque → Inventário**: empurrar "quanto dá pra entregar hoje" pro Catalog, pausando item sozinho
5. **Financial**: reconciliar Settlement do iFood com nosso módulo Financeiro
6. **Homologação e produção**

---

## 11. Plano de implementação — funções novas

**Princípio confirmado pelo usuário em 23/08/2026:** o iFood passa a ser a **fonte automática principal** de vendas, mas o lançamento manual (tela `/sales/new`, já construída na Etapa 16) **nunca é removido nem desabilitado** — continua sendo a segunda opção, sempre disponível, para venda de balcão, teste, ou qualquer cenário fora do iFood. Nenhuma tela existente perde funcionalidade; só ganha uma origem nova.

### 11.1. Mudança de schema (pequena e aditiva — não quebra nada existente)

```prisma
enum SaleOrigin {
  MANUAL   // como já funciona hoje, Etapa 16
  IFOOD
}

model Sale {
  // ...campos existentes, sem alteração...
  origin           SaleOrigin @default(MANUAL)
  externalOrderId  String?    // preenchido só quando origin = IFOOD
}
```

**Decisão de modelagem para pedidos multi-item (o gap já sinalizado na Seção 7):** em vez de reescrever `Sale` para suportar múltiplos itens (mudança grande, arriscada, afeta todo o cálculo já testado desde a Etapa 16), a proposta é: **cada item de um pedido do iFood vira uma `Sale` separada**, todas compartilhando o mesmo `externalOrderId` — assim dá pra agrupar visualmente "essas 3 vendas vieram do mesmo pedido #12345 do iFood" sem tocar no núcleo de `SalesService.registerSale()` que já funciona e já tem PD-001/BR-009 resolvidos. **Essa é uma escolha consciente meu para minimizar risco — se preferir a opção mais "correta" architeturalmente (Sale com itens múltiplos, mudança maior), me avisa antes de eu começar a Fase 2.**

Mesma lógica se aplica a `FinancialEntry` (`origin: MANUAL | IFOOD`) para rastrear lançamentos vindos do Settlement.

### 11.2. Novo módulo backend: `IfoodModule`

| Serviço | Função | Reaproveita |
|---|---|---|
| `IfoodAuthService` | Obtém/renova token OAuth, cacheia com expiração | — (novo) |
| `IfoodCatalogSyncService` | `syncProduct(productId)` / `syncAll()` — envia `Product`+`FichaTecnica` ativa pro Catalog do iFood, código externo = `Product.id` | Reutiliza `ProductsService`/`FichaTecnicaService` só para leitura |
| `IfoodOrderPollingService` | **O coração do "puxar automaticamente"**: a cada 30s (`@nestjs/schedule` `@Cron`), consulta `/events:polling`, busca detalhe do pedido, mapeia itens por código externo, e chama `SalesService.registerSale()` uma vez por item — com `origin: 'IFOOD'` e o `externalOrderId` compartilhado | **Reaproveita 100% da lógica de venda já existente** (BR-009, PD-001, evento `sale.registered` → lançamento financeiro) — nenhum cálculo duplicado |
| `IfoodInventorySyncService` | Envia "quanto dá pra entregar hoje" pro campo de inventário do Catalog, deixando o iFood pausar item sozinho quando esgotar | Reaproveita `AnalyticsService.getDeliverableQuantities()` (já existe, Etapa recente) |
| `IfoodFinancialSyncService` | Consulta Settlement API, cria/atualiza `FinancialEntry` com `origin: 'IFOOD'`, categorizando taxa/repasse | Reaproveita `FinancialService.create()` |

### 11.3. Frontend — o que muda

- **Nova tela "Configurações → Integração iFood"**: status da conexão, botão "Sincronizar catálogo agora", log das últimas sincronizações e erros
- **Tela de Vendas (lista)**: badge discreto indicando a origem — "Manual" ou "iFood" — ao lado de cada linha (reaproveita o `StatusBadge` já construído no design system)
- **Formulário de nova venda manual**: continua exatamente como está hoje, sem nenhuma mudança — é a "segunda opção" intacta
- **Dashboard**: card opcional de "pedidos iFood com erro de sincronização" (ex.: pedido chegou com um item sem ficha técnica cadastrada) — importante pra não deixar erro silencioso

### 11.4. Ordem sugerida de implementação

| Fase | O quê | Risco |
|---|---|---|
| 0 | Cadastro no Portal Developer, ambiente de teste, decisão final de autenticação (Centralizado, conforme recomendado na Seção 2) | Nenhum código ainda |
| 1 | Catalog Sync (Wave Burger → iFood) | Baixo — unidirecional, não toca em venda/estoque |
| 2 | Order Polling → `Sale` automática (**o núcleo**) | Médio — decisão do multi-item (11.1) precisa estar fechada antes de começar |
| 3 | Inventário (Estoque → iFood) | Baixo — só leitura do nosso lado, reaproveita cálculo existente |
| 4 | Financeiro (Settlement → `FinancialEntry`) | Médio — precisa decidir se substitui ou complementa o lançamento já criado via `sale.registered` (Seção 9, item 4) |
| 5 | Homologação e produção | — |

### 11.5. Decisões que precisavam da sua confirmação antes de codar

1. Modelagem de pedido multi-item: aceitar a proposta do item 11.1 (N `Sale`s por pedido) ou preferir mudar `Sale` para suportar itens múltiplos de verdade?
2. Fase 4: quando o pedido do iFood já gera `FinancialEntry` via `sale.registered` (Fase 2), a sincronização de Settlement (Fase 4) **substitui** esse lançamento com o valor líquido real, ou **complementa** como um segundo lançamento (ex.: ajuste de taxa)?
3. Confirma que quer começar pela Fase 0/1, ou prefere outra ordem?

### 11.6. Status das decisões e progresso

**Todas as 3 confirmadas pelo usuário em 24/08/2026:**
1. ✅ Modelagem multi-item: aceita a proposta do item 11.1 (N `Sale`s por pedido, agrupadas por `externalOrderId`)
2. ✅ Settlement: **Opção B — Complementar** (novo lançamento de taxa/comissão, nunca substitui o lançamento da venda)
3. ✅ Começar pela Fase 0/1

**Progresso da Fase 0/1 (24/08/2026):**
- Fase 0 (cadastro no Portal Developer): responsabilidade do usuário — não é algo que o agente consegue fazer (exige CNPJ real, login, aprovação)
- Fase 1 (Catalog Sync): **✅ CONFIRMADA FUNCIONANDO CONTRA A API REAL — 02/09/2026.** Depois de duas correções encontradas testando de verdade (formato aninhado do payload do item — erro 400 "FullItemDto is not valid"; e falta do `catalogId` no caminho da URL de categorias — erro 404), o usuário sincronizou o Smash Burger com sucesso e confirmou visualmente no painel do iFood que o produto apareceu no cardápio. `IfoodAuthService` (Centralizado, `client_credentials`), `buildIfoodItemPayload` (payload aninhado correto), `IfoodCatalogSyncService` (com `resolveCatalogId`/`resolveCategoryId`), endpoint `POST /ifood/catalog/sync`. 22 testes unitários no módulo (157 totais no backend). Migration aditiva aplicada (`Sale.origin`/`externalOrderId`, `FinancialEntry.origin`).
- Ainda faltando pra fechar a Fase 1 por completo: disparo automático de sincronização quando um produto é ativado/editado (hoje só manual via endpoint/tela). **Tela de frontend "Configurações → Integração iFood" já implementada** (`/settings`, 24/08/2026) — campo de ID da loja + botão "Sincronizar catálogo agora" + resultado por produto.

**Progresso da Fase 2 (02/09/2026):**
- **✅ CONFIRMADA FUNCIONANDO COMPLETAMENTE EM PRODUÇÃO REAL.** Usuário fez um pedido de teste de verdade (checkout real do iFood, pagamento na entrega/dinheiro) do Smash Burger, e toda a cadeia funcionou sozinha: pedido confirmado automaticamente (apareceu "em preparo" no painel do iFood), venda registrada no Wave Burger, lançamento financeiro de conta a receber criado automaticamente (reaproveitando o listener já existente desde a Etapa 16), estoque baixado corretamente segundo a ficha técnica (160g de carne bovina), e o indicador "quanto dá pra entregar hoje" do Dashboard atualizado (35→34 unidades).
- Implementado: `BusinessUnit.ifoodMerchantId` (persistente — Fase 2 roda em segundo plano sem input humano), `SalesService.registerSale` com parâmetro interno opcional (`origin`/`externalOrderId`, nunca exposto no DTO público), `IfoodOrderPollingService` (`@Interval` 30s, processa eventos `PLACED`, idempotência via `externalOrderId`), `IfoodSettingsController` (persiste merchantId). 32 testes novos (167 totais).
- **Correção real encontrada durante o teste**: `item.externalCode` de itens de exemplo da loja de teste do iFood não são UUID válido — Prisma lançava erro de tipo antes da query rodar, travando o pedido inteiro. Corrigido com validação de formato (regex) antes de qualquer consulta ao banco.
- **Detalhes práticos do ambiente de teste do iFood documentados** (fora do nosso código, mas relevantes para testes futuros): geração "automática" de pedido no Portal usa itens genéricos sem relação com o catálogo sincronizado; testar um produto específico exige simular uma compra manual real (login com e-mail de teste do Portal, endereço "Ramal Bujari, 100", pagamento na entrega em dinheiro ou cartão de teste `4111 1111 1111 1111`, nunca PIX/Débito em Conta).

**Progresso da Fase 3 (04/09/2026):**
- **✅ CONFIRMADA FUNCIONANDO EM PRODUÇÃO REAL.** `IfoodInventorySyncService` (`@Interval` 5 min), reaproveitando 100% de `AnalyticsService.getDeliverableQuantities()`. **Correção real encontrada no primeiro teste**: campo do payload é `amount` (inteiro), não `quantity` como uma das páginas da documentação sugeria — corrigido e confirmado com sucesso na sincronização. **Cenário de auto-pausa testado e confirmado**: zerando o estoque do ingrediente limitante, o item some do cardápio do app do cliente automaticamente (o app do vendedor não destacava "pausado" explicitamente, mas isso não afeta o resultado real). Endpoint manual `POST /ifood/inventory/sync` lê o `merchantId` já salvo (não pede de novo). Descoberta lateral: Inventário só funciona pra item que já passou pelo Catalog Sync — se um produto for cadastrado depois do último sync de catálogo, é preciso rodar "Sincronizar catálogo agora" antes do inventário ter efeito visível (usuário optou por manter esse passo manual, não automatizado).

**Próximas fases:**
- **Fase 4 — Financeiro: ⏸️ PAUSADA (04/09/2026).** Reconciliar Settlement do iFood com o módulo Financeiro (Opção B já confirmada — complementa, não substitui). Ao pesquisar antes de codar, encontrada uma exigência diferente das fases anteriores: o módulo Financeiro requer um **processo de homologação próprio e separado** (mais formal, avaliado pela equipe do iFood), distinto do que usamos para Catalog/Order/Inventory — que testamos livremente com a loja de teste. Usuário optou por pausar esta fase em vez de codar sem conseguir testar de verdade. **Próximo passo antes de retomar**: verificar/solicitar essa homologação financeira específica no Portal Developer. Resumo do que a API oferece, para quando a fase for retomada: **Financial Events** (`merchantId`/`beginDate`/`endDate`, cada evento com valor de crédito/débito e marcação `hasTransferImpact` — só `true` conta pro cálculo de repasse) e **Settlement** (valor líquido real recebido, pode diferir do esperado).
- Fase 5 — Homologação e produção (depende da Fase 4 estar resolvida, e da homologação geral do app)

## Fontes consultadas

- https://developer.ifood.com.br/pt-BR (portal geral)
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/distributed/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/authentication/intro/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/workflow/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/merchant/endpoints
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/workflow
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/using-api/
- https://developer.ifood.com.br/en-US/docs/guides/catalog/v2/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/definitions
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/item/general/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/workflow/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/endpoints
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/order/details/
- https://developer.ifood.com.br/pt-BR/docs/guides/order/events/
- https://developer.ifood.com.br/en-US/docs/guides/order/events/delivery-methods/polling/overview/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/financial/api-financial-events/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/financial/api-reconciliation
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/financial/api-settlement/
- https://developer.ifood.com.br/pt-BR/docs/guides/modules/financial/api-antecipation
- https://developer.ifood.com.br/pt-BR/docs/guides/order/homologation/
- https://developer.ifood.com.br/pt-BR/docs/categories?category=FOOD

*(Nota: alguns resultados de busca também trouxeram documentação da vertical Mercado/Groceries — deliberadamente excluída deste plano, já que usa uma API mais antiga e diferente da que se aplica a restaurantes.)*
