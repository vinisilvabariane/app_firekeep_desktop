import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { defaultExplorerRoot, defaultProjectsRoot } from "./config.js";
import { httpError, uniquePaths } from "./utils.js";

const MAX_EDIT_BYTES = 2 * 1024 * 1024;
const MAX_COMPLETIONS = 18;

export async function listDirectory(requested) {
  const target = requested ? path.resolve(String(requested)) : defaultExplorerRoot;
  const stats = await stat(target).catch(() => null);
  if (!stats?.isDirectory()) {
    throw httpError(400, "Pasta invalida ou inexistente.");
  }

  const dirents = await readdir(target, { withFileTypes: true });
  const entries = dirents
    .map((dirent) => ({
      name: dirent.name,
      path: path.join(target, dirent.name),
      type: dirent.isDirectory() ? "dir" : "file",
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const parent = path.dirname(target);
  return { path: target, parent: parent === target ? null : parent, entries };
}

export async function readFileContent(requested) {
  const target = path.resolve(String(requested || ""));
  const stats = await stat(target).catch(() => null);
  if (!stats?.isFile()) {
    throw httpError(400, "Arquivo invalido ou inexistente.");
  }
  if (stats.size > MAX_EDIT_BYTES) {
    throw httpError(413, "Arquivo grande demais para editar aqui.");
  }

  const content = await readFile(target, "utf8");
  return { path: target, name: path.basename(target), content };
}

export async function writeFileContent(body) {
  const target = body?.path ? path.resolve(String(body.path)) : "";
  if (!target) {
    throw httpError(400, "Caminho vazio.");
  }
  const content = typeof body?.content === "string" ? body.content : "";
  await writeFile(target, content, "utf8");
  return { path: target, name: path.basename(target), savedAt: new Date().toISOString() };
}

export async function createFsEntry(body) {
  const basePath = body?.basePath ? path.resolve(String(body.basePath)) : defaultExplorerRoot;
  const name = String(body?.name ?? "").trim();
  const type = body?.type === "dir" ? "dir" : "file";

  if (!name) {
    throw httpError(400, "Nome vazio.");
  }
  if (name.includes("/") || name.includes("\\") || path.basename(name) !== name) {
    throw httpError(400, "Use apenas o nome, sem caminho.");
  }

  const baseStats = await stat(basePath).catch(() => null);
  if (!baseStats?.isDirectory()) {
    throw httpError(400, "Pasta de destino invalida.");
  }

  const target = path.join(basePath, name);
  try {
    if (type === "dir") {
      await mkdir(target);
    } else {
      await writeFile(target, "", { encoding: "utf8", flag: "wx" });
    }
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw httpError(409, "Ja existe um arquivo ou pasta com esse nome.");
    }
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw httpError(403, "Sem permissao para criar nesse destino.");
    }
    throw error;
  }

  return { name, path: target, type };
}

export async function deleteFsEntry(body) {
  const target = body?.path ? path.resolve(String(body.path)) : "";
  if (!target || path.dirname(target) === target) {
    throw httpError(400, "Item invalido para apagar.");
  }

  const targetStats = await stat(target).catch(() => null);
  if (!targetStats) {
    throw httpError(404, "Arquivo ou pasta inexistente.");
  }

  try {
    await rm(target, { recursive: targetStats.isDirectory(), force: false });
  } catch (error) {
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw httpError(403, "Sem permissao para apagar esse item.");
    }
    throw error;
  }

  return {
    name: path.basename(target),
    path: target,
    parent: path.dirname(target),
    type: targetStats.isDirectory() ? "dir" : "file",
  };
}

export async function moveFsEntry(body) {
  const source = body?.sourcePath ? path.resolve(String(body.sourcePath)) : "";
  const destinationDir = body?.destinationDir ? path.resolve(String(body.destinationDir)) : "";
  if (!source || !destinationDir || path.dirname(source) === source) {
    throw httpError(400, "Origem ou destino invalido.");
  }

  const sourceStats = await stat(source).catch(() => null);
  if (!sourceStats) {
    throw httpError(404, "Arquivo ou pasta de origem inexistente.");
  }

  const destinationStats = await stat(destinationDir).catch(() => null);
  if (!destinationStats?.isDirectory()) {
    throw httpError(400, "Destino precisa ser uma pasta.");
  }

  const target = path.join(destinationDir, path.basename(source));
  if (samePath(source, target)) {
    return {
      name: path.basename(source),
      path: source,
      parent: path.dirname(source),
      type: sourceStats.isDirectory() ? "dir" : "file",
    };
  }

  if (sourceStats.isDirectory()) {
    const relativeDestination = path.relative(source, destinationDir);
    if (relativeDestination === "" || (!relativeDestination.startsWith("..") && !path.isAbsolute(relativeDestination))) {
      throw httpError(400, "Nao da para mover uma pasta para dentro dela mesma.");
    }
  }

  const targetStats = await stat(target).catch(() => null);
  if (targetStats) {
    throw httpError(409, "Ja existe um item com esse nome no destino.");
  }

  try {
    await rename(source, target);
  } catch (error) {
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      throw httpError(403, "Sem permissao para mover esse item.");
    }
    if (error?.code === "EXDEV") {
      throw httpError(400, "Nao consigo mover entre discos diferentes.");
    }
    throw error;
  }

  return {
    name: path.basename(target),
    path: target,
    oldPath: source,
    oldParent: path.dirname(source),
    parent: destinationDir,
    type: sourceStats.isDirectory() ? "dir" : "file",
  };
}

export async function completeFsPath({ cwd, fragment }) {
  const currentDir = cwd ? path.resolve(String(cwd)) : defaultProjectsRoot;
  const rawFragment = String(fragment ?? "");
  const normalizedFragment = stripMatchingQuote(rawFragment);
  const parsed = splitCompletionFragment(normalizedFragment);
  const searchDir = path.resolve(currentDir, parsed.dirPart || ".");
  const searchStats = await stat(searchDir).catch(() => null);

  if (!searchStats?.isDirectory()) {
    return { cwd: currentDir, fragment: rawFragment, replacement: rawFragment, suggestions: [] };
  }

  const entries = await readdir(searchDir, { withFileTypes: true });
  const suggestions = entries
    .filter((entry) => entry.name.toLowerCase().startsWith(parsed.basenamePart.toLowerCase()))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_COMPLETIONS)
    .map((entry) => {
      const suffix = entry.isDirectory() ? path.sep : "";
      const value = `${parsed.dirPart}${entry.name}${suffix}`;
      return {
        name: entry.name,
        path: path.join(searchDir, entry.name),
        type: entry.isDirectory() ? "dir" : "file",
        replacement: preserveCompletionQuote(rawFragment, value),
      };
    });

  const replacement = suggestions.length === 1 ? suggestions[0].replacement : longestSharedReplacement(rawFragment, suggestions);
  return { cwd: currentDir, fragment: rawFragment, replacement, suggestions };
}

export async function listProjects(root) {
  const roots = uniquePaths([defaultProjectsRoot, root]);
  const projects = [];

  for (const projectsRoot of roots) {
    let entries = [];
    try {
      entries = await readdir(projectsRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      projects.push({
        name: entry.name,
        path: path.join(projectsRoot, entry.name),
      });
    }
  }

  return projects
    .filter((project, index, all) => all.findIndex((item) => item.path === project.path) === index)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function assertDirectory(value) {
  const result = await stat(value).catch(() => null);
  if (!result?.isDirectory()) {
    throw httpError(400, "Projeto invalido ou pasta inexistente.");
  }
  await access(value, constants.R_OK);
}

function splitCompletionFragment(fragment) {
  const lastSlash = Math.max(fragment.lastIndexOf("/"), fragment.lastIndexOf("\\"));
  if (lastSlash < 0) {
    return { dirPart: "", basenamePart: fragment };
  }
  return {
    dirPart: fragment.slice(0, lastSlash + 1),
    basenamePart: fragment.slice(lastSlash + 1),
  };
}

function stripMatchingQuote(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  if (first === '"' || first === "'") {
    return value.slice(1);
  }
  return value;
}

function preserveCompletionQuote(original, value) {
  const quote = original[0] === "'" || original[0] === '"' ? original[0] : "";
  return quote ? `${quote}${value}` : value;
}

function longestSharedReplacement(original, suggestions) {
  if (suggestions.length < 2) return original;
  const values = suggestions.map((suggestion) => suggestion.replacement);
  let shared = values[0];
  for (const value of values.slice(1)) {
    let index = 0;
    while (index < shared.length && index < value.length && shared[index].toLowerCase() === value[index].toLowerCase()) {
      index += 1;
    }
    shared = shared.slice(0, index);
  }
  return shared.length > original.length ? shared : original;
}

function samePath(left, right) {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}
