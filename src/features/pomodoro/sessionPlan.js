export const SESSION_PLAN = [
  { type: "focus", label: "Foco 1", minutes: 25 },
  { type: "short", label: "Descanso", minutes: 5 },
  { type: "focus", label: "Foco 2", minutes: 25 },
  { type: "short", label: "Descanso", minutes: 5 },
  { type: "focus", label: "Foco 3", minutes: 25 },
  { type: "short", label: "Descanso", minutes: 5 },
  { type: "focus", label: "Foco 4", minutes: 25 },
  { type: "long", label: "Pausa longa", minutes: 15 },
].map((session) => ({ ...session, seconds: session.minutes * 60 }));

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
