import { NextRequest } from "next/server";
import { addRoomSubscriber, broadcastToRoom } from "@/lib/room/sse-hub";
import { getSerializedRoom } from "@/lib/room/manager";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const cleanup = addRoomSubscriber(roomId, controller);

      const room = getSerializedRoom(roomId);
      if (room) {
        send({ type: "room_state", room });
      }

      // Heartbeat to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "pong" })}\n\n`));
        } catch {
          // ignore
        }
      }, 15000);

      controller.close = ((orig) => () => {
        clearInterval(heartbeat);
        cleanup();
        orig.call(controller);
      })(controller.close.bind(controller));
    },
    cancel() {
      // no-op, cleanup handled in close wrapper
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
