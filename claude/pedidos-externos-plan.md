# Wave Burger — Plano: Pedidos por fora do iFood (coleta de dados do cliente)

> Documento de planejamento (19/09/2026). Constrói em cima do que já existe (`Sale`, Etapa 16) e do plano de Marketing esboçado anteriormente (`claude/marketing-sales-plan.md`, nunca implementado) — adaptado especificamente para o fluxo que o usuário pediu agora: registrar pedidos que chegam por fora do iFood (WhatsApp, telefone, balcão, redes sociais), capturando dado de cliente e atribuição, **com todo campo novo opcional**, já que a coleta ainda está em fase de adaptação. Nenhum código foi escrito ainda — este é o plano.

---

## 1. O que já existe hoje

A tela de venda manual (`/sales/new`, Etapa 16) registra: produto, quantidade, preço, desconto, data. **Não sabe quem comprou, de onde veio o pedido, nem como foi pago.**

---

## 2. Os campos que você pediu

| Campo | Onde vive | Observação |
|---|---|---|
| Nome do cliente | `Customer.name` (novo) | — |
| Telefone | `Customer.phone` (novo) | Naturalmente o identificador pra reconhecer recompra — mas como nada é obrigatório, um pedido sem telefone informado simplesmente não vincula a nenhum cliente (fica "anônimo", como hoje) |
| E-mail | `Customer.email` (novo) | — |
| Canal de venda | `Sale.salesChannel` (novo) | Ver nota importante na Seção 4 |
| Método de pagamento | `Sale.paymentMethod` (novo) | Dado que o sistema nunca capturou até hoje, nem nas vendas manuais |
| Código de campanha de marketing | `Sale.marketingCampaignCode` (novo) | Proposital como texto livre simples nesta primeira versão — ver Seção 6 |

## 3. Dados adicionais que sugiro considerar

Analisando o que normalmente faz diferença pra esse tipo de pedido, além do que você já listou:

| Campo sugerido | Por quê |
|---|---|
| **Bairro/CEP do cliente** | Já era o dado apontado como "mais valioso" no plano de marketing original — decidir onde investir depende de saber de onde vêm os pedidos |
| **Observações do pedido** | Campo livre pra qualquer detalhe (ex.: "sem cebola", "entregar na portaria") — não impacta cálculo nenhum, só serve de anotação |
| **Taxa de entrega** (se vocês entregam por fora, sem ser pelo entregador do iFood) | Se existe entrega própria pra pedido direto, esse valor deveria compor o financeiro da venda — hoje não existe nenhum campo pra isso |

Deixo os três como sugestão — não incluí no modelo de dados abaixo até você confirmar quais quer de fato.

---

## 4. Atenção: "canal de venda" ≠ `Sale.origin`

Isso merece destaque pra não confundir com o que já existe: `Sale.origin` (criado na integração com o iFood) distingue **como a venda foi criada no nosso sistema** (`MANUAL` vs `IFOOD` — ou seja, se foi você que digitou ou se o sistema criou sozinho a partir de um pedido do iFood). **Canal de venda é uma coisa diferente**: é por **onde o cliente fez o pedido** (WhatsApp, Instagram, telefone, balcão) — todos esses continuam `origin = MANUAL`, porque nenhum deles vem do iFood; `salesChannel` só refina **qual** canal manual foi.

---

## 5. Modelo de dados proposto

```prisma
model Customer {
  id             String   @id @default(uuid())
  organizationId String
  name           String?          // opcional — nada é obrigatório
  phone          String?          // identificador de recompra, quando informado
  email          String?
  neighborhood   String?          // se a sugestão da Seção 3 for aceita
  postalCode     String?
  createdAt      DateTime @default(now())

  sales Sale[]

  @@unique([organizationId, phone])  // só aplica quando phone não é nulo
}

enum SalesChannel {
  WHATSAPP
  INSTAGRAM
  TELEFONE
  PRESENCIAL
  SITE_PROPRIO
  OUTRO
}

enum PaymentMethod {
  DINHEIRO
  PIX
  CARTAO_DEBITO
  CARTAO_CREDITO
  VALE_REFEICAO
  OUTRO
}

// Novos campos em Sale (todos opcionais, aditivos):
//   customerId            String?
//   salesChannel           SalesChannel?
//   paymentMethod          PaymentMethod?
//   marketingCampaignCode  String?
//   notes                  String?          (se a sugestão da Seção 3 for aceita)
```

---

## 6. Sobre o "código de campanha de marketing"

O plano de Marketing original (nunca implementado) propunha um modelo bem mais estruturado — `Campaign`/`Coupon` como entidades próprias, com tela de cadastro, contagem de uso, vínculo com canal pago, etc. Pra este primeiro momento de **adaptação da coleta**, sugiro começar mais simples: um campo de **texto livre** (`marketingCampaignCode`), onde você digita qualquer código que quiser (ex.: "CRIADOR-JOAO", "PRIMEIRA20") — sem cadastro prévio, sem validação. Se, depois de um tempo usando isso, fizer sentido ter relatório por campanha (quantas vendas cada código gerou, etc.), aí sim evolui pro modelo mais completo do plano original.

---

## 7. Fluxo de UX proposto

Na tela de nova venda (`/sales/new`), abaixo dos campos que já existem, uma seção nova, **"Dados do pedido (opcional)"**, com todos os campos citados. Ao salvar:

1. Se **telefone** foi informado: sistema busca um `Customer` existente com esse telefone (dentro da organização) — se achar, reaproveita e atualiza nome/e-mail se vierem diferentes; se não achar, cria um novo
2. Se **telefone não foi informado**: nenhum `Customer` é criado nem vinculado — a venda fica como está hoje, sem cliente identificado
3. Os demais campos (canal, pagamento, campanha, observações) são salvos direto na própria `Sale`, independente de ter cliente vinculado ou não

---

## 8. Telas afetadas

| Tela | Mudança |
|---|---|
| `/sales/new` | Ganha a seção "Dados do pedido (opcional)" |
| `/sales` (lista) | Ganha colunas/badges opcionais mostrando canal e cliente, quando preenchidos |
| **Nova: `/customers`** | Lista simples de clientes cadastrados, com histórico de compras — proposta como fase separada, não obrigatória nesta primeira entrega |

---

## 9. Fases de implementação sugeridas

| Fase | O quê | Risco |
|---|---|---|
| 1 | Migration aditiva (`Customer`, campos novos em `Sale`) | Baixo |
| 2 | Lógica de buscar/criar `Customer` por telefone no registro de venda | Baixo |
| 3 | Formulário de venda ganha a seção nova | Baixo |
| 4 | Tela `/customers` (histórico por cliente) | Baixo — mas só se você quiser já nesta entrega |

---

## 10. Perguntas antes de eu começar a codar

1. Aceita as 3 sugestões da Seção 3 (bairro/CEP, observações, taxa de entrega), ou só os campos que você já tinha listado?
2. Confirma o texto livre simples pro código de campanha (Seção 6), em vez do modelo completo de `Campaign`/`Coupon`?
3. Quer a tela `/customers` já nesta entrega, ou só os campos no formulário de venda por enquanto?
