export const DEFAULT_SETTINGS = {
  musicMode: "youtube",
  youtubeLinks: [],
  activeYoutubeUrl: "",
  backgrounds: [],
  playAudio: true,
  dimVisual: false,
  visualBrightness: 100,
  visualUrl: "",
  visualName: "",
  dominantColor: "#ff8c42",
  musicMenuOpen: false,
  visualMenuOpen: false,
  terminalOpen: false,
  explorerOpen: false,
  pomodoroOpen: true,
  clockOpen: true,
  musicOpen: true,
  visualOpen: true,
};

export function normalizeSettings(value) {
  const settings = { ...DEFAULT_SETTINGS, ...(value ?? {}) };
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
    musicMode: "youtube",
    youtubeLinks,
    activeYoutubeUrl,
    activeAudioUrl: "",
    audioTracks: [],
    activeVideoUrl: "",
    videoLinks: [],
    removedVideoIds: [],
    dimVisual: Boolean(settings.dimVisual ?? settings.dimVideo),
    visualBrightness,
    visualUrl: typeof settings.visualUrl === "string" ? settings.visualUrl : "",
    visualName: typeof settings.visualName === "string" ? settings.visualName : "",
    dominantColor: normalizeDominantColor(settings.dominantColor),
    musicMenuOpen: Boolean(settings.musicMenuOpen ?? false),
    visualMenuOpen: Boolean(settings.visualMenuOpen),
    terminalOpen: Boolean(settings.terminalOpen ?? settings.chatOpen ?? false),
    explorerOpen: Boolean(settings.explorerOpen ?? false),
    pomodoroOpen: Boolean(settings.pomodoroOpen ?? true),
    clockOpen: Boolean(settings.clockOpen ?? true),
    musicOpen: Boolean(settings.musicOpen ?? true),
    visualOpen: Boolean(settings.visualOpen ?? true),
    backgrounds,
  };
}

function normalizeDominantColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#ff8c42";
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

