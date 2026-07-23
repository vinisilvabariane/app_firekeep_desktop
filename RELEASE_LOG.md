# Firekeep Release Log

Registro local das releases do Firekeep, consolidado a partir do historico de commits.
Use este arquivo como base para atualizar a pagina de lancamentos do site.

Nota de versionamento: o Firekeep ainda nao chegou na `1.0.0` estavel. As entradas que antes apareciam como `1.0.0`, `1.0.1`, `1.1.0`, `1.2.0`, `1.3.0` e `1.4.0` foram reclassificadas como betas da futura `1.0.0`.

## beta.1.8 2026-07-23

- Navegador aguarda `dom-ready` antes de chamar a API do `webview`, evitando
  que uma excecao desmonte a interface e deixe a janela preta.
- Modo web usa `iframe` como fallback; o desktop preserva navegacao completa.
- GPU voltou a ser habilitada por padrao. `FIREKEEP_DISABLE_GPU=1` mantem um
  fallback para drivers problematicos.
- Monaco deixou de sincronizar todo o texto com React a cada tecla; layouts sao
  agrupados por frame e efeitos de cursor/minimap foram reduzidos.
- Terminais ocultos deixam de pintar saida continuamente, e lotes muito grandes
  sao limitados no gateway.
- Superficies de trabalho deixaram de aplicar blur continuo sobre fundos GIF.
- Cards e superficies de trabalho ficaram mais transparentes sem reativar
  blur; o controle de fundo agora chega a
  0% e aplica uma camada extra de escurecimento abaixo de 20%.
- Pesquisas comuns usam o Google em portugues e a sessao isolada preserva a
  preferencia de tema escuro.
- Sessoes do terminal usam numeracao sequencial estavel mesmo no React
  `StrictMode` de desenvolvimento.
- Fechar a ultima aba desmonta o xterm e encerra o PTY; minimizar o painel
  continua preservando as sessoes abertas.
- Nomes dos fundos e pares nome/link do YouTube agora sao persistidos nos seeds
  versionados e restaurados no primeiro start de um clone ou instalacao.

## beta.1.7 - 2026-07-22

Fonte: consolidacao do workspace atual desde a `beta.1.6`.

Resumo: beta de amadurecimento do workspace desktop, com novo editor Monaco,
explorador de arquivos operacional, navegador redesenhado e reforcos de
estabilidade no Electron.

### Implementacoes

- Editor de codigo migrado para Monaco, com workers locais, linguagens,
  salvamento por `Ctrl+S`, tratamento de erros e recuperacao visual.
- Explorador agora cria arquivos e pastas, abre menu de contexto, confirma
  exclusoes e move itens por arrastar e soltar.
- Navegacao do explorador ganhou acao global para subir um nivel ao lado do
  controle de recolher o painel.
- Navegador interno ganhou uma tela inicial de pesquisa e uma faixa horizontal
  de favoritos, substituindo a grade de favoritos.
- Workspace ganhou dock central para Explorador, Navegador, Terminal, Grid e
  tela cheia, com carregamento sob demanda dos paineis pesados.
- Novos logotipos e icones do Firekeep aplicados na janela, no app e no
  instalador Windows.
- API local ganhou operacoes para criar, mover e excluir arquivos e pastas.

### Correcoes e melhorias

- Navegador reutiliza um unico `webview` entre as guias para evitar a criacao
  repetida de processos Chromium; o limite da sessao foi reduzido para oito
  guias para conter memoria.
- Recuperacao de uma pagina travada agora recria o `webview` em vez de tentar
  reutilizar um renderer encerrado.
- Crash do processo GPU nao recarrega mais a janela inteira e suas guias.
- GPU fica desativada por padrao no Windows; `FIREKEEP_USE_GPU=1` permite
  reativar aceleracao manualmente quando o driver for estavel.
- Terminais, explorador, navegador e editor preservam melhor o estado ao abrir,
  fechar ou reorganizar o workspace.
- Layout, tipografia, icones e contraste dos paineis foram refinados para
  reduzir artefatos de composicao e melhorar leitura.

## beta.1.6 - 2026-07-20

Fonte: alteracoes locais ainda nao commitadas.

Resumo: beta atual com ajustes no navegador interno e organizacao do historico de versoes.

### Correcoes e melhorias

- Fechar a ultima aba agora fecha o navegador interno e deixa o proximo inicio preparado no Hub.
- Navegador voltou a usar apenas um `webview` ativo por vez para reduzir tela preta, travamentos e crashes do Chromium.
- Pesquisas digitadas agora usam uma pagina leve do DuckDuckGo em vez da busca do Google dentro do `webview`.
- Painel do navegador deixou de usar blur pesado atras do `webview`, reduzindo problemas de composicao no Electron.
- Falhas de carregamento e crashes de pagina agora exibem o painel de recuperacao em vez de deixar a area preta.
- GPU fica desativada por padrao no Electron, inclusive em desenvolvimento; `FIREKEEP_USE_GPU=1` reativa manualmente.
- Release log reclassificado para deixar claro que todas as versoes atuais ainda sao beta.

## beta.1.5 - 2026-07-20

Fonte: commit `ccbd14c` (`feat varias coias`).

Resumo: beta de consolidacao de interface, musica, Spotify, Worker do backend e estabilidade grafica.

### Implementacoes

- Menu central do workspace agrupa Explorador, Navegador, Terminal, Grid e Tela cheia.
- Versao atual exibida no canto inferior direito do app.
- Backend local movido para `electron/server-worker.js`, executando em um Worker Node separado do processo principal do Electron.
- Processo principal do Electron passou a focar em janela, lifecycle, recuperacao e ponte com o Worker.
- Modo de musica alterna entre `YouTube` e `Spotify`.
- Modo YouTube usa player oculto oficial para audio em segundo plano.
- Modo Spotify adicionado com OAuth PKCE e Web Playback SDK.
- Campos para configurar Spotify Client ID e faixa Spotify por URI/link.
- Uploads novos de fundo preservam melhor o nome escolhido/original do arquivo.

### Correcoes e melhorias

- Build instalada no Windows desativa GPU por padrao para reduzir tela preta/crash ao usar `webview`.
- `FIREKEEP_USE_GPU=1` permite reativar GPU manualmente.
- Rotas, arquivos locais, logs JSONL, preferencias, seeds e gateway de terminal rodam fora do main process.
- Encerramento do app solicita fechamento limpo do Worker e finaliza forcosamente se ele nao responder.
- Reduzido o risco de I/O, terminal ou servidor local travarem o processo que gerencia a janela Electron.
- Removido o seed antigo de links externos de video.

## beta.1.4 - 2026-07-20

Fonte: commit `23b2146` (`feat: realease 1.0.1`).

Resumo: beta focado no navegador interno, persistencia de abas/favoritos e recuperacao da janela Electron em falhas graficas.

### Implementacoes

- Persistencia local do estado do navegador em `logs/firekeep-browser-state.json`.
- Novas rotas:
  - `GET /api/browser-state`
  - `POST /api/browser-state`
- Migracao do navegador interno de `localStorage` para sincronizacao com arquivo local, mantendo compatibilidade com dados antigos.
- Captura de links `target=_blank` dentro do `webview`, abrindo como abas internas.
- Protecoes no Electron para anexar `webview` apenas com URLs web e particao esperada.
- Recuperacao automatica da janela principal quando renderer ou GPU falha.
- Script `npm test` adicionado.
- Testes automatizados para leitura, gravacao, normalizacao e concorrencia do estado do navegador.

### Correcoes e melhorias

- Favoritos limitados a URLs `http`/`https`.
- Abas limitadas a URLs web ou Hub interno.
- Limite de ate 12 abas e ate 100 favoritos.
- Fallback automatico para Hub quando o estado salvo esta vazio ou invalido.
- Reducao de risco de janelas externas soltas criadas por webviews.
- Tratamento de pagina do navegador travada sem derrubar toda a interface.
- Serializacao de gravacoes concorrentes do estado do navegador.

## beta.1.3 - 2026-07-18

Fonte principal: commit `8f1b050` (`feat; realese official`).
Tambem consolida `071791b`, `93031b4` e ajustes preparatorios.

Resumo: beta grande que separa o backend em modulos, adiciona persistencia local mais completa e prepara instalador Windows.

### Implementacoes

- Estrutura do backend separada em `routes`, `stores`, `fs-service`, `terminal-gateway`, `config` e `utils`.
- API local consolidada para saude, workspace, projetos, musicas, fundos, preferencias, arquivos e terminal via WebSocket.
- Persistencia local sem banco de dados para musicas, fundos e preferencias.
- Seeds de fabrica adicionados em `seed/` para dados iniciais do app instalado.
- Cliente HTTP unico no frontend em `src/shared/api.js`.
- Hook `useStartupSync` para carregar preferencias, musicas e fundos no inicio do app.
- Separacao de estado de features em componentes/docks proprios para reduzir re-renderizacoes globais.
- Painel de fundos `VisualDock` com upload, nome customizado, selecao, renomeacao e remocao.
- Player de musica `MusicDock` com controles completos para links do YouTube.
- Pomodoro extraido para `usePomodoro`.
- Terminal com multiplas sessoes via abas, renomeacao, status online e minimizacao sem desmontar PTYs.
- Explorador de arquivos em arvore.
- Editor de codigo com leitura e gravacao pelo backend.
- Navegador interno/hub de pesquisa com abas e favoritos.
- Configuracao do Electron Builder para instalador Windows NSIS x64.

### Correcoes e melhorias

- Upload de fundos passou a usar corpo binario puro, evitando JSON/base64 grande.
- Terminal mantido montado quando minimizado para evitar encerramento de sessoes.
- Tratamento defensivo para erros do `node-pty` no Windows.
- Melhor organizacao visual da interface e dos paineis principais.
- Pasta de saida do instalador ajustada para `release-installer`.
- Pasta `seed/` incluida no pacote do Electron Builder.

## beta.1.2 - 2026-07-18

Fonte: commit `071791b` (`chore: configure desktop installer output`).

Resumo: beta pequeno de empacotamento.

### Correcoes e melhorias

- Saida do instalador configurada no `package.json`.
- `.gitignore` atualizado para ignorar artefatos locais de release.

## beta.1.1 - 2026-07-18

Fonte: commit `93031b4` (`feat; melhorias`).

Resumo: beta que transforma a base inicial em um workspace desktop mais completo.

### Implementacoes

- Interface principal expandida com paineis de musica, fundos, navegador, terminal, editor e explorador.
- Navegador interno `SearchBrowser` adicionado.
- Editor de codigo `CodeEditor` adicionado.
- Explorador de arquivos `FileExplorer` adicionado.
- Player YouTube oculto `YouTubeAudio` adicionado.
- Componentes compartilhados para icones e linhas de biblioteca.
- Tema visual, icones do app e assets Windows adicionados.
- Dependencias de desktop, terminal e UI consolidadas no `package.json`.

### Correcoes e melhorias

- Layout visual redesenhado em `App.css`.
- Terminal, Pomodoro, musica e fundos ganharam paineis mais isolados.
- Electron ajustado para o fluxo desktop.
- README atualizado com o estado do app.

## beta.1.0 - 2026-07-18

Fonte: commit `2228570` (`Initial commit`).

Resumo: prototipo inicial do Firekeep como app Node + React/Electron.

### Implementacoes

- Projeto inicial com Vite, React, Electron, Express, Material UI, xterm, node-pty e WebSocket.
- Servidor Node integrado ao Vite em desenvolvimento e modo producao.
- Janela Electron com barra customizada e preload para controles da janela.
- Workspace inicial com Pomodoro, horario/data, terminal interativo, painel de musica do YouTube, upload de fundo e layout principal.
- Persistencia inicial via `localStorage`.
- API inicial para health, workspace, links de video, upload de fundo e terminal.
- Configuracao basica de lint e build.
