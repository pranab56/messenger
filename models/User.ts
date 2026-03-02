import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  username?: string;
  profileImage?: string;
  coverImage?: string;
  bio?: string;
  dbName: string;
  initialCapital: number;
  capitalUpdateDate: Date;
  isVerified: boolean;
  onlineStatus?: 'online' | 'offline' | 'away';
  lastSeen?: Date;
  otp?: string;
  otpExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  username: { type: String, unique: true, sparse: true },
  profileImage: { type: String },
  coverImage: { type: String },
  bio: { type: String, default: '' },
  dbName: { type: String, required: true },
  initialCapital: { type: Number, default: 0 },
  capitalUpdateDate: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  onlineStatus: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  otp: { type: String },
  otpExpiry: { type: Date },
}, { timestamps: true, collection: 'users' });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
