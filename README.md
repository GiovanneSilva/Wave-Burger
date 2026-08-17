# Wave Burger

Plataforma de gestão inteligente para hamburgueria — centraliza dados operacionais, financeiros e comerciais e os transforma em respostas para perguntas de negócio (custo real, margem, ponto de equilíbrio, etc).

Fonte da verdade do negócio: `Documento Mestre de Produto e Negócio (v0.1)`.
Instruções permanentes de engenharia: [`claude/CLAUDE.md`](./claude/CLAUDE.md).

> Este repositório está na Etapa 4 do roteiro de implementação (estrutura inicial). Nenhuma regra de negócio foi implementada ainda.

## Stack

- **Frontend:** Next.js + TypeScript
- **Backend:** NestJS + TypeScript
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Testes backend:** Jest
- **Testes end-to-end:** Playwright
- **Ambiente local:** Docker

## Estrutura do repositório

```
.
├── backend/          # API NestJS
├── frontend/          # Next.js
├── claude/            # Documentação de instrução do agente
├── docker-compose.yml
└── .env.example
```

## Executando localmente

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- npm

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Ajuste os valores se necessário (credenciais padrão de desenvolvimento já funcionam com o `docker-compose.yml`).

### 2. Subir banco de dados

```bash
docker compose up -d postgres
```

### 3. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

API disponível em `http://localhost:3001`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Aplicação disponível em `http://localhost:3000`.

### 5. Rodando com Docker Compose (tudo junto)

```bash
docker compose up --build
```

## Testes

### Backend (Jest)

```bash
cd backend
npm run test        # testes unitários
npm run test:e2e    # testes end-to-end da API
```

### Frontend (Playwright)

```bash
cd frontend
npx playwright install
npm run test:e2e
```

## Lint e formatação

```bash
# backend
cd backend && npm run lint

# frontend
cd frontend && npm run lint
```

## Status do projeto

Ver histórico de decisões e pendências em [`claude/CLAUDE.md`](./claude/CLAUDE.md) e [`claude/pendencias.md`](./claude/pendencias.md).
