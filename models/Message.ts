import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  messageType: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
  content: string;
  mediaUrl?: string;
  mediaName?: string;
  status: 'sent' | 'delivered' | 'read';
  readBy: {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }[];
  replyTo?: mongoose.Types.ObjectId;
  reactions: {
    userId: mongoose.Types.ObjectId;
    emoji: string;
  }[];
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'voice', 'system'],
    default: 'text'
  },
  content: { type: String, required: true },
  mediaUrl: { type: String },
  mediaName: { type: String },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readBy: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  reactions: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String }
  }],
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
}, { timestamps: true });

// Index for conversation and timestamp for fast fetching
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);
