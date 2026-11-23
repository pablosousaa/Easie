# Easie

Sistema web (SaaS-style) para afiliados do Mercado Livre que divulgam produtos em grupos do Facebook. O envio final é sempre **manual** (sem automação).

- Landing em `/` · workspace em `/gerar` (login obrigatório; sidebar no desktop, bottom nav no mobile)
- Visual: UI escura graphite + neon (Absolute UI + Unslop), pt-BR, mobile-first

## Fase 2 — Controle por grupo + contas

- Cadastro de grupos (nome, link, tema, regras) com ativar/desativar
- Checklist por produto: pendente / postado / ignorado, abrir grupo + copiar texto, variação sugerida por grupo, aviso de re-post, progresso
- Fila de produtos e histórico com datas/grupos
- Contas individuais (e-mail/senha); dados privados por usuário em SQLite no servidor
- **Login obrigatório** para o workspace (sem modo convidado / localStorage-only)
- Migração opcional de dados antigos do aparelho ao criar a conta
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
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

O banco SQLite é criado automaticamente em `data/easie.db` (ou no caminho de `DATABASE_PATH` / `DATABASE_URL`).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `AUTH_SECRET` | Produção | Segredo para assinar o cookie de sessão. Em dev há fallback (aviso na tela Conta). |
| `DATABASE_PATH` | Não | Caminho do arquivo SQLite (padrão `./data/easie.db`). |
| `DATABASE_URL` | Não | Alternativa `file:./caminho/easie.db`. |
| `ML_ACCESS_TOKEN` | Não | Bearer do app Mercado Livre (Highlights oficiais). Alias: `MERCADOLIBRE_ACCESS_TOKEN`. |
| `ML_APP_ID` / `ML_CLIENT_ID` | Não | ID do aplicativo ML (documentação / OAuth futuro). |
| `ML_CLIENT_SECRET` | Não | Secret do aplicativo ML — nunca commitado. |
| `ML_SITE_ID` | Não | Site ML (padrão `MLB`). |
| `ML_REFRESH_CADENCE` | Não | `weekly` (padrão) ou `daily`. |
| `ML_CATEGORIES` | Não | Override `id:Nome,...` das categorias iniciais. |

Sem `AUTH_SECRET` o app sobe em modo desenvolvimento. Não use o fallback em produção.
Sem credenciais ML a aba Pegar produtos continua utilizável com fallback/demo.

Hospedagem barata: qualquer VPS/Node 22+ com disco persistente (SQLite). Evite serverless sem volume — o arquivo do banco precisa persistir.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Servir build |
| `npm run lint` | ESLint |

## Fluxo sugerido

1. (Opcional) Criar conta em **Conta** e migrar dados locais
2. Cadastrar grupos em **Grupos**
3. (Opcional) Escolher sugestão em **Pegar produtos** e colar o link de afiliado
4. Gerar textos em **Gerar** (produto entra na fila + checklist)
5. Em **Fila** → checklist: abrir grupo, copiar, marcar postado
6. Ver concluídos em **Histórico**

## Fora do escopo

Automação do Facebook, pagamentos/comissões automáticas, edição de imagens.
