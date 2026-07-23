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
