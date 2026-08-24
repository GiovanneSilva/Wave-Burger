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

1. **Modelo de autenticação**: Centralizado (recomendo) ou Distribuído?
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
