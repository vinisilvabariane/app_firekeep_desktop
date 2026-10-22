import { useMemo, useSyncExternalStore } from "react";
import { describe, getState, reset, skip, subscribe, toggleRunning, toggleSound } from "./pomodoroStore";

// O cronometro vive em pomodoroStore (continua contando com o widget oculto);
// este hook so le o estado e entrega as acoes.
export function usePomodoro() {
  const state = useSyncExternalStore(subscribe, getState);
  const derived = useMemo(() => describe(state), [state]);
  return { ...derived, toggleRunning, reset, skip, toggleSound };
}
