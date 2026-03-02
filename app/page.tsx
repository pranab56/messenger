'use client';

import MainLayout from '@/components/layout/MainLayout';
import ChatSidebar from '@/components/messages/ChatSidebar';
import ChatWindow from '@/components/messages/ChatWindow';
import { useSocket } from '@/providers/socket-provider';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Normalize any MongoDB ObjectId / string to a plain string
const toStr = (id: string | { $oid: string } | { toString: () => string } | undefined | null): string => {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (typeof id === 'object') {
    if ('$oid' in id) return id.$oid;
    if (typeof id.toString === 'function') return id.toString();
  }
  return String(id);
};

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

interface Participant {
  _id: string;
  name: string;
  profileImage?: string;
  onlineStatus?: string;
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
  isBlocked?: boolean;
  groupImage?: string;
  updatedAt: string;
  pinnedMessageId?: string | null;
}

interface Request {
  _id: string;
  senderId: { _id: string; name: string; profileImage?: string };
  receiverId: string;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  profileImage?: string;
}

export default function MessagesRootPage() {
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Refs to always have the latest values in event callbacks without stale closures
  const currentUserRef = useRef<User | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const convRef = useRef<Conversation[]>([]);

  useEffect(() => {
    audioRef.current = new Audio('/audio/audio.mp3');
  }, []);

  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { selectedConvRef.current = selectedConversation; }, [selectedConversation]);
  useEffect(() => { convRef.current = conversations; }, [conversations]);

  // ─── Data Fetchers ───────────────────────────────────────────────
  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/me');
      setCurrentUser(res.data.user);
      return res.data.user;
    } catch (err) {
      console.error('[MessagesPage] Failed to fetch user', err);
      return null;
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get('/api/requests');
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('[MessagesPage] Failed to fetch requests', err);
    }
  }, []);

  const fetchConversations = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await axios.get('/api/conversations');
      const newConversations = res.data.conversations;
      setConversations(newConversations);

      const selConv = selectedConvRef.current;
      if (selConv) {
        const stillExists = newConversations.find((c: Conversation) => toStr(c._id) === toStr(selConv._id));
        if (!stillExists) setSelectedConversation(null);
      }
    } catch (err) {
      console.error('[MessagesPage] Failed to fetch conversations', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // ─── Initial Load ────────────────────────────────────────────────
  useEffect(() => {
    fetchCurrentUser();
    fetchConversations(true);
    fetchRequests();
  }, [fetchConversations, fetchCurrentUser, fetchRequests]);

  // ─── Join personal room whenever we have both socket + user ──────
  useEffect(() => {
    if (!socket || !currentUser) return;

    const uId = toStr(currentUser.id || currentUser._id);
    if (!uId) return;

    const joinPersonalRoom = () => {
      console.log('[MessagesPage] 👤 Joining personal room:', uId);
      socket.emit('join-user', uId);
    };

    if (socket.connected) {
      joinPersonalRoom();
    }

    socket.on('connect', joinPersonalRoom);
    socket.on('reconnect', joinPersonalRoom);

    return () => {
      socket.off('connect', joinPersonalRoom);
      socket.off('reconnect', joinPersonalRoom);
    };
  }, [socket, currentUser]);

  // ─── Socket Event Listeners ──────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const fetch = fetchConversations;
    const requestsFetch = fetchRequests;

    const handleIncomingMessage = (message: Message) => {
      const msgConvId = toStr(message.conversationId);
      setConversations(prev => {
        const exists = prev.find(c => toStr(c._id) === msgConvId);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        const isCurrentlyOpen = toStr(selectedConvRef.current?._id) === msgConvId;
        if (isCurrentlyOpen) {
          axios.post('/api/conversations/read', { conversationId: msgConvId }).catch(() => { });
          if (socket) socket.emit('mark-read', { conversationId: msgConvId });
        }

        return prev
          .map(conv => {
            if (toStr(conv._id) !== msgConvId) return conv;
            const senderId = typeof message.senderId === 'object' ? toStr(message.senderId._id) : toStr(message.senderId);
            const myId = toStr(currentUserRef.current?._id || currentUserRef.current?.id);
            const isSentByMe = senderId === myId;
            return {
              ...conv,
              lastMessage: message,
              updatedAt: new Date().toISOString(),
              unreadCount: (isCurrentlyOpen || isSentByMe) ? 0 : (conv.unreadCount || 0) + 1
            };
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    };

    const onReceiveMessage = (message: Message) => handleIncomingMessage(message);
    const onNewMessageNotification = async (message: Message) => {
      handleIncomingMessage(message);
      const user = currentUserRef.current;
      const senderId = typeof message.senderId === 'object' ? toStr(message.senderId._id) : toStr(message.senderId);
      const myId = toStr(user?.id);
      if (senderId && myId && senderId !== myId) {
        const conv = convRef.current.find((c) => toStr(c._id) === toStr(message.conversationId));
        const isMuted = conv ? conv.isMuted : false;
        if (!isMuted) {
          const senderName = typeof message.senderId === 'object' ? message.senderId.name : 'someone';
          toast.info(`New message from ${senderName}`);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
          }
        }
      }
    };
    const onReceiveInvite = (data: { senderName: string }) => {
      toast.info(`New message request from ${data.senderName}`);
      requestsFetch();
    };
    const onReceiveInviteAccepted = (data: { receiverName: string }) => {
      toast.success(`${data.receiverName} accepted your invite`);
      fetch();
      requestsFetch();
    };
    const onConversationCreated = () => fetch();
    const onConversationDeleted = () => fetch();
    const onMessageRead = () => fetch();
    const onPresenceUpdate = ({ userId, status }: { userId: string; status: string }) => {
      const uId = toStr(userId);
      setConversations(prev => prev.map(conv => {
        if (conv.isGroup) return conv;
        return {
          ...conv,
          participants: conv.participants.map((p) =>
            toStr(p._id) === uId ? { ...p, onlineStatus: status } : p
          ),
        };
      }));
    };

    socket.on('receive-message', onReceiveMessage);
    socket.on('new-message-notification', onNewMessageNotification);
    socket.on('receive-invite', onReceiveInvite);
    socket.on('receive-invite-accepted', onReceiveInviteAccepted);
    socket.on('conversation-created', onConversationCreated);
    socket.on('conversation-deleted', onConversationDeleted);
    socket.on('presence-update', onPresenceUpdate);
    socket.on('message-read', onMessageRead);

    return () => {
      socket.off('receive-message', onReceiveMessage);
      socket.off('new-message-notification', onNewMessageNotification);
      socket.off('receive-invite', onReceiveInvite);
      socket.off('receive-invite-accepted', onReceiveInviteAccepted);
      socket.off('conversation-created', onConversationCreated);
      socket.off('conversation-deleted', onConversationDeleted);
      socket.off('presence-update', onPresenceUpdate);
      socket.off('message-read', onMessageRead);
    };
  }, [socket, fetchConversations, fetchRequests]);

  return (
    <MainLayout>
      <div className="flex h-full overflow-hidden bg-background">
        <ChatSidebar
          conversations={conversations}
          requests={requests}
          onSelect={(conv) => {
            setSelectedConversation(conv);
            setConversations(prev => prev.map(c =>
              toStr(c._id) === toStr(conv._id) ? { ...c, unreadCount: 0 } : c
            ));
          }}
          selectedId={selectedConversation?._id}
          loading={loading}
          currentUser={currentUser}
          onConversationCreated={() => {
            fetchConversations();
            fetchRequests();
          }}
          isConnected={isConnected}
        />

        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            currentUser={currentUser}
            onMessageSent={(msg) => {
              setConversations(prev => {
                const updated = prev.map(c =>
                  toStr(c._id) === toStr(msg.conversationId)
                    ? { ...c, lastMessage: msg, updatedAt: new Date().toISOString(), unreadCount: 0 }
                    : c
                );
                return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
              });
            }}
            onBack={() => setSelectedConversation(null)}
          />
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground p-8 bg-muted/10 h-full w-full">
            <div className="w-24 h-24 mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Select a conversation</h2>
            <p className="max-w-xs text-center mt-2">
              Choose a contact from the sidebar or search for new people to start messaging.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
