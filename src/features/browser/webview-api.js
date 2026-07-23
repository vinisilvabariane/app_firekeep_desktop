export function callWebview(webview, method, ...args) {
  const action = webview?.[method];
  if (typeof action !== "function") return undefined;

  try {
    return action.apply(webview, args);
  } catch {
    return undefined;
  }
}

export function readWebviewBoolean(webview, method) {
  return Boolean(callWebview(webview, method));
}

export function readWebviewUrl(webview, fallback = "") {
  const value = callWebview(webview, "getURL");
  return typeof value === "string" && value ? value : fallback;
}
