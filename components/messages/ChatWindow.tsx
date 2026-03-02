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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MoreVertical,
  Pin,
  Settings,
  Trash2,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { toast } from 'sonner';
import CallOverlay from './CallOverlay';
import GroupSettingsModal from './GroupSettingsModal';
import MessageInput from './MessageInput';
import MessageItem from './MessageItem';
import { Calendar } from '@/components/ui/calendar';
import dayjs from '@/lib/dayjs';



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
  email: string;
  profileImage?: string;
}

interface ChatWindowProps {
  conversation: Conversation;
  currentUser: User | null;
  onMessageSent?: (msg: Message) => void;
  onBack?: () => void;
}

// Normalize any ID (string, ObjectId, {$oid:...}) to a plain string
const toStr = (id: string | { $oid: string } | { toString: () => string } | undefined | null): string => {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object') {
    if ('$oid' in id) return id.$oid;
    if (typeof id.toString === 'function') return id.toString();
  }
  return String(id);
};

export default function ChatWindow({ conversation, currentUser, onMessageSent, onBack }: ChatWindowProps) {
  const { socket, isConnected } = useSocket();
  const convId = toStr(conversation._id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);
  const preventScrollRef = useRef(false); // blocks scroll-to-bottom when loading older messages
  const [typingUser, setTypingUser] = useState<{ id: string; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState<string | null>(null); // YYYY-MM-DD
  const [filteredMessages, setFilteredMessages] = useState<Message[] | null>(null);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);

  const otherParticipant = !conversation.isGroup
    ? conversation.participants.find((p: Participant) => toStr(p._id) !== toStr(currentUser?.id || currentUser?._id))
    : null;

  const title = conversation.isGroup ? conversation.name : otherParticipant?.name;
  const image = conversation.isGroup ? conversation.groupImage : otherParticipant?.profileImage;

  const fetchMessages = useCallback(async (isInitial = true) => {
    try {
      if (isInitial) {
        setLoading(true);
        pageRef.current = 1;
      } else {
        setLoadingMore(true);
      }

      const pageToFetch = isInitial ? 1 : pageRef.current + 1;
      const res = await axios.get(`/api/messages?conversationId=${conversation._id}&page=${pageToFetch}&limit=20`);

      const newMessages = res.data.messages;

      if (isInitial) {
        preventScrollRef.current = false; // allow scroll to bottom on initial load
        setMessages(newMessages);
      } else {
        pageRef.current = pageToFetch;
        preventScrollRef.current = true; // block scroll when prepending old messages
        setMessages(prev => [...newMessages, ...prev]);
      }

      setHasMore(res.data.hasMore);

      // Mark as read
      if (isInitial) {
        await axios.post('/api/conversations/read', { conversationId: conversation._id });
        if (socket) socket.emit('mark-read', { conversationId: conversation._id, userId: currentUser?.id });
      }
    } catch (err) {
      console.error('Fetch messages error', err);
    } finally {
      if (isInitial) setLoading(false);
      else {
        setLoadingMore(false);
        // Keep preventScrollRef true briefly so the re-render from setMessages
        // doesn't trigger scroll. Reset after paint.
        requestAnimationFrame(() => { preventScrollRef.current = false; });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation._id, currentUser?.id, socket]); // page intentionally excluded — using pageRef instead

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    pageRef.current = 1;
    fetchMessages(true);
  }, [convId, fetchMessages]);

  const loadMoreMessages = () => {
    if (!loading && !loadingMore && hasMore && !dateFilter) {
      fetchMessages(false);
    }
  };

  const applyDateFilter = async (date: string) => {
    try {
      setLoadingFilter(true);
      setDateFilter(date);
      setShowDatePicker(false);
      const res = await axios.get(`/api/messages?conversationId=${conversation._id}&date=${date}`);
      setFilteredMessages(res.data.messages);
    } catch (err) {
      console.error('Filter messages error', err);
      toast.error('Failed to filter messages');
    } finally {
      setLoadingFilter(false);
    }
  };

  const clearDateFilter = () => {
    setDateFilter(null);
    setFilteredMessages(null);
    setShowDatePicker(false);
    setCalendarDate(undefined);
  };

  const getDateLabel = (dateStr: string) => {
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    if (!socket) return;

    // Join conversation room — also rejoin on reconnect
    const joinRoom = () => {
      console.log('[ChatWindow] Joining room:', convId);
      socket.emit('join-room', convId);
    };

    // Join immediately if already connected
    if (socket.connected) joinRoom();

    // Re-join on every (re)connect
    socket.on('connect', joinRoom);

    const onReceiveMessage = (message: Message) => {
      if (toStr(message.conversationId) === convId) {
        setMessages(prev => [...prev, message]);
      }
    };

    const onUserTyping = (data: { conversationId: string; userId: string; userName: string }) => {
      if (toStr(data.conversationId) === convId && toStr(data.userId) !== toStr(currentUser?.id || currentUser?._id)) {
        setTypingUser({ id: data.userId, name: data.userName });
      }
    };

    const onUserStopTyping = (data: { conversationId: string; userId: string }) => {
      if (toStr(data.conversationId) === convId) {
        setTypingUser(null);
      }
    };

    const onMessageEdited = (updatedMessage: Message) => {
      setMessages(prev => prev.map(m => toStr(m._id) === toStr(updatedMessage._id) ? { ...m, ...updatedMessage } : m));
    };

    const onMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => toStr(m._id) !== toStr(data.messageId)));
    };

    const onMessageReacted = (updatedMessage: Message) => {
      setMessages(prev => prev.map(m => toStr(m._id) === toStr(updatedMessage._id) ? { ...m, ...updatedMessage } : m));

      // Play sound when someone reacts
      const playReactSound = () => {
        const audio = new Audio('/audio/audio.mp3');
        audio.play().catch(err => console.log('Audio playback prevented by browser:', err));
      };
      playReactSound();
    };

    const onMessageRead = (data: { conversationId: string; userId: string }) => {
      if (toStr(data.conversationId) === convId) {
        setMessages(prev => prev.map(m => {
          const senderId = typeof m.senderId === 'object' ? toStr(m.senderId._id) : toStr(m.senderId);
          const myId = toStr(currentUser?.id || currentUser?._id);
          if (senderId === myId && myId !== toStr(data.userId)) {
            return { ...m, status: 'read' as const };
          }
          return m;
        }));
      }
    };

    socket.on('receive-message', onReceiveMessage);
    socket.on('user-typing', onUserTyping);
    socket.on('user-stop-typing', onUserStopTyping);
    socket.on('message-edited', onMessageEdited);
    socket.on('message-deleted', onMessageDeleted);
    socket.on('message-reacted', onMessageReacted);
    socket.on('message-read', onMessageRead);

    return () => {
      socket.off('connect', joinRoom);
      socket.off('receive-message', onReceiveMessage);
      socket.off('user-typing', onUserTyping);
      socket.off('user-stop-typing', onUserStopTyping);
      socket.off('message-edited', onMessageEdited);
      socket.off('message-deleted', onMessageDeleted);
      socket.off('message-reacted', onMessageReacted);
      socket.off('message-read', onMessageRead);
    };
  }, [convId, socket, isConnected, currentUser?.id, currentUser?._id]);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: 0,
        behavior
      });
    }
  }, []);

  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    if (preventScrollRef.current) return; // older messages loaded — don't scroll
    const scrollableDiv = scrollRef.current;
    if (!scrollableDiv) return;
    scrollableDiv.scrollTop = 0;
  }, [messages]);

  useEffect(() => {
    if (!typingUser) return;
    const scrollableDiv = scrollRef.current;
    if (!scrollableDiv) return;
    scrollableDiv.scrollTop = 0;
  }, [typingUser]);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/20', 'transition-colors', 'duration-500', 'rounded-lg');
      setTimeout(() => el.classList.remove('bg-primary/20', 'transition-colors', 'duration-500', 'rounded-lg'), 2000);
    } else {
      toast.error('Please scroll up more to load this message.');
    }
  };

  const pinnedMessages = messages.filter(m => m.isPinned);

  const handleSendMessage = async (content: string, type: string = 'text', mediaUrl?: string) => {
    try {
      if (editingMessage) {
        const res = await axios.patch('/api/messages', {
          messageId: editingMessage._id,
          type: 'edit',
          content
        });
        const updatedFromApi = res.data.message;

        setMessages(prev => prev.map(m => {
          if (m._id === editingMessage._id) {
            const updated = {
              ...m,
              content: updatedFromApi.content,
              isEdited: updatedFromApi.isEdited,
              updatedAt: updatedFromApi.updatedAt
            };
            if (socket) socket.emit('edit-message', {
              ...updated,
              conversationId: convId,
              participants: conversation.participants.map((p: Participant) => p._id)
            });
            return updated;
          }
          return m;
        }));
        setEditingMessage(null);
        return;
      }

      const res = await axios.post('/api/messages', {
        conversationId: conversation._id,
        content,
        messageType: type,
        mediaUrl,
        replyTo: replyingTo?._id
      });
      const newMessage = res.data.message;

      if (replyingTo) {
        newMessage.replyTo = {
          _id: replyingTo._id,
          content: replyingTo.content,
          messageType: replyingTo.messageType || 'text',
          senderName: (typeof replyingTo.senderId === 'object' ? replyingTo.senderId.name : 'User')
        };
      }


      setMessages(prev => [...prev, newMessage]);
      setReplyingTo(null);
      if (onMessageSent) onMessageSent(newMessage);

      if (socket) {
        socket.emit('send-message', {
          ...newMessage,
          participants: conversation.participants.map((p: Participant) => p._id)
        });
      }
    } catch (err) {
      console.error('Send message error', err);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      const audio = new Audio('/audio/audio.mp3');
      audio.play().catch(e => console.log('Audio playback prevented by browser:', e));

      const res = await axios.patch('/api/messages', { messageId, type: 'react', emoji });
      const updatedReactions = res.data.message.reactions;

      const newMessages = messages.map(m => {
        if (m._id === messageId) {
          const updated = { ...m, reactions: updatedReactions };
          if (socket) socket.emit('react-message', {
            ...updated,
            participants: conversation.participants.map((p: Participant) => p._id)
          });
          return updated;
        }
        return m;
      });
      setMessages(newMessages);
    } catch (err) {
      console.error('React error', err);
    }
  };

  const handlePin = async (messageId: string, currentPinStatus: boolean) => {
    try {
      const newPinStatus = !currentPinStatus;

      if (newPinStatus) {
        const currentPinnedCount = messages.filter(m => m.isPinned).length;
        if (currentPinnedCount >= 3) {
          toast.error('You can only pin up to 3 messages.');
          return;
        }
      }

      await axios.patch('/api/messages', { messageId, type: 'pin', isPinned: newPinStatus });
      setMessages(prev => {
        const newMessages = prev.map(m => {
          if (m._id === messageId) {
            const updated = { ...m, isPinned: newPinStatus };
            if (socket) socket.emit('edit-message', {
              ...updated,
              conversationId: convId,
              participants: conversation.participants.map((p: Participant) => p._id)
            });
            return updated;
          }
          return m;
        });
        return newMessages;
      });
    } catch (err: unknown) {
      console.error('Pin error', err);
      const errorMessage = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to pin message';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await axios.delete(`/api/messages?messageId=${messageId}`);
      setMessages(prev => prev.filter(m => m._id !== messageId));
      if (socket) socket.emit('delete-message', {
        conversationId: conversation._id,
        messageId,
        participants: conversation.participants.map((p: Participant) => p._id)
      });
    } catch (err) {
      console.error('Delete error', err);
    }
  };

  const handleDeleteChat = async (type: 'all' | 'me') => {
    try {
      await axios.delete(`/api/conversations?conversationId=${conversation._id}&type=${type}`);
      setShowDeleteChatModal(false);

      if (type === 'all' && socket) {
        socket.emit('delete-conversation', {
          conversationId: conversation._id,
          participants: conversation.participants.map((p: Participant) => p._id)
        });
      }

      toast.success(type === 'all' ? 'Chat deleted for everyone' : 'Chat deleted for you');
      router.push('/messages'); // redirect back to message list
      router.refresh();
    } catch (err) {
      console.error('Delete chat error', err);
      toast.error('Failed to delete chat');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-card/30 min-w-0 max-w-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card/80 backdrop-blur-md sticky top-0 z-10 w-full">
        <div className="flex items-center gap-3 truncate">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden flex-shrink-0 text-muted-foreground mr-1 cursor-pointer"
              onClick={onBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <Avatar className="w-10 h-10 ring-2 ring-primary/10 flex-shrink-0">
            <AvatarImage src={image} />
            <AvatarFallback className="bg-primary/5 text-primary">
              {title?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold leading-none mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {conversation.isGroup
                ? `${conversation.participants.length} members`
                : (otherParticipant?.onlineStatus === 'online' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </span>
                ) : 'Offline')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Date Filter Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className={`transition-colors hover:text-primary cursor-pointer ${dateFilter ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
              onClick={() => setShowDatePicker(prev => !prev)}
              title="Filter by date"
            >
              <CalendarDays className="w-5 h-5" />
            </Button>
            {showDatePicker && (
              <div className="absolute right-0 top-12 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 w-72 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Filter Messages</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Today', value: new Date().toISOString().split('T')[0] },
                    { label: 'Yesterday', value: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })() },
                    { label: 'Last 7 days', value: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })() },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => applyDateFilter(opt.value)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer hover:bg-primary/10 hover:text-primary ${dateFilter === opt.value ? 'bg-primary/10 text-primary font-bold' : ''
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">Custom Date</p>
                    <Calendar
                      mode="single"
                      selected={calendarDate}
                      onSelect={(date) => {
                        if (date) {
                          setCalendarDate(date);
                          applyDateFilter(dayjs(date).format('YYYY-MM-DD'));
                        }
                      }}
                      disabled={{ after: new Date() }}
                      className="rounded-xl border border-border p-0 scale-90 origin-top-left"
                    />
                  </div>
                  {dateFilter && (
                    <button
                      onClick={clearDateFilter}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm font-medium text-loss hover:bg-loss/10 transition-all cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {conversation.isGroup && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground transition-colors hover:text-primary cursor-pointer"
              onClick={() => setShowGroupSettings(true)}
              title="Group Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground transition-colors hover:text-primary cursor-pointer">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                onClick={() => setShowDeleteChatModal(true)}
              >
                <Trash2 className="w-4 h-4" /> Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {pinnedMessages.length > 0 && (
        <div className="flex flex-col z-10 border-b">
          {pinnedMessages.map((pinnedMsg, index) => (
            <div
              key={pinnedMsg._id}
              className="px-4 py-2 bg-card/60 backdrop-blur-md flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors shadow-sm"
              onClick={() => scrollToMessage(pinnedMsg._id)}
            >
              <div className="p-1.5 bg-primary/10 rounded-full text-primary shrink-0">
                <Pin className="w-4 h-4 fill-current" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[11px] font-bold text-primary uppercase tracking-tight">
                  Pinned Message {pinnedMessages.length > 1 ? `(${index + 1}/${pinnedMessages.length})` : ''}
                </p>
                <p className="text-sm truncate text-muted-foreground font-medium">
                  {pinnedMsg.messageType === 'text' ? pinnedMsg.content : `[${pinnedMsg.messageType}]`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date Filter Banner */}
      {dateFilter && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary">
              {loadingFilter ? 'Loading...' : `Showing messages from ${getDateLabel(dateFilter)}`}
              {filteredMessages && !loadingFilter && ` — ${filteredMessages.length} message(s) found`}
            </span>
          </div>
          <button onClick={clearDateFilter} className="text-primary hover:bg-primary/20 rounded-full p-0.5 transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div
        className="flex-1 relative overflow-hidden"
        id="scrollableDiv"
        ref={scrollRef}
        style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column-reverse' }}
      >
        {/* Initial chat-switch loading — renders at bottom in reversed layout */}
        {(loading || loadingFilter) && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest animate-pulse">
              {loadingFilter ? 'Filtering messages...' : 'Loading messages...'}
            </p>
          </div>
        )}

        {/* Date Filter Results */}
        {!loading && !loadingFilter && dateFilter && (
          <div className="p-4 w-full" style={{ display: 'flex', flexDirection: 'column-reverse' }}>
            <div className="space-y-1.5 space-y-reverse flex flex-col-reverse w-full pb-4">
              {filteredMessages && filteredMessages.length > 0 ? (
                [...filteredMessages].reverse().map((msg, index, reversedArr) => (
                  <motion.div
                    key={msg._id}
                    id={`msg-${msg._id}`}
                    className="w-full p-1"
                    initial={{ opacity: 0, scale: 0.98, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <MessageItem
                      message={msg}
                      isOwn={toStr(typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId) === toStr(currentUser?.id || currentUser?._id)}
                      showAvatar={index === 0 || toStr(typeof reversedArr[index - 1]?.senderId === 'object' ? (reversedArr[index - 1].senderId as { _id: string })._id : reversedArr[index - 1]?.senderId) !== toStr(typeof msg.senderId === 'object' ? (msg.senderId as { _id: string })._id : msg.senderId)}
                      onReply={() => setReplyingTo(msg)}
                      onReact={(emoji) => handleReact(msg._id, emoji)}
                      onEdit={() => setEditingMessage(msg)}
                      onDelete={() => handleDelete(msg._id)}
                      onPin={() => handlePin(msg._id, !!msg.isPinned)}
                      onReplyClick={scrollToMessage}
                    />
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <CalendarDays className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h4 className="font-medium">No messages found</h4>
                  <p className="text-sm text-muted-foreground mt-1">No messages were sent on {getDateLabel(dateFilter)}.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Normal paginated view */}
        {!loading && !loadingFilter && !dateFilter && (
          <InfiniteScroll
            dataLength={messages.length}
            next={loadMoreMessages}
            hasMore={hasMore}
            loader={
              loadingMore ? (
                <div className="flex justify-center items-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading older messages...</span>
                </div>
              ) : <></>
            }
            scrollableTarget="scrollableDiv"
            inverse={true}
            style={{ display: 'flex', flexDirection: 'column-reverse', width: '100%' }}
            className="p-4 w-full"
          >
            <div className="space-y-1.5 space-y-reverse flex flex-col-reverse w-full pb-4">
              {typingUser && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-12 mb-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>{typingUser.name} is typing...</span>
                </div>
              )}

              {[...messages].reverse().map((msg, index, reversedArr) => (
                <motion.div
                  key={msg._id}
                  id={`msg-${msg._id}`}
                  className="w-full p-1"
                  initial={{ opacity: 0, scale: 0.98, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <MessageItem
                    message={msg}
                    isOwn={toStr(typeof msg.senderId === 'object' ? msg.senderId._id : msg.senderId) === toStr(currentUser?.id || currentUser?._id)}
                    showAvatar={index === 0 || toStr(typeof reversedArr[index - 1]?.senderId === 'object' ? (reversedArr[index - 1].senderId as { _id: string })._id : reversedArr[index - 1]?.senderId) !== toStr(typeof msg.senderId === 'object' ? (msg.senderId as { _id: string })._id : msg.senderId)}
                    onReply={() => setReplyingTo(msg)}
                    onReact={(emoji) => handleReact(msg._id, emoji)}
                    onEdit={() => setEditingMessage(msg)}
                    onDelete={() => handleDelete(msg._id)}
                    onPin={() => handlePin(msg._id, !!msg.isPinned)}
                    onReplyClick={scrollToMessage}
                  />
                </motion.div>
              ))}

              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full my-auto">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">👋</span>
                  </div>
                  <h4 className="font-medium">No messages yet</h4>
                  <p className="text-sm text-muted-foreground mt-1">Send a message to start the conversation!</p>
                </div>
              )}
            </div>
          </InfiniteScroll>
        )}
      </div>

      {/* Input Area */}
      {conversation.isBlocked ? (
        <div className="p-4 text-center bg-muted w-full border-t border-border">
          <p className="font-semibold text-muted-foreground">You cannot reply to this conversation</p>
        </div>
      ) : (
        <MessageInput
          onSend={handleSendMessage}
          conversationId={conversation._id}
          currentUser={currentUser}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
        />
      )}

      {/* Call UI */}
      <CallOverlay
        isOpen={isCalling}
        onHangup={() => setIsCalling(false)}
        user={otherParticipant || null}
      />

      <Dialog open={showDeleteChatModal} onOpenChange={setShowDeleteChatModal}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Chat?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Do you want to delete this chat for everyone or just yourself?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Button
              variant="destructive"
              className="w-full rounded-xl py-6"
              onClick={() => handleDeleteChat('all')}
            >
              Delete for everyone
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl py-6"
              onClick={() => handleDeleteChat('me')}
            >
              Delete for me only
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="w-full rounded-xl" onClick={() => setShowDeleteChatModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {conversation.isGroup && (
        <GroupSettingsModal
          isOpen={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          conversation={conversation}
          onUpdate={() => router.refresh()}
        />
      )}
    </div>
  );
}
