import { useEffect, useRef } from "react";

let sdkPromise;

export function SpotifyPlayer({
  accessToken,
  trackUri,
  playing,
  volume,
  onReady,
  onProgress,
  onPlayingChange,
  onError,
}) {
  const playerRef = useRef(null);
  const deviceIdRef = useRef("");
  const callbacksRef = useRef({});
  const volumeRef = useRef(volume);
  callbacksRef.current = { onReady, onProgress, onPlayingChange, onError };
  volumeRef.current = volume;

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
          deviceIdRef.current = device_id;
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
        player.connect();
      })
      .catch((error) => callbacksRef.current.onError?.(error.message));

    return () => {
      cancelled = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = "";
    };
  }, [accessToken]);

  useEffect(() => {
    playerRef.current?.setVolume(Math.max(0, Math.min(1, volume / 100)));
  }, [volume]);

  useEffect(() => {
    if (!accessToken || !deviceIdRef.current || !trackUri) return;
    if (playing) {
      playSpotifyTrack(accessToken, deviceIdRef.current, trackUri).catch((error) => {
        callbacksRef.current.onError?.(error.message);
      });
    }
    else playerRef.current?.pause();
  }, [accessToken, playing, trackUri]);

  return null;
}

async function playSpotifyTrack(accessToken, deviceId, trackUri) {
  const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [trackUri] }),
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
