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

export function CodeEditor({ file, onClose, gridClassName = "", gridDraggable = false, onGridDragStart, onGridDragOver, onGridDrop }) {
  const [initialContent, setInitialContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("carregando");
  const [error, setError] = useState(null);
  const editorRef = useRef(null);
  const observerRef = useRef(null);
  const layoutFrameRef = useRef(null);
  const dirtyRef = useRef(false);
  const saveRef = useRef(() => {});

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (layoutFrameRef.current) cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = null;
      editorRef.current = null;
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
        setInitialContent(data.content);
        dirtyRef.current = false;
        setDirty(false);
        setStatus("pronto");
      })
      .catch((readError) => {
        if (cancelled) return;
        setError(readError.message ?? "Nao consegui abrir o arquivo.");
        setStatus("erro");
      });

    return () => {
      cancelled = true;
    };
  }, [file.path]);

  const save = useCallback(async () => {
    const current = editorRef.current?.getValue() ?? initialContent;
    setStatus("salvando");
    try {
      await saveFileContent(file.path, current);
      dirtyRef.current = false;
      setDirty(false);
      setStatus("salvo");
    } catch (saveError) {
      setError(saveError.message ?? "Nao consegui salvar.");
      setStatus("erro");
    }
  }, [file.path, initialContent]);

  saveRef.current = () => {
    if (dirtyRef.current) save();
  };

  function handleBeforeMount(monaco) {
    ensureEmberTheme(monaco);
  }

  function handleMount(editor, monaco) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current();
    });

    const host = editor.getContainerDomNode();
    let lastWidth = 0;
    let lastHeight = 0;
    const refresh = () => {
      if (!host || editorRef.current !== editor) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      lastWidth = width;
      lastHeight = height;
      editor.layout({ width, height });
    };

    refresh();
    if (typeof ResizeObserver !== "undefined" && host) {
      const observer = new ResizeObserver(() => {
        if (layoutFrameRef.current) cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = requestAnimationFrame(() => {
          layoutFrameRef.current = null;
          refresh();
        });
      });
      observer.observe(host);
      observerRef.current = observer;
    }

    if (globalThis.document?.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (editorRef.current !== editor) return;
        monaco.editor.remeasureFonts();
        lastWidth = 0;
        lastHeight = 0;
        refresh();
      });
    }

    editor.focus();
  }

  function handleChange() {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
  }

  return (
    <Paper elevation={12} className={`codeEditor ${gridClassName}`} onDragOver={onGridDragOver} onDrop={onGridDrop}>
      {gridDraggable ? <GridDragHandle onDragStart={onGridDragStart} /> : null}
      <Stack className="codeEditorHeader" direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Box className="widgetIcon explorerIcon">
          <Icon name="file" fontSize="small" />
        </Box>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={900} noWrap>
            {file.name}
            {dirty ? " *" : ""}
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
          disabled={!dirty || loading || status === "salvando"}
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
        {loading ? (
          <Stack className="codeEditorLoading" sx={{ alignItems: "center", gap: 1.5, color: "var(--muted)" }}>
            <CircularProgress size={22} sx={{ color: "var(--ember)" }} />
            <Typography variant="caption">Carregando editor...</Typography>
          </Stack>
        ) : (
          <Editor
            className="codeEditorMonaco"
            height="100%"
            theme="ember-keep"
            language={language}
            path={file.path}
            defaultValue={initialContent}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleChange}
            options={{
              automaticLayout: false,
              fontFamily: MONO_STACK,
              fontSize: 13,
              lineHeight: 20,
              fontLigatures: false,
              tabSize: 2,
              insertSpaces: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              smoothScrolling: false,
              cursorBlinking: "blink",
              cursorSmoothCaretAnimation: "off",
              renderWhitespace: "selection",
              renderLineHighlight: "line",
              roundedSelection: true,
              padding: { top: 12, bottom: 12 },
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
        )}
      </Box>
    </Paper>
  );
}

function GridDragHandle({ onDragStart }) {
  return (
    <Box className="gridDragHandle" draggable onDragStart={onDragStart} aria-label="Arraste para trocar a posição desta tela">
      <Icon name="grid" fontSize="inherit" />
      Mover
    </Box>
  );
}
