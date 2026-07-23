export function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function toMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function uniquePaths(values) {
  return values.filter((value, index, all) => value && all.indexOf(value) === index);
}
