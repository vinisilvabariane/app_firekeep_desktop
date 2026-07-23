import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Box from "@mui/material/Box";
import { loadYouTubeIframeApi } from "./youtubeApi";

export const YouTubeAudio = forwardRef(function YouTubeAudio(
  { videoId, start = 0, playing, volume = 100, onProgress, onEnded, onPlayingChange, onError },
  ref,
) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);
  const currentIdRef = useRef("");
  const callbacksRef = useRef({});
  const volumeRef = useRef(volume);
  callbacksRef.current = { onProgress, onEnded, onPlayingChange, onError };
  volumeRef.current = volume;

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      if (readyRef.current) playerRef.current?.seekTo?.(seconds, true);
    },
  }));

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;

        playerRef.current = new YT.Player(hostRef.current, {
          videoId: videoId || undefined,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            start: 0,
          },
          events: {
            onReady: () => {
              readyRef.current = true;
              currentIdRef.current = videoId;
              playerRef.current.setVolume?.(volumeRef.current);
              if (playing && videoId) playerRef.current.playVideo();
            },
            onStateChange: (event) => {
              const state = window.YT?.PlayerState ?? {};
              if (event.data === state.ENDED) callbacksRef.current.onEnded?.();
              if (event.data === state.PLAYING) callbacksRef.current.onPlayingChange?.(true);
              if (event.data === state.PAUSED) callbacksRef.current.onPlayingChange?.(false);
            },
            onError: () => callbacksRef.current.onError?.("Nao consegui tocar esse link do YouTube."),
          },
        });
      })
      .catch((error) => callbacksRef.current.onError?.(error.message));

    let lastCurrent = -1;
    let lastDuration = -1;
    const poll = window.setInterval(() => {
      const player = playerRef.current;
      if (!readyRef.current || typeof player?.getDuration !== "function") return;
      const duration = player.getDuration() || 0;
      const current = player.getCurrentTime() || 0;
      if (Math.abs(current - lastCurrent) < 0.25 && duration === lastDuration) return;
      lastCurrent = current;
      lastDuration = duration;
      callbacksRef.current.onProgress?.(current, duration);
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore teardown errors
      }
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player || !videoId || currentIdRef.current === videoId) return;

    currentIdRef.current = videoId;
    if (playing) player.loadVideoById({ videoId, startSeconds: start });
    else player.cueVideoById({ videoId, startSeconds: start });
  }, [videoId, start, playing]);

  useEffect(() => {
    const player = playerRef.current;
    if (!readyRef.current || !player || !videoId) return;
    if (playing) player.playVideo();
    else player.pauseVideo();
  }, [playing, videoId]);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume?.(volume);
  }, [volume]);

  return (
    <Box className="externalAudioFrame" aria-hidden="true">
      <div ref={hostRef} />
    </Box>
  );
});
