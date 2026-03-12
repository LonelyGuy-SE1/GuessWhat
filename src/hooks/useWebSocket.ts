"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { WSClientMessage, WSServerMessage } from "@/lib/types";

type MessageHandler = (msg: WSServerMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(onMessage);
  handlersRef.current = onMessage;
  const urlsRef = useRef<string[] | null>(null);
  const urlIndexRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (!urlsRef.current) {
      const envUrl = process.env.NEXT_PUBLIC_WS_URL;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const urls = envUrl ? [envUrl] : [`${protocol}//${host}/ws`];
      const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
      if (!envUrl && isLocal && !host.endsWith(":3001")) {
        const base = host.replace(/:\d+$/, "");
        urls.push(`${protocol}//${base}:3001/ws`);
      }
      urlsRef.current = urls;
    }

    const urls = urlsRef.current;
    const url = urls[urlIndexRef.current % urls.length];
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      urlIndexRef.current = 0;
    };
    ws.onclose = () => {
      setConnected(false);
      if (urls.length > 1) {
        urlIndexRef.current = (urlIndexRef.current + 1) % urls.length;
      }
      // Auto-reconnect after 1.5 seconds
      setTimeout(() => connect(), 1500);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (event) => {
      try {
        const msg: WSServerMessage = JSON.parse(event.data);
        handlersRef.current(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    wsRef.current = ws;
  }, []);

  const sendMessage = useCallback((msg: WSClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, sendMessage, connected };
}
