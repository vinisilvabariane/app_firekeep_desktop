import { useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "../../shared/storage";
import { SESSION_PLAN } from "./sessionPlan";

// Todo o estado do cronometro vive aqui, dentro do widget — o tick de 1s
// nao pode re-renderizar a arvore inteira do app.
export function usePomodoro() {
  const [sessionIndex, setSessionIndex] = useStoredState("firekeep:sessionIndex", 0);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_PLAN[sessionIndex]?.seconds ?? SESSION_PLAN[0].seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef();
  const sessionIndexRef = useRef(sessionIndex);

  const currentSession = SESSION_PLAN[sessionIndex] ?? SESSION_PLAN[0];
  const progress = ((currentSession.seconds - secondsLeft) / currentSession.seconds) * 100;
  const focusRound = useMemo(() => {
    const previousFocuses = SESSION_PLAN.slice(0, sessionIndex).filter(
      (session) => session.type === "focus",
    ).length;
    return Math.min(4, previousFocuses + (currentSession.type === "focus" ? 1 : 0));
  }, [currentSession.type, sessionIndex]);

  useEffect(() => {
    sessionIndexRef.current = sessionIndex;
    setSecondsLeft((current) => {
      const expectedTotal = SESSION_PLAN[sessionIndex]?.seconds ?? SESSION_PLAN[0].seconds;
      return current > expectedTotal ? expectedTotal : current;
    });
  }, [sessionIndex]);

  useEffect(() => {
    if (!running) {
      window.clearInterval(intervalRef.current);
      return undefined;
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;

        const nextIndex = (sessionIndexRef.current + 1) % SESSION_PLAN.length;
        sessionIndexRef.current = nextIndex;
        setSessionIndex(nextIndex);
        return SESSION_PLAN[nextIndex].seconds;
      });
    }, 1000);

    return () => window.clearInterval(intervalRef.current);
  }, [running, setSessionIndex]);

  function toggleRunning() {
    setRunning((current) => !current);
  }

  function reset() {
    setRunning(false);
    sessionIndexRef.current = 0;
    setSessionIndex(0);
    setSecondsLeft(SESSION_PLAN[0].seconds);
  }

  function skip() {
    const nextIndex = (sessionIndexRef.current + 1) % SESSION_PLAN.length;
    sessionIndexRef.current = nextIndex;
    setSessionIndex(nextIndex);
    setSecondsLeft(SESSION_PLAN[nextIndex].seconds);
  }

  return { currentSession, focusRound, progress, running, secondsLeft, toggleRunning, reset, skip };
}
