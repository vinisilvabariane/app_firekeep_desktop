import { useEffect, useRef, useState } from "react";
import { normalizeSettings } from "../features/video/defaultVideos";
import { fetchBackgrounds, fetchPreferences, fetchVideoLinks } from "../shared/api";

// Sincroniza o estado guardado no navegador com o que o servidor tem em disco
// (preferencias e fundos), uma vez, na inicializacao.
export function useStartupSync(setStoredSettings) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const hasStoredBackgroundPreferenceRef = useRef(false);

  useEffect(() => {
    async function loadPreferences() {
      const result = await fetchPreferences();
      const preferences = result.preferences && typeof result.preferences === "object" ? result.preferences : {};
      const nextPatch = {};

      if (Object.hasOwn(preferences, "visualUrl")) {
        hasStoredBackgroundPreferenceRef.current = true;
        nextPatch.visualUrl = typeof preferences.visualUrl === "string" ? preferences.visualUrl : "";
      }

      if (Object.hasOwn(preferences, "visualName")) {
        nextPatch.visualName = typeof preferences.visualName === "string" ? preferences.visualName : "";
      }

      if (Object.hasOwn(preferences, "dimVisual")) {
        nextPatch.dimVisual = Boolean(preferences.dimVisual);
      }

      if (Object.hasOwn(preferences, "visualBrightness")) {
        const brightness = Number(preferences.visualBrightness);
        if (Number.isFinite(brightness)) {
          nextPatch.visualBrightness = Math.max(0, Math.min(100, Math.round(brightness)));
        }
      }

      if (Object.keys(nextPatch).length) {
        setStoredSettings((current) => ({ ...normalizeSettings(current), ...nextPatch }));
      }
    }

    loadPreferences()
      .catch(() => {})
      .finally(() => setPreferencesLoaded(true));
  }, [setStoredSettings]);

  useEffect(() => {
    if (!preferencesLoaded) return;

    async function loadSavedBackgrounds() {
      const result = await fetchBackgrounds();
      if (!Array.isArray(result.backgrounds)) return;

      setStoredSettings((current) => {
        const normalized = normalizeSettings(current);
        const backgrounds = mergeBackgrounds(normalized.backgrounds, result.backgrounds);
        const fallback = !normalized.visualUrl && !hasStoredBackgroundPreferenceRef.current ? backgrounds.at(-1) : null;
        return {
          ...normalized,
          backgrounds,
          visualUrl: fallback?.url ?? normalized.visualUrl,
          visualName: fallback?.name ?? normalized.visualName,
        };
      });
    }

    loadSavedBackgrounds().catch(() => {});
  }, [preferencesLoaded, setStoredSettings]);

  useEffect(() => {
    async function loadSavedVideoLinks() {
      const result = await fetchVideoLinks();
      if (!Array.isArray(result.videoLinks)) return;

      setStoredSettings((current) => {
        const normalized = normalizeSettings(current);
        const youtubeLinks = mergeVideoLinks(normalized.youtubeLinks, result.videoLinks);
        return normalizeSettings({
          ...normalized,
          youtubeLinks,
          activeYoutubeUrl: normalized.activeYoutubeUrl || youtubeLinks[0]?.url || "",
        });
      });
    }

    loadSavedVideoLinks().catch(() => {});
  }, [setStoredSettings]);
}

function mergeBackgrounds(currentBackgrounds, incoming) {
  const byUrl = new Map();
  for (const background of [...currentBackgrounds, ...incoming]) {
    if (background?.url) byUrl.set(background.url, { url: background.url, name: background.name ?? background.url });
  }
  return Array.from(byUrl.values());
}

function mergeVideoLinks(currentLinks, incoming) {
  const byUrl = new Map();
  for (const link of [...currentLinks, ...incoming]) {
    if (link?.url) byUrl.set(link.url, { url: link.url, label: link.label ?? link.url });
  }
  return Array.from(byUrl.values());
}
