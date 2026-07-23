import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const defaultRoot = path.resolve(__dirname, "..");

export const defaultProjectsRoot = process.env.FIREKEEP_PROJECTS_ROOT
  ? path.resolve(process.env.FIREKEEP_PROJECTS_ROOT)
  : path.dirname(defaultRoot);

export const defaultExplorerRoot = process.env.FIREKEEP_EXPLORER_ROOT
  ? path.resolve(process.env.FIREKEEP_EXPLORER_ROOT)
  : path.parse(defaultRoot).root || defaultProjectsRoot;

export const userBackgroundsDir = path.join("public", "user-backgrounds");
export const userAudioDir = path.join("public", "user-audio");
export const audioTracksLog = path.join("logs", "firekeep-audio-tracks.jsonl");
export const videoLinksLog = path.join("logs", "firekeep-video-links.jsonl");
export const backgroundsLog = path.join("logs", "firekeep-backgrounds.jsonl");
export const preferencesFile = path.join("logs", "firekeep-preferences.json");
export const browserStateFile = path.join("logs", "firekeep-browser-state.json");
