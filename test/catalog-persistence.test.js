import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendVideoLink,
  appendVideoLinkRemoval,
  readVideoLinks,
} from "../server/stores.js";
import { seedInitialData } from "../server/seed.js";

test("catalogo do YouTube preserva link e nome no seed de desenvolvimento", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "firekeep-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const url = "https://www.youtube.com/watch?v=abc123";
  await appendVideoLink(root, { url, label: "Focus mix" }, { mirrorSeed: true });
  await appendVideoLink(root, { url, label: "Focus mix renomeado" }, { mirrorSeed: true });

  assert.deepEqual(await readVideoLinks(root), [{ url, label: "Focus mix renomeado" }]);
  const seedLog = await readFile(path.join(root, "seed", "firekeep-video-links.jsonl"), "utf8");
  assert.match(seedLog, /"label":"Focus mix renomeado"/);
  assert.match(seedLog, /"url":"https:\/\/www\.youtube\.com\/watch\?v=abc123"/);

  await appendVideoLinkRemoval(root, { url }, { mirrorSeed: true });
  assert.deepEqual(await readVideoLinks(root), []);
});

test("primeiro start local copia os seeds para logs mesmo no clone de desenvolvimento", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "firekeep-seed-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, "seed"), { recursive: true });
  await writeFile(
    path.join(root, "seed", "firekeep-video-links.jsonl"),
    '{"action":"upsert","url":"https://youtu.be/abc123","label":"Seed track"}\n',
    "utf8",
  );

  await seedInitialData({ root, storageRoot: root });

  assert.deepEqual(await readVideoLinks(root), [
    { url: "https://youtu.be/abc123", label: "Seed track" },
  ]);
});
