import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { handleMessage, handleDisconnect } from "./ws-handler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url || "/", true);
    handle(req, res, parsedUrl);
  });

  // ─── WebSocket Server ───
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    ws.on("message", (data: Buffer | string) => {
      const raw = typeof data === "string" ? data : data.toString("utf-8");
      handleMessage(ws, raw);
    });

    ws.on("close", () => {
      handleDisconnect(ws);
    });

    ws.on("error", () => {
      handleDisconnect(ws);
    });
  });

  // Heartbeat to detect stale connections
  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  server.listen(port, () => {
    console.log(`> Guess What? server running on http://${hostname}:${port}`);
    console.log(`> WebSocket available at ws://${hostname}:${port}/ws`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});
