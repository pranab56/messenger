import { comparePassword, generateToken } from '@/lib/auth-utils';
import { getDb } from '@/lib/mongodb-client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const searchEmail = email.trim().toLowerCase();
    console.log(`[LOGIN] Attempt: ${searchEmail}`);

    const db = await getDb('tradelog_main');
    const usersCollection = db.collection('users');

    // Case-insensitive search on the email field
    const user = await usersCollection.findOne({
      email: { $regex: new RegExp(`^${searchEmail}$`, 'i') }
    });

    if (!user) {
      console.warn(`[LOGIN] User not found: ${searchEmail}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.isVerified) {
      console.warn(`[LOGIN] User not verified: ${searchEmail}`);
      return NextResponse.json({ error: 'Please verify your email first', needsVerification: true }, { status: 403 });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      console.warn(`[LOGIN] Password mismatch: ${searchEmail}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log(`[LOGIN] Success: ${searchEmail}`);

    // Include the isolated database name in the token
    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      dbName: user.dbName // This is the key for isolated data management
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        dbName: user.dbName
      }
    });

    // Set token in HTTP-only cookie for better security
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;

  } catch (err: unknown) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
