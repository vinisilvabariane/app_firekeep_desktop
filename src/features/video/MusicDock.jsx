import { memo, useMemo, useRef, useState } from "react";
import { deleteVideoLink, saveVideoLink } from "../../shared/api";
import { useStoredState } from "../../shared/storage";
import { parseYouTube, parseYouTubeId } from "../../shared/youtube";
import { MusicPanel } from "./MusicPanel";
import { YouTubeAudio } from "./YouTubeAudio";

function clampVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return 80;
  return Math.max(0, Math.min(100, Math.round(volume)));
}

export const MusicDock = memo(function MusicDock({ youtubeLinks, activeYoutubeUrl, onUpdateSettings }) {
  const youtubePlayerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");
  const [storedVolume, setStoredVolume] = useStoredState("firekeep:musicVolume", 80);
  const volume = clampVolume(storedVolume);
  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 80);
  if (volume > 0) lastAudibleVolumeRef.current = volume;

  const activeYoutube = useMemo(
    () => youtubeLinks.find((link) => link.url === activeYoutubeUrl) ?? youtubeLinks[0] ?? null,
    [activeYoutubeUrl, youtubeLinks],
  );
  const activeYoutubeVideo = useMemo(() => parseYouTube(activeYoutube?.url), [activeYoutube?.url]);

  function changeVolume(nextVolume) {
    setStoredVolume(clampVolume(nextVolume));
  }

  function toggleMute() {
    setStoredVolume(volume > 0 ? 0 : lastAudibleVolumeRef.current);
  }

  function togglePlay() {
    if (activeYoutubeVideo.id) setPlaying((current) => !current);
  }

  function skip() {
    if (!youtubeLinks.length) return;
    const index = youtubeLinks.findIndex((link) => link.url === activeYoutube?.url);
    const next = youtubeLinks[(index + 1) % youtubeLinks.length];
    onUpdateSettings({ activeYoutubeUrl: next.url });
    setPlaying(true);
  }

  function previous() {
    if (!youtubeLinks.length) return;
    const index = youtubeLinks.findIndex((link) => link.url === activeYoutube?.url);
    const previousLink = youtubeLinks[(index - 1 + youtubeLinks.length) % youtubeLinks.length];
    onUpdateSettings({ activeYoutubeUrl: previousLink.url });
    setPlaying(true);
  }

  function restart() {
    youtubePlayerRef.current?.seekTo(0);
    setPlaying(Boolean(activeYoutubeVideo.id));
  }

  function seek(fraction) {
    if (progress.duration > 0) youtubePlayerRef.current?.seekTo(fraction * progress.duration);
  }

  function addYoutubeLink() {
    const id = parseYouTubeId(draftUrl);
    if (!id) {
      setError("Informe um link valido do YouTube.");
      return;
    }
    const url = draftUrl.trim();
    const label = draftLabel.trim() || `Faixa ${youtubeLinks.length + 1}`;
    const nextLink = { label, url };
    const nextLinks = youtubeLinks.some((link) => parseYouTubeId(link.url) === id)
      ? youtubeLinks.map((link) => (parseYouTubeId(link.url) === id ? nextLink : link))
      : [...youtubeLinks, nextLink];
    onUpdateSettings({ youtubeLinks: nextLinks, activeYoutubeUrl: url });
    saveVideoLink(nextLink).catch(() => {});
    setDraftUrl("");
    setDraftLabel("");
    setError("");
    setPlaying(true);
  }

  function renameYoutubeLink(url, rawLabel) {
    const label = (rawLabel ?? "").trim();
    if (!label) return;
    const nextLink = { url, label };
    onUpdateSettings({ youtubeLinks: youtubeLinks.map((link) => (link.url === url ? nextLink : link)) });
    saveVideoLink(nextLink).catch(() => {});
  }

  function removeYoutubeLink(url) {
    const nextLinks = youtubeLinks.filter((link) => link.url !== url);
    onUpdateSettings({ youtubeLinks: nextLinks, activeYoutubeUrl: activeYoutubeUrl === url ? nextLinks[0]?.url || "" : activeYoutubeUrl });
    if (!nextLinks.length) setPlaying(false);
    deleteVideoLink(url).catch(() => {});
  }

  return (
    <>
      {activeYoutubeVideo.id ? (
        <YouTubeAudio
          ref={youtubePlayerRef}
          videoId={activeYoutubeVideo.id}
          start={activeYoutubeVideo.start}
          playing={playing}
          volume={volume}
          onProgress={(current, duration) => setProgress({ current, duration })}
          onEnded={skip}
          onPlayingChange={setPlaying}
          onError={setError}
        />
      ) : null}
      <MusicPanel
        activeLabel={activeYoutube?.label || "Nenhum link do YouTube"}
        youtubeLinks={youtubeLinks}
        activeYoutubeUrl={activeYoutubeUrl}
        draftLabel={draftLabel}
        draftUrl={draftUrl}
        error={error}
        playing={playing}
        progress={progress}
        volume={volume}
        canPlay={Boolean(activeYoutubeVideo.id)}
        onVolumeChange={changeVolume}
        onToggleMute={toggleMute}
        onDraftLabelChange={setDraftLabel}
        onDraftUrlChange={setDraftUrl}
        onAddYoutubeLink={addYoutubeLink}
        onSelectYoutubeLink={(url) => { onUpdateSettings({ activeYoutubeUrl: url }); setPlaying(true); }}
        onRenameYoutubeLink={renameYoutubeLink}
        onRemoveYoutubeLink={removeYoutubeLink}
        onTogglePlay={togglePlay}
        onSkip={skip}
        onPrevious={previous}
        onRestart={restart}
        onSeek={seek}
      />
    </>
  );
});
