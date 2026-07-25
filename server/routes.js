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

export function registerApiRoutes(app, { root, storageRoot, openCode }) {
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

  app.get(
    "/api/opencode/status",
    respond(async () => openCode.status(), "Falha ao verificar o OpenCode."),
  );

  app.post(
    "/api/opencode/start",
    respond(async () => openCode.start(), "Falha ao iniciar o OpenCode."),
  );

  app.post(
    "/api/opencode/session",
    respond(async () => ({ session: await openCode.createSession() }), "Falha ao criar sessao AI."),
  );

  app.get(
    "/api/opencode/session/:id/messages",
    respond(async (request) => ({ messages: await openCode.messages(request.params.id) }), "Falha ao ler mensagens AI."),
  );

  app.post(
    "/api/opencode/session/:id/message",
    respond(
      async (request) => ({ message: await openCode.sendMessage(request.params.id, String(request.body?.message ?? "")) }),
      "Falha ao enviar mensagem ao OpenCode.",
    ),
  );

  app.post(
    "/api/opencode/session/:id/abort",
    respond(async (request) => openCode.abort(request.params.id), "Falha ao interromper a resposta AI."),
  );

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
