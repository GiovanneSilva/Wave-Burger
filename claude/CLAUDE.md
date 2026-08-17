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
