'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSocket } from '@/providers/socket-provider';
import dayjs from '@/lib/dayjs';
import {
  MessageSquarePlus, MoreVertical,
  Pin as PinIcon, Plus, Search, Trash, UserMinus, Volume2,
  VolumeX
} from 'lucide-react';
import { useState } from 'react';
import GroupModal from './GroupModal';
import PendingRequests from './PendingRequests';
import SearchUsers from './SearchUsers';

import axios from 'axios';
import { toast } from 'sonner';

// dayjs configured in @/lib/dayjs

interface Participant {
  _id: string;
  name: string;
  profileImage?: string;
  onlineStatus?: string;
}

interface Message {
  _id: string;
  conversationId: string;
  senderId: string | { _id: string; name: string; profileImage?: string };
  content: string;
  messageType?: string;
  mediaUrl?: string;
  replyTo?: {
    _id: string;
    content: string;
    messageType: string;
    senderName: string;
  } | string | null;
  reactions?: { userId: string; emoji: string; userName?: string }[];
  isPinned?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

interface Conversation {
  _id: string;
  name?: string;
  description?: string;
  isGroup: boolean;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount?: number;
  isMuted?: boolean;
  isPinned?: boolean;
  isBlockedByMe?: boolean;
  isBlocked?: boolean;
  groupImage?: string;
  updatedAt: string;
  pinnedMessageId?: string | null;
}

interface User {
  id: string;
  _id?: string;
  name: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  requests: {
    _id: string;
    senderId: { _id: string; name: string; profileImage?: string };
    receiverId: string;
    status: string;
    createdAt: string;
  }[];
  onSelect: (conv: Conversation) => void;
  selectedId?: string;
  loading: boolean;
  currentUser: User | null;
  onConversationCreated: () => void;
  isConnected: boolean;
}

export default function ChatSidebar({
  conversations,
  requests,
  onSelect,
  selectedId,
  loading,
  currentUser,
  onConversationCreated,
  isConnected
}: ChatSidebarProps) {
  const { socket } = useSocket();
  console.log('[SIDEBAR] Socket Connected State:', isConnected);
  const [showSearch, setShowSearch] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'blocked'>('all');

  const handleUpdateConversation = async (conversationId: string, data: Partial<Conversation>) => {
    try {
      await axios.patch('/api/conversations', { conversationId, ...data });
      toast.success('Conversation updated');
      onConversationCreated();
    } catch {
      toast.error('Failed to update conversation');
    }
  };

  const handleDeleteConversation = async (conv: Conversation) => {
    if (!confirm('Are you sure you want to delete this conversation and all its messages?')) return;
    try {
      await axios.delete(`/api/conversations?conversationId=${conv._id}`);

      if (socket) {
        socket.emit('delete-conversation', {
          conversationId: conv._id,
          participants: [currentUser?.id] // Only notify my own tabs
        });
      }

      toast.success('Conversation deleted');
      onConversationCreated();
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const filteredConversations = conversations
    .filter(conv => {
      if (activeTab === 'all') return !conv.isBlockedByMe;
      return conv.isBlockedByMe;
    })
    .filter(conv => {
      if (conv.isGroup) {
        return conv.name?.toLowerCase().includes(searchQuery.toLowerCase());
      }
      const otherParticipant = conv.participants.find((p: Participant) => p._id !== currentUser?.id);
      return otherParticipant?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className={cn(
      "flex flex-col border-r bg-card h-full transition-all duration-300 flex-shrink-0",
      selectedId ? "hidden md:flex md:w-[350px]" : "w-full md:w-[350px]"
    )}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 animate-pulse"
              )}
            />
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isConnected ? "text-green-500" : "text-red-500"
            )}>
              {isConnected ? "Real-time Online" : "Connecting..."}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(true)}
            title="New Chat"
            className="cursor-pointer"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGroupModal(true)}
            title="New Group"
            className="cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9 bg-muted/50 border-none transition-all focus-visible:bg-muted cursor-pointer"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-muted/50 rounded-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
              activeTab === 'all' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Chats
          </button>
          <button
            onClick={() => setActiveTab('blocked')}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer",
              activeTab === 'blocked' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Blocked
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {activeTab === 'all' && (
        <PendingRequests
          requests={requests}
          onAction={onConversationCreated}
          currentUser={currentUser}
        />
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </div>
            ))
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const otherParticipant = !conv.isGroup
                ? conv.participants.find((p: Participant) => p._id !== currentUser?.id)
                : null;

              const title = conv.isGroup ? conv.name : otherParticipant?.name;
              const image = conv.isGroup ? conv.groupImage : otherParticipant?.profileImage;

              return (
                <div key={conv._id} className="relative group w-full">
                  <button
                    onClick={() => onSelect(conv)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-muted/50 text-left cursor-pointer",
                      selectedId === conv._id && "bg-primary/10 hover:bg-primary/20"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12 border-2 border-background shadow-sm">
                        <AvatarImage src={image} />
                        <AvatarFallback className="bg-primary/5 text-primary text-lg">
                          {title?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {!conv.isGroup && otherParticipant && (
                        <span className={cn(
                          "absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-background rounded-full transition-colors",
                          otherParticipant?.onlineStatus === 'online' ? "bg-green-500" : "bg-red-500"
                        )} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={cn("truncate", (conv.unreadCount && conv.unreadCount > 0) ? "font-bold text-foreground" : "font-semibold")}>{title}</span>
                          {conv.isPinned && <PinIcon className="w-3 h-3 text-primary fill-primary" />}
                          {conv.isMuted && <VolumeX className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        {conv.lastMessage && (
                          <span className={cn("text-[11px] whitespace-nowrap ml-2", (conv.unreadCount && conv.unreadCount > 0) ? "font-bold text-primary" : "text-muted-foreground")}>
                            {dayjs(conv.updatedAt).format('HH:mm')}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={cn(
                          "text-xs line-clamp-1 flex-1 text-left break-all",
                          (conv.unreadCount && conv.unreadCount > 0) ? "font-semibold text-foreground font-medium" : "text-muted-foreground"
                        )}>
                          {conv.lastMessage ? (
                            <>
                              {(String(typeof conv.lastMessage.senderId === 'object' ? conv.lastMessage.senderId._id : conv.lastMessage.senderId) === String(currentUser?.id)) && "You: "}
                              {conv.lastMessage.content}
                            </>
                          ) : (
                            <span className="italic">No messages yet</span>
                          )}
                        </p>
                        {conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 animate-in zoom-in">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => handleUpdateConversation(conv._id, { isPinned: !conv.isPinned })}
                        >
                          <PinIcon className="w-4 h-4" /> {conv.isPinned ? 'Unpin' : 'Pin'} Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => handleUpdateConversation(conv._id, { isMuted: !conv.isMuted })}
                        >
                          <Volume2 className="w-4 h-4" /> {conv.isMuted ? 'Unmute' : 'Mute'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => {
                            handleUpdateConversation(conv._id, { isBlocked: !conv.isBlockedByMe });
                            if (socket && otherParticipant) {
                              socket.emit('new-conversation', {
                                participants: [otherParticipant._id],
                                action: 'block',
                                isBlocked: !conv.isBlockedByMe,
                                blockedBy: currentUser?.name || 'User'
                              });
                            }
                          }}
                        >
                          <UserMinus className="w-4 h-4" /> {conv.isBlockedByMe ? 'Unblock' : 'Block'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => handleDeleteConversation(conv)}
                        >
                          <Trash className="w-4 h-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No conversations found
            </div>
          )}
        </div>
      </ScrollArea>

      {/* User Search Modal */}
      <SearchUsers
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={() => {
          setShowSearch(false);
          // Handle starting conversation
          onConversationCreated();
        }}
        currentUser={currentUser}
      />

      {/* Group Creation Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onCreated={() => {
          setShowGroupModal(false);
          onConversationCreated();
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
