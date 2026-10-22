import { memo, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Icon } from "../../shared/Icon";
import { formatTime } from "./sessionPlan";
import { usePomodoro } from "./usePomodoro";

// Estado da janela do miniplayer (so existe no app desktop).
function useMiniPlayer() {
  const api = globalThis.window?.firekeepWindow;
  const available = Boolean(api?.toggleMiniPlayer);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!available) return undefined;
    api.isMiniPlayerOpen().then(setOpen).catch(() => {});
    return api.onMiniPlayerVisibility(setOpen);
  }, [api, available]);

  return { available, open, toggle: () => api?.toggleMiniPlayer() };
}

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DATE_PARTS = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

// "qui 22 out": dia da semana, dia e mes, sem os pontos da abreviacao.
function formatDate(date) {
  const part = (type) => DATE_PARTS.formatToParts(date).find((item) => item.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`.replaceAll(".", "");
}

// Relogio discreto: so atualiza na virada do minuto, nao a cada segundo.
function ClockLine() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(new Date()), 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    return () => window.clearTimeout(timeout);
  }, [now]);

  return (
    <Box className="pomodoroClock">
      <span>{formatDate(now)}</span>
      <time dateTime={now.toISOString()}>{TIME_FORMAT.format(now)}</time>
    </Box>
  );
}

export const PomodoroWidget = memo(function PomodoroWidget() {
  const { currentSession, focusRound, progress, running, secondsLeft, soundOn, toggleRunning, toggleSound, reset, skip } =
    usePomodoro();
  const miniPlayer = useMiniPlayer();

  return (
    <Paper elevation={10} className="pomodoroWidget">
      <Box className="rowBetween">
        <Box className="rowCenter">
          <Box className="tinyIcon">
            <Icon name="timer" fontSize="small" />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {currentSession.label}
            </Typography>
            <Typography variant="body2" fontWeight={900}>
              {currentSession.type === "focus" ? `rodada ${focusRound}/4` : "descanso"}
            </Typography>
          </Box>
        </Box>
        <Box className="rowCenter">
          <Tooltip title={soundOn ? "Desligar aviso sonoro" : "Ligar aviso sonoro"}>
            <IconButton
              className={soundOn ? "pomodoroTool isActive" : "pomodoroTool"}
              onClick={toggleSound}
              aria-label={soundOn ? "Desligar aviso sonoro" : "Ligar aviso sonoro"}
              aria-pressed={soundOn}
            >
              <Icon name={soundOn ? "volume" : "volumeOff"} fontSize="small" />
            </IconButton>
          </Tooltip>
          {miniPlayer.available ? (
            <Tooltip title={miniPlayer.open ? "Fechar miniplayer" : "Abrir miniplayer"}>
              <IconButton
                className={miniPlayer.open ? "pomodoroTool isActive" : "pomodoroTool"}
                onClick={miniPlayer.toggle}
                aria-label={miniPlayer.open ? "Fechar miniplayer" : "Abrir miniplayer"}
                aria-pressed={miniPlayer.open}
              >
                <Icon name="miniplayer" fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      </Box>

      <Typography variant="h1" className="compactTime">
        {formatTime(secondsLeft)}
      </Typography>
      <LinearProgress className="compactProgress" variant="determinate" value={progress} />

      <Box className="rowCenter pomodoroControls">
        <Button
          className="startButton"
          size="small"
          variant="contained"
          startIcon={<Icon name={running ? "pause" : "play"} />}
          onClick={toggleRunning}
        >
          {running ? "Pausar" : "Iniciar"}
        </Button>
        <Tooltip title="Pular">
          <IconButton className="smallGlassButton" onClick={skip} aria-label="Pular">
            <Icon name="skip" fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Resetar">
          <IconButton className="smallGlassButton" onClick={reset} aria-label="Resetar">
            <Icon name="reset" fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <ClockLine />
    </Paper>
  );
});
