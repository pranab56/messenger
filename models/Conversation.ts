import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  isGroup: boolean;
  participants: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  name?: string; // For groups
  description?: string; // For groups
  groupImage?: string;
  lastMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema: Schema = new Schema({
  isGroup: { type: Boolean, default: false },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  name: { type: String },
  description: { type: String },
  groupImage: { type: String },
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
}, { timestamps: true });

export default mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', ConversationSchema);
