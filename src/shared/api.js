// Cliente HTTP unico do frontend: toda chamada a API do Firekeep passa por aqui.

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? `Falha na requisicao (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function jsonBody(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// --- Preferencias e catalogos ------------------------------------------------

export function fetchPreferences() {
  return requestJson("/api/preferences", { cache: "no-store" });
}

export function savePreferences(preferences) {
  return requestJson("/api/preferences", jsonBody("POST", preferences));
}

export function fetchBrowserState() {
  return requestJson("/api/browser-state", { cache: "no-store" });
}

export function saveBrowserState(browserState) {
  return requestJson("/api/browser-state", jsonBody("POST", browserState));
}

export function fetchBackgrounds() {
  return requestJson("/api/backgrounds", { cache: "no-store" });
}

export function saveBackground(background) {
  return requestJson("/api/backgrounds", jsonBody("POST", background));
}

export function deleteBackground(url) {
  return requestJson("/api/backgrounds", jsonBody("DELETE", { url }));
}

export function fetchVideoLinks() {
  return requestJson("/api/video-links", { cache: "no-store" });
}

export function saveVideoLink(videoLink) {
  return requestJson("/api/video-links", jsonBody("POST", videoLink));
}

export function deleteVideoLink(url) {
  return requestJson("/api/video-links", jsonBody("DELETE", { url }));
}

// Envia o arquivo como binario puro — sem base64/JSON, que congelava o app
// (e o servidor) em GIFs grandes.
export function uploadBackgroundAsset(file, name) {
  return requestJson("/api/background-assets", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-firekeep-name": encodeURIComponent(name || file.name),
    },
    body: file,
  });
}

// --- Arquivos ----------------------------------------------------------------

export function fetchDirectory(dirPath) {
  const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : "";
  return requestJson(`/api/fs/list${query}`, { cache: "no-store" });
}

export function fetchFileContent(filePath) {
  return requestJson(`/api/fs/read?path=${encodeURIComponent(filePath)}`, { cache: "no-store" });
}

export function saveFileContent(filePath, content) {
  return requestJson("/api/fs/write", jsonBody("POST", { path: filePath, content }));
}

export function createFileSystemEntry(basePath, name, type) {
  return requestJson("/api/fs/create", jsonBody("POST", { basePath, name, type }));
}

export async function deleteFileSystemEntry(filePath) {
  try {
    return await requestJson("/api/fs/delete", jsonBody("POST", { path: filePath }));
  } catch (error) {
    if (error.status === 404) {
      return requestJson("/api/fs/entry", jsonBody("DELETE", { path: filePath }));
    }
    throw error;
  }
}

export async function moveFileSystemEntry(sourcePath, destinationDir) {
  try {
    return await requestJson("/api/fs/move", jsonBody("POST", { sourcePath, destinationDir }));
  } catch (error) {
    if (error.status === 404) {
      throw new Error("O servidor local ainda nao carregou a funcao de mover. Reinicie o Firekeep e tente de novo.");
    }
    throw error;
  }
}

export function completeFileSystemPath(cwd, fragment) {
  const query = new URLSearchParams({
    cwd: cwd || "",
    fragment: fragment || "",
  });
  return requestJson(`/api/fs/complete?${query.toString()}`, { cache: "no-store" });
}

export function fetchGitStatus(root) { return requestJson(`/api/git/status?root=${encodeURIComponent(root)}`, { cache: "no-store" }); }
export function fetchGitAvailability() { return requestJson("/api/git/availability", { cache: "no-store" }); }
export function fetchGitDiff(root, path, staged) { return requestJson(`/api/git/diff?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}&staged=${Boolean(staged)}`, { cache: "no-store" }); }
export function stageGitFile(root, path) { return requestJson("/api/git/stage", jsonBody("POST", { root, path })); }
export function unstageGitFile(root, path) { return requestJson("/api/git/unstage", jsonBody("POST", { root, path })); }
export function discardGitWorkingChanges(root) { return requestJson("/api/git/discard-working-changes", jsonBody("POST", { root })); }
export function resolveGitConflict(root, path, strategy) { return requestJson("/api/git/resolve-conflict", jsonBody("POST", { root, path, strategy })); }
export function commitGit(root, message) { return requestJson("/api/git/commit", jsonBody("POST", { root, message })); }
export function pullGit(root) { return requestJson("/api/git/pull", jsonBody("POST", { root })); }
export function pushGit(root) { return requestJson("/api/git/push", jsonBody("POST", { root })); }
export function fetchGitOverview(root) { return requestJson(`/api/git/overview?root=${encodeURIComponent(root)}`, { cache: "no-store" }); }
export function checkoutGitBranch(root, branch, create = false) { return requestJson("/api/git/checkout", jsonBody("POST", { root, branch, create })); }
