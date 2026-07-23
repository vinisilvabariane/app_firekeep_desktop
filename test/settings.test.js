import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettings } from "../src/features/video/defaultVideos.js";

test("brilho zero e preservado para permitir o fundo mais escuro", () => {
  assert.equal(normalizeSettings({ visualBrightness: 0 }).visualBrightness, 0);
  assert.equal(normalizeSettings({ visualBrightness: -20 }).visualBrightness, 0);
  assert.equal(normalizeSettings({ visualBrightness: 120 }).visualBrightness, 100);
});
