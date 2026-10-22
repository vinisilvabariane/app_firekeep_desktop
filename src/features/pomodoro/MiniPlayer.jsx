import { useEffect, useState } from "react";
import { Icon } from "../../shared/Icon";
import { formatTime } from "./sessionPlan";
import "./MiniPlayer.css";

const ROUNDS = [1, 2, 3, 4];

const PHASE_LABEL = { focus: "Foco", short: "Descanso", long: "Pausa longa" };

// Bolinha da rodada: cheia se ja passou, acesa se e a rodada em andamento.
function roundState(round, snapshot) {
  if (!snapshot) return "";
  if (round < snapshot.focusRound) return "isDone";
  if (round > snapshot.focusRound) return "";
  return snapshot.type === "focus" ? "isNow" : "isDone";
}

function send(command) {
  globalThis.window?.firekeepWindow?.sendPomodoroCommand?.(command);
}

// Janela flutuante do pomodoro. Nao calcula nada: exibe o estado publicado
// pela janela principal e devolve comandos (iniciar, pular, reiniciar, som).
export default function MiniPlayer() {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    const api = globalThis.window?.firekeepWindow;
    if (!api) return undefined;
    document.title = "Firekeep Pomodoro";
    api.getPomodoroState?.().then((state) => state && setSnapshot(state)).catch(() => {});
    return api.onPomodoroState?.(setSnapshot);
  }, []);

  const type = snapshot?.type ?? "focus";
  const running = Boolean(snapshot?.running);
  const progress = snapshot ? 1 - snapshot.secondsLeft / snapshot.totalSeconds : 0;
  const closeWindow = () => globalThis.window?.firekeepWindow?.close?.();

  return (
    <main className={`mini phase-${type}${running ? " isRunning" : ""}${snapshot ? "" : " isEmpty"}`}>
      <div className="miniGlow" aria-hidden="true" />
      <div className="miniSurface">
        <header className="miniTop">
          <div className="miniPhase">
            <span key={snapshot?.label} className="miniLabel">
              {snapshot ? PHASE_LABEL[type] : "Pomodoro"}
            </span>
            <span className="miniRounds" role="img" aria-label={`Rodada ${snapshot?.focusRound ?? 1} de 4`}>
              {ROUNDS.map((round) => (
                <i key={round} className={roundState(round, snapshot)} />
              ))}
            </span>
          </div>
          <div className="miniTools">
            <button
              type="button"
              title={snapshot?.soundOn ? "Desligar aviso sonoro" : "Ligar aviso sonoro"}
              aria-label={snapshot?.soundOn ? "Desligar aviso sonoro" : "Ligar aviso sonoro"}
              aria-pressed={Boolean(snapshot?.soundOn)}
              onClick={() => send("sound")}
            >
              <Icon name={snapshot?.soundOn === false ? "volumeOff" : "volume"} />
            </button>
            <button
              type="button"
              title="Abrir Firekeep"
              aria-label="Abrir Firekeep"
              onClick={() => globalThis.window?.firekeepWindow?.focusMainWindow?.()}
            >
              <Icon name="maximize" />
            </button>
            <button type="button" title="Fechar miniplayer" aria-label="Fechar miniplayer" onClick={closeWindow}>
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="miniBody">
          <time className="miniTime" aria-live="off">
            {snapshot ? formatTime(snapshot.secondsLeft) : "--:--"}
          </time>
          <div className="miniControls">
            <button type="button" className="miniGhost" title="Reiniciar" aria-label="Reiniciar" onClick={() => send("reset")}>
              <Icon name="reset" />
            </button>
            <button
              type="button"
              className="miniPlay"
              title={running ? "Pausar" : "Iniciar"}
              aria-label={running ? "Pausar" : "Iniciar"}
              onClick={() => send("toggle")}
            >
              <Icon name={running ? "pause" : "play"} />
            </button>
            <button type="button" className="miniGhost" title="Pular" aria-label="Pular" onClick={() => send("skip")}>
              <Icon name="skip" />
            </button>
          </div>
        </div>

        <div className="miniFuse" aria-hidden="true">
          <div className="miniFuseBar" style={{ transform: `scaleX(${progress})` }} />
          <div className="miniFuseSpark" style={{ left: `${progress * 100}%` }} />
        </div>
      </div>
    </main>
  );
}
