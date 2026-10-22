import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRoot } from "./config.js";
import { registerApiRoutes } from "./routes.js";
import { seedInitialData } from "./seed.js";
import { createTerminalGateway } from "./terminal-gateway.js";

export async function createFirekeepServer({
  root = defaultRoot,
  storageRoot = root,
  production = process.env.NODE_ENV === "production" || process.argv.includes("--production"),
  port = Number(process.env.PORT ?? 5173),
} = {}) {
  const app = express();
  const httpServer = createServer(app);
  let viteServer;
  const terminalGateway = createTerminalGateway({ httpServer, root });

  await seedInitialData({ root, storageRoot });

  // Bodies JSON sao pequenos (links, preferencias, arquivos de ate 2MB no
  // editor); uploads de imagem passam por express.raw na propria rota.
  app.use(express.json({ limit: "8mb" }));

  registerApiRoutes(app, { root, storageRoot });

  if (production) {
    app.use(express.static(path.join(root, "dist")));
    app.use(express.static(path.join(storageRoot, "public")));
    app.use(express.static(path.join(root, "public")));
    app.get(/.*/, (_request, response) => {
      response.sendFile(path.join(root, "dist", "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    viteServer = await createViteServer({
      root,
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  }

  return {
    app,
    httpServer,
    listen() {
      return new Promise((resolve) => {
        httpServer.listen(port, "127.0.0.1", () => {
          const address = httpServer.address();
          const actualPort = typeof address === "object" && address ? address.port : port;
          resolve({
            port: actualPort,
            url: `http://127.0.0.1:${actualPort}`,
          });
        });
      });
    },
    async close() {
      await new Promise((resolve, reject) => {
        if (!httpServer.listening) {
          resolve();
          return;
        }

        httpServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await viteServer?.close();
      terminalGateway.close();
    },
  };
}

// Last-resort guard: a stray terminal/socket error should never close the app.
if (!globalThis.__firekeepGuarded) {
  globalThis.__firekeepGuarded = true;
  process.on("uncaughtException", (error) => {
    console.error("[firekeep] erro nao tratado:", error);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[firekeep] promessa rejeitada:", reason);
  });
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  const server = await createFirekeepServer();
  const { url } = await server.listen();
  console.log(`Firekeep em ${url}`);
}
