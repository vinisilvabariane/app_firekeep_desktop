const AUTH_KEY = "firekeep:spotifyAuth";
const VERIFIER_KEY = "firekeep:spotifyVerifier";
const STATE_KEY = "firekeep:spotifyState";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
];

// O Client ID identifica o aplicativo, nao a conta do usuario. Ele pode ser
// embutido na build porque nao e um segredo; o Client Secret nunca deve ir
// para o frontend. A configuracao antiga salva em settings continua sendo
// aceita para nao invalidar instalacoes existentes.
const BUILD_CLIENT_ID = typeof import.meta.env?.VITE_SPOTIFY_CLIENT_ID === "string"
  ? import.meta.env.VITE_SPOTIFY_CLIENT_ID.trim()
  : "";

export function getSpotifyClientId(savedClientId = "") {
  return BUILD_CLIENT_ID || (typeof savedClientId === "string" ? savedClientId.trim() : "");
}

export function readSpotifyAuth() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSpotifyAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
}

export async function startSpotifyLogin(clientId) {
  const id = typeof clientId === "string" ? clientId.trim() : "";
  if (!id) throw new Error("Informe o Client ID do Spotify.");

  const verifier = randomString(96);
  const state = randomString(32);
  const challenge = await sha256Base64Url(verifier);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);

  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: id,
    scope: SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge,
    redirect_uri: getRedirectUri(),
    state,
  }).toString();
  const authorizationUrl = url.toString();
  if (typeof window.firekeepWindow?.spotifyLogin === "function") {
    const callbackUrl = await window.firekeepWindow.spotifyLogin(authorizationUrl, getRedirectUri());
    return completeSpotifyLogin(clientId, callbackUrl);
  }

  window.location.href = authorizationUrl;
  return null;
}

export async function completeSpotifyLogin(clientId, callbackUrl = window.location.href) {
  const callback = new URL(callbackUrl, window.location.origin);
  const params = callback.searchParams;
  const code = params.get("code");
  const returnedState = params.get("state");
  const error = params.get("error");
  if (error) throw new Error(`Spotify recusou login: ${error}`);
  if (!code) return null;

  const state = localStorage.getItem(STATE_KEY);
  const verifier = localStorage.getItem(VERIFIER_KEY);
  if (!state || state !== returnedState || !verifier) {
    throw new Error("Sessao de login do Spotify invalida.");
  }

  const auth = await requestSpotifyToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
    client_id: clientId,
    code_verifier: verifier,
  });

  saveAuth(auth);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return auth;
}

export async function getFreshSpotifyAuth(clientId) {
  const auth = readSpotifyAuth();
  if (!auth?.refresh_token) return auth;
  if (Date.now() < Number(auth.expires_at ?? 0) - 30_000) return auth;

  const refreshed = await requestSpotifyToken({
    grant_type: "refresh_token",
    refresh_token: auth.refresh_token,
    client_id: clientId,
  });
  return saveAuth({ ...refreshed, refresh_token: refreshed.refresh_token || auth.refresh_token });
}

function saveAuth(tokenResponse) {
  const auth = {
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    token_type: tokenResponse.token_type,
    scope: tokenResponse.scope,
    expires_at: Date.now() + Number(tokenResponse.expires_in ?? 3600) * 1000,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

async function requestSpotifyToken(body) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Falha ao autenticar no Spotify.");
  }
  return data;
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function randomString(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[byte % 62]).join("");
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
