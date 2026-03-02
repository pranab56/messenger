'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface PendingRequestsProps {
  requests: {
    _id: string;
    senderId: { _id: string; name: string; profileImage?: string };
    receiverId: string;
    status: string;
  }[];
  onAction: () => void;
  currentUser: { id: string; name: string } | null;
}

export default function PendingRequests({ requests, onAction, currentUser }: PendingRequestsProps) {
  const { socket } = useSocket();
  const [loading] = useState(false);

  const handleAction = async (request: { _id: string; senderId: { _id: string } }, status: 'accepted' | 'rejected') => {
    try {
      await axios.patch('/api/requests', { requestId: request._id, status });

      if (status === 'accepted' && socket) {
        socket.emit('invite-accepted', {
          senderId: request.senderId._id, // The original sender
          receiverName: currentUser?.name,
          receiverId: currentUser?.id
        });

        // Also notify about new conversation
        socket.emit('new-conversation', {
          participants: [request.senderId._id, currentUser?.id]
        });
      }

      toast.success(`Request ${status}`);
      onAction();
    } catch {
      toast.error('Failed to update request');
    }
  };

  if (requests.length === 0 && !loading) return null;

  return (
    <div className="px-4 py-2 space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Message Requests</h3>
      {requests.map((request) => (
        <Card key={request._id} className="p-3 bg-primary/5 border-primary/10 shadow-sm overflow-hidden animate-in slide-in-from-left-2 duration-300">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={request.senderId.profileImage} />
                <AvatarFallback>{request.senderId.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">
                  {request.senderId.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  invited you to message request.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1 h-8 text-xs font-bold rounded-lg"
                onClick={() => handleAction(request, 'accepted')}
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs font-bold rounded-lg"
                onClick={() => handleAction(request, 'rejected')}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
