import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "../../shared/storage";
import { parseYouTube, parseYouTubeId } from "../../shared/youtube";
import { MusicPanel } from "./MusicPanel";
import { SpotifyPlayer } from "./SpotifyPlayer";
import {
  clearSpotifyAuth,
  completeSpotifyLogin,
  getSpotifyClientId,
  getFreshSpotifyAuth,
  readSpotifyAuth,
  startSpotifyLogin,
} from "./spotifyAuth";
import { YouTubeAudio } from "./YouTubeAudio";

function clampVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return 80;
  return Math.max(0, Math.min(100, Math.round(volume)));
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

export const MusicDock = memo(function MusicDock({
  musicMode,
  youtubeLinks,
  activeYoutubeUrl,
  spotifyClientId,
  spotifyTrackUri,
  onUpdateSettings,
}) {
  const youtubePlayerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftSpotifyTrack, setDraftSpotifyTrack] = useState(spotifyTrackUri);
  const [spotifyAuth, setSpotifyAuth] = useState(readSpotifyAuth);
  const [spotifyReady, setSpotifyReady] = useState(false);
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
  const activeLabel = musicMode === "spotify"
    ? spotifyTrackUri || "Spotify"
    : activeYoutube?.label || "Nenhum link do YouTube";
  const canPlay = musicMode === "spotify" ? Boolean(spotifyAuth?.access_token && spotifyReady && spotifyTrackUri) : Boolean(activeYoutubeVideo.id);
  const configuredSpotifyClientId = getSpotifyClientId(spotifyClientId);

  useEffect(() => {
    setDraftSpotifyTrack(spotifyTrackUri);
  }, [spotifyTrackUri]);

  useEffect(() => {
    completeSpotifyLogin(configuredSpotifyClientId)
      .then((auth) => {
        if (auth) {
          setSpotifyAuth(auth);
          onUpdateSettings({ musicMode: "spotify" });
        }
      })
      .catch((loginError) => setError(loginError.message));
  }, [configuredSpotifyClientId, onUpdateSettings]);

  useEffect(() => {
    if (musicMode !== "spotify" || !configuredSpotifyClientId) return;
    getFreshSpotifyAuth(configuredSpotifyClientId)
      .then((auth) => {
        if (auth) setSpotifyAuth(auth);
      })
      .catch(() => {});
  }, [configuredSpotifyClientId, musicMode]);

  function changeMode(nextMode) {
    setPlaying(false);
    setProgress({ current: 0, duration: 0 });
    setError("");
    onUpdateSettings({ musicMode: nextMode });
  }

  function changeVolume(nextVolume) {
    setStoredVolume(clampVolume(nextVolume));
  }

  function toggleMute() {
    setStoredVolume(volume > 0 ? 0 : lastAudibleVolumeRef.current);
  }

  function togglePlay() {
    if (!canPlay) return;
    setPlaying((current) => !current);
  }

  function skip() {
    if (musicMode !== "youtube" || !youtubeLinks.length) return;
    const index = youtubeLinks.findIndex((link) => link.url === activeYoutube?.url);
    const next = youtubeLinks[(index + 1) % youtubeLinks.length];
    onUpdateSettings({ activeYoutubeUrl: next.url });
    setPlaying(true);
  }

  function previous() {
    if (musicMode !== "youtube" || !youtubeLinks.length) return;
    const index = youtubeLinks.findIndex((link) => link.url === activeYoutube?.url);
    const previousLink = youtubeLinks[(index - 1 + youtubeLinks.length) % youtubeLinks.length];
    onUpdateSettings({ activeYoutubeUrl: previousLink.url });
    setPlaying(true);
  }

  function restart() {
    if (musicMode === "youtube") {
      youtubePlayerRef.current?.seekTo(0);
      setPlaying(Boolean(activeYoutubeVideo.id));
    }
  }

  function seek(fraction) {
    if (musicMode === "youtube" && progress.duration > 0) {
      youtubePlayerRef.current?.seekTo(fraction * progress.duration);
    }
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

    onUpdateSettings({ youtubeLinks: nextLinks, activeYoutubeUrl: url, musicMode: "youtube" });
    setDraftUrl("");
    setDraftLabel("");
    setError("");
    setPlaying(true);
  }

  function renameYoutubeLink(url, rawLabel) {
    const label = (rawLabel ?? "").trim();
    if (!label) return;
    onUpdateSettings({ youtubeLinks: youtubeLinks.map((link) => (link.url === url ? { ...link, label } : link)) });
  }

  function removeYoutubeLink(url) {
    const nextLinks = youtubeLinks.filter((link) => link.url !== url);
    onUpdateSettings({
      youtubeLinks: nextLinks,
      activeYoutubeUrl: activeYoutubeUrl === url ? nextLinks[0]?.url || "" : activeYoutubeUrl,
    });
    if (!nextLinks.length) setPlaying(false);
  }

  function saveSpotifyConfig() {
    const uri = normalizeSpotifyUri(draftSpotifyTrack);
    if (draftSpotifyTrack.trim() && !uri) {
      setError("Informe uma URI ou link de faixa do Spotify.");
      return false;
    }
    onUpdateSettings({ spotifyTrackUri: uri, musicMode: "spotify" });
    setError("");
    return true;
  }

  function connectSpotify() {
    if (!saveSpotifyConfig()) return;
    startSpotifyLogin(configuredSpotifyClientId).catch((loginError) => setError(loginError.message));
  }

  function disconnectSpotify() {
    clearSpotifyAuth();
    setSpotifyAuth(null);
    setSpotifyReady(false);
    setPlaying(false);
  }

  return (
    <>
      {musicMode === "youtube" && activeYoutubeVideo.id ? (
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
      {musicMode === "spotify" && spotifyAuth?.access_token ? (
        <SpotifyPlayer
          accessToken={spotifyAuth.access_token}
          trackUri={spotifyTrackUri}
          playing={playing}
          volume={volume}
          onReady={() => setSpotifyReady(true)}
          onProgress={(current, duration) => setProgress({ current, duration })}
          onPlayingChange={setPlaying}
          onError={setError}
        />
      ) : null}
      <MusicPanel
        mode={musicMode}
        activeLabel={activeLabel}
        youtubeLinks={youtubeLinks}
        activeYoutubeUrl={activeYoutubeUrl}
        draftLabel={draftLabel}
        draftUrl={draftUrl}
        spotifyConfigured={Boolean(configuredSpotifyClientId)}
        spotifyTrack={draftSpotifyTrack}
        spotifyConnected={Boolean(spotifyAuth?.access_token)}
        spotifyReady={spotifyReady}
        error={error}
        playing={playing}
        progress={progress}
        volume={volume}
        canPlay={canPlay}
        onModeChange={changeMode}
        onVolumeChange={changeVolume}
        onToggleMute={toggleMute}
        onDraftLabelChange={setDraftLabel}
        onDraftUrlChange={setDraftUrl}
        onAddYoutubeLink={addYoutubeLink}
        onSelectYoutubeLink={(url) => {
          onUpdateSettings({ activeYoutubeUrl: url, musicMode: "youtube" });
          setPlaying(true);
        }}
        onRenameYoutubeLink={renameYoutubeLink}
        onRemoveYoutubeLink={removeYoutubeLink}
        onSpotifyTrackChange={setDraftSpotifyTrack}
        onSaveSpotifyConfig={saveSpotifyConfig}
        onConnectSpotify={connectSpotify}
        onDisconnectSpotify={disconnectSpotify}
        onTogglePlay={togglePlay}
        onSkip={skip}
        onPrevious={previous}
        onRestart={restart}
        onSeek={seek}
      />
    </>
  );
});
