import { spawn } from "node:child_process";

const DEFAULT_PORT = 4096;

export function createOpenCodeService({ root, port = Number(process.env.OPENCODE_PORT ?? DEFAULT_PORT) } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  let processRef = null;
  let startedByFirekeep = false;

  async function request(path, options) {
    const response = await fetch(`${origin}${path}`, options);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const error = new Error(body?.message ?? body?.error ?? `OpenCode respondeu ${response.status}.`);
      error.statusCode = response.status;
      throw error;
    }
    return body;
  }

  async function health() {
    try {
      const data = await request("/global/health", { signal: AbortSignal.timeout(900) });
      return { connected: Boolean(data?.healthy), version: data?.version ?? "" };
    } catch {
      return { connected: false, version: "" };
    }
  }

  async function start() {
    const existing = await health();
    if (existing.connected) return { ...existing, started: false };

    const command = process.platform === "win32" ? "opencode.cmd" : "opencode";
    try {
      processRef = spawn(command, ["serve", "--hostname", "127.0.0.1", "--port", String(port)], {
        cwd: root,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (error) {
      throw new Error(`Nao foi possivel iniciar o OpenCode. Instale o CLI e configure um provedor. (${error.message})`);
    }

    processRef.once("error", () => {
      processRef = null;
      startedByFirekeep = false;
    });
    processRef.once("exit", () => {
      processRef = null;
      startedByFirekeep = false;
    });
    startedByFirekeep = true;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const status = await health();
      if (status.connected) return { ...status, started: true };
    }

    throw new Error("O OpenCode nao respondeu. Verifique se o CLI esta instalado e se um provedor foi configurado.");
  }

  return {
    async status() {
      const current = await health();
      return { ...current, startedByFirekeep };
    },
    start,
    async createSession() {
      return request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Firekeep AI" }),
      });
    },
    async messages(sessionId) {
      return request(`/session/${encodeURIComponent(sessionId)}/message`);
    },
    async sendMessage(sessionId, message) {
      return request(`/session/${encodeURIComponent(sessionId)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O agente plan pesquisa e explica, sem aplicar mudancas no workspace.
        body: JSON.stringify({
          agent: "plan",
          parts: [{ type: "text", text: message }],
        }),
      });
    },
    async abort(sessionId) {
      return request(`/session/${encodeURIComponent(sessionId)}/abort`, { method: "POST" });
    },
    async close() {
      if (!processRef || !startedByFirekeep) return;
      processRef.kill();
      processRef = null;
      startedByFirekeep = false;
    },
  };
}
