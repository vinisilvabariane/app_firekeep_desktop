import { appendFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  audioTracksLog,
  backgroundsLog,
  browserStateFile,
  preferencesFile,
  userAudioDir,
  userBackgroundsDir,
  videoLinksLog,
} from "./config.js";
import { httpError } from "./utils.js";

// Os catálogos de músicas e fundos são logs JSONL append-only: cada linha é um
// upsert ou remove, e a leitura reconstrói o estado atual reproduzindo o log.

async function readLogEntries(logPath) {
  const content = await readFile(logPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });

  const entries = [];
  for (const line of content.split(/\r?\n/).filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // linha corrompida — ignorada
    }
  }
  return entries;
}

async function appendLogEntry(logPath, entry) {
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function appendCatalogEntry(root, logFile, entry, { mirrorSeed = false } = {}) {
  await appendLogEntry(path.join(root, logFile), entry);
  if (mirrorSeed) {
    await appendLogEntry(path.join(root, "seed", path.basename(logFile)), entry);
  }
}

function replayLog(entries, mapUpsert) {
  const active = new Map();
  const removed = new Set();

  for (const entry of entries) {
    if (!entry?.url) continue;
    if (entry.action === "remove") {
      active.delete(entry.url);
      removed.add(entry.url);
    } else {
      active.set(entry.url, mapUpsert(entry));
      removed.delete(entry.url);
    }
  }

  return { active, removed };
}

function requireUrl(body, message) {
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) throw httpError(400, message);
  return url;
}

// --- Links de vídeo -------------------------------------------------------

export async function readVideoLinks(root) {
  const entries = await readLogEntries(path.join(root, videoLinksLog));
  const { active } = replayLog(entries, (entry) => ({
    url: entry.url,
    label: entry.label ?? entry.url,
  }));
  return Array.from(active.values());
}

export async function appendVideoLink(root, body, options) {
  const url = requireUrl(body, "Musica sem endereco.");
  const entry = {
    action: "upsert",
    url,
    label: typeof body?.label === "string" && body.label.trim() ? body.label.trim() : url,
    createdAt: new Date().toISOString(),
  };
  await appendCatalogEntry(root, videoLinksLog, entry, options);
  return { url: entry.url, label: entry.label };
}

export async function appendVideoLinkRemoval(root, body, options) {
  const url = requireUrl(body, "Musica sem endereco.");
  const entry = { action: "remove", url, createdAt: new Date().toISOString() };
  await appendCatalogEntry(root, videoLinksLog, entry, options);
  return { url };
}

// --- Audio local ------------------------------------------------------------

export async function readAudioTracks(root) {
  const entries = await readLogEntries(path.join(root, audioTracksLog));
  const { active, removed } = replayLog(entries, (entry) => ({
    url: entry.url,
    label: entry.label ?? entry.url,
    filename: entry.filename ?? "",
    type: entry.type ?? "",
  }));

  const files = await readdir(path.join(root, userAudioDir)).catch(() => []);
  for (const file of files) {
    const url = `/user-audio/${file}`;
    if (!active.has(url) && !removed.has(url)) {
      active.set(url, { url, label: path.parse(file).name, filename: file, type: "" });
    }
  }

  return Array.from(active.values());
}

export async function appendAudioTrack(root, body) {
  const url = requireUrl(body, "Audio sem endereco.");
  const entry = {
    action: "upsert",
    url,
    label: typeof body?.label === "string" && body.label.trim() ? body.label.trim() : url,
    filename: typeof body?.filename === "string" ? body.filename : "",
    type: typeof body?.type === "string" ? body.type : "",
    createdAt: new Date().toISOString(),
  };
  await appendLogEntry(path.join(root, audioTracksLog), entry);
  return { url: entry.url, label: entry.label, filename: entry.filename, type: entry.type };
}

export async function appendAudioTrackRemoval(root, body) {
  const url = requireUrl(body, "Audio sem endereco.");
  const entry = { action: "remove", url, createdAt: new Date().toISOString() };
  await appendLogEntry(path.join(root, audioTracksLog), entry);

  if (url.startsWith("/user-audio/")) {
    const filename = path.basename(url);
    await unlink(path.join(root, userAudioDir, filename)).catch(() => {});
  }

  return { url };
}

export async function saveAudioAsset(root, { label, mimeType, buffer }) {
  const rawLabel = typeof label === "string" ? label : "audio";
  const type = typeof mimeType === "string" ? mimeType : "";
  const extension = audioExtensionFromMime(type) || audioExtensionFromName(rawLabel);

  if (!extension || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw httpError(400, "Envie um arquivo de audio valido.");
  }

  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeFileStem(rawLabel)}${extension}`;
  const outputDir = path.join(root, userAudioDir);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, filename), buffer);

  const url = `/user-audio/${filename}`;
  const trackLabel = rawLabel.trim() ? rawLabel.trim() : path.parse(filename).name;
  return appendAudioTrack(root, { url, label: trackLabel, filename, type });
}

// --- Fundos ----------------------------------------------------------------

export async function readBackgrounds(root) {
  const entries = await readLogEntries(path.join(root, backgroundsLog));
  const { active, removed } = replayLog(entries, (entry) => ({
    url: entry.url,
    name: entry.name ?? entry.url,
  }));

  // Exibe arquivos enviados antes do registro existir (a menos que removidos).
  const files = await readdir(path.join(root, userBackgroundsDir)).catch(() => []);
  for (const file of files) {
    const url = `/user-backgrounds/${file}`;
    if (!active.has(url) && !removed.has(url)) {
      active.set(url, { url, name: path.parse(file).name });
    }
  }

  return Array.from(active.values());
}

export async function appendBackground(root, body, options) {
  const url = requireUrl(body, "Fundo sem endereco.");
  const entry = {
    action: "upsert",
    url,
    name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : url,
    createdAt: new Date().toISOString(),
  };
  await appendCatalogEntry(root, backgroundsLog, entry, options);
  return { url: entry.url, name: entry.name };
}

export async function appendBackgroundRemoval(root, body, options) {
  const url = requireUrl(body, "Fundo sem endereco.");
  const entry = { action: "remove", url, createdAt: new Date().toISOString() };
  await appendCatalogEntry(root, backgroundsLog, entry, options);

  // Apaga o arquivo salvo quando ele vive na nossa pasta de uploads.
  if (url.startsWith("/user-backgrounds/")) {
    const filename = path.basename(url);
    await unlink(path.join(root, userBackgroundsDir, filename)).catch(() => {});
  }

  return { url };
}

export async function saveBackgroundAsset(root, { name, mimeType, buffer }, options) {
  const rawName = typeof name === "string" ? name : "background";
  const type = typeof mimeType === "string" ? mimeType : "";

  if (!type.startsWith("image/") || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw httpError(400, "Envie uma imagem ou GIF valido.");
  }

  const outputDir = path.join(root, userBackgroundsDir);
  const extension = extensionFromMime(type) || path.extname(rawName).toLowerCase() || ".img";
  const filename = await uniqueUploadFilename(outputDir, safeFileStem(rawName), extension);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, filename), buffer);

  const url = `/user-backgrounds/${filename}`;
  const label = rawName.trim() ? rawName.trim() : filename;
  await appendBackground(root, { url, name: label }, options);

  return { name: label, filename, type, url };
}

function extensionFromMime(mimeType) {
  const extensions = {
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/webp": ".webp",
  };
  return extensions[mimeType] ?? "";
}

function audioExtensionFromMime(mimeType) {
  const extensions = {
    "audio/aac": ".aac",
    "audio/flac": ".flac",
    "audio/m4a": ".m4a",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "audio/x-m4a": ".m4a",
    "audio/x-wav": ".wav",
  };
  return extensions[mimeType] ?? "";
}

function audioExtensionFromName(value) {
  const extension = path.extname(value).toLowerCase();
  return [".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"].includes(extension) ? extension : "";
}

function safeFileStem(value) {
  const parsed = path.parse(value).name || "background";
  return parsed
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "background";
}

async function uniqueUploadFilename(outputDir, stem, extension) {
  const files = await readdir(outputDir).catch(() => []);
  const taken = new Set(files.map((file) => file.toLowerCase()));
  let filename = `${stem}${extension}`;
  let suffix = 2;

  while (taken.has(filename.toLowerCase())) {
    filename = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }

  return filename;
}

// --- Preferencias -----------------------------------------------------------

export async function readPreferences(root) {
  const content = await readFile(path.join(root, preferencesFile), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "{}";
    throw error;
  });

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function savePreferences(root, body) {
  const current = await readPreferences(root);
  const next = { ...current };

  if (Object.hasOwn(body ?? {}, "visualUrl")) {
    next.visualUrl = typeof body.visualUrl === "string" ? body.visualUrl.trim() : "";
  }

  if (Object.hasOwn(body ?? {}, "visualName")) {
    next.visualName = typeof body.visualName === "string" ? body.visualName.trim() : "";
  }

  if (Object.hasOwn(body ?? {}, "dimVisual")) {
    next.dimVisual = Boolean(body.dimVisual);
  }

  if (Object.hasOwn(body ?? {}, "visualBrightness")) {
    const brightness = Number(body.visualBrightness);
    if (Number.isFinite(brightness)) {
      next.visualBrightness = Math.max(0, Math.min(100, Math.round(brightness)));
    }
  }

  next.updatedAt = new Date().toISOString();

  const outputPath = path.join(root, preferencesFile);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return next;
}

// --- Estado do navegador ----------------------------------------------------

const browserStateWrites = new Map();

export async function readBrowserState(root) {
  const content = await readFile(path.join(root, browserStateFile), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });

  if (!content) return null;

  try {
    return normalizeBrowserState(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function saveBrowserState(root, body) {
  const state = normalizeBrowserState(body);
  const outputPath = path.join(root, browserStateFile);
  const previousWrite = browserStateWrites.get(outputPath) ?? Promise.resolve();
  const write = previousWrite
    .catch(() => {})
    .then(async () => {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    });

  browserStateWrites.set(outputPath, write);
  try {
    await write;
  } finally {
    if (browserStateWrites.get(outputPath) === write) {
      browserStateWrites.delete(outputPath);
    }
  }

  return state;
}

export function normalizeBrowserState(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const favorites = Array.isArray(input.favorites)
    ? input.favorites
        .filter((favorite) => favorite && isWebUrl(favorite.url))
        .slice(0, 100)
        .map((favorite, index) => ({
          id: cleanText(favorite.id, `favorite-${index}`),
          label: cleanText(favorite.label, new URL(favorite.url).hostname),
          url: favorite.url.trim(),
        }))
    : [];
  const seenTabs = new Set();
  const tabs = Array.isArray(input.tabs)
    ? input.tabs
        .filter((tab) => tab && typeof tab.id === "string" && tab.id && !seenTabs.has(tab.id) && seenTabs.add(tab.id))
        .filter((tab) => !tab.url || isWebUrl(tab.url))
        .slice(0, 12)
        .map((tab) => ({
          id: tab.id.slice(0, 160),
          title: cleanText(tab.title, tab.url ? "Aba" : "Hub"),
          url: typeof tab.url === "string" ? tab.url.trim() : "",
        }))
    : [];

  if (!tabs.length) {
    tabs.push({ id: "home", title: "Hub", url: "" });
  }

  const requestedActiveTab = typeof input.activeTabId === "string" ? input.activeTabId : "";
  const activeTabId = tabs.some((tab) => tab.id === requestedActiveTab) ? requestedActiveTab : tabs[0].id;

  return { favorites, tabs, activeTabId };
}

function cleanText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, 240);
}

function isWebUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
