import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

let sdkPromise;

export const SpotifyPlayer = forwardRef(function SpotifyPlayer({
  accessToken,
  playbackUri,
  playing,
  volume,
  onReady,
  onProgress,
  onPlayingChange,
  onError,
}, ref) {
  const playerRef = useRef(null);
  const [deviceId, setDeviceId] = useState("");
  const callbacksRef = useRef({});
  const volumeRef = useRef(volume);
  callbacksRef.current = { onReady, onProgress, onPlayingChange, onError };
  volumeRef.current = volume;

  useImperativeHandle(ref, () => ({
    activate: () => playerRef.current?.activateElement?.().catch(() => {}),
  }), []);

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;

    loadSpotifySdk()
      .then(() => {
        if (cancelled) return;
        const player = new window.Spotify.Player({
          name: "Firekeep",
          volume: Math.max(0, Math.min(1, volumeRef.current / 100)),
          getOAuthToken: (callback) => callback(accessToken),
        });
        playerRef.current = player;

        player.addListener("ready", ({ device_id }) => {
          setDeviceId(device_id);
          callbacksRef.current.onReady?.(device_id);
        });
        player.addListener("player_state_changed", (state) => {
          if (!state) return;
          callbacksRef.current.onProgress?.(state.position / 1000, state.duration / 1000);
          callbacksRef.current.onPlayingChange?.(!state.paused);
        });
        player.addListener("initialization_error", ({ message }) => callbacksRef.current.onError?.(message));
        player.addListener("authentication_error", ({ message }) => callbacksRef.current.onError?.(message));
        player.addListener("account_error", () => callbacksRef.current.onError?.("Spotify Premium e necessario para tocar no Firekeep."));
        player.addListener("playback_error", ({ message }) => callbacksRef.current.onError?.(message));
        player.addListener("autoplay_failed", () => callbacksRef.current.onError?.("O Spotify bloqueou a reproducao automatica. Clique em Tocar novamente."));
        player.connect();
      })
      .catch((error) => callbacksRef.current.onError?.(error.message));

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      setDeviceId("");
    };
  }, [accessToken]);

  useEffect(() => {
    playerRef.current?.setVolume(Math.max(0, Math.min(1, volume / 100)));
  }, [volume]);

  useEffect(() => {
    if (!accessToken || !deviceId || !playbackUri) return;
    if (playing) {
      playSpotifyUri(accessToken, deviceId, playbackUri, playerRef.current).catch((error) => {
        callbacksRef.current.onError?.(error.message);
      });
    }
    else playerRef.current?.pause();
  }, [accessToken, deviceId, playing, playbackUri]);

  return null;
});

async function playSpotifyUri(accessToken, deviceId, playbackUri, player) {
  const isTrack = playbackUri.startsWith("spotify:track:");
  await player?.activateElement?.().catch(() => {});
  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(isTrack ? { uris: [playbackUri] } : { context_uri: playbackUri }),
  });
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || "Nao consegui iniciar a faixa no Spotify.");
  }
}

function loadSpotifySdk() {
  if (window.Spotify?.Player) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Nao consegui carregar o SDK do Spotify."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}
