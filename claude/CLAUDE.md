# CLAUDE.md — Wave Burger

> Este arquivo é a instrução permanente para qualquer agente (Claude ou outro) que trabalhe neste repositório. Ele deve ser lido antes de qualquer implementação. Em caso de conflito entre este arquivo e um pedido pontual, sinalize o conflito antes de agir.

## 1. Objetivo do Wave Burger

O Wave Burger é uma plataforma de gestão inteligente para uma hamburgueria que nasce em operação de **delivery**, inicialmente via iFood, com possibilidade de expansão futura para múltiplas unidades e franquias.

O produto **não é um sistema de cadastro**. Seu propósito é centralizar dados operacionais, financeiros e comerciais e transformá-los em respostas para perguntas de negócio (custo real de produção, margem por produto, impacto de aumento de custo de insumo, ponto de equilíbrio, etc.).

Fonte da verdade do negócio: **`Wave Burger — Documento Mestre de Produto e Negócio` (v0.1)**. Este `CLAUDE.md` não substitui o Documento Mestre — ele traduz a documentação em regras de engenharia.

## 2. Módulos

Na ordem em que aparecem no Documento Mestre:

1. Produtos
2. Ficha Técnica (núcleo funcional do sistema)
3. Ingredientes
4. Fornecedores
5. Compras
6. Estoque
7. Financeiro
8. BI e Analytics
9. Usuários, Perfis e Permissões
10. Auditoria

Módulos adicionais tratados pelo roadmap de implementação, mas ainda sem especificação formal completa no Documento Mestre (ver `docs/pendencias.md`):

- **Vendas/Pedidos manuais** — existe no Modelo de Domínio e nos casos de uso como efeito colateral (baixa de estoque, geração financeira), mas não há um RF dedicado ao cadastro do pedido em si. Os campos devem ser confirmados com o usuário antes da implementação (Etapa 16).
- **Integração iFood** — citada na Visão, Premissas e Roadmap, mas o "capítulo de integração" ainda não existe no Documento Mestre. Não deve ser implementada sem essa definição prévia (Etapa 20).

## 3. Arquitetura

**Stack técnica definitiva (Etapa 3 — confirmada em 17/08/2026):**

- **Frontend:** Next.js + TypeScript
- **Backend:** NestJS + TypeScript
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Testes backend:** Jest
- **Testes end-to-end:** Playwright
- **Ambiente local:** Docker

Justificativa (avaliada contra simplicidade, manutenção, geração de código com IA, integração futura com iFood e crescimento multi-unidade):

- TypeScript ponta a ponta reduz erro de contrato entre frontend e backend, e é a combinação mais bem representada em geração de código por IA, reduzindo risco de alucinação de API.
- NestJS oferece módulos com injeção de dependência que mapeiam diretamente para a exigência de modularidade e isolamento de integrações externas (Seção 1.7/8 do Documento Mestre) — a futura integração com iFood poderá ser implementada como módulo/adapter isolado sem vazar seu formato para o domínio.
- PostgreSQL + Prisma suportam nativamente tipo `NUMERIC`/`Decimal`, atendendo à regra de nunca usar `float`/`double` para valores monetários (Seção 5 deste documento).
- PostgreSQL lida bem com o modelo relacional multi-tenant (`Organization`/`BusinessUnit`) exigido desde a fundação do banco (Seção 3, princípio "multi-unidade desde o início").
- Prisma facilita migrations versionadas e reversíveis, alinhado à Seção 6 e 9 deste documento.

**Convenção obrigatória decorrente da stack:** todo valor monetário ou de custo deve usar o tipo `Decimal` do Prisma/PostgreSQL (nunca `number`/`float` em TypeScript) em qualquer camada — modelo, DTO, cálculo ou serialização.

Princípios arquiteturais já válidos independentemente da stack escolhida (derivados da Seção 1.7 e 8 do Documento Mestre):

- **Fonte única da verdade**: uma informação fundamental tem um único cadastro central. Exemplo: o custo do ingrediente existe apenas no cadastro do ingrediente (BR-003); nunca duplicar esse dado em outra entidade.
- **Automação de cálculos**: sempre que o sistema tiver os dados necessários, o cálculo não deve depender de intervenção humana.
- **Modularidade**: módulos devem poder evoluir de forma independente, mas sem duplicar regras de negócio entre si. Efeitos entre módulos (ex.: compra confirmada → estoque → financeiro) devem ser implementados via serviços de aplicação ou eventos internos, nunca duplicando lógica em cada módulo.
- **Multi-unidade desde o início**: as entidades `Organization` e `BusinessUnit` devem existir desde a fundação do banco, mesmo que o MVP opere com uma única unidade. Não construir premissas de "unidade única" nos modelos de domínio.
- **Isolamento de integrações externas**: qualquer integração externa (iFood e futuras) deve ser implementada como adapter isolado. O domínio do Wave Burger nunca deve depender diretamente do formato de uma API externa.
- **IDs**: todas as entidades de negócio usam UUID como identificador.
- **Simplicidade no MVP**: não implementar complexidade de franquia, multi-unidade operacional ou integrações automáticas enquanto não solicitado.

## 4. Regras arquiteturais

- Nenhum módulo de negócio implementa auditoria própria — todos reutilizam o mecanismo central de `AuditLog` (Etapa 7 do roadmap).
- Nenhum módulo de negócio implementa checagem de permissão própria — toda operação sensível passa pelo mecanismo central de autorização baseado em `Role`/`Permission`.
- Registros historicamente relevantes (ex.: fichas técnicas, movimentações de estoque, log de auditoria) são **imutáveis/append-only**; correções são feitas por novos registros, nunca por edição destrutiva do histórico.
- Entidades com impacto operacional (Produto, Ingrediente, Fornecedor) são inativadas, nunca excluídas fisicamente, preservando histórico (RF-003).
- Toda mudança de estado com efeito em múltiplos módulos (ex.: confirmação de compra) deve ser transacional — falha parcial não pode deixar estoque, financeiro ou auditoria inconsistentes entre si.

## 5. Convenções de código

A serem detalhadas junto da definição de stack (Etapa 3). Já valem, independentemente da stack:

- Nomenclatura das entidades no código deve espelhar os termos do Modelo de Domínio do Documento Mestre (`Produto`, `FichaTecnica`, `Ingrediente`, `Fornecedor`, `Compra`, `Estoque`, `MovimentacaoEstoque`, `Venda`, `LancamentoFinanceiro`, `Usuario`, `Role`, `Permission`, `AuditLog`) para manter rastreabilidade entre documentação e código.
- Valores monetários e de custo nunca usam ponto flutuante (`float`/`double`); usar tipo decimal/fixed-point para evitar erro de arredondamento em cálculos de CMV, markup e margem.
- Datas/horas armazenadas em UTC; conversão de fuso tratada na camada de apresentação.

## 6. Regras de banco

- Chave primária: UUID em todas as tabelas de domínio de negócio.
- Toda mudança de schema ocorre via migration versionada — nunca alteração manual direta no banco.
- Constraints de integridade referencial obrigatórias entre `Organization`/`BusinessUnit` e as demais entidades.
- Tabelas de histórico (versões de ficha técnica, movimentações de estoque, auditoria) não permitem `UPDATE`/`DELETE` de registros já confirmados — apenas inserção de novos registros.
- Todo ambiente de desenvolvimento deve ter seed mínimo reprodutível.

## 7. Regras de auditoria

- Mecanismo central e reutilizável, implementado antes dos módulos de negócio (Etapa 7).
- Toda ação crítica registra: usuário, data/hora, ação, entidade, ID da entidade, valor anterior, valor posterior e metadata relevante (RF-033).
- São consideradas ações críticas, no mínimo, alterações que impactem: estoque, custo, preço, ficha técnica, financeiro e permissões (Seção 9 do Documento Mestre).
- Auditoria serve tanto para segurança quanto para diagnóstico operacional (ex.: investigar por que a margem de um produto caiu).

## 8. Estratégia de testes

- Testes de cálculo com valores conhecidos são obrigatórios para os módulos de custo, ficha técnica, financeiro e BI — sempre demonstrando o exemplo numérico esperado vs. obtido.
- Cada módulo de negócio inclui testes de autorização (permissão negada deve bloquear a operação).
- Teste ponta a ponta obrigatório antes de avançar de fase: ciclo completo Fornecedor → Compra → Ingrediente → Estoque → Produto → Ficha Técnica → Venda → Baixa de estoque → Financeiro. A fase só é considerada concluída se os números baterem.
- Framework de testes: a definir na Etapa 3, junto da stack.

## 9. Regras para migrations

- Toda entidade nova ou alterada gera migration própria, versionada e reversível quando possível.
- Migrations devem ser executadas e validadas (rodar + testar) antes de uma etapa ser considerada concluída.
- Seed de desenvolvimento deve acompanhar novas entidades relevantes.

## 10. Regra de não implementar funcionalidades futuras sem solicitação

O agente implementa **apenas o escopo da etapa solicitada**. Não adianta funcionalidades de etapas futuras do roadmap, mesmo que pareçam relacionadas ou "quase prontas". Ao final de cada etapa, o agente para e aguarda a próxima instrução explícita — nunca prossegue automaticamente para a etapa seguinte.

## 11. Regra de nunca alterar uma regra de negócio sem sinalizar

Nenhuma regra de negócio (`BR-XXX`) ou requisito (`RF-XXX`) do Documento Mestre pode ser alterado, reinterpretado ou "resolvido temporariamente" pelo agente. Decisões ainda pendentes (`PD-001` a `PD-008`, listadas em `docs/pendencias.md`) devem ser sinalizadas ao usuário — nunca resolvidas unilateralmente, mesmo que a implementação pareça exigir uma resposta imediata.

## 12. Regra de manter documentação e código sincronizados

Qualquer decisão tomada durante a implementação (resolução de uma pendência, escolha técnica relevante, mudança de escopo) deve ser registrada de volta neste `CLAUDE.md` e, quando for uma decisão de negócio, também deve ser sinalizada para eventual atualização do Documento Mestre. O código nunca deve divergir silenciosamente da documentação.

## 13. Histórico de decisões registradas

| Data | Decisão | Etapa |
|------|---------|-------|
| 2026-08-17 | Leitura da documentação validada pelo usuário | Etapa 1 |
| 2026-08-17 | CLAUDE.md criado | Etapa 2 |
| 2026-08-17 | Stack técnica confirmada: Next.js+TS (front), NestJS+TS (back), PostgreSQL, Prisma, Jest, Playwright, Docker | Etapa 3 |
| 2026-08-17 | Fundação organizacional criada: Organization/BusinessUnit (UUID, FK RESTRICT, unique [organizationId, name]), migration versionada, seed mínimo. `prisma generate`/`migrate dev` bloqueados no sandbox de desenvolvimento (binário do engine); migration validada via SQL direto + testes automatizados com driver `pg` (7/7 passando) | Etapa 5 |
| 2026-08-17 | Autenticação e autorização implementadas: User/Role/Permission/RolePermission/UserRole (migration versionada); JWT stateless (login/me) — logout é decisão técnica de escopo: sem blacklist/refresh-token nesta etapa (revisar se necessidade de revogação imediata surgir); PermissionsGuard central reutilizável (BR-014); perfis seed ADMIN/STOCK_OPERATOR/FINANCE/VIEW_ONLY, só ADMIN com permissões nesta etapa (módulos de negócio ainda não existem). Resolvida dependência circular AuthModule↔UsersModule via forwardRef. Mesma limitação de `prisma generate` da Etapa 5 impede subir a app completa no sandbox — validado via 11 testes unitários (guard/service com mocks) + 11 testes estruturais via SQL direto (`pg`) | Etapa 6 |
| 2026-08-17 | Auditoria central implementada: AuditLog (migration versionada) com append-only garantido por trigger no PostgreSQL (bloqueia UPDATE/DELETE mesmo fora da aplicação — validado por teste); AuditService global (`record`, `findByEntity`, `findMany`) pronto para ser reutilizado pelos módulos de negócio nas próximas etapas, sem integração retroativa em Users/Auth ainda (fora do escopo desta etapa). `entity`/`action` como strings livres (não enum) para não acoplar o mecanismo central a módulos futuros. 14 testes unitários + 6 estruturais (incl. bloqueio de UPDATE/DELETE) passando | Etapa 7 |
| 2026-08-17 | Ingredientes implementado (RF-009, RF-010, BR-003): catálogo no nível da Organization (não por BusinessUnit — receitas normalmente compartilhadas entre unidades; revisar se necessário catálogo por unidade). Campo `currentStock` de RF-009 deliberadamente omitido — pertence ao módulo de Estoque (Etapa 13); só `minimumStock` (limite configurado) existe agora. `standardUnit` é texto validado por lista prática (kg/g/l/ml/un), sem resolver PD-011 (conversão de unidades, segue em aberto). Permissões `ingredients:read`/`ingredients:manage` concedidas só a ADMIN nesta etapa — RF-030 restringe acesso de STOCK_OPERATOR a informação de lucro/custo; revisar granularidade de permissão por perfil quando Estoque/Financeiro existirem. Primeiro módulo de negócio a reutilizar AuditService (Etapa 7) e PermissionsGuard (Etapa 6) sem duplicar mecanismo, validando a arquitetura definida no CLAUDE.md Seção 4. BR-004 (recálculo de produtos ao mudar custo) não implementado — não existe Produto/FichaTecnica ainda; alteração de custo gera nota informativa no audit log até a Etapa 10. 20 testes unitários + 6 estruturais passando; frontend mínimo em `/ingredients` (autenticação via token colado manualmente — não há tela de login ainda) | Etapa 8 |
| 2026-08-17 | Produtos implementado (RF-001/002/003, BR-001): status DRAFT/ACTIVE/INACTIVE (enum nativo Postgres), catálogo por Organization (mesmo critério de Ingredient). BR-001 ("não pode ativar sem ficha técnica válida") resolvido com FichaTecnicaValidationPort injetável — a implementação atual (PendingFichaTecnicaValidator) SEMPRE nega ativação, já que Ficha Técnica não existe (Etapa 10); nenhum produto pode ser ativado até a porta ser trocada por uma implementação real, o que respeita a regra sem inventar exceção temporária. Inativação (RF-003) não depende dessa checagem. Unique (organizationId, name) e (organizationId, internalCode) — NULL em internalCode não conflita. Permissões `products:read`/`products:manage` só ADMIN, mesma lógica da Etapa 8. 26 testes unitários (incl. prova de que BR-001 bloqueia e de que a porta funciona quando aprova) + 8 estruturais passando | Etapa 9 |
| 2026-08-17 | Ficha Técnica implementada (RF-004 a RF-007, BR-001 a BR-005) — núcleo funcional do sistema. Versionada e imutável (nunca UPDATE numa versão — cada mudança cria version+1); só uma versão "corrente" por produto garantida por índice único PARCIAL no Postgres (validado com teste real de conflito). BR-001 finalmente resolvido de verdade: PendingFichaTecnicaValidator (Etapa 9) substituído por FichaTecnicaValidator real, que consulta a ficha corrente do produto — prova de integração ponta a ponta incluída. Conversão de unidade implementada APENAS para família métrica pura (kg↔g, l↔ml, fator 1000) — conversões entre famílias diferentes continuam bloqueadas, preservando PD-011 em aberto. UC-002 (ingrediente inativo não pode entrar em nova composição) e ausência de custo médio são validados na criação. "Custo da embalagem" (RF-006) não é um indicador separado — embalagem é só mais um item da ficha, igual ao exemplo do Documento Mestre; custo indireto (PD-003) não incorporado, totalCost = soma dos itens apenas. BR-004 (recálculo ao mudar custo) resolvido com recálculo SOB DEMANDA (`getCurrentCostSummary`, compara custo congelado vs. custo atual do ingrediente) em vez de reescrever versões históricas ou auto-versionar — preserva a imutabilidade. CMV/markup/margem calculados com fórmulas padrão de gestão (CMV%=custo/preço×100, markup=preço/custo, margem%=(preço-custo)/preço×100); indicadores retornam null quando o produto não tem preço definido (rascunho). Exemplo matemático completo demonstrado em teste (Smash Burger: pão+carne+queijo+molho+embalagem = R$9,10 de custo, 28.90 de venda → CMV 31,49%, markup 3,18x, margem 68,51%, lucro R$19,80). 51 testes unitários + 8 estruturais passando | Etapa 10 |
| 2026-08-17 | Fornecedores implementado (RF-011, RF-012): CRUD completo com inativação (nunca exclusão física), relação N:N Fornecedor↔Ingrediente via SupplierIngredient. "Fornecedor preferencial" (RF-012) — só um por ingrediente — garantido por índice único PARCIAL no Postgres, mesma técnica da "versão corrente" da Etapa 10; lógica de marcar-como-preferencial (desmarcar outros antes de vincular, dentro de transação) testada explicitamente, incluindo ordem das operações. RF-013 (histórico de preços) NÃO implementado nesta etapa — depende de dados reais de Compras (Etapa 12), que ainda não existe; a estrutura relacional criada é o que uma futura Compra vai referenciar. Permissões `suppliers:read`/`suppliers:manage` só ADMIN, mesmo padrão das etapas anteriores. 59 testes unitários + 8 estruturais passando | Etapa 11 |
| 2026-08-17 | Compras implementado (RF-014): registro (DRAFT) e confirmação, com efeitos em Estoque/Financeiro preparados via evento interno `purchase.confirmed` (EventEmitter2), NÃO implementados diretamente — Estoque (Etapa 13) e Financeiro (Etapa 15) ainda não existem. PurchasesModule não conhece nenhum dos dois; qualquer módulo futuro só precisa se inscrever no evento, sem exigir mudança em Compras (claude/CLAUDE.md, Seção 4). Único listener ativo hoje: IngredientsPurchaseListener, que atualiza `lastCost`/`lastPurchaseDate` do ingrediente (dado objetivo) — NUNCA `averageCost`, pois BR-008 (custo médio) depende de PD-002 (metodologia), que segue em aberto; testado explicitamente que `averageCost` nunca aparece no payload de update. Conversão de preço por unidade (kg↔g, l↔ml) reaproveita o mesmo unit-conversion.ts da Ficha Técnica (Etapa 10), agora movido para `src/common/`. Status DRAFT/CONFIRMED/CANCELLED — apenas DRAFT pode ser confirmada ou cancelada (estado terminal depois disso). Compra guarda organizationId + businessUnitId (RF-014 "unidade") e referências a criador/confirmador. Permissões `purchases:read`/`purchases:manage` só ADMIN. 75 testes unitários + 8 estruturais passando | Etapa 12 |
| 2026-08-17 | Estoque implementado (RF-015, RF-017, RF-018, BR-006, BR-010 a BR-012): StockBalance (saldo atual por unidade+ingrediente — o campo `currentStock` de RF-009 que foi deliberadamente omitido de Ingredient na Etapa 8) e StockMovement (histórico append-only, mesma técnica de trigger da audit_logs/Etapa 7). BR-006 finalmente fecha o ciclo aberto na Etapa 12: StockPurchaseListener reage a `purchase.confirmed` gerando entrada de estoque, sem qualquer alteração em PurchasesModule — prova de que o desacoplamento por evento funciona de verdade, com dois listeners independentes reagindo ao mesmo evento. BR-010 (saldo nunca negativo) aplicado como regra geral segura, dentro de transação atômica (movimentação + saldo); ressalva de PD-001 (venda sem estoque) é específica do módulo de Vendas (Etapa 16, ainda não existe) e não foi resolvida aqui. RF-017: motivo obrigatório em ajuste manual (enum LOSS/WASTE/INVENTORY/CORRECTION/RETURN — categorias do próprio Documento Mestre), reforçado por CHECK constraint no banco (testado). RF-018/BR-011: implementada só a DETECÇÃO de ingredientes abaixo do mínimo (query `listBelowMinimum`) — entrega de alerta (e-mail/push) não implementada, pois depende de PD-008 (canais/responsáveis), em aberto. RF-016/BR-009 (baixa por venda) NÃO implementado — depende de Vendas (Etapa 16, PD-010). Mudança de permissões: primeira vez que um perfil além de ADMIN recebe acesso real — `STOCK_OPERATOR` ganha `stock:read`/`stock:manage`, conforme RF-030 descreve literalmente ("registrar entradas; registrar perdas; realizar ajustes autorizados; consultar estoque"); custo continua restrito a ADMIN via ingredients:read/manage. 84 testes unitários + 8 estruturais (incl. bloqueio real de UPDATE/DELETE e CHECK constraints) passando | Etapa 13 |
| 2026-08-17 | Financeiro essencial implementado (RF-020 a RF-024, BR-007, BR-016): FinancialEntry cobre contas a pagar/receber (RF-021/022), categorias de RF-023 (enum explícito, sem invenção), fluxo de caixa (RF-020, soma de entradas/saídas liquidadas num período — granularidade dia/semana/mês é escolha do chamador ao definir o intervalo) e DRE gerencial (RF-024). BR-007 fecha o TERCEIRO braço do evento `purchase.confirmed` (depois de custo, Etapa 12, e estoque, Etapa 13): FinancialPurchaseListener cria lançamento PAYABLE/MATERIA_PRIMA automaticamente, sem alterar PurchasesModule — três listeners independentes provam a arquitetura de desacoplamento por evento. DRE: "taxas" = despesas categoria PLATAFORMA (ex. comissão iFood); "impostos" é parâmetro manual opcional, default zero — PD-006 (regime tributário) segue sem definição, nenhum cálculo automático implementado; CMV aproximado por despesas categoria MATERIA_PRIMA no período (BR-016: derivado de lançamentos registrados/categorizados), já que não há Vendas (Etapa 16) para CMV real por volume vendido — interpretação documentada, revisar quando Vendas existir. FinancialEntry NÃO é append-only (diferente de AuditLog/StockMovement) — tem ciclo de vida editável até liquidação (PENDING→PAID/CANCELLED). Segunda mudança de permissão além de ADMIN: `FINANCE` ganha `financial:read`/`financial:manage`, conforme RF-031 literalmente. Exemplo numérico completo testado (receita R$10.000, taxas R$1.200, CMV R$3.000, despesas operacionais R$2.700 → resultado operacional R$2.500). 97 testes unitários + 7 estruturais passando | Etapa 14 |
| 2026-08-17 | BI e Analytics essencial implementado (RF-025 a RF-027, BR-017) — módulo puramente de leitura/agregação, SEM nova tabela/migration. RF-025: faturamento e CMV/margem/lucro vêm do Financeiro (Etapa 14); "produtos mais lucrativos" ranqueia por lucro ATUAL recalculado ao vivo via FichaTecnicaService.getCurrentCostSummary (Etapa 10) — satisfaz BR-017 (indicadores devem refletir custo atual) reutilizando código já testado, sem duplicar cálculo. "Produtos mais vendidos", "ticket médio" e "ponto de equilíbrio" retornam null com nota explicativa — dependem de volume de vendas (Vendas, Etapa 16, PD-010); ponto de equilíbrio depende também de uma classificação custo fixo/variável que o Documento Mestre não define, então não foi inventada. RF-026: dashboard de estoque inteiramente composto a partir do StockService (Etapa 13) — novo método `getConsumptionSummary` (soma de saídas por ingrediente num período) adicionado ao StockService, não ao Analytics, mantendo a lógica de domínio centralizada; hoje só reflete ajustes manuais, já que baixa por venda ainda não existe. RF-027: histórico de preço por fornecedor derivado de PurchaseItem+Purchase (Etapa 12), fornecedores vinculados via SuppliersService.findSuppliersByIngredient (Etapa 11) reutilizado sem duplicação. Permissões: reaproveitadas as já existentes por área (`financial:read` para dashboard executivo, `stock:read` para estoque, `suppliers:read` para análise de fornecedores) em vez de criar uma permissão nova de "analytics" — mais coerente semanticamente. 107 testes unitários passando (nenhum teste estrutural novo, já que não há schema novo) | Etapa 15 |
