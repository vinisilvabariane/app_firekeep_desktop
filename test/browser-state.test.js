import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { normalizeBrowserState, readBrowserState, saveBrowserState } from "../server/stores.js";

async function withStorage(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "firekeep-browser-state-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("a lista vazia de favoritos permanece vazia depois de salvar e reabrir", async () => {
  await withStorage(async (root) => {
    assert.equal(await readBrowserState(root), null);

    const expected = {
      tabs: [{ id: "home", title: "Hub", url: "" }],
      activeTabId: "home",
      favorites: [],
    };
    await saveBrowserState(root, expected);

    assert.deepEqual(await readBrowserState(root), expected);
    const file = await readFile(path.join(root, "logs", "firekeep-browser-state.json"), "utf8");
    assert.match(file, /"favorites": \[\]/);
  });
});

test("estado invalido ou perigoso do navegador e normalizado", () => {
  const state = normalizeBrowserState({
    activeTabId: "missing",
    tabs: [
      { id: "home", title: "Hub", url: "" },
      { id: "bad", title: "Arquivo", url: "file:///C:/Windows/System32" },
      { id: "web", title: "Example", url: "https://example.com" },
    ],
    favorites: [
      { id: "bad", label: "Arquivo", url: "file:///C:/Windows/System32" },
      { id: "good", label: "Example", url: "https://example.com/docs" },
    ],
  });

  assert.deepEqual(state, {
    tabs: [
      { id: "home", title: "Hub", url: "" },
      { id: "web", title: "Example", url: "https://example.com" },
    ],
    activeTabId: "home",
    favorites: [{ id: "good", label: "Example", url: "https://example.com/docs" }],
  });
});

test("gravacoes concorrentes sao serializadas e a ultima alteracao vence", async () => {
  await withStorage(async (root) => {
    const first = saveBrowserState(root, {
      tabs: [{ id: "home", title: "Hub", url: "" }],
      activeTabId: "home",
      favorites: [{ id: "one", label: "Um", url: "https://one.example" }],
    });
    const second = saveBrowserState(root, {
      tabs: [{ id: "home", title: "Hub", url: "" }],
      activeTabId: "home",
      favorites: [],
    });

    await Promise.all([first, second]);
    assert.deepEqual((await readBrowserState(root)).favorites, []);
  });
});
