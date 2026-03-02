import { NextResponse } from 'next/server';

export async function GET() {
  const g = global as unknown as { io?: { engine: { clientsCount: number }, sockets: { adapter: { rooms: Map<string, unknown> } } } };
  const ioExists = !!g.io;
  const numClients = ioExists ? g.io!.engine.clientsCount : 0;

  const connectedRooms = ioExists ? Array.from(g.io!.sockets.adapter.rooms.keys()) : [];

  return NextResponse.json({ ioExists, numClients, connectedRooms });
}
