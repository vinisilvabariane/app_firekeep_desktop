import assert from "node:assert/strict";
import test from "node:test";
import { toSearchUrl } from "../src/features/browser/browser-navigation.js";
import { callWebview, readWebviewBoolean, readWebviewUrl } from "../src/features/browser/webview-api.js";

test("chamadas ao webview antes de dom-ready nao derrubam a interface", () => {
  const webview = {
    getURL() {
      throw new Error("The WebView must be attached to the DOM");
    },
    canGoBack() {
      throw new Error("not ready");
    },
  };

  assert.equal(readWebviewUrl(webview, "https://fallback.test"), "https://fallback.test");
  assert.equal(readWebviewBoolean(webview, "canGoBack"), false);
});

test("a API segura preserva retorno, argumentos e contexto do webview", () => {
  const webview = {
    prefix: "https://",
    loadURL(value) {
      this.loaded = `${this.prefix}${value}`;
      return this.loaded;
    },
    getURL() {
      return this.loaded;
    },
    isLoading() {
      return true;
    },
  };

  assert.equal(callWebview(webview, "loadURL", "example.test"), "https://example.test");
  assert.equal(readWebviewUrl(webview), "https://example.test");
  assert.equal(readWebviewBoolean(webview, "isLoading"), true);
});

test("metodos ausentes sao tratados como operacoes indisponiveis", () => {
  assert.equal(callWebview(null, "reload"), undefined);
  assert.equal(callWebview({}, "reload"), undefined);
  assert.equal(readWebviewUrl({}, ""), "");
});

test("pesquisas comuns usam o Google e enderecos continuam diretos", () => {
  assert.equal(toSearchUrl("firekeep app"), "https://www.google.com/search?q=firekeep%20app&hl=pt-BR");
  assert.equal(toSearchUrl("github.com/openai"), "https://github.com/openai");
  assert.equal(toSearchUrl("https://example.com/path"), "https://example.com/path");
});
