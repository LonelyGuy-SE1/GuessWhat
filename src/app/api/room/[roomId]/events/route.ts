import { NextRequest, NextResponse } from "next/server";
import { getEvents, getRoomState } from "@/lib/room/multiplayer-engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const cursor = parseInt(req.nextUrl.searchParams.get("cursor") ?? "0", 10);

  const state = getRoomState(roomId);
  if (!state) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { events, cursor: newCursor } = getEvents(roomId, cursor);

  return NextResponse.json({
    ...state,
    events,
    cursor: newCursor,
  });
}
