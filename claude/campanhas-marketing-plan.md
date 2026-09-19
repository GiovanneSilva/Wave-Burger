# Wave Burger — Plano: Tela de Campanhas (lista de clientes + disparo de marketing via WhatsApp/E-mail)

> Documento de planejamento (19/09/2026). Constrói em cima do `Customer` criado na etapa anterior (`claude/pedidos-externos-plan.md`). Nenhum código foi escrito ainda — este é o plano, incluindo uma pesquisa real sobre como o WhatsApp Business funciona de verdade, porque muda o que dá pra construir.

---

## 1. Aviso importante antes de tudo: como o WhatsApp Business realmente funciona

Pesquisei a documentação oficial antes de desenhar isso, porque o modelo mental de "escrevo um texto e disparo pros clientes" **não é como o WhatsApp permite mensagem de marketing funcionar**. Veja a diferença:

| O que você imaginou | Como é de verdade |
|---|---|
| Escrever um texto livre na hora e mandar pra todo mundo | Precisa de um **modelo de mensagem (template) pré-aprovado pela Meta**, com espaços reservados numerados (`{{1}}`, `{{2}}`) — só esses espaços podem ser personalizados por cliente |
| Personalizar com o nome do cliente | **Funciona!** — é exatamente pra isso que serve `{{1}}` — mas só dentro da estrutura do template já aprovado, não texto solto |
| Anexar imagem/vídeo direto na campanha | Também precisa estar previsto no **cabeçalho do template** desde a aprovação (você define lá "esse template tem cabeçalho de imagem"); na hora de disparar, você só troca o link da mídia, não o tipo |
| Enviar pra qualquer cliente cadastrado | **Só pra quem deu consentimento explícito (opt-in)** — a Meta exige isso, e desativa conta que descumprir |
| Mandar quantas mensagens quiser | Toda mensagem de marketing precisa incluir instrução clara de descadastro (botão "Parar promoções" ou similar) |

**Resumo prático**: dá pra fazer exatamente o que você quer (nome personalizado, imagem/vídeo, disparo em massa) — só que o **modelo da mensagem** precisa ser aprovado pela Meta antes, e só clientes que autorizaram recebem. Isso não é uma limitação do nosso sistema — é assim pra qualquer empresa que use WhatsApp Business, sem exceção.

**Pro E-mail, é diferente e bem mais simples**: não existe esse sistema de aprovação prévia — você escreve o texto que quiser, com personalização livre (`Olá {{nome}}`), sem depender de aprovação de terceiro.

---

## 2. Dados e funcionalidades que faltam (você pediu pra eu indicar)

| O que falta | Por que é necessário |
|---|---|
| **Consentimento (opt-in) do cliente**, por canal | Exigência da Meta (WhatsApp) e da LGPD — hoje `Customer` não tem nenhum campo dizendo se a pessoa autorizou receber marketing. Sem isso, literalmente não dá pra disparar nada de forma legal/permitida |
| **Registro de descadastro (opt-out)** | Cliente precisa poder parar de receber a qualquer momento — e o sistema nunca pode mandar de novo depois disso |
| **Conta comercial verificada na Meta + número de WhatsApp Business dedicado** | Pré-requisito da Meta pra sequer começar — processo de verificação de empresa, parecido com o que fizemos pro iFood, mas noutra plataforma |
| **Provedor de envio (BSP)** — ex.: Twilio, 360dialog, Gupshup, ou a Cloud API direto da Meta | O Wave Burger não conversa direto com o WhatsApp — precisa de um intermediário homologado. Cada um tem custo por mensagem/conversa |
| **Serviço de envio de e-mail** — ex.: SendGrid, Amazon SES, Resend | Não existe nenhuma infraestrutura de e-mail no projeto hoje |
| **Armazenamento de imagem/vídeo com link público** | O Wave Burger **não tem nenhum sistema de upload de arquivo hoje** — nem pra foto de produto (`Product.imageUrl` já existe, mas é só um campo de texto pra colar um link, não um upload de verdade). Pra campanha, precisa de um lugar de verdade pra guardar a mídia e gerar um link acessível |
| **Fila de envio em segundo plano** | Disparar pra 300 clientes de uma vez não pode ser uma requisição só — puxa o mesmo padrão que já usamos no iFood (processo rodando sozinho, não trava a tela esperando) |
| **Rastreamento de entrega por cliente** | Preciso saber, pra cada campanha, quem recebeu, quem falhou, quem visualizou — não só "campanha enviada" |
| **Custo de envio** | Tanto WhatsApp (cobrança por conversa, varia por categoria/país) quanto o provedor de e-mail têm custo real — vale ter isso claro antes de decidir a escala |

---

## 3. Modelo de dados proposto

```prisma
enum OptInChannel {
  WHATSAPP
  EMAIL
}

// Novo em Customer:
//   whatsappOptIn   Boolean @default(false)
//   emailOptIn      Boolean @default(false)
//   optOutAt        DateTime?   (se marcado, NUNCA envia de novo em nenhum canal)

model CampaignTemplate {
  id              String   @id @default(uuid())
  organizationId  String
  name            String                    // nome interno, ex.: "Promo Sexta"
  channel         OptInChannel              // WHATSAPP ou EMAIL — cada canal tem seu próprio template
  bodyText        String                    // com {{1}} (WhatsApp) ou {{nome}} (E-mail)
  headerMediaType String?                   // IMAGE | VIDEO | null (só relevante pro WhatsApp)
  approvalStatus  String   @default("DRAFT") // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED (só WhatsApp)
  metaTemplateId  String?                   // preenchido depois que a Meta aprova
  createdAt       DateTime @default(now())
}

model Campaign {
  id              String   @id @default(uuid())
  organizationId  String
  name            String
  templateId      String
  mediaUrl        String?                  // link da imagem/vídeo já hospedado
  status          String   @default("DRAFT") // DRAFT | SENDING | SENT | FAILED
  createdAt       DateTime @default(now())
}

model CampaignRecipient {
  id              String   @id @default(uuid())
  campaignId      String
  customerId      String
  channel         OptInChannel
  status          String   @default("QUEUED") // QUEUED | SENT | DELIVERED | READ | FAILED | OPTED_OUT
  errorMessage    String?
  sentAt          DateTime?
}
```

---

## 4. Arquitetura de envio proposta

- **WhatsApp**: integração com um provedor (BSP) — a decidir qual (Twilio, 360dialog, Gupshup, ou Cloud API direto da Meta). Fluxo: criar template no nosso sistema → enviar pra aprovação da Meta via API do provedor → esperar aprovação (pode levar de minutos a dias) → depois de aprovado, disparar campanha usando esse template + lista de clientes com `whatsappOptIn = true`
- **E-mail**: integração com serviço de envio (SendGrid/SES/Resend) — sem espera de aprovação, texto livre com personalização
- **Disparo em massa**: um serviço em segundo plano (mesmo padrão `@Interval` já usado no iFood) processa a fila de `CampaignRecipient`, um por um, registrando o resultado — não trava a tela nem faz uma campanha de 300 pessoas virar 300 cliques

---

## 5. Telas propostas

| Tela | O quê |
|---|---|
| **`/customers`** | Lista de clientes (nome, telefone, canal de origem, se deu opt-in) — pré-requisito de tudo isso, ainda não construída |
| **`/campaigns/templates`** | Criar/gerenciar templates (WhatsApp precisa de aprovação; e-mail não) |
| **`/campaigns/new`** | Escolher template, mídia, lista de destinatários (com opt-in), disparar |
| **`/campaigns/[id]`** | Acompanhar status de entrega por cliente |

---

## 6. Fases de implementação sugeridas

| Fase | O quê | Responsabilidade |
|---|---|---|
| 0 | Verificação de negócio na Meta (WhatsApp Business), escolha do provedor (BSP), contratação de serviço de e-mail | **Sua**, fora do meu alcance — mesma natureza do cadastro no Portal Developer do iFood |
| 1 | Campo de opt-in/opt-out em `Customer` + tela `/customers` | Baixo risco, não depende de nada externo |
| 2 | Upload de mídia (imagem/vídeo) com link público | Precisa decidir onde hospedar (S3, Cloudinary, etc.) |
| 3 | `CampaignTemplate` + fluxo de aprovação do WhatsApp | Depende da Fase 0 estar pronta |
| 4 | `Campaign`/`CampaignRecipient` + disparo em massa (fila) | Depende das Fases 0-3 |
| 5 | E-mail (mais simples, pode até vir antes do WhatsApp, já que não depende de aprovação externa) | Depende só da Fase 0 (contratar o serviço) |

---

## 7. Perguntas antes de eu começar a codar

1. **Confirma que entendeu a limitação real do WhatsApp** (template pré-aprovado, não texto livre)? Isso muda a experiência de uso.
2. **Já tem conta comercial verificada na Meta**, ou isso ainda precisa ser feito (Fase 0)?
3. **Qual provedor (BSP) prefere pro WhatsApp** — ou quer que eu pesquise e compare opções (Twilio, 360dialog, Gupshup) antes de decidir?
4. **Qual serviço de e-mail prefere** (SendGrid, SES, Resend) — ou também quer comparação?
5. **Onde hospedar imagem/vídeo** — já tem alguma conta de armazenamento (S3, Cloudinary, etc.), ou precisamos decidir isso também?
6. **Por onde começar**: sugiro a Fase 1 (`/customers` + opt-in) e a Fase 5 (e-mail) primeiro, já que não dependem de homologação externa — concorda?
