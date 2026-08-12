import express from "express";
import path from "node:path";
import { defaultProjectsRoot } from "./config.js";
import {
  completeFsPath,
  createFsEntry,
  deleteFsEntry,
  listDirectory,
  listProjects,
  moveFsEntry,
  readFileContent,
  writeFileContent,
} from "./fs-service.js";
import {
  appendBackground,
  appendBackgroundRemoval,
  appendVideoLink,
  appendVideoLinkRemoval,
  readBackgrounds,
  readBrowserState,
  readPreferences,
  readVideoLinks,
  saveBackgroundAsset,
  saveBrowserState,
  savePreferences,
} from "./stores.js";
import { toMessage } from "./utils.js";

// O upload de fundo chega como binario puro (nao base64/JSON) para nao
// bloquear o event loop com JSON.parse de payloads gigantes.
const rawImageBody = express.raw({ type: "image/*", limit: "64mb" });

export function registerApiRoutes(app, { root, storageRoot, git }) {
  const catalogOptions = { mirrorSeed: path.resolve(root) === path.resolve(storageRoot) };
  const respond = (handler, fallbackMessage) => async (request, response) => {
    try {
      response.json(await handler(request));
    } catch (error) {
      response.status(error?.statusCode ?? 500).json({ error: toMessage(error, fallbackMessage) });
    }
  };

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, name: "firekeep" });
  });

  app.get("/api/workspace", (_request, response) => {
    response.json({ name: path.basename(root), path: root });
  });

  app.get("/api/git/availability", respond(() => git.availability(), "Falha ao verificar o Git."));
  app.get("/api/git/status", respond((request) => git.status(request.query.root), "Falha ao ler o estado do Git."));
  app.get("/api/git/diff", respond((request) => git.diff(request.query.root, request.query.path, request.query.staged === "true"), "Falha ao ler o diff."));
  app.post("/api/git/stage", respond((request) => git.stage(request.body?.root, request.body?.path), "Falha ao preparar o arquivo."));
  app.post("/api/git/unstage", respond((request) => git.unstage(request.body?.root, request.body?.path), "Falha ao retirar o arquivo do commit."));
  app.post("/api/git/discard-working-changes", respond((request) => git.discardWorkingChanges(request.body?.root), "Falha ao desfazer as alterações locais."));
  app.post("/api/git/resolve-conflict", respond((request) => git.resolveConflict(request.body?.root, request.body?.path, request.body?.strategy), "Falha ao resolver o conflito."));
  app.post("/api/git/commit", respond((request) => git.commit(request.body?.root, request.body?.message), "Falha ao criar o commit."));
  app.post("/api/git/pull", respond((request) => git.pull(request.body?.root), "Falha ao atualizar a branch."));
  app.post("/api/git/push", respond((request) => git.push(request.body?.root), "Falha ao enviar a branch."));
  app.get("/api/git/overview", respond((request) => git.overview(request.query.root), "Falha ao ler branches e histórico."));
  app.post("/api/git/checkout", respond((request) => git.checkout(request.body?.root, request.body?.branch, request.body?.create), "Falha ao trocar a branch."));

  app.get(
    "/api/projects",
    respond(async () => ({ root: defaultProjectsRoot, projects: await listProjects(root) }), "Falha ao listar projetos."),
  );

  app.post(
    "/api/background-assets",
    rawImageBody,
    respond(
      (request) =>
        saveBackgroundAsset(storageRoot, {
          name: decodeHeaderValue(request.get("x-firekeep-name")),
          mimeType: request.get("content-type"),
          buffer: request.body,
        }, catalogOptions),
      "Falha ao salvar fundo local.",
    ),
  );

  app.get(
    "/api/backgrounds",
    respond(async () => ({ backgrounds: await readBackgrounds(storageRoot) }), "Falha ao ler fundos locais."),
  );

  app.post(
    "/api/backgrounds",
    respond(
      async (request) => ({ background: await appendBackground(storageRoot, request.body, catalogOptions) }),
      "Falha ao salvar fundo.",
    ),
  );

  app.delete(
    "/api/backgrounds",
    respond(
      async (request) => ({ background: await appendBackgroundRemoval(storageRoot, request.body, catalogOptions) }),
      "Falha ao remover fundo.",
    ),
  );

  app.get(
    "/api/video-links",
    respond(async () => ({ videoLinks: await readVideoLinks(storageRoot) }), "Falha ao ler musicas."),
  );

  app.post(
    "/api/video-links",
    respond(
      async (request) => ({ videoLink: await appendVideoLink(storageRoot, request.body, catalogOptions) }),
      "Falha ao salvar musica.",
    ),
  );

  app.delete(
    "/api/video-links",
    respond(
      async (request) => ({ videoLink: await appendVideoLinkRemoval(storageRoot, request.body, catalogOptions) }),
      "Falha ao remover musica.",
    ),
  );

  app.get(
    "/api/preferences",
    respond(async () => ({ preferences: await readPreferences(storageRoot) }), "Falha ao ler preferencias locais."),
  );

  app.post(
    "/api/preferences",
    respond(async (request) => ({ preferences: await savePreferences(storageRoot, request.body) }), "Falha ao salvar preferencias."),
  );

  app.get(
    "/api/browser-state",
    respond(async () => ({ browserState: await readBrowserState(storageRoot) }), "Falha ao ler dados do navegador."),
  );

  app.post(
    "/api/browser-state",
    respond(
      async (request) => ({ browserState: await saveBrowserState(storageRoot, request.body) }),
      "Falha ao salvar dados do navegador.",
    ),
  );

  app.get(
    "/api/fs/list",
    respond((request) => listDirectory(request.query.path), "Falha ao listar pasta."),
  );

  app.get(
    "/api/fs/read",
    respond((request) => readFileContent(request.query.path), "Falha ao ler arquivo."),
  );

  app.post(
    "/api/fs/write",
    respond((request) => writeFileContent(request.body), "Falha ao salvar arquivo."),
  );

  app.post(
    "/api/fs/create",
    respond(async (request) => ({ entry: await createFsEntry(request.body) }), "Falha ao criar item."),
  );

  app.delete(
    "/api/fs/entry",
    respond(async (request) => ({ entry: await deleteFsEntry(request.body) }), "Falha ao apagar item."),
  );

  app.post(
    "/api/fs/delete",
    respond(async (request) => ({ entry: await deleteFsEntry(request.body) }), "Falha ao apagar item."),
  );

  app.post(
    "/api/fs/move",
    respond(async (request) => ({ entry: await moveFsEntry(request.body) }), "Falha ao mover item."),
  );

  app.get(
    "/api/fs/complete",
    respond(
      (request) => completeFsPath({ cwd: request.query.cwd, fragment: request.query.fragment }),
      "Falha ao completar caminho.",
    ),
  );
}

function decodeHeaderValue(value) {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
