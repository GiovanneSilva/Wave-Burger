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
