'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SearchUsersProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  currentUser: { id: string; name: string } | null;
}

export default function SearchUsers({ isOpen, onClose, onSelect, currentUser }: SearchUsersProps) {
  const { socket } = useSocket();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ _id: string; name: string; email: string; profileImage?: string; onlineStatus?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const searchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/users/search?q=${query}`);
      setResults(res.data.users || []);
    } catch (err: unknown) {
      console.error('Search error', err);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchUsers();
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const handleSendRequest = async (user: { _id: string; name: string }) => {
    try {
      setRequestingId(user._id);
      await axios.post('/api/requests', {
        receiverId: user._id
      });

      if (socket && currentUser) {
        socket.emit('new-invite', {
          receiverId: user._id,
          senderName: currentUser.name,
          senderId: currentUser.id
        });
      }

      toast.success(`Message request sent to ${user.name}!`);
      onSelect();
      onClose();
    } catch (err: unknown) {
      console.error('Error sending request', err);
      const message = err instanceof axios.AxiosError ? err.response?.data?.error : 'Failed to send message request';
      toast.error(message);
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Discover Contacts
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name, email or username..."
              className="pl-11 h-12 bg-muted/40 border-none rounded-xl focus-visible:ring-primary/20 transition-all font-medium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar min-h-[100px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Searching the community...</p>
              </div>
            ) : results.length > 0 ? (
              results.map((user) => (
                <div
                  key={user._id}
                  className="group flex items-center justify-between p-3 rounded-2xl hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="w-12 h-12 ring-2 ring-background shadow-md">
                        <AvatarImage src={user.profileImage} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                          {user.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {user.onlineStatus === 'online' && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <p className="font-bold text-foreground leading-tight">{user.name}</p>
                      <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendRequest(user)}
                    disabled={requestingId === user._id}
                    className="rounded-xl gap-2 font-semibold shadow-md px-5 bg-primary hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                  >
                    {requestingId === user._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" /> Invite
                      </>
                    )}
                  </Button>
                </div>
              ))
            ) : query.trim() ? (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="font-semibold text-muted-foreground">No matches found</h3>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different name or email address</p>
              </div>
            ) : (
              <div className="text-center py-16 flex flex-col items-center">
                <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mb-4">
                  <UserPlus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Find People</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Search for any registered user to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
