# Easie

Gerador de posts para afiliados do Mercado Livre que divulgam em grupos do Facebook.

## Fase 1 (MVP)

- Cadastro de produto: link de afiliado, nome, preço, frete grátis, entrega rápida
- Modelos de texto com variáveis (`{{nome}}`, `{{preco}}`, `{{link}}`, `{{frete}}`, `{{entrega}}`) e modelo padrão
- Geração de 3–5 variações editáveis + copiar com um toque
- Sem login; dados no `localStorage` do navegador
- Interface em português (pt-BR), mobile-first

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando        | Descrição              |
|----------------|------------------------|
| `npm run dev`  | Desenvolvimento        |
| `npm run build`| Build de produção      |
| `npm start`    | Servir build           |
| `npm run lint` | ESLint                 |

## Fora do escopo (Fase 1)

Automação do Facebook, checklist de grupos, login na nuvem, aba “Pegar produtos”, pagamentos.
