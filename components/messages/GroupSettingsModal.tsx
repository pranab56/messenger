'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { Camera, Loader2, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: {
    _id: string;
    name?: string;
    description?: string;
    groupImage?: string | null;
    participants: { _id: string }[];
  } | null;
  onUpdate: () => void;
}

export default function GroupSettingsModal({
  isOpen,
  onClose,
  conversation,
  onUpdate
}: GroupSettingsModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (conversation) {
      setName(conversation.name || '');
      setDescription(conversation.description || '');
      setGroupImage(conversation.groupImage || null);
    }
  }, [conversation, isOpen]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImage(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Image preview error', err);
      toast.error('Failed to preview image');
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      setLoading(true);
      if (!conversation) return;
      await axios.patch('/api/conversations', {
        conversationId: conversation._id,
        type: 'group_update',
        name: name.trim(),
        description: description.trim(),
        groupImage
      });

      if (socket) {
        // Notify others about the update
        socket.emit('group-updated', {
          conversationId: conversation._id,
          name: name.trim(),
          description: description.trim(),
          groupImage,
          participants: conversation.participants.map((p: { _id: string }) => p._id)
        });
      }

      toast.success('Group settings updated');
      onUpdate();
      onClose();
    } catch (err: unknown) {
      console.error('Update group error', err);
      const message = err instanceof axios.AxiosError ? err.response?.data?.error : 'Failed to update group';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold">Group Settings</DialogTitle>
          <DialogDescription>
            Change group name, description, and profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative group cursor-pointer" onClick={handleImageClick}>
              <Avatar className="w-24 h-24 border-4 border-background shadow-xl">
                <AvatarImage src={groupImage || undefined} />
                <AvatarFallback className="bg-primary/5 text-primary text-3xl font-bold">
                  {name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
            <p className="text-xs text-muted-foreground">Click to change group photo</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Group Name</label>
              <Input
                placeholder="Enter group name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className="rounded-xl bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Description</label>
              <Textarea
                placeholder="What is this group about?"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                className="rounded-xl bg-muted/30 resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
