# Easie

Sistema web para afiliados do Mercado Livre que divulgam produtos em grupos do Facebook. O envio final é sempre **manual** (sem automação).

## Fase 2 — Controle por grupo + contas

- Cadastro de grupos (nome, link, tema, regras) com ativar/desativar
- Checklist por produto: pendente / postado / ignorado, abrir grupo + copiar texto, variação sugerida por grupo, aviso de re-post, progresso
- Fila de produtos e histórico com datas/grupos
- Contas individuais (e-mail/senha); dados privados por usuário em SQLite no servidor
- Migração opcional do `localStorage` (Fase 1) ao criar a conta
- Geração/cópia de textos da Fase 1 continua funcionando (também offline no navegador)
- UI pt-BR, mobile-first

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

Sem `AUTH_SECRET` o app sobe em modo desenvolvimento. Não use o fallback em produção.

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
3. Gerar textos em **Gerar** (produto entra na fila + checklist)
4. Em **Fila** → checklist: abrir grupo, copiar, marcar postado
5. Ver concluídos em **Histórico**

## Fora do escopo

Automação do Facebook, aba “Pegar produtos”, export CSV (Fase 3), pagamentos.
