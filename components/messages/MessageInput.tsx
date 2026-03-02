'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useSocket } from '@/providers/socket-provider';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import {
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  Smile,
  X
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface MessageInputProps {
  onSend: (content: string, type?: string, mediaUrl?: string) => void;
  conversationId: string;
  currentUser: { id: string; name: string } | null;
  replyingTo?: {
    _id: string;
    content: string;
    messageType?: string;
    senderId: string | { name: string };
  } | null;
  onCancelReply?: () => void;
  editingMessage?: { _id: string; content: string } | null;
  onCancelEdit?: () => void;
}

export default function MessageInput({
  onSend,
  conversationId,
  currentUser,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
    } else {
      setContent('');
    }
  }, [editingMessage]);

  const handleSend = () => {
    if (content.trim() || selectedImage) {
      if (selectedImage) {
        onSend(content.trim() || 'Photo', 'image', selectedImage);
        setSelectedImage(null);
      } else {
        onSend(content.trim());
      }
      setContent('');
      if (socket) {
        socket.emit('stop-typing', { conversationId, userId: currentUser?.id });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    if (socket) {
      socket.emit('typing', {
        conversationId,
        userId: currentUser?.id,
        userName: currentUser?.name
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop-typing', { conversationId, userId: currentUser?.id });
      }, 3000);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simulate upload - in a real app, you'd use FormData and an upload API
    try {
      setIsUploading(true);

      // For demo purposes, we'll use a FileReader to get a base64 string
      // In production, this should be a URL from S3/Cloudinary/etc.
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);

      // Reset input
      e.target.value = '';
    } catch (err) {
      console.error('Upload error', err);
      setIsUploading(false);
    }
  };

  return (
    <div className="p-2 border-t bg-card flex flex-col relative w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Reply Preview */}
      {replyingTo && (
        <div className="bg-background border-l-2 border-primary pl-3 pr-2 py-2 mb-2 rounded-md flex items-center justify-between mx-2 animate-in slide-in-from-bottom-2">
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-primary">Reply to {typeof replyingTo.senderId === 'object' ? replyingTo.senderId?.name : 'Message'}</p>
            <p className="text-sm text-muted-foreground truncate italic">
              {replyingTo.messageType === 'text' ? replyingTo.content : 'Image'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancelReply} className="h-6 w-6 text-muted-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Editing Preview */}
      {editingMessage && (
        <div className="bg-background border-l-2 border-blue-500 pl-3 pr-2 py-2 mb-2 rounded-md flex items-center justify-between mx-2 animate-in slide-in-from-bottom-2">
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-blue-500">Edit Message</p>
            <p className="text-sm text-muted-foreground truncate italic">{editingMessage.content}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancelEdit} className="h-6 w-6 text-muted-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Image Preview */}
      {selectedImage && (
        <div className="bg-background border-l-2 border-green-500 pl-3 pr-2 py-2 mb-2 rounded-md flex items-center justify-between mx-2 animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
              <Image fill src={selectedImage} alt="Preview" className="object-cover" />
            </div>
            <p className="text-sm font-semibold text-green-500">Image attached</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedImage(null)} className="h-6 w-6 text-muted-foreground">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-1 px-4 w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-muted text-muted-foreground transition-colors rounded-full flex-shrink-0 mb-0.5">
              <Paperclip className="w-5 h-5 rotate-45" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 p-2 mb-2 rounded-xl">
            <DropdownMenuItem className="gap-2 cursor-pointer p-2 rounded-lg" onClick={handleFileClick}>
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              Photo or Video
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 relative flex items-center h-[44px]">
          <textarea
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit message..." : "Write a message..."}
            className="w-full h-full bg-transparent border-none px-3 py-2.5 text-[15px] focus:outline-none focus:ring-0 resize-none overflow-y-auto custom-scrollbar text-foreground placeholder:text-muted-foreground"
            rows={1}
          />
        </div>

        <div className="flex items-center gap-1 mb-0.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors rounded-full">
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" sideOffset={10} className="p-0 border-none shadow-2xl rounded-2xl overflow-hidden w-full sm:w-auto">
              <EmojiPicker
                onEmojiClick={(emojiData) => setContent(prev => prev + emojiData.emoji)}
                theme={Theme.LIGHT}
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={handleSend}
            disabled={isUploading || (!content.trim() && !selectedImage)}
            size="icon"
            className={cn(
              "rounded-full w-10 h-10 flex-shrink-0 transition-transform",
              (content.trim() || selectedImage)
                ? "bg-primary text-primary-foreground hover:scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed"
            )}
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

