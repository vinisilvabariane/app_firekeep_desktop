import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import { LibraryRow } from "../../shared/LibraryRow";

export function MusicPanel({
  mode,
  activeLabel,
  youtubeLinks,
  activeYoutubeUrl,
  draftLabel,
  draftUrl,
  spotifyTrack,
  spotifyConfigured,
  spotifyConnected,
  spotifyReady,
  error,
  playing,
  progress,
  volume,
  canPlay,
  onModeChange,
  onVolumeChange,
  onToggleMute,
  onDraftLabelChange,
  onDraftUrlChange,
  onAddYoutubeLink,
  onSelectYoutubeLink,
  onRenameYoutubeLink,
  onRemoveYoutubeLink,
  onSpotifyTrackChange,
  onSaveSpotifyConfig,
  onConnectSpotify,
  onDisconnectSpotify,
  onTogglePlay,
  onSkip,
  onPrevious,
  onRestart,
  onSeek,
}) {
  const [listOpen, setListOpen] = useState(false);
  const duration = progress?.duration ?? 0;
  const current = progress?.current ?? 0;
  const fraction = duration > 0 ? Math.min(1, current / duration) : 0;
  const isSpotify = mode === "spotify";

  function handleSeek(event) {
    if (!onSeek || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)));
  }

  return (
    <Paper elevation={10} className="sidePanel musicPanel">
      <Box className="rowBetween">
        <Box className="rowCenter">
          <Box className="tinyIcon">
            <Icon name="music" fontSize="small" />
          </Box>
          <Typography variant="subtitle2" fontWeight={900}>
            Musicas
          </Typography>
        </Box>
        <Box
          component="button"
          type="button"
          className={listOpen ? "musicListToggle isOpen" : "musicListToggle"}
          onClick={() => setListOpen((currentValue) => !currentValue)}
        >
          {isSpotify ? "Spotify" : `${youtubeLinks.length} YouTube`}
          <Icon name={listOpen ? "chevronDown" : "chevronRight"} fontSize="small" />
        </Box>
      </Box>

      <Box className="musicModeSwitch">
        <button type="button" className={mode === "youtube" ? "isActive" : ""} onClick={() => onModeChange("youtube")}>
          YouTube
        </button>
        <button type="button" className={mode === "spotify" ? "isActive" : ""} onClick={() => onModeChange("spotify")}>
          Spotify
        </button>
      </Box>

      <Box className="musicPlayer">
        <Stack className="musicNowPlaying" direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <span className={playing ? "musicPulse isOn" : "musicPulse"} />
          <Typography variant="body2" fontWeight={800} noWrap sx={{ flex: 1 }}>
            {activeLabel}
          </Typography>
        </Stack>

        <Box className="musicSeek" onClick={handleSeek} role="slider" aria-label="Progresso da musica">
          <Box className="musicSeekFill" style={{ width: `${fraction * 100}%` }}>
            <span className="musicSeekThumb" />
          </Box>
        </Box>

        <Stack className="musicTimes" direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption">{formatDuration(current)}</Typography>
          <Typography variant="caption">{formatDuration(duration)}</Typography>
        </Stack>

        <Stack className="musicControls" direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 1.5 }}>
          <Tooltip title="Recomecar faixa">
            <span>
              <IconButton className="musicSideButton" onClick={onRestart} disabled={!canPlay || isSpotify} aria-label="Recomecar faixa">
                <Icon name="reset" fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Anterior">
            <span>
              <IconButton className="musicSideButton" onClick={onPrevious} disabled={!canPlay || isSpotify} aria-label="Faixa anterior">
                <Icon name="skipBack" fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={playing ? "Pausar" : "Tocar"}>
            <span>
              <IconButton className="musicPlayButton" onClick={onTogglePlay} disabled={!canPlay} aria-label="Tocar ou pausar">
                <Icon name={playing ? "pause" : "play"} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Proxima">
            <span>
              <IconButton className="musicSideButton" onClick={onSkip} disabled={!canPlay || isSpotify} aria-label="Proxima musica">
                <Icon name="skip" fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Stack className="musicVolume" direction="row" sx={{ alignItems: "center", gap: 1.2 }}>
          <Tooltip title={volume === 0 ? "Ativar som" : "Silenciar"}>
            <IconButton
              className="musicSideButton"
              size="small"
              onClick={onToggleMute}
              aria-label={volume === 0 ? "Ativar som" : "Silenciar"}
            >
              <Icon name={volume === 0 ? "volumeOff" : "volume"} fontSize="small" />
            </IconButton>
          </Tooltip>
          <Slider
            className="musicVolumeSlider"
            size="small"
            value={volume}
            min={0}
            max={100}
            onChange={(_event, value) => onVolumeChange(value)}
            aria-label="Volume da musica"
          />
          <Typography variant="caption" className="musicVolumeValue">
            {volume}
          </Typography>
        </Stack>
      </Box>

      <Collapse in={listOpen} unmountOnExit>
        <Box className="stackCol">
          {isSpotify ? (
            <>
              <TextField
                fullWidth
                size="small"
                label="Link ou URI da faixa"
                value={spotifyTrack}
                onChange={(event) => onSpotifyTrackChange(event.target.value)}
              />
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button variant="outlined" size="small" onClick={onSaveSpotifyConfig}>
                  Salvar
                </Button>
                {spotifyConnected ? (
                  <Button variant="outlined" size="small" color="error" onClick={onDisconnectSpotify}>
                    Desconectar
                  </Button>
                ) : (
                  <Button variant="contained" size="small" onClick={onConnectSpotify} disabled={!spotifyConfigured}>
                    Entrar com Spotify
                  </Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {spotifyConnected
                  ? spotifyReady
                    ? "Spotify conectado."
                    : "Conectado; aguardando player."
                  : spotifyConfigured
                    ? "Entre pela janela oficial do Spotify. Playback exige Spotify Premium."
                    : "Spotify ainda nao foi configurado nesta build."}
              </Typography>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                label="Nome"
                value={draftLabel}
                onChange={(event) => onDraftLabelChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onAddYoutubeLink();
                }}
              />
              <Box className="rowCenter">
                <TextField
                  fullWidth
                  size="small"
                  label="Link do YouTube"
                  value={draftUrl}
                  onChange={(event) => onDraftUrlChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onAddYoutubeLink();
                  }}
                />
                <Tooltip title="Adicionar">
                  <IconButton className="glassButton" onClick={onAddYoutubeLink} aria-label="Adicionar musica">
                    <Icon name="add" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box className="videoList">
                {youtubeLinks.length ? (
                  youtubeLinks.map((link) => (
                    <LibraryRow
                      key={link.url}
                      active={activeYoutubeUrl === link.url}
                      label={link.label}
                      onSelect={() => onSelectYoutubeLink(link.url)}
                      onRename={(name) => onRenameYoutubeLink(link.url, name)}
                      onRemove={() => onRemoveYoutubeLink(link.url)}
                      removeLabel="Remover musica"
                    />
                  ))
                ) : null}
              </Box>
            </>
          )}

          {error ? (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
