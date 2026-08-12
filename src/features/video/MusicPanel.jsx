import { useState } from "react";
import Box from "@mui/material/Box";
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

export function MusicPanel({ activeLabel, youtubeLinks, activeYoutubeUrl, draftLabel, draftUrl, error, playing, progress, volume, canPlay, onVolumeChange, onToggleMute, onDraftLabelChange, onDraftUrlChange, onAddYoutubeLink, onSelectYoutubeLink, onRenameYoutubeLink, onRemoveYoutubeLink, onTogglePlay, onSkip, onPrevious, onRestart, onSeek }) {
  const [listOpen, setListOpen] = useState(false);
  const duration = progress?.duration ?? 0;
  const current = progress?.current ?? 0;
  const fraction = duration > 0 ? Math.min(1, current / duration) : 0;

  function handleSeek(event) {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
  }

  return (
    <Paper elevation={10} className="sidePanel musicPanel">
      <Box className="rowBetween">
        <Box className="rowCenter"><Box className="tinyIcon"><Icon name="music" fontSize="small" /></Box><Typography variant="subtitle2" fontWeight={900}>Musicas</Typography></Box>
        <Box component="button" type="button" className={listOpen ? "musicListToggle isOpen" : "musicListToggle"} onClick={() => setListOpen((value) => !value)} aria-expanded={listOpen}>
          {listOpen ? "Minimizar" : `${youtubeLinks.length} YouTube`}<Icon name={listOpen ? "chevronDown" : "chevronRight"} fontSize="small" />
        </Box>
      </Box>
      <Box className="musicPlayer">
        <Stack className="musicNowPlaying" direction="row" sx={{ alignItems: "center", gap: 1 }}><span className={playing ? "musicPulse isOn" : "musicPulse"} /><Typography variant="body2" fontWeight={800} noWrap sx={{ flex: 1 }}>{activeLabel}</Typography></Stack>
        <Box className="musicSeek" onClick={handleSeek} role="slider" aria-label="Progresso da musica"><Box className="musicSeekFill" style={{ width: `${fraction * 100}%` }}><span className="musicSeekThumb" /></Box></Box>
        <Stack className="musicTimes" direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}><Typography variant="caption">{formatDuration(current)}</Typography><Typography variant="caption">{formatDuration(duration)}</Typography></Stack>
        <Stack className="musicControls" direction="row" sx={{ alignItems: "center", justifyContent: "center", gap: 1.5 }}>
          <Tooltip title="Recomecar faixa"><span><IconButton className="musicSideButton" onClick={onRestart} disabled={!canPlay} aria-label="Recomecar faixa"><Icon name="reset" fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title="Anterior"><span><IconButton className="musicSideButton" onClick={onPrevious} disabled={!canPlay} aria-label="Faixa anterior"><Icon name="skipBack" fontSize="small" /></IconButton></span></Tooltip>
          <Tooltip title={playing ? "Pausar" : "Tocar"}><span><IconButton className="musicPlayButton" onClick={onTogglePlay} disabled={!canPlay} aria-label="Tocar ou pausar"><Icon name={playing ? "pause" : "play"} /></IconButton></span></Tooltip>
          <Tooltip title="Proxima"><span><IconButton className="musicSideButton" onClick={onSkip} disabled={!canPlay} aria-label="Proxima musica"><Icon name="skip" fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        <Stack className="musicVolume" direction="row" sx={{ alignItems: "center", gap: 1.2 }}><Tooltip title={volume === 0 ? "Ativar som" : "Silenciar"}><IconButton className="musicSideButton" size="small" onClick={onToggleMute} aria-label="Alternar som"><Icon name={volume === 0 ? "volumeOff" : "volume"} fontSize="small" /></IconButton></Tooltip><Slider className="musicVolumeSlider" size="small" value={volume} min={0} max={100} onChange={(_event, value) => onVolumeChange(value)} aria-label="Volume da musica" /><Typography variant="caption" className="musicVolumeValue">{volume}</Typography></Stack>
      </Box>
      <Collapse in={listOpen} unmountOnExit><Box className="stackCol"><TextField fullWidth size="small" label="Nome" value={draftLabel} onChange={(event) => onDraftLabelChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddYoutubeLink(); }} /><Box className="rowCenter"><TextField fullWidth size="small" label="Link do YouTube" value={draftUrl} onChange={(event) => onDraftUrlChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onAddYoutubeLink(); }} /><Tooltip title="Adicionar"><IconButton className="glassButton" onClick={onAddYoutubeLink} aria-label="Adicionar musica"><Icon name="add" /></IconButton></Tooltip></Box><Box className="videoList">{youtubeLinks.map((link) => <LibraryRow key={link.url} active={activeYoutubeUrl === link.url} label={link.label} onSelect={() => onSelectYoutubeLink(link.url)} onRename={(name) => onRenameYoutubeLink(link.url, name)} onRemove={() => onRemoveYoutubeLink(link.url)} removeLabel="Remover musica" />)}</Box>{error ? <Typography variant="caption" color="error">{error}</Typography> : null}</Box></Collapse>
    </Paper>
  );
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
