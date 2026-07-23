import { useEffect, useState } from "react";

function readStoredValue(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStoredValue(key, fallback));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // A preferencia continua em memoria se o armazenamento estiver cheio.
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [key, value]);

  return [value, setValue];
}
