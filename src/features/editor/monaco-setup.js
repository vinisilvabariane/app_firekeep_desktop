// Configuracao unica do Monaco para o Firekeep.
// Importado apenas pelo CodeEditor (que e lazy), entao o Monaco so entra no
// bundle quando o usuario abre um arquivo — nao pesa na inicializacao do app.
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Os workers rodam fora da thread principal: o language service (TS/JSON/CSS/HTML)
// nunca bloqueia a digitacao nem congela a UI, mesmo em arquivos grandes. E o
// motivo de configurar isto e justamente evitar travamentos.
globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Usa a instancia local do Monaco (empacotada pelo Vite) em vez de baixar de um
// CDN — essencial para funcionar offline dentro do Electron.
loader.config({ monaco });

// Editando um arquivo por vez, sem o projeto inteiro carregado, a validacao
// semantica geraria "nao encontrei o modulo" em tudo. Mantemos so a sintatica.
// Protegido: se a API de TS nao existir, o editor ainda deve abrir sem quebrar.
const ts = monaco.languages?.typescript;
if (ts?.javascriptDefaults && ts?.typescriptDefaults) {
  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false };
  ts.javascriptDefaults.setDiagnosticsOptions(diagnostics);
  ts.typescriptDefaults.setDiagnosticsOptions(diagnostics);
}

let themeReady = false;

// Tema "Ember Keep": firelight para estrutura, moonlight para valores — o mesmo
// espirito da paleta que o Prism usava. Fundo solido (nao transparente) para
// evitar ghosting/artefatos de scroll do canvas do Monaco.
export function ensureEmberTheme() {
  if (themeReady) return "ember-keep";
  monaco.editor.defineTheme("ember-keep", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8f8774", fontStyle: "italic" },
      { token: "keyword", foreground: "ff8c42" },
      { token: "keyword.control", foreground: "ff8c42" },
      { token: "tag", foreground: "ff8c42" },
      { token: "attribute.name", foreground: "ffb06e" },
      { token: "string", foreground: "86c7c0" },
      { token: "string.value.json", foreground: "86c7c0" },
      { token: "number", foreground: "86c7c0" },
      { token: "constant", foreground: "86c7c0" },
      { token: "type", foreground: "ffb06e" },
      { token: "type.identifier", foreground: "ffb06e" },
      { token: "function", foreground: "ffb06e" },
      { token: "variable", foreground: "f2ecdd" },
      { token: "delimiter", foreground: "f2ecdd8c" },
    ],
    colors: {
      "editor.background": "#0a0d13",
      "editor.foreground": "#f2ecdd",
      "editorLineNumber.foreground": "#f2ecdd45",
      "editorLineNumber.activeForeground": "#ff8c42",
      "editorCursor.foreground": "#ff8c42",
      "editor.selectionBackground": "#ff8c4238",
      "editor.inactiveSelectionBackground": "#ff8c4220",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
      "editorIndentGuide.background1": "#f2ecdd12",
      "editorIndentGuide.activeBackground1": "#ff8c4240",
      "editorGutter.background": "#0a0d13",
      "editorWidget.background": "#0b0e14",
      "editorWidget.border": "#ffffff14",
      "editorSuggestWidget.background": "#0b0e14",
      "editorSuggestWidget.selectedBackground": "#ff8c4222",
      "editorHoverWidget.background": "#0b0e14",
      "input.background": "#11151d",
      "scrollbarSlider.background": "#ff8c4230",
      "scrollbarSlider.hoverBackground": "#ff8c4255",
      "scrollbarSlider.activeBackground": "#ff8c4270",
      "minimap.background": "#0a0d1300",
    },
  });
  themeReady = true;
  return "ember-keep";
}

// Extensao -> id de linguagem do Monaco.
const LANGUAGE_BY_EXTENSION = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  vue: "html",
  md: "markdown",
  markdown: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  dockerfile: "dockerfile",
};

export function languageForFile(name) {
  const extension = (name.split(".").pop() || "").toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] || "plaintext";
}

export function badgeForFile(name) {
  const extension = (name.split(".").pop() || "").toLowerCase();
  const language = LANGUAGE_BY_EXTENSION[extension];
  return language || extension || "texto";
}
