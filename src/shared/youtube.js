export function parseYouTube(value) {
  if (!value) return { id: "", start: 0 };

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || "";
    const start = parseStart(url.searchParams.get("t") || url.searchParams.get("start"));
    return { id, start };
  } catch {
    return { id: "", start: 0 };
  }
}

export function parseYouTubeId(value) {
  return parseYouTube(value).id;
}

function parseStart(value) {
  if (!value) return 0;
  const text = String(value);
  if (/^\d+$/.test(text)) return Number(text);
  const hours = Number(text.match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(text.match(/(\d+)m/)?.[1] ?? 0);
  const seconds = Number(text.match(/(\d+)s/)?.[1] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}
