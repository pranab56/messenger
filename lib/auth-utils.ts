import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_build_only';

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashed: string) {
  return await bcrypt.compare(password, hashed);
}

export interface TokenPayload {
  id: string;
  email: string;
  dbName: string;
  name?: string;
}

export function generateToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
