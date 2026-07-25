import { memo, useEffect, useMemo, useRef, useState } from "react";
import { deleteVideoLink, saveVideoLink } from "../../shared/api";
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

export const MusicDock = memo(function MusicDock({
  musicMode,
  youtubeLinks,
  activeYoutubeUrl,
  spotifyClientId,
  spotifyTrackUri,
  onUpdateSettings,
}) {
  const youtubePlayerRef = useRef(null);
  const spotifyPlayerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [spotifyAuth, setSpotifyAuth] = useState(readSpotifyAuth);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [spotifyExpanded, setSpotifyExpanded] = useState(false);
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
    ? spotifyPlaylists.find((playlist) => playlist.uri === spotifyTrackUri)?.name || "Escolha uma playlist"
    : activeYoutube?.label || "Nenhum link do YouTube";
  const canPlay = musicMode === "spotify" ? Boolean(spotifyAuth?.access_token && spotifyReady && spotifyTrackUri) : Boolean(activeYoutubeVideo.id);
  const configuredSpotifyClientId = getSpotifyClientId(spotifyClientId);

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

  useEffect(() => {
    if (!spotifyAuth?.access_token || musicMode !== "spotify") return undefined;
    let active = true;
    setSpotifyLoading(true);
    loadSpotifyLibrary(spotifyAuth.access_token)
      .then(({ profile, playlists }) => {
        if (!active) return;
        setSpotifyProfile(profile);
        setSpotifyPlaylists(playlists);
      })
      .catch((libraryError) => {
        if (active) setError(libraryError.message);
      })
      .finally(() => {
        if (active) setSpotifyLoading(false);
      });
    return () => { active = false; };
  }, [musicMode, spotifyAuth?.access_token]);

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
    if (musicMode === "spotify" && !playing) spotifyPlayerRef.current?.activate();
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
    onUpdateSettings({
      youtubeLinks: nextLinks,
      activeYoutubeUrl: activeYoutubeUrl === url ? nextLinks[0]?.url || "" : activeYoutubeUrl,
    });
    if (!nextLinks.length) setPlaying(false);
    deleteVideoLink(url).catch(() => {});
  }

  function connectSpotify() {
    startSpotifyLogin(configuredSpotifyClientId)
      .then((auth) => {
        if (!auth) return;
        setSpotifyAuth(auth);
        onUpdateSettings({ musicMode: "spotify" });
      })
      .catch((loginError) => setError(loginError.message));
  }

  function disconnectSpotify() {
    clearSpotifyAuth();
    setSpotifyAuth(null);
    setSpotifyReady(false);
    setSpotifyProfile(null);
    setSpotifyPlaylists([]);
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
          ref={spotifyPlayerRef}
          accessToken={spotifyAuth.access_token}
          playbackUri={spotifyTrackUri}
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
        spotifyConnected={Boolean(spotifyAuth?.access_token)}
        spotifyReady={spotifyReady}
        spotifyProfile={spotifyProfile}
        spotifyPlaylists={spotifyPlaylists}
        spotifyLoading={spotifyLoading}
        spotifyPlaybackUri={spotifyTrackUri}
        expanded={spotifyExpanded}
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
        onConnectSpotify={connectSpotify}
        onDisconnectSpotify={disconnectSpotify}
        onSelectSpotifyPlaylist={(playlist) => {
          spotifyPlayerRef.current?.activate();
          onUpdateSettings({ spotifyTrackUri: playlist.uri, musicMode: "spotify" });
          setError("");
          setPlaying(true);
        }}
        onToggleExpanded={() => setSpotifyExpanded((current) => !current)}
        onTogglePlay={togglePlay}
        onSkip={skip}
        onPrevious={previous}
        onRestart={restart}
        onSeek={seek}
      />
    </>
  );
});

async function loadSpotifyLibrary(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const [profileResponse, playlistsResponse] = await Promise.all([
    fetch("https://api.spotify.com/v1/me", { headers }),
    fetch("https://api.spotify.com/v1/me/playlists?limit=24", { headers }),
  ]);
  if (!profileResponse.ok || !playlistsResponse.ok) {
    throw new Error("Não foi possível carregar sua biblioteca do Spotify.");
  }
  const profile = await profileResponse.json();
  const data = await playlistsResponse.json();
  return {
    profile: { name: profile.display_name || profile.id || "Sua conta" },
    playlists: (data.items || [])
      .filter((playlist) => playlist?.uri && playlist?.name)
      .map((playlist) => ({
        uri: playlist.uri,
        name: playlist.name,
        total: playlist.tracks?.total ?? 0,
        image: playlist.images?.[0]?.url || "",
      })),
  };
}
