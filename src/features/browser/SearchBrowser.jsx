import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import { fetchBrowserState, saveBrowserState } from "../../shared/api";
import { toSearchUrl } from "./browser-navigation";
import { callWebview, readWebviewBoolean, readWebviewUrl } from "./webview-api";

const HOME_TAB = { id: "home", title: "Hub", url: "" };
const EMPTY_BROWSER_STATE = { tabs: [HOME_TAB], activeTabId: HOME_TAB.id, favorites: [] };
const MAX_BROWSER_TABS = 8;

export const SearchBrowser = memo(function SearchBrowser({ open, onOpenChange, onClose, gridClassName = "", gridDraggable = false, onGridDragStart, onGridDragOver, onGridDrop }) {
  const webviewRef = useRef(null);
  const bodyRef = useRef(null);
  const [address, setAddress] = useState("");
  const [webviewGeneration, setWebviewGeneration] = useState(0);
  const [browserState, setBrowserState] = useBrowserState();
  const supportsElectronWebview = Boolean(globalThis.window?.firekeepWindow);
  const { tabs, activeTabId, favorites } = browserState;
  const setTabs = useCallback(
    (update) =>
      setBrowserState((current) => ({
        ...current,
        tabs: resolveUpdate(update, current.tabs),
      })),
    [setBrowserState],
  );
  const setActiveTabId = useCallback(
    (update) =>
      setBrowserState((current) => ({
        ...current,
        activeTabId: resolveUpdate(update, current.activeTabId),
      })),
    [setBrowserState],
  );
  const setFavorites = useCallback(
    (update) =>
      setBrowserState((current) => ({
        ...current,
        favorites: resolveUpdate(update, current.favorites),
      })),
    [setBrowserState],
  );
  const [navState, setNavState] = useState({
    crashed: false,
    error: "",
    loading: false,
    canGoBack: false,
    canGoForward: false,
  });

  const safeTabs = useMemo(() => normalizeTabs(tabs), [tabs]);
  const activeTab = safeTabs.find((tab) => tab.id === activeTabId) ?? safeTabs[0] ?? HOME_TAB;
  const activeIsFavorite = useMemo(() => {
    if (!activeTab.url) return false;
    return favorites.some((favorite) => sameUrl(favorite.url, activeTab.url));
  }, [activeTab.url, favorites]);
  const currentHost = useMemo(() => getHost(address || activeTab.url), [address, activeTab.url]);

  useEffect(() => {
    if (!safeTabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(safeTabs[0]?.id ?? HOME_TAB.id);
    }
  }, [activeTabId, safeTabs, setActiveTabId]);

  const updateTab = useCallback(
    (id, patch) => {
      setTabs((current) => normalizeTabs(current).map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
    },
    [setTabs],
  );

  const syncNavState = useCallback(() => {
    const webview = webviewRef.current;
    setNavState((current) => ({
      ...current,
      loading: readWebviewBoolean(webview, "isLoading"),
      canGoBack: readWebviewBoolean(webview, "canGoBack"),
      canGoForward: readWebviewBoolean(webview, "canGoForward"),
    }));
  }, []);

  useEffect(() => {
    setAddress(activeTab.url ?? "");
    setNavState({ crashed: false, error: "", loading: false, canGoBack: false, canGoForward: false });
    window.requestAnimationFrame(syncNavState);
  }, [activeTab.id, activeTab.url, syncNavState]);

  // O Electron nem sempre remede o conteudo do webview quando o container muda
  // de tamanho (ex.: maximizar a janela ou abrir o terminal), deixando uma
  // faixa preta. Um empurrao de 1px na altura forca o guest a se realinhar.
  useEffect(() => {
    if (!supportsElectronWebview) return undefined;
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === "undefined") return undefined;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      const views = body.querySelectorAll(".miniBrowserWebview");
      views.forEach((view) => {
        const height = view.offsetHeight;
        if (height) view.style.height = `${Math.max(1, height - 1)}px`;
      });
      frame = window.requestAnimationFrame(() => {
        views.forEach((view) => {
          view.style.height = "";
        });
      });
    });

    observer.observe(body);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [supportsElectronWebview]);

  const handleLoadStarted = useCallback(() => {
    setNavState((current) => ({ ...current, crashed: false, error: "", loading: true }));
    syncNavState();
  }, [syncNavState]);

  const handleCrashed = useCallback((message = "Esta pagina travou") => {
    setNavState((current) => ({ ...current, crashed: true, error: message, loading: false }));
  }, []);

  useEffect(() => {
    const unsubscribe = window.firekeepWindow?.onBrowserOpenUrl?.((url) => {
      if (!isWebUrl(url)) return;
      const tab = createTab({ title: getHost(url) || "Nova aba", url });
      setTabs((current) => appendTab(current, tab));
      setActiveTabId(tab.id);
      onOpenChange(true);
    });
    return typeof unsubscribe === "function" ? unsubscribe : undefined;
  }, [onOpenChange, setActiveTabId, setTabs]);

  function navigate(rawValue, { newTab = false } = {}) {
    const nextUrl = toSearchUrl(rawValue);
    if (!nextUrl) return;

    onOpenChange(true);

    if (newTab) {
      const tab = createTab({ title: getHost(nextUrl) || "Pesquisa", url: nextUrl });
      setTabs((current) => appendTab(current, tab));
      setActiveTabId(tab.id);
      setAddress(nextUrl);
      return;
    }

    setAddress(nextUrl);
    updateTab(activeTab.id, { url: nextUrl, title: getHost(nextUrl) || "Pesquisa" });
  }

  function submitAddress(event) {
    event.preventDefault();
    navigate(address);
  }

  function addTab(url = "") {
    const tab = createTab({ title: url ? getHost(url) || "Nova aba" : "Hub", url });
    setTabs((current) => appendTab(current, tab));
    setActiveTabId(tab.id);
    onOpenChange(true);
  }

  function closeTab(id) {
    const list = normalizeTabs(browserState.tabs);
    const nextTabs = list.filter((tab) => tab.id !== id);

    let nextState;
    if (!nextTabs.length) {
      nextState = { ...browserState, tabs: [HOME_TAB], activeTabId: HOME_TAB.id };
      setBrowserState(nextState);
      onOpenChange(false);
      setNavState((current) => ({ ...current, loading: false }));
    } else {
      const closingActiveTab = id === browserState.activeTabId;
      const closingIndex = list.findIndex((tab) => tab.id === id);
      const nextActiveTabId = closingActiveTab
        ? nextTabs[Math.max(0, closingIndex - 1)]?.id ?? nextTabs[0].id
        : browserState.activeTabId;
      nextState = { ...browserState, tabs: nextTabs, activeTabId: nextActiveTabId };
      setBrowserState(nextState);
    }

    // Persiste na hora: fechar a aba precisa valer mesmo se o app fechar logo
    // em seguida, senao o debounce perde a alteracao e a aba "volta".
    saveBrowserState(nextState).catch(() => {});
  }

  function toggleFavorite() {
    if (!activeTab.url) return;
    setFavorites((current) => {
      if (current.some((favorite) => sameUrl(favorite.url, activeTab.url))) {
        return current.filter((favorite) => !sameUrl(favorite.url, activeTab.url));
      }
      return [
        ...current,
        {
          id: createId(),
          label: cleanTitle(activeTab.title) || getHost(activeTab.url) || "Favorito",
          url: activeTab.url,
        },
      ];
    });
  }

  function removeFavorite(id) {
    setFavorites((current) => current.filter((favorite) => favorite.id !== id));
  }

  function openFavorite(favorite, newTab = false) {
    navigate(favorite.url, { newTab });
  }

  function minimizeBrowser() {
    onOpenChange(false);
    setNavState((current) => ({ ...current, loading: false }));
  }

  function closeBrowser() {
    onClose();
  }

  return (
    <Paper elevation={14} className={open ? `miniBrowser ${gridClassName}` : `miniBrowser isMinimized ${gridClassName}`} onDragOver={onGridDragOver} onDrop={onGridDrop}>
          {gridDraggable ? <GridDragHandle onDragStart={onGridDragStart} /> : null}
          <Box className="miniBrowserTabs" role="tablist" aria-label="Abas do navegador">
            {safeTabs.map((tab) => (
              <Box
                key={tab.id}
                role="tab"
                tabIndex={0}
                className={tab.id === activeTab.id ? "miniBrowserTab isActive" : "miniBrowserTab"}
                onClick={() => setActiveTabId(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveTabId(tab.id);
                  }
                }}
              >
                <Icon name={tab.url ? "search" : "folder"} fontSize="small" />
                <span>{tab.title || (tab.url ? getHost(tab.url) : "Hub")}</span>
                <IconButton
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  aria-label="Fechar aba"
                >
                  <Icon name="close" fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Tooltip title="Nova aba">
              <IconButton className="miniBrowserAddTab" size="small" onClick={() => addTab()} aria-label="Nova aba">
                <Icon name="add" fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box className="miniBrowserChrome">
            <Box className="miniBrowserNav">
              <Tooltip title="Voltar">
                <span>
                  <IconButton
                    size="small"
                    disabled={!navState.canGoBack}
                    onClick={() => callWebview(webviewRef.current, "goBack")}
                    aria-label="Voltar"
                  >
                    <Icon name="chevronLeft" fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Avancar">
                <span>
                  <IconButton
                    size="small"
                    disabled={!navState.canGoForward}
                    onClick={() => callWebview(webviewRef.current, "goForward")}
                    aria-label="Avancar"
                  >
                    <Icon name="chevronRight" fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={navState.loading ? "Parar" : "Recarregar"}>
                <IconButton
                  size="small"
                  disabled={!activeTab.url}
                  onClick={() => {
                    if (!supportsElectronWebview) {
                      setWebviewGeneration((current) => current + 1);
                      return;
                    }
                    if (navState.loading) {
                      callWebview(webviewRef.current, "stop");
                      return;
                    }
                    callWebview(webviewRef.current, "reload");
                  }}
                  aria-label={navState.loading ? "Parar carregamento" : "Recarregar pagina"}
                >
                  <Icon name={navState.loading ? "close" : "refresh"} fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Box component="form" className="miniBrowserAddress" onSubmit={submitAddress}>
              <Icon name="search" fontSize="small" />
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Endereco ou pesquisa"
                aria-label="Endereco ou pesquisa"
              />
            </Box>

            <Box className="miniBrowserMeta">
              <Tooltip title={activeIsFavorite ? "Remover favorito" : "Favoritar aba"}>
                <IconButton
                  size="small"
                  disabled={!activeTab.url}
                  onClick={toggleFavorite}
                  aria-label={activeIsFavorite ? "Remover favorito" : "Favoritar aba"}
                >
                  <Icon name={activeIsFavorite ? "starFilled" : "star"} fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" noWrap>
                {currentHost || activeTab.title || "Hub"}
              </Typography>
              <Tooltip title="Minimizar navegador">
                <IconButton size="small" onClick={minimizeBrowser} aria-label="Minimizar navegador">
                  <Icon name="minimize" fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fechar navegador definitivamente">
                <IconButton size="small" onClick={closeBrowser} aria-label="Fechar navegador">
                  <Icon name="close" fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Box className={navState.loading ? "miniBrowserProgress isLoading" : "miniBrowserProgress"} />
          <Box className="miniBrowserBody" ref={bodyRef}>
            {supportsElectronWebview ? (
              <>
                {safeTabs
                  .filter((tab) => tab.url)
                  .map((tab) => (
                    <PersistentWebview
                      key={tab.id}
                      tab={tab}
                      isActive={tab.id === activeTab.id}
                      webviewRef={webviewRef}
                      onAddressChange={setAddress}
                      onCrashed={handleCrashed}
                      onLoadStarted={handleLoadStarted}
                      onNavUpdate={syncNavState}
                      onTabUpdate={updateTab}
                    />
                  ))}
                {activeTab.url ? null : (
                  <BrowserHub
                    favorites={favorites}
                    onSearch={navigate}
                    onOpenFavorite={openFavorite}
                    onRemoveFavorite={removeFavorite}
                  />
                )}
              </>
            ) : activeTab.url ? (
              <WebBrowserFrame
                key={webviewGeneration}
                tab={activeTab}
                onLoadStarted={handleLoadStarted}
                onNavUpdate={syncNavState}
              />
            ) : (
              <BrowserHub
                favorites={favorites}
                onSearch={navigate}
                onOpenFavorite={openFavorite}
                onRemoveFavorite={removeFavorite}
              />
            )}
            {navState.crashed ? (
              <Box className="miniBrowserCrash">
                <Typography variant="subtitle2" fontWeight={900}>
                  {navState.error || "Esta pagina travou"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Recarregue a aba, feche esta aba ou abra outra pesquisa.
                </Typography>
                <IconButton
                  className="glassButton"
                  onClick={() => {
                    setNavState((current) => ({ ...current, crashed: false, error: "" }));
                    if (supportsElectronWebview) {
                      callWebview(webviewRef.current, "reload");
                    } else {
                      setWebviewGeneration((current) => current + 1);
                    }
                  }}
                  aria-label="Recarregar aba"
                >
                  <Icon name="refresh" />
                </IconButton>
              </Box>
            ) : null}
          </Box>
    </Paper>
  );
});

function GridDragHandle({ onDragStart }) {
  return (
    <Box className="gridDragHandle" draggable onDragStart={onDragStart} aria-label="Arraste para trocar a posição desta tela">
      <Icon name="grid" fontSize="inherit" />
      Mover
    </Box>
  );
}

// Cada aba mantem seu proprio webview vivo. Trocar de aba so muda a
// visibilidade (CSS), entao a pagina nao recarrega e o processo continua ativo.
function PersistentWebview({ tab, isActive, webviewRef, onAddressChange, onCrashed, onLoadStarted, onNavUpdate, onTabUpdate }) {
  const localRef = useRef(null);
  const initialUrlRef = useRef(tab.url);
  const readyRef = useRef(false);

  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const tabIdRef = useRef(tab.id);
  tabIdRef.current = tab.id;
  const tabUrlRef = useRef(tab.url);
  tabUrlRef.current = tab.url;
  const handlersRef = useRef({});
  handlersRef.current = { onAddressChange, onCrashed, onLoadStarted, onNavUpdate, onTabUpdate };

  // Liga os eventos uma unica vez; os handlers leem os refs para pegar sempre
  // o estado atual sem religar os listeners a cada render.
  useEffect(() => {
    const webview = localRef.current;
    if (!webview) return undefined;

    const active = () => isActiveRef.current;
    const handlers = () => handlersRef.current;

    function syncUrl() {
      const url = readWebviewUrl(webview, tabUrlRef.current);
      handlers().onTabUpdate(tabIdRef.current, { url });
      if (active()) {
        handlers().onAddressChange(url);
        handlers().onNavUpdate();
      }
    }

    function syncTitle(event) {
      const url = readWebviewUrl(webview, tabUrlRef.current);
      handlers().onTabUpdate(tabIdRef.current, { title: cleanTitle(event.title) || getHost(url) || "Aba" });
    }

    function syncFail(event) {
      if (event.errorCode === -3) return;
      if (active()) handlers().onCrashed("Falha ao carregar a pagina");
    }

    function syncCrash(event) {
      if (!active()) return;
      const reason = event?.reason;
      handlers().onCrashed(reason === "oom" ? "A pagina ficou sem memoria" : "Esta pagina travou");
    }

    function loadStarted() {
      if (active()) handlers().onLoadStarted();
    }

    function navUpdate() {
      if (active()) handlers().onNavUpdate();
    }

    function syncReady() {
      readyRef.current = true;
      const currentUrl = readWebviewUrl(webview);
      if (normalizeUrl(currentUrl) !== normalizeUrl(tabUrlRef.current)) {
        callWebview(webview, "loadURL", tabUrlRef.current);
      }
      if (active()) handlers().onNavUpdate();
    }

    webview.addEventListener("dom-ready", syncReady);
    webview.addEventListener("did-start-loading", loadStarted);
    webview.addEventListener("did-stop-loading", navUpdate);
    webview.addEventListener("did-finish-load", navUpdate);
    webview.addEventListener("did-fail-load", syncFail);
    webview.addEventListener("did-navigate", syncUrl);
    webview.addEventListener("did-navigate-in-page", syncUrl);
    webview.addEventListener("page-title-updated", syncTitle);
    webview.addEventListener("render-process-gone", syncCrash);

    return () => {
      webview.removeEventListener("dom-ready", syncReady);
      webview.removeEventListener("did-start-loading", loadStarted);
      webview.removeEventListener("did-stop-loading", navUpdate);
      webview.removeEventListener("did-finish-load", navUpdate);
      webview.removeEventListener("did-fail-load", syncFail);
      webview.removeEventListener("did-navigate", syncUrl);
      webview.removeEventListener("did-navigate-in-page", syncUrl);
      webview.removeEventListener("page-title-updated", syncTitle);
      webview.removeEventListener("render-process-gone", syncCrash);
    };
  }, []);

  // Recarrega apenas quando a URL da aba muda de fato (barra de endereco),
  // nao quando o usuario apenas troca de aba.
  useEffect(() => {
    const webview = localRef.current;
    if (!webview || !tab.url || !readyRef.current) return;

    const currentUrl = readWebviewUrl(webview);
    if (normalizeUrl(currentUrl) !== normalizeUrl(tab.url)) {
      callWebview(webview, "loadURL", tab.url);
    }
  }, [tab.url]);

  // A aba ativa vira alvo dos botoes de navegacao e recebe um ajuste de tamanho.
  useEffect(() => {
    if (!isActive) return undefined;
    const webview = localRef.current;
    webviewRef.current = webview;
    handlersRef.current.onNavUpdate();
    nudgeWebviewSize(webview);
    return () => {
      if (webviewRef.current === webview) webviewRef.current = null;
    };
  }, [isActive, webviewRef]);

  return (
    <webview
      ref={localRef}
      className={isActive ? "miniBrowserWebview isActive" : "miniBrowserWebview"}
      src={initialUrlRef.current}
      partition="persist:firekeep-search"
    />
  );
}

function nudgeWebviewSize(webview) {
  if (!webview) return;
  const height = webview.offsetHeight;
  if (!height) return;
  webview.style.height = `${Math.max(1, height - 1)}px`;
  window.requestAnimationFrame(() => {
    webview.style.height = "";
  });
}

function WebBrowserFrame({ tab, onLoadStarted, onNavUpdate }) {
  useEffect(() => {
    onLoadStarted();
  }, [onLoadStarted, tab.url]);

  return (
    <iframe
      className="miniBrowserWebview isActive"
      src={tab.url}
      title={tab.title || getHost(tab.url) || "Navegador"}
      onLoad={onNavUpdate}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function useBrowserState() {
  const [state, setState] = useState(readLegacyBrowserState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  const mutationVersionRef = useRef(0);

  const updateState = useCallback((update) => {
    setState((current) => {
      const next = normalizeBrowserState(resolveUpdate(update, current));
      stateRef.current = next;
      mutationVersionRef.current += 1;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const versionAtStart = mutationVersionRef.current;

    async function hydrate() {
      try {
        const result = await fetchBrowserState();
        if (cancelled) return;

        if (result.browserState && mutationVersionRef.current === versionAtStart) {
          const next = normalizeBrowserState(result.browserState);
          stateRef.current = next;
          setState(next);
        } else {
          await saveBrowserState(stateRef.current);
        }
      } catch {
        // Mantem o estado local e tenta salva-lo novamente na proxima alteracao.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistLegacyBrowserState(state);
    if (!hydrated) return undefined;

    const timer = window.setTimeout(() => {
      saveBrowserState(state).catch(() => {});
    }, 180);
    return () => window.clearTimeout(timer);
  }, [hydrated, state]);

  return [state, updateState];
}

function readLegacyBrowserState() {
  return normalizeBrowserState({
    tabs: readLocalJson("firekeep:browserTabs", EMPTY_BROWSER_STATE.tabs),
    activeTabId: readLocalJson("firekeep:activeBrowserTab", EMPTY_BROWSER_STATE.activeTabId),
    favorites: readLocalJson("firekeep:browserFavorites", EMPTY_BROWSER_STATE.favorites),
  });
}

function persistLegacyBrowserState(state) {
  try {
    localStorage.setItem("firekeep:browserTabs", JSON.stringify(state.tabs));
    localStorage.setItem("firekeep:activeBrowserTab", JSON.stringify(state.activeTabId));
    localStorage.setItem("firekeep:browserFavorites", JSON.stringify(state.favorites));
  } catch {
    // O arquivo em %APPDATA% continua sendo a fonte persistente no desktop.
  }
}

function readLocalJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function normalizeBrowserState(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : EMPTY_BROWSER_STATE;
  const tabs = normalizeTabs(input.tabs);
  const favorites = normalizeFavorites(input.favorites);
  const activeTabId = tabs.some((tab) => tab.id === input.activeTabId) ? input.activeTabId : tabs[0].id;
  return { tabs, activeTabId, favorites };
}

function normalizeFavorites(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  return list
    .filter((favorite) => favorite && isWebUrl(favorite.url))
    .map((favorite, index) => ({
      id: typeof favorite.id === "string" && favorite.id ? favorite.id : `favorite-${index}`,
      label:
        typeof favorite.label === "string" && favorite.label.trim()
          ? favorite.label.trim()
          : getHost(favorite.url) || "Favorito",
      url: favorite.url.trim(),
    }))
    .filter((favorite) => {
      const url = normalizeUrl(favorite.url);
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, 100);
}

function resolveUpdate(update, current) {
  return typeof update === "function" ? update(current) : update;
}

function BrowserHub({ favorites, onSearch, onOpenFavorite, onRemoveFavorite }) {
  const [query, setQuery] = useState("");

  function submitSearch(event) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <Box className="miniBrowserHub">
      <Box component="form" className="browserHubSearch" onSubmit={submitSearch}>
        <Typography variant="overline">Pesquisa</Typography>
        <Typography variant="h6">Para onde vamos?</Typography>
        <Box className="browserHubSearchField">
          <Icon name="search" fontSize="small" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar ou colar um endereco"
            aria-label="Pesquisar ou colar um endereco"
            autoFocus
          />
          <IconButton type="submit" size="small" disabled={!query.trim()} aria-label="Pesquisar">
            <Icon name="chevronRight" fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box className="browserFavoritesShelf">
        <Box className="browserFavoritesHeading">
          <Typography variant="caption">Favoritos</Typography>
          <Typography variant="caption" color="text.secondary">
            {favorites.length ? `${favorites.length} salvos` : "Salve paginas pela estrela"}
          </Typography>
        </Box>
        {favorites.length ? (
          <Box className="browserFavoriteStrip">
            {favorites.map((favorite) => (
              <Box key={favorite.id} className="browserFavoriteChip">
                <button
                  type="button"
                  className="browserFavoriteOpen"
                  onClick={() => onOpenFavorite(favorite)}
                  onAuxClick={() => onOpenFavorite(favorite, true)}
                  title={favorite.url}
                >
                  <span>{favorite.label.slice(0, 1).toUpperCase()}</span>
                  <strong>{favorite.label}</strong>
                </button>
                <button
                  type="button"
                  className="browserFavoriteRemove"
                  title="Remover favorito"
                  aria-label={`Remover ${favorite.label} dos favoritos`}
                  onClick={(event) => { event.stopPropagation(); onRemoveFavorite(favorite.id); }}
                >
                  <Icon name="close" fontSize="inherit" />
                </button>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function normalizeTabs(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const tabs = list
    .filter((tab) => tab && typeof tab.id === "string" && !seen.has(tab.id) && seen.add(tab.id))
    .slice(0, MAX_BROWSER_TABS)
    .map((tab) => ({
      id: tab.id,
      title: typeof tab.title === "string" ? tab.title : "Aba",
      url: typeof tab.url === "string" ? tab.url : "",
    }));
  return tabs.length ? tabs : [HOME_TAB];
}

function appendTab(current, tab) {
  return [...normalizeTabs(current).slice(-(MAX_BROWSER_TABS - 1)), tab];
}

function createTab({ title, url }) {
  return {
    id: createId(),
    title,
    url,
  };
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isWebUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function getHost(value) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sameUrl(left, right) {
  return normalizeUrl(left) === normalizeUrl(right);
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

function cleanTitle(value) {
  return typeof value === "string" ? value.replace(/\s+-\s+Google.*$/i, "").trim() : "";
}
