'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { Check, Loader2, Users, X } from 'lucide-react';
import { useState } from 'react';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUser: { id: string; name: string } | null;
}

export default function GroupModal({ isOpen, onClose, onCreated, currentUser }: GroupModalProps) {
  const { socket } = useSocket();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<{ _id: string; name: string; profileImage?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ _id: string; name: string; profileImage?: string }[]>([]);

  const toggleUser = (user: { _id: string; name: string; profileImage?: string }) => {
    if (selectedUsers.find(u => u._id === user._id)) {
      setSelectedUsers(prev => prev.filter(u => u._id !== user._id));
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(`/api/users/search?q=${q}`);
      setSearchResults(res.data.users);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async () => {
    if (!name || selectedUsers.length < 1) return;

    try {
      setLoading(true);
      const res = await axios.post('/api/conversations', {
        name,
        description,
        participants: selectedUsers.map(u => u._id),
        isGroup: true
      });

      if (socket) {
        socket.emit('new-conversation', {
          conversation: res.data.conversation,
          participants: [...selectedUsers.map(u => u._id), currentUser?.id]
        });
      }

      onCreated();
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedUsers([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            Create New Group
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Group Name</label>
              <Input
                placeholder="e.g. Trading Strategy Team"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium ml-1">Description (Optional)</label>
              <Input
                placeholder="What is this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl bg-muted/30"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium ml-1 flex justify-between">
              Add Members
              <span className="text-xs text-muted-foreground">{selectedUsers.length} selected</span>
            </label>

            <div className="relative">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                className="rounded-xl bg-muted/30"
              />
            </div>

            {/* Selected Users Chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 py-1">
                {selectedUsers.map(user => (
                  <div key={user._id} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium border border-primary/20">
                    {user.name}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => toggleUser(user)} />
                  </div>
                ))}
              </div>
            )}

            {/* Search Results */}
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {searchResults.map(user => (
                <div
                  key={user._id}
                  onClick={() => toggleUser(user)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={user.profileImage} />
                      <AvatarFallback className="bg-muted text-xs">{user.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                    selectedUsers.find(u => u._id === user._id)
                      ? "bg-primary border-primary text-white"
                      : "border-muted-foreground group-hover:border-primary"
                  )}>
                    {selectedUsers.find(u => u._id === user._id) && <Check className="w-3 h-3" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleCreateGroup}
            disabled={loading || !name || selectedUsers.length < 1}
            className="rounded-xl px-8 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Users className="w-4 h-4 mr-2" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

