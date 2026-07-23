import { memo, useEffect, useRef, useState } from "react";
import { deleteBackground, saveBackground, savePreferences, uploadBackgroundAsset } from "../../shared/api";
import { VisualPanel } from "./VisualPanel";

function mergeBackgrounds(currentBackgrounds, incoming) {
  const byUrl = new Map();
  for (const background of [...currentBackgrounds, ...incoming]) {
    if (background?.url) byUrl.set(background.url, { url: background.url, name: background.name ?? background.url });
  }
  return Array.from(byUrl.values());
}

// Painel de fundos. `sessionVisual` e o fallback aplicado so nesta sessao
// (object URL local) quando o upload para o servidor falha; quem exibe a
// imagem em tela cheia e o App, por isso o estado sobe via callback.
export const VisualDock = memo(function VisualDock({
  backgrounds,
  visualUrl,
  visualName,
  visualBrightness,
  sessionVisual,
  onSessionVisualChange,
  onUpdateSettings,
}) {
  const [draftName, setDraftName] = useState("");
  const objectUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function releaseObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function uploadVisual(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const name = draftName.trim() || file.name.replace(/\.[^.]+$/, "");
    releaseObjectUrl();

    try {
      const result = await uploadBackgroundAsset(file, name);
      onSessionVisualChange({ url: result.url, name: result.name });
      onUpdateSettings({
        visualUrl: result.url,
        visualName: result.name,
        backgrounds: mergeBackgrounds(backgrounds, [{ url: result.url, name: result.name }]),
      });
      savePreferences({ visualUrl: result.url, visualName: result.name }).catch(() => {});
      setDraftName("");
    } catch (error) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      onSessionVisualChange({ url, name });
      const motivo = error?.message ? ` Motivo: ${error.message}` : "";
      window.alert(`Nao consegui salvar esse fundo no public. Ele foi aplicado apenas nesta sessao.${motivo}`);
    }

    event.target.value = "";
  }

  function selectBackground(background) {
    releaseObjectUrl();
    onSessionVisualChange(null);
    onUpdateSettings({ visualUrl: background.url, visualName: background.name });
    savePreferences({ visualUrl: background.url, visualName: background.name }).catch(() => {});
  }

  function renameBackground(url, rawName) {
    const name = (rawName ?? "").trim();
    if (!name) return;

    onUpdateSettings({
      backgrounds: backgrounds.map((background) =>
        background.url === url ? { ...background, name } : background,
      ),
      visualName: visualUrl === url ? name : visualName,
    });
    saveBackground({ url, name }).catch(() => {});
    if (visualUrl === url) {
      savePreferences({ visualUrl: url, visualName: name }).catch(() => {});
    }
  }

  function removeBackground(url) {
    const nextBackgrounds = backgrounds.filter((background) => background.url !== url);
    const clearingActive = visualUrl === url;
    onUpdateSettings({
      backgrounds: nextBackgrounds,
      visualUrl: clearingActive ? "" : visualUrl,
      visualName: clearingActive ? "" : visualName,
    });
    if (clearingActive) {
      onSessionVisualChange(null);
      savePreferences({ visualUrl: "", visualName: "" }).catch(() => {});
    }
    deleteBackground(url).catch(() => {});
  }

  function clearVisual() {
    releaseObjectUrl();
    onSessionVisualChange(null);
    onUpdateSettings({ visualUrl: "", visualName: "" });
    savePreferences({ visualUrl: "", visualName: "" }).catch(() => {});
  }

  function changeBrightness(value) {
    const numericValue = Number(value);
    const brightness = Number.isFinite(numericValue) ? Math.max(0, Math.min(100, Math.round(numericValue))) : 100;
    onUpdateSettings({ visualBrightness: brightness, dimVisual: brightness < 100 });
    savePreferences({ visualBrightness: brightness, dimVisual: brightness < 100 }).catch(() => {});
  }

  return (
    <VisualPanel
      visualName={sessionVisual?.name ?? visualName}
      activeUrl={visualUrl}
      backgrounds={backgrounds}
      draftName={draftName}
      visualBrightness={visualBrightness}
      onDraftNameChange={setDraftName}
      onUploadVisual={uploadVisual}
      onSelectBackground={selectBackground}
      onRenameBackground={renameBackground}
      onRemoveBackground={removeBackground}
      onClearVisual={clearVisual}
      onBrightnessChange={changeBrightness}
    />
  );
});
