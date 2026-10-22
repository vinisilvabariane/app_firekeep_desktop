// Aviso sonoro da troca de tempo, sintetizado com WebAudio (sem arquivo de som).
// Sinos suaves: descem ao entrar no descanso e sobem ao voltar para o foco.

const NOTES = {
  G4: 392.0,
  B4: 493.88,
  C5: 523.25,
  E5: 659.25,
};

const PATTERNS = {
  focus: { notes: [NOTES.G4, NOTES.C5, NOTES.E5], gap: 0.22 },
  short: { notes: [NOTES.E5, NOTES.B4], gap: 0.3 },
  long: { notes: [NOTES.E5, NOTES.C5, NOTES.G4], gap: 0.32 },
};

// Parciais de um sino: fundamental, quase-oitava e um brilho curto.
const PARTIALS = [
  { ratio: 1, gain: 1, decay: 1.9 },
  { ratio: 2.01, gain: 0.32, decay: 1.2 },
  { ratio: 3.97, gain: 0.1, decay: 0.55 },
];

let context;

function getContext() {
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

function ring(audio, frequency, startAt, level) {
  for (const partial of PARTIALS) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * partial.ratio;
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(level * partial.gain, startAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + partial.decay);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + partial.decay + 0.05);
  }
}

// `nextType` e o tipo da sessao que comeca: "focus", "short" ou "long".
export function playChime(nextType) {
  const audio = getContext();
  if (!audio) return;
  const pattern = PATTERNS[nextType] ?? PATTERNS.focus;
  const start = audio.currentTime + 0.04;
  pattern.notes.forEach((frequency, index) => ring(audio, frequency, start + index * pattern.gap, 0.16));
}
