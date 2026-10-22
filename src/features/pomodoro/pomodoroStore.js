import { playChime } from "./chime";
import { SESSION_PLAN } from "./sessionPlan";

// Fonte unica do cronometro. Vive fora do React para continuar contando mesmo
// com o widget oculto, e usa o relogio de parede (endsAt) em vez de contar
// ticks: se o Chromium atrasar o timer com a janela em segundo plano, o tempo
// restante continua certo.

const INDEX_KEY = "firekeep:sessionIndex";
const SOUND_KEY = "firekeep:pomodoroSound";
const TICK_MS = 250;

function readStored(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O valor continua em memoria se o armazenamento estiver indisponivel.
  }
}

function sessionAt(index) {
  return SESSION_PLAN[index] ?? SESSION_PLAN[0];
}

const storedIndex = readStored(INDEX_KEY, 0);
const initialIndex =
  Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < SESSION_PLAN.length ? storedIndex : 0;

let state = {
  sessionIndex: initialIndex,
  secondsLeft: sessionAt(initialIndex).seconds,
  running: false,
  soundOn: readStored(SOUND_KEY, true) !== false,
};
let endsAt = 0;
let timer = null;
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function describe(snapshot) {
  const session = sessionAt(snapshot.sessionIndex);
  const previousFocuses = SESSION_PLAN.slice(0, snapshot.sessionIndex).filter((item) => item.type === "focus").length;
  return {
    ...snapshot,
    currentSession: session,
    focusRound: Math.min(4, previousFocuses + (session.type === "focus" ? 1 : 0)),
    progress: ((session.seconds - snapshot.secondsLeft) / session.seconds) * 100,
  };
}

function startTimer() {
  if (timer !== null) return;
  timer = window.setInterval(tick, TICK_MS);
}

function stopTimer() {
  window.clearInterval(timer);
  timer = null;
}

function goTo(index) {
  const session = sessionAt(index);
  writeStored(INDEX_KEY, index);
  if (state.running) endsAt = Date.now() + session.seconds * 1000;
  setState({ sessionIndex: index, secondsLeft: session.seconds });
}

function tick() {
  if (!state.running) return;
  const remaining = Math.ceil((endsAt - Date.now()) / 1000);
  if (remaining > 0) {
    if (remaining !== state.secondsLeft) setState({ secondsLeft: remaining });
    return;
  }

  const nextIndex = (state.sessionIndex + 1) % SESSION_PLAN.length;
  goTo(nextIndex);
  if (state.soundOn) playChime(sessionAt(nextIndex).type);
}

export function toggleRunning() {
  if (state.running) {
    stopTimer();
    setState({ running: false });
    return;
  }
  endsAt = Date.now() + state.secondsLeft * 1000;
  setState({ running: true });
  startTimer();
}

export function skip() {
  goTo((state.sessionIndex + 1) % SESSION_PLAN.length);
}

export function reset() {
  stopTimer();
  writeStored(INDEX_KEY, 0);
  setState({ running: false, sessionIndex: 0, secondsLeft: SESSION_PLAN[0].seconds });
}

export function toggleSound() {
  const soundOn = !state.soundOn;
  writeStored(SOUND_KEY, soundOn);
  setState({ soundOn });
  // Ao ligar, toca uma amostra para o usuario ouvir como e o aviso.
  if (soundOn) playChime("focus");
}
