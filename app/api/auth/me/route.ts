import { TokenPayload, verifyToken } from '@/lib/auth-utils';
import { getDb } from '@/lib/mongodb-client';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
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
    const user = await db.collection('users').findOne({ email: decoded.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username || '',
        bio: user.bio || '',
        profileImage: user.profileImage || '',
        coverImage: user.coverImage || '',
        dbName: user.dbName,
        initialCapital: user.initialCapital || 0,
        capitalUpdateDate: user.capitalUpdateDate || user.createdAt,
        isVerified: user.isVerified
      }
    });

  } catch (err: unknown) {
    console.error('Profile fetch error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const decoded = verifyToken(token) as TokenPayload | null;
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      initialCapital,
      capitalUpdateDate,
      bio,
      username,
      profileImage,
      coverImage,
      currentPassword,
      newPassword
    } = body;

    const db = await getDb('tradelog_main');
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: decoded.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Basic Info
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    // Username Check
    if (username !== undefined && username !== user.username) {
      const existing = await usersCollection.findOne({ username });
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
      }
      updateData.username = username;
    }

    // Capital & Session
    if (initialCapital !== undefined) {
      updateData.initialCapital = parseFloat(initialCapital);
      updateData.capitalUpdateDate = capitalUpdateDate ? new Date(capitalUpdateDate) : new Date();
    } else if (capitalUpdateDate !== undefined) {
      updateData.capitalUpdateDate = new Date(capitalUpdateDate);
    }

    // Password Update
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required to change password' }, { status: 400 });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }
    await usersCollection.updateOne(
      { email: decoded.email },
      { $set: updateData }
    );

    return NextResponse.json({ message: 'Profile updated successfully' });

  } catch (err: unknown) {
    console.error('Profile update error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
