import { memo } from "react";
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

export const PomodoroWidget = memo(function PomodoroWidget() {
  const { currentSession, focusRound, progress, running, secondsLeft, toggleRunning, reset, skip } = usePomodoro();

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
    </Paper>
  );
});
