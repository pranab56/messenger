import { TokenPayload, verifyToken } from '@/lib/auth-utils';
import { getDb } from '@/lib/mongodb-client';
import { Document, ObjectId, UpdateFilter } from 'mongodb';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const db = await getDb('tradelog_main');
    const user = await db.collection('users').findOne({ email: decoded.email });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    console.log('Fetching conversations for user ID:', user._id);

    const conversations = await db.collection('conversations').aggregate([
      {
        $match: {
          participants: { $in: [user._id, user._id.toString()] },
          deletedBy: { $nin: [user._id, user._id.toString()] }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participantDetails'
        }
      },
      {
        $lookup: {
          from: 'messages',
          localField: 'lastMessageId',
          foreignField: '_id',
          as: 'lastMessage'
        }
      },
      { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'messages',
          let: { convId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$conversationId', '$$convId'] },
                senderId: { $ne: user._id },
                'readBy.userId': { $ne: user._id }
              }
            },
            { $count: 'unread' }
          ],
          as: 'unreadData'
        }
      },
      { $sort: { updatedAt: -1 } }
    ]).toArray();

    console.log(`Found ${conversations.length} conversations for user ${user.email}`);
    if (conversations.length > 0) {
      console.log('Sample conversation participants:', conversations[0].participants);
    }

    // Map participantDetails and add user-specific flags
    const formattedConversations = conversations.map(c => ({
      ...c,
      _id: c._id.toString(), // Always a plain string so socket room IDs match
      isPinned: c.pinnedBy?.some((id: ObjectId) => id.toString() === user._id.toString()) || false,
      isMuted: c.mutedBy?.some((id: ObjectId) => id.toString() === user._id.toString()) || false,
      isBlocked: c.blockedBy?.length > 0 ? true : false,
      isBlockedByMe: c.blockedBy?.some((id: ObjectId) => id.toString() === user._id.toString()) || false,
      unreadCount: c.unreadData?.[0]?.unread || 0,
      participants: c.participantDetails.map((p: { _id: ObjectId, name: string, email: string, profileImage?: string, onlineStatus?: string }) => ({
        _id: p._id.toString(),
        name: p.name,
        email: p.email,
        profileImage: p.profileImage,
        onlineStatus: p.onlineStatus
      }))
    }));

    return NextResponse.json({ conversations: formattedConversations });
  } catch (err: unknown) {
    console.error('Fetch conversations error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { participants, isGroup, name, description } = await req.json();

    const db = await getDb('tradelog_main');
    const user = await db.collection('users').findOne({ email: decoded.email });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const participantObjectIds = [...new Set([...participants.map((id: string) => new ObjectId(id)), user._id])];

    if (!isGroup && participantObjectIds.length === 2) {
      const existing = await db.collection('conversations').findOne({
        isGroup: false,
        participants: { $all: participantObjectIds, $size: 2 }
      });
      if (existing) return NextResponse.json({ conversation: existing });
    }

    const newConversation = {
      participants: participantObjectIds,
      isGroup: !!isGroup,
      name,
      description,
      admins: isGroup ? [user._id] : [],
      pinnedBy: [],
      mutedBy: [],
      blockedBy: [],
      deletedBy: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('conversations').insertOne(newConversation);
    return NextResponse.json({ conversation: { ...newConversation, _id: result.insertedId } }, { status: 201 });
  } catch (err: unknown) {
    console.error('Create conversation error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { conversationId, isPinned, isMuted, isBlocked, type, name, description, groupImage } = await req.json();
    const db = await getDb('tradelog_main');
    const user = await db.collection('users').findOne({ email: decoded.email });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Handle group metadata updates
    if (type === 'group_update') {
      const conv = await db.collection('conversations').findOne({ _id: new ObjectId(conversationId) });
      if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

      // Verify user is an admin or participant (usually admins can change settings)
      // For now, let any participant update to match user request "every thing can be changed"
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(conversationId) },
        {
          $set: {
            name,
            description,
            groupImage,
            updatedAt: new Date()
          }
        }
      );
      return NextResponse.json({ message: 'Group updated' });
    }

    const finalUpdate: UpdateFilter<Document> = {
      $set: { updatedAt: new Date() }
    };

    const pushOps: Record<string, ObjectId> = {};
    const pullOps: Record<string, ObjectId> = {};

    if (typeof isPinned !== 'undefined') {
      if (isPinned) pushOps.pinnedBy = user._id; else pullOps.pinnedBy = user._id;
    }
    if (typeof isMuted !== 'undefined') {
      if (isMuted) pushOps.mutedBy = user._id; else pullOps.mutedBy = user._id;
    }
    if (typeof isBlocked !== 'undefined') {
      if (isBlocked) pushOps.blockedBy = user._id; else pullOps.blockedBy = user._id;
    }

    if (Object.keys(pushOps).length > 0) finalUpdate.$addToSet = pushOps as unknown as UpdateFilter<Document>['$addToSet'];
    if (Object.keys(pullOps).length > 0) finalUpdate.$pull = pullOps as unknown as UpdateFilter<Document>['$pull'];

    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      finalUpdate
    );

    return NextResponse.json({ message: 'Conversation updated' });
  } catch (err: unknown) {
    console.error('Update conversation error:', err);
    return NextResponse.json({ error: 'Error updating conversation' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const type = searchParams.get('type') || 'me';

    if (!conversationId) return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });

    const db = await getDb('tradelog_main');
    const user = await db.collection('users').findOne({ email: decoded.email });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (type === 'all') {
      // Delete conversation entirely for everyone
      await db.collection('conversations').deleteOne({ _id: new ObjectId(conversationId) });
      await db.collection('messages').deleteMany({ conversationId: new ObjectId(conversationId) });
      return NextResponse.json({ message: 'Conversation deleted for everyone' });
    } else {
      // "Delete" for this user only by adding them to deletedBy array
      await db.collection('conversations').updateOne(
        { _id: new ObjectId(conversationId) },
        { $addToSet: { deletedBy: user._id }, $set: { updatedAt: new Date() } }
      );
      return NextResponse.json({ message: 'Conversation deleted for you' });
    }
  } catch (err: unknown) {
    console.error('Delete conversation error:', err);
    return NextResponse.json({ error: 'Error deleting conversation' }, { status: 500 });
  }
}
