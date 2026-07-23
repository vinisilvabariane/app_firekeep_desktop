export function toSearchUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(text) && !/\s/.test(text)) {
    return `https://${text}`;
  }

  const shortcutUrl = getSearchShortcutUrl(text);
  if (shortcutUrl) return shortcutUrl;

  return `https://www.google.com/search?q=${encodeURIComponent(text)}&hl=pt-BR`;
}

function getSearchShortcutUrl(value) {
  const key = value.toLowerCase();
  const shortcuts = {
    google: "https://www.google.com",
    github: "https://github.com",
    spotify: "https://open.spotify.com",
  };
  return shortcuts[key] ?? "";
}
