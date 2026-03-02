import { TokenPayload, verifyToken } from '@/lib/auth-utils';
import { getDb } from '@/lib/mongodb-client';
import { Document, ObjectId, UpdateFilter } from 'mongodb';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });

    const db = await getDb('tradelog_main');
    const user = await db.collection('users').findOne({ email: decoded.email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Mark all unread messages in this conversation as read explicitly avoiding those already read by user
    await db.collection('messages').updateMany(
      {
        conversationId: new ObjectId(conversationId),
        senderId: { $ne: user._id },
        'readBy.userId': { $ne: user._id }
      },
      {
        $push: {
          readBy: {
            userId: user._id,
            readAt: new Date()
          }
        }
      } as unknown as UpdateFilter<Document>
    );

    return NextResponse.json({ message: 'Marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
