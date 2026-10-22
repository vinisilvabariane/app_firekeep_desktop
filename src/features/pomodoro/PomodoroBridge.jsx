import { useEffect, useSyncExternalStore } from "react";
import { describe, getState, reset, skip, subscribe, toggleRunning, toggleSound } from "./pomodoroStore";

const COMMANDS = { toggle: toggleRunning, skip, reset, sound: toggleSound };

// Componente sem UI: publica o estado do pomodoro para o miniplayer (outra
// janela do Electron) e executa os comandos que ele envia de volta.
export function PomodoroBridge() {
  const state = useSyncExternalStore(subscribe, getState);

  useEffect(() => {
    const api = globalThis.window?.firekeepWindow;
    if (!api?.publishPomodoro) return;
    const { currentSession, focusRound, secondsLeft, running, soundOn } = describe(state);
    api.publishPomodoro({
      type: currentSession.type,
      label: currentSession.label,
      focusRound,
      secondsLeft,
      totalSeconds: currentSession.seconds,
      running,
      soundOn,
    });
  }, [state]);

  useEffect(() => {
    const api = globalThis.window?.firekeepWindow;
    if (!api?.onPomodoroCommand) return undefined;
    return api.onPomodoroCommand((command) => COMMANDS[command]?.());
  }, []);

  return null;
}
