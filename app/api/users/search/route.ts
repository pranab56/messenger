import { TokenPayload, verifyToken } from '@/lib/auth-utils';
import { getDb } from '@/lib/mongodb-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ users: [] });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const db = await getDb('tradelog_main');
    const usersCollection = db.collection('users');

    console.log('--- Search API Debug (Native Driver) ---');
    console.log('Query:', query);
    console.log('Current User Email:', decoded.email);

    // native driver search
    const users = await usersCollection.find({
      email: { $ne: decoded.email },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).project({
      name: 1,
      email: 1,
      profileImage: 1,
      username: 1,
      onlineStatus: 1
    }).limit(10).toArray();

    const totalUsers = await usersCollection.countDocuments();
    console.log(`Total users in native DB: ${totalUsers}`);
    console.log(`Matching users found: ${users.length}`);

    return NextResponse.json({
      users: users.map(u => ({ ...u, _id: u._id.toString() })),
      debug: {
        totalInCollection: totalUsers,
        queryUsed: query,
        currentUser: decoded.email,
        matchingCount: users.length
      }
    });
  } catch (err: unknown) {
    console.error('User search error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
