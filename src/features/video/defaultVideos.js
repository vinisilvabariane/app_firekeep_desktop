export const DEFAULT_SETTINGS = {
  musicMode: "youtube",
  youtubeLinks: [],
  activeYoutubeUrl: "",
  spotifyClientId: "",
  spotifyTrackUri: "",
  backgrounds: [],
  playAudio: true,
  dimVisual: false,
  visualBrightness: 100,
  visualUrl: "",
  visualName: "",
  musicMenuOpen: false,
  visualMenuOpen: false,
  terminalOpen: false,
  explorerOpen: false,
};

export function normalizeSettings(value) {
  const settings = { ...DEFAULT_SETTINGS, ...(value ?? {}) };
  const musicMode = settings.musicMode === "spotify" ? "spotify" : "youtube";
  const youtubeLinks = normalizeYoutubeLinks(settings.youtubeLinks ?? settings.videoLinks ?? []);
  const activeYoutubeUrl = youtubeLinks.some((link) => link.url === settings.activeYoutubeUrl)
    ? settings.activeYoutubeUrl
    : youtubeLinks[0]?.url || "";
  const savedBackgrounds = Array.isArray(settings.backgrounds) ? settings.backgrounds : [];
  const backgrounds = savedBackgrounds
    .filter((background) => background && typeof background.url === "string" && background.url)
    .map((background) => ({ url: background.url, name: background.name ?? background.url }));
  const rawBrightness = Number(settings.visualBrightness);
  const visualBrightness = Number.isFinite(rawBrightness)
    ? Math.max(0, Math.min(100, Math.round(rawBrightness)))
    : settings.dimVisual || settings.dimVideo
      ? 70
      : 100;

  return {
    ...settings,
    musicMode,
    youtubeLinks,
    activeYoutubeUrl,
    spotifyClientId: typeof settings.spotifyClientId === "string" ? settings.spotifyClientId : "",
    spotifyTrackUri: normalizeSpotifyUri(settings.spotifyTrackUri),
    activeAudioUrl: "",
    audioTracks: [],
    activeVideoUrl: "",
    videoLinks: [],
    removedVideoIds: [],
    dimVisual: Boolean(settings.dimVisual ?? settings.dimVideo),
    visualBrightness,
    visualUrl: typeof settings.visualUrl === "string" ? settings.visualUrl : "",
    visualName: typeof settings.visualName === "string" ? settings.visualName : "",
    musicMenuOpen: Boolean(settings.musicMenuOpen ?? false),
    visualMenuOpen: Boolean(settings.visualMenuOpen),
    terminalOpen: Boolean(settings.terminalOpen ?? settings.chatOpen ?? false),
    explorerOpen: Boolean(settings.explorerOpen ?? false),
    backgrounds,
  };
}

function normalizeYoutubeLinks(value) {
  const byUrl = new Map();
  for (const link of Array.isArray(value) ? value : []) {
    if (!link || typeof link.url !== "string" || !link.url) continue;
    byUrl.set(link.url, {
      url: link.url,
      label: typeof link.label === "string" && link.label.trim() ? link.label.trim() : link.url,
    });
  }
  return Array.from(byUrl.values());
}

function normalizeSpotifyUri(value) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (/^spotify:track:[A-Za-z0-9]+$/.test(text)) return text;
  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/track\/([A-Za-z0-9]+)/);
    return match ? `spotify:track:${match[1]}` : "";
  } catch {
    return "";
  }
}
