# Reis do Ringue

Jogo de lutas automáticas (boxe + wrestling + super ataques de fantasia) feito como PWA.
Vite + TypeScript + Canvas 2D: todos os gráficos e sons são gerados em código, sem imagens nem áudio para descarregar.

```bash
npm install
npm run dev     # desenvolvimento
npm run build   # gera dist/ (deploy na Vercel com vercel.json)
```

- `src/fight/` — motor da luta (IA, golpes, agarrões, saltos da corda, supers, tag team), arena e cena.
- `src/render/` — esqueleto e desenho dos lutadores cartoon.
- `src/data/` — raridades, itens, atributos, baús, missões, ligas, notas de atualização.
- `src/core/` — estado/gravação, progressão, missões, baús, trocas, adversários.
- `src/ui/` — menus, criador de personagem, loja, coleção, baús, resultados.

Notas de atualização do jogo: `src/data/patchnotes.ts` (atualizar a cada versão).
