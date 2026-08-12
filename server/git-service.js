import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

function runGit(root, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => reject(new Error("Git nao esta disponivel neste computador.")));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || stdout.trim() || "O comando Git falhou."));
    });
  });
}

function parseStatus(output) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const branchLine = lines.shift() ?? "";
  const branch = branchLine.replace(/^##\s*/, "").split("...")[0] || "(detached)";
  const upstream = branchLine.includes("...") ? branchLine.split("...")[1].split(" ")[0] : "";
  const changes = lines.map((line) => ({
    index: line[0],
    worktree: line[1],
    path: line.slice(3).split(" -> ").at(-1),
  }));
  return {
    branch,
    upstream,
    ahead: /ahead (\d+)/.test(branchLine) ? Number(branchLine.match(/ahead (\d+)/)?.[1]) : 0,
    behind: /behind (\d+)/.test(branchLine) ? Number(branchLine.match(/behind (\d+)/)?.[1]) : 0,
    changes,
  };
}

function parseRecords(output) {
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.split("\x1f"));
}

export function createGitService() {
  async function isAvailable() {
    try {
      await runGit(process.cwd(), ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  async function resolveRepository(projectPath) {
    const input = String(projectPath ?? "").trim();
    if (!input) throw new Error("Informe a pasta de um projeto Git.");
    const directory = path.resolve(input);
    const metadata = await stat(directory).catch(() => null);
    if (!metadata?.isDirectory()) throw new Error("A pasta informada não existe ou não é uma pasta válida.");
    return (await runGit(directory, ["rev-parse", "--show-toplevel"])).trim();
  }

  return {
    async availability() {
      return { available: await isAvailable() };
    },
    async status(projectPath) {
      const repository = await resolveRepository(projectPath);
      const [status, lastCommit] = await Promise.all([
        runGit(repository, ["status", "--porcelain=v1", "--branch"]),
        runGit(repository, ["log", "-1", "--pretty=format:%h%x1f%s%x1f%cr"]).catch(() => ""),
      ]);
      const [hash = "", subject = "", when = ""] = lastCommit.split("\x1f");
      return { ...parseStatus(status), root: repository, lastCommit: { hash, subject, when } };
    },
    async diff(projectPath, filePath, staged = false) {
      const repository = await resolveRepository(projectPath);
      const path = String(filePath ?? "").trim();
      if (!path) throw new Error("Selecione um arquivo para ver o diff.");
      return { path, content: await runGit(repository, ["diff", ...(staged ? ["--cached"] : []), "--", path]) };
    },
    async stage(projectPath, filePath) {
      const repository = await resolveRepository(projectPath);
      await runGit(repository, ["add", "--", String(filePath)]);
      return this.status(repository);
    },
    async unstage(projectPath, filePath) {
      const repository = await resolveRepository(projectPath);
      await runGit(repository, ["restore", "--staged", "--", String(filePath)]);
      return this.status(repository);
    },
    async discardWorkingChanges(projectPath) {
      const repository = await resolveRepository(projectPath);
      await runGit(repository, ["restore", "--worktree", "--", "."]);
      return this.status(repository);
    },
    async resolveConflict(projectPath, filePath, strategy) {
      const repository = await resolveRepository(projectPath);
      const path = String(filePath ?? "").trim();
      if (!path) throw new Error("Selecione o arquivo em conflito.");
      if (strategy !== "ours" && strategy !== "theirs") throw new Error("Escolha uma versão para resolver o conflito.");
      await runGit(repository, ["checkout", `--${strategy}`, "--", path]);
      await runGit(repository, ["add", "--", path]);
      return this.status(repository);
    },
    async commit(projectPath, message) {
      const repository = await resolveRepository(projectPath);
      const text = String(message ?? "").trim();
      if (!text) throw new Error("Escreva uma mensagem de commit.");
      await runGit(repository, ["commit", "-m", text]);
      return this.status(repository);
    },
    async pull(projectPath) {
      const repository = await resolveRepository(projectPath);
      await runGit(repository, ["pull", "--ff-only"]);
      return this.status(repository);
    },
    async push(projectPath) {
      const repository = await resolveRepository(projectPath);
      await runGit(repository, ["push"]);
      return this.status(repository);
    },
    async overview(projectPath) {
      const repository = await resolveRepository(projectPath);
      const [branchOutput, logOutput] = await Promise.all([
        runGit(repository, ["branch", "--format=%(HEAD)%x1f%(refname:short)"]),
        runGit(repository, ["log", "-20", "--pretty=format:%h%x1f%s%x1f%cr%x1f%an"]),
      ]);
      return {
        root: repository,
        branches: parseRecords(branchOutput).map(([head, name]) => ({ name, current: head === "*" })),
        history: parseRecords(logOutput).map(([hash, subject, when, author]) => ({ hash, subject, when, author })),
      };
    },
    async checkout(projectPath, branch, create = false) {
      const repository = await resolveRepository(projectPath);
      const name = String(branch ?? "").trim();
      if (!name) throw new Error("Informe o nome da branch.");
      await runGit(repository, create ? ["switch", "-c", name] : ["switch", name]);
      return { ...(await this.status(repository)), ...(await this.overview(repository)) };
    },
  };
}
