import { parentPort, workerData } from "node:worker_threads";
import { createFirekeepServer } from "../server/index.js";

let server;

async function start() {
  try {
    server = await createFirekeepServer(workerData);
    const { port, url } = await server.listen();
    parentPort?.postMessage({ type: "ready", port, url });
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      message: error?.message ?? "Falha ao iniciar servidor local.",
      stack: error?.stack ?? "",
    });
  }
}

parentPort?.on("message", async (message) => {
  if (message?.type !== "close") return;

  try {
    await server?.close();
    parentPort?.postMessage({ type: "closed" });
  } catch (error) {
    parentPort?.postMessage({
      type: "error",
      message: error?.message ?? "Falha ao encerrar servidor local.",
      stack: error?.stack ?? "",
    });
  }
});

start();
