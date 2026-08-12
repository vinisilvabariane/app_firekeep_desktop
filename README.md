# Firekeep

Monolito Node + React/Electron para vibe code com Pomodoro automatico, musica por YouTube, fundo visual local e terminais interativos.

Status: beta. As versoes atuais seguem `1.0.0-beta.x`; a versao `1.0.0` fica reservada para o lancamento estavel.

## Rodar

```bash
npm install
npm run dev
```

`npm run dev` sobe o servidor Node em `http://127.0.0.1:5173` e injeta o Vite como middleware. As rotas de API ficam no mesmo host:

- `GET /api/health`
- `GET /api/workspace`
- `GET /api/projects`
- `POST /api/background-assets` — salva imagem/GIF e registra na biblioteca com nome (corpo binario puro; o mime vai em `Content-Type` e o nome em `x-firekeep-name`)
- `GET /api/backgrounds` — lista a biblioteca de fundos salvos
- `POST /api/backgrounds` — renomeia/registra `{ url, name }`
- `DELETE /api/backgrounds` — remove `{ url }` (apaga o arquivo do disco)
- `GET /api/video-links` — lista musicas do YouTube com nome e link
- `POST /api/video-links` — adiciona ou renomeia `{ url, label }`
- `DELETE /api/video-links` — remove `{ url }`
- `GET /api/fs/list?path=` — lista uma pasta (usado pelo explorador)
- `GET /api/fs/read?path=` — le um arquivo de texto para o editor (limite 2MB)
- `POST /api/fs/write` — salva `{ path, content }`
- `WS /api/terminal`

## Rodar como desktop

```bash
npm run electron:dev
```

Esse comando abre uma janela Electron e reaproveita o mesmo React/Vite e o mesmo backend Node/Express local. Para testar a versao de producao dentro do Electron:

```bash
npm run electron:start
```

## Publicar atualizacoes

As versoes instaladas verificam atualizacoes no GitHub Releases do Firekeep ao
iniciar. Quando uma versao nova estiver pronta, ela e baixada em segundo plano e
o app pede apenas o reinicio para concluir a instalacao.

Para publicar uma nova versao, altere `version` no `package.json`, crie uma
variavel de ambiente `GH_TOKEN` com permissao para publicar releases no
repositorio e execute:

```powershell
$env:GH_TOKEN="seu-token-do-github"
npm run desktop:publish
```

O comando envia para a release o instalador e o arquivo `latest.yml`, que e o
manifesto usado pelos apps instalados para encontrar a atualizacao. Para o
lancamento publico, assine o executavel Windows com um certificado de code
signing para evitar alertas do SmartScreen.

## Arquitetura

```text
server/
  index.js                 # createFirekeepServer: Express + Vite middleware + entrada CLI
  routes.js                # rotas /api/*
  terminal-gateway.js      # WebSocket + node-pty
  stores.js                # logs JSONL (musicas, fundos) + preferencias
  fs-service.js            # listar/ler/escrever arquivos e projetos
  config.js                # caminhos padrao
  utils.js                 # helpers (httpError, clamp, ...)

electron/
  main.js                  # janela Electron + bootstrap do servidor local
  preload.cjs              # controles de janela

src/
  app/
    App.jsx                # composicao da tela (so estado global)
    useStartupSync.js      # carga inicial de preferencias/musicas/fundos do servidor
    App.css                # estilos globais do app
    theme.js               # tema Material UI
  assets/
    logo.png               # imagem base do app
    firekeep-icon.ico      # icone do app no Windows
  features/
    background/            # VisualDock (estado) + VisualPanel (painel do fundo visual)
    clock/                 # horario e data
    desktop/               # barra customizada da janela
    editor/                # editor de codigo (abre/edita/salva arquivos)
    explorer/              # explorador de arquivos em arvore
    pomodoro/              # usePomodoro (ciclo automatico) + widget
    terminal/              # workspace com multiplos terminais
    video/                 # MusicDock (YouTube) + painel
  shared/
    api.js                 # cliente HTTP unico das rotas /api/*
    Icon.jsx               # icones SVG locais
    storage.js             # localStorage hook
```

Estados que mudam com frequencia (tick do Pomodoro, progresso da musica,
campos de digitacao) vivem dentro da propria feature — o App nao re-renderiza
a arvore inteira a cada segundo.

Os terminais usam `node-pty` no backend e `xterm` no frontend. No Windows, eles abrem em `C:\` com `powershell.exe -NoLogo`. Para trocar o shell:

```bash
$env:FIREKEEP_SHELL="pwsh.exe"
npm run electron:dev
```

A aceleracao de GPU fica habilitada por padrao porque Monaco, xterm, GIFs e a
composicao da interface dependem dela para responder sem atraso. Em maquinas
com driver grafico problematico, use o fallback por software:

```bash
$env:FIREKEEP_DISABLE_GPU="1"
Firekeep.exe
```

No Electron, o navegador interno usa `webview`. Ao abrir a interface pelo
servidor web de `npm run dev`, ele usa um `iframe`; paginas que proibem
incorporacao por CSP ou `X-Frame-Options` so funcionam no aplicativo desktop.

O servidor local do app roda em um Worker separado do processo principal do
Electron. Rotas, arquivos locais, logs e terminais ficam fora do processo que
controla a janela, reduzindo travamentos quando alguma feature faz I/O ou usa
`node-pty`.

## Arquivos locais

O Firekeep nao precisa de banco de dados para o uso desktop atual:

- fundos enviados ficam em `public/user-backgrounds/`
- a biblioteca de fundos (nome + endereco) fica em `logs/firekeep-backgrounds.jsonl`
- os links do YouTube e seus nomes ficam em `logs/firekeep-video-links.jsonl`
- abas e favoritos do navegador ficam em `logs/firekeep-browser-state.json`

No app instalado esses arquivos vivem na pasta de dados do usuario
(`%APPDATA%/Firekeep`). Na primeira execucao, os catalogos de fabrica da
pasta `seed/` (musicas, fundos e preferencias que vao no instalador) sao
copiados para la — arquivos ja existentes nunca sao sobrescritos. No
desenvolvimento, adicionar, renomear ou remover um fundo ou link do YouTube
tambem registra a mesma operacao em `seed/`. Assim, os nomes e links versionados
seguem juntos no proximo clone e nas builds seguintes sem regeneracao manual.

Os logs sao append-only: cada item novo, renomeacao ou remocao vira uma linha JSON com `action` (`upsert`/`remove`), `url`, `name`/`label` e `createdAt`. Renomear = novo `upsert` com o mesmo `url`.
