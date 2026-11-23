# Easie

Sistema web para afiliados do Mercado Livre que divulgam produtos em grupos do Facebook. O envio final é sempre **manual** (sem automação).

- Entrada em `/` → login (`/conta`) ou workspace (`/gerar`) se já autenticado
- **Sem cadastro público** — usuários são criados manualmente (CLI)
- Login obrigatório para o workspace; dados privados por conta (Postgres em produção / SQLite local)
- Visual: UI escura graphite + neon (Absolute UI + Unslop), pt-BR, mobile-first

## Criar usuários (admin)

Não existe signup na UI nem em `/api/auth/signup`. Crie contas no servidor:

```bash
npm run user:create -- --name "Pablo" --username pablo --password 'senha-segura'
```

O script grava no **mesmo banco do app**: `DATABASE_URL` Postgres (Neon/Vercel) em produção, ou SQLite local (`DATABASE_PATH` / `file:…`, padrão `./data/easie.db`). Faz hash da senha e semeia o modelo de texto padrão.

Depois disso, a pessoa entra em `/conta` com **usuário** e senha (não e-mail).

Contas antigas com e-mail recebem `username` automático (parte local do e-mail) na migração do banco.

## Fase 2 — Controle por grupo + contas

- Cadastro de grupos (nome, link, tema, regras) com ativar/desativar
- Checklist por produto: pendente / postado / ignorado, abrir grupo + copiar texto, variação sugerida por grupo, aviso de re-post, progresso
- Fila de produtos e histórico com datas/grupos
- Contas individuais (usuário/senha); dados privados por usuário no banco do servidor
- UI pt-BR, mobile-first

## Fase 3 — Backup e relatórios

- Exportar / importar todos os dados em CSV (`# easie-backup-v1`) — Conta
- Excluir conta e dados na nuvem
- Relatórios: posts hoje / semana / total + gráfico 7 dias
- Resultados manuais por produto (cliques, vendas, comissão)

## Fase 4 — Produtos em alta

- Aba **Pegar produtos** (`/pegar-produtos`): lista compartilhada dos mais vendidos por categoria
- Atualização automática semanal (ou diária via `ML_REFRESH_CADENCE=daily`)
- Abrir no ML → colar link de afiliado → preenche Gerar textos
- Marcar “já peguei” / ocultar; filtro por categoria e busca
- Sem `ML_ACCESS_TOKEN`: tenta busca pública ML, senão lista demo (RF47: mantém último cache)

## Fase 5 — Melhorias

- **RF05:** Preencher nome/preço a partir do link de afiliado (`/api/ml/lookup`)
- **RF17:** Importar grupos por colagem ou CSV em **Grupos**
- **RF12:** Modelos por categoria / sazonalidade (ex.: Natal); geração escolhe o modelo certo

## Requisitos

- **Node.js 22.13+** (usa o módulo nativo `node:sqlite` — sem compilação C++ / Visual Studio Build Tools no Windows)

## Como rodar

```bash
npm install
cp .env.example .env.local   # opcional em dev
npm run user:create -- --name "Admin" --username admin --password 'trocar-agora'
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) — você cai no login.

Em local, o SQLite é criado automaticamente em `data/easie.db` (ou no caminho de `DATABASE_PATH` / `file:…`). Em produção na Vercel, use **Postgres** via `DATABASE_URL` (Neon-friendly) — o schema sobe sozinho no cold start (`ensurePgSchema`).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `AUTH_SECRET` | Produção / Vercel | Segredo para assinar o cookie de sessão. Gere com `openssl rand -base64 32`. Em dev há fallback (aviso na tela Conta). |
| `DATABASE_URL` | Produção / Vercel | Connection string Postgres (`postgresql://…` / `postgres://…`). Neon, Vercel Postgres, etc. Sem isso (ou com `file:…`) o app usa SQLite local. |
| `DATABASE_PATH` | Não (local) | Caminho do arquivo SQLite (padrão `./data/easie.db`). |
| `ML_ACCESS_TOKEN` | Não | Bearer do app Mercado Livre (Highlights oficiais). Alias: `MERCADOLIBRE_ACCESS_TOKEN`. |
| `ML_APP_ID` / `ML_CLIENT_ID` | Não | ID do aplicativo ML (documentação / OAuth futuro). |
| `ML_CLIENT_SECRET` | Não | Secret do aplicativo ML — nunca commitado. |
| `ML_SITE_ID` | Não | Site ML (padrão `MLB`). |
| `ML_REFRESH_CADENCE` | Não | `weekly` (padrão) ou `daily`. |
| `ML_CATEGORIES` | Não | Override `id:Nome,...` das categorias iniciais. |

Sem `AUTH_SECRET` o app sobe em modo desenvolvimento. Não use o fallback em produção.
Sem credenciais ML a aba Pegar produtos continua utilizável com fallback/demo.

### Deploy Vercel (usuários persistentes)

1. Crie um banco Postgres (ex.: [Neon](https://neon.tech) → Connect → copie a connection string).
2. No projeto Vercel → **Settings → Environment Variables**:
   - `AUTH_SECRET` = saída de `openssl rand -base64 32` (Production + Preview)
   - `DATABASE_URL` = `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`
3. (Opcional) Empurre o schema com Drizzle a partir da máquina local:
   ```bash
   DATABASE_URL='postgresql://…' npm run db:push
   ```
   Se pular, o app ainda cria as tabelas no primeiro request (`ensurePgSchema`).
4. Redeploy. Crie o primeiro usuário apontando para o mesmo banco:
   ```bash
   DATABASE_URL='postgresql://…' npm run user:create -- --name "Admin" --username admin --password 'trocar-agora'
   ```

**Não invente nem commit secrets.** Só nomes de variáveis + passos acima. `DATABASE_URL` é reservado no bind de secrets do Cursor publish — configure-a direto no painel da Vercel / Neon.

Local sem Postgres: omita `DATABASE_URL` postgres e use SQLite (Node 22.13+).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Servir build |
| `npm run lint` | ESLint |
| `npm run user:create` | Criar usuário no banco ativo (`DATABASE_URL` ou SQLite) |
| `npm run db:push` | Empurrar schema Drizzle para Postgres (`DATABASE_URL`) |
| `npm run db:studio` | Drizzle Studio (Postgres) |

## Fluxo sugerido

1. Admin cria a conta com `npm run user:create`
2. Usuário entra em **Conta**
3. Cadastrar grupos em **Grupos**
4. (Opcional) Escolher sugestão em **Pegar produtos** e colar o link de afiliado
5. Gerar textos em **Gerar** (produto entra na fila + checklist)
6. Em **Fila** → checklist: abrir grupo, copiar, marcar postado
7. Ver concluídos em **Histórico**

## Fora do escopo

Automação do Facebook, pagamentos/comissões automáticas, edição de imagens, cadastro público self-service.
