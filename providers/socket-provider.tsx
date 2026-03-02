'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io as ClientIO, Socket } from 'socket.io-client';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  refresh: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  refresh: () => { },
});

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [counter, setCounter] = useState(0);

  const refresh = () => {
    console.log('[SOCKET-PROVIDER] 🔄 Manually refreshing socket connection');
    setCounter(prev => prev + 1);
  };

  useEffect(() => {
    console.log('[SOCKET-PROVIDER] 🔌 Initializing socket connection | count:', counter);

    const socketInstance: Socket = ClientIO({
      transports: ['websocket', 'polling'], // Prioritize websocket for speed, fallback to polling
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20, // Don't try forever if it's really down
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      forceNew: true, // Force a fresh connection on mount/refresh
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET-PROVIDER] ✅ Connected! ID:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('connect_error', (error: Error) => {
      console.error('[SOCKET-PROVIDER] ❌ Connection error:', error.message);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attempt: number) => {
      console.log(`[SOCKET-PROVIDER] 🔄 Reconnected after ${attempt} attempt(s)`);
      setIsConnected(true);
    });

    socketInstance.on('reconnect_attempt', (attempt: number) => {
      console.log(`[SOCKET-PROVIDER] 🔄 Reconnecting... attempt ${attempt}`);
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.log('[SOCKET-PROVIDER] ⚠️ Disconnected:', reason);
      setIsConnected(false);
      // If server forcibly disconnected, reconnect manually
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    setSocket(socketInstance);

    return () => {
      console.log('[SOCKET-PROVIDER] 🧹 Cleaning up socket');
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
    };
  }, [counter]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, refresh }}>
      {children}
    </SocketContext.Provider>
  );
};
