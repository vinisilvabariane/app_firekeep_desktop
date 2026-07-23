import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { fetchFileContent, saveFileContent } from "../../shared/api";
import { Icon } from "../../shared/Icon";
import { badgeForFile, ensureEmberTheme, languageForFile } from "./monaco-setup";

const MONO_STACK =
  '"JetBrains Mono", "Cascadia Code", "SFMono-Regular", Consolas, ui-monospace, monospace';

export function CodeEditor({ file, onClose }) {
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("carregando");
  const [error, setError] = useState(null);

  const editorRef = useRef(null);
  const observerRef = useRef(null);
  const contentSubRef = useRef(null);
  const saveRef = useRef(() => {});

  // Libera observer e listeners do Monaco ao fechar o editor.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      contentSubRef.current?.dispose();
      contentSubRef.current = null;
    };
  }, []);

  const language = languageForFile(file.name);
  const badgeLabel = badgeForFile(file.name);
  const loading = status === "carregando";

  useEffect(() => {
    let cancelled = false;
    setStatus("carregando");
    setError(null);

    fetchFileContent(file.path)
      .then((data) => {
        if (cancelled) return;
        setValue(data.content);
        setDirty(false);
        setStatus("pronto");
      })
      .catch((readError) => {
        if (!cancelled) {
          setError(readError.message ?? "Nao consegui abrir o arquivo.");
          setStatus("erro");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.path]);

  // O conteudo chega de forma assincrona (fetch) depois do editor montar. Em
  // painel com backdrop-filter o Monaco as vezes nao repinta as linhas ao
  // receber o novo valor, ficando "preso" numa unica linha vazia. Ao terminar
  // de carregar, forcamos layout + render no proximo frame para destravar.
  useEffect(() => {
    if (status !== "pronto") return undefined;
    const editor = editorRef.current;
    if (!editor) return undefined;
    // setTimeout (nao requestAnimationFrame): o rAF fica pausado quando a janela
    // nao esta em foco/visivel, e o editor ficaria preso sem repintar.
    const timer = setTimeout(() => {
      editor.layout();
      // Um "empurrao" no scroll forca o Monaco a recalcular a faixa visivel e
      // repintar as linhas — render(true) sozinho nao destrava o viewport preso.
      const top = editor.getScrollTop();
      editor.setScrollTop(top + 1);
      editor.setScrollTop(top);
      editor.render(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [status]);

  const save = useCallback(async () => {
    const current = editorRef.current ? editorRef.current.getValue() : value;
    setStatus("salvando");
    try {
      await saveFileContent(file.path, current);
      setDirty(false);
      setStatus("salvo");
    } catch (saveError) {
      setError(saveError.message ?? "Nao consegui salvar.");
      setStatus("erro");
    }
  }, [file.path, value]);

  // Mantem o Ctrl+S do Monaco sempre chamando a versao mais recente de save().
  saveRef.current = () => {
    if (dirty) save();
  };

  function handleBeforeMount(monaco) {
    ensureEmberTheme(monaco);
  }

  function handleMount(editor, monaco) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current();
    });

    // Dentro de um painel flex com backdrop-filter, o Monaco costuma nascer com
    // dimensoes erradas (5x5px) e/ou o viewport fica "preso" sem pintar as
    // linhas, mesmo com o modelo carregado. Medimos o host explicitamente,
    // forcamos o layout e um render redraw — isso destrava a pintura das linhas.
    const host = editor.getContainerDomNode();
    const refresh = () => {
      if (!host) return;
      editor.layout({ width: host.clientWidth, height: host.clientHeight });
      editor.render(true);
    };
    refresh();
    setTimeout(refresh, 0);
    if (typeof ResizeObserver !== "undefined" && host) {
      const observer = new ResizeObserver(refresh);
      observer.observe(host);
      observerRef.current = observer;
    }

    // Se a fonte (JetBrains Mono via web font) ainda nao carregou quando o Monaco
    // mede os glifos, as metricas saem zeradas e o layout quebra. Ao terminar de
    // carregar, remedimos e repintamos — deterministico em qualquer maquina.
    if (globalThis.document?.fonts?.ready) {
      document.fonts.ready.then(() => {
        monaco.editor.remeasureFonts();
        refresh();
      });
    }

    // O conteudo do arquivo chega via fetch DEPOIS da montagem. Quando ele e
    // injetado no modelo, o viewport as vezes fica preso mostrando so uma linha.
    // No primeiro conteudo, damos um empurrao no scroll para forcar a pintura da
    // faixa visivel, e removemos o listener para nao interferir na digitacao.
    const nudge = () => {
      const top = editor.getScrollTop();
      editor.setScrollTop(top + 1);
      editor.setScrollTop(top);
      editor.render(true);
    };
    contentSubRef.current = editor.onDidChangeModelContent(() => {
      contentSubRef.current?.dispose();
      contentSubRef.current = null;
      setTimeout(nudge, 0);
    });

    editor.focus();
  }

  return (
    <Paper elevation={12} className="codeEditor">
      <Stack className="codeEditorHeader" direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Box className="widgetIcon explorerIcon">
          <Icon name="file" fontSize="small" />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={900} noWrap>
            {file.name}
            {dirty ? " ●" : ""}
          </Typography>
          <Typography variant="caption" className="codeEditorPath" noWrap>
            {file.path}
          </Typography>
        </Stack>
        <Typography variant="caption" className="codeEditorLang">
          {badgeLabel}
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<Icon name="save" fontSize="small" />}
          onClick={save}
          disabled={!dirty || status === "carregando" || status === "salvando"}
        >
          Salvar
        </Button>
        <Tooltip title="Fechar editor">
          <IconButton size="small" onClick={onClose} aria-label="Fechar editor">
            <Icon name="close" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {error ? (
        <Typography variant="caption" color="error" className="codeEditorError">
          {error}
        </Typography>
      ) : null}

      <Box className="codeEditorScroll">
        <Editor
          className="codeEditorMonaco"
          height="100%"
          theme="ember-keep"
          language={language}
          path={file.path}
          value={value}
          loading={
            <Stack sx={{ alignItems: "center", gap: 1.5, color: "var(--muted)" }}>
              <CircularProgress size={22} sx={{ color: "var(--ember)" }} />
              <Typography variant="caption">Carregando editor…</Typography>
            </Stack>
          }
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(next) => {
            setValue(next ?? "");
            setDirty(true);
          }}
          options={{
            readOnly: loading,
            automaticLayout: false,
            fontFamily: MONO_STACK,
            fontSize: 13,
            lineHeight: 20,
            fontLigatures: true,
            tabSize: 2,
            insertSpaces: true,
            minimap: { enabled: true, renderCharacters: false, maxColumn: 90 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderWhitespace: "selection",
            renderLineHighlight: "line",
            roundedSelection: true,
            padding: { top: 12, bottom: 12 },
            // Evita que o autocomplete/hover seja cortado pelo overflow do painel.
            fixedOverflowWidgets: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              useShadows: false,
            },
            guides: { indentation: true },
            bracketPairColorization: { enabled: true },
          }}
        />
      </Box>
    </Paper>
  );
}
