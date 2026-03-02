import mongoose, { Document, Schema } from 'mongoose';

export interface IMessageRequest extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

const MessageRequestSchema: Schema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    default: 'pending'
  },
}, { timestamps: true });

// Prevent duplicate requests
MessageRequestSchema.index({ senderId: 1, receiverId: 1 }, { unique: true });

export default mongoose.models.MessageRequest || mongoose.model<IMessageRequest>('MessageRequest', MessageRequestSchema);
