'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface UserProfile {
  name?: string;
  profileImage?: string;
}

interface CallOverlayProps {
  isOpen: boolean;
  onHangup: () => void;
  user: UserProfile | null;
  isIncoming?: boolean;
  onAccept?: () => void;
}

export default function CallOverlay({ isOpen, onHangup, user, isIncoming, onAccept }: CallOverlayProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isOpen && !isIncoming) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, isIncoming]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-8 right-8 z-50"
        >
          <Card className="w-80 overflow-hidden shadow-2xl border-none bg-background/80 backdrop-blur-xl ring-1 ring-primary/20">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-none" />

            <div className="p-8 flex flex-col items-center gap-4 relative">
              <div className="relative">
                <Avatar className="w-24 h-24 ring-4 ring-primary/10 shadow-xl">
                  <AvatarImage src={user?.profileImage} />
                  <AvatarFallback className="bg-primary/5 text-primary text-3xl font-bold">
                    {user?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {isOpen && !isIncoming && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 ring-4 ring-primary rounded-full"
                  />
                )}
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold">{user?.name}</h3>
                <p className="text-sm text-primary font-medium">
                  {isIncoming ? 'Incoming Call...' : formatDuration(duration)}
                </p>
              </div>

              <div className="flex gap-4 mt-4">
                {isIncoming ? (
                  <>
                    <Button
                      onClick={onAccept}
                      className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30"
                      size="icon"
                    >
                      <Phone className="w-6 h-6 fill-current" />
                    </Button>
                    <Button
                      onClick={onHangup}
                      className="w-14 h-14 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/30"
                      size="icon"
                    >
                      <PhoneOff className="w-6 h-6 fill-current" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setIsMuted(!isMuted)}
                      className={`w-12 h-12 rounded-full border-primary/20 transition-all ${isMuted ? 'bg-primary/20 border-primary' : ''}`}
                      size="icon"
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </Button>
                    <Button
                      onClick={onHangup}
                      className="w-14 h-14 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/30"
                      size="icon"
                    >
                      <PhoneOff className="w-6 h-6 fill-current" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsSpeaker(!isSpeaker)}
                      className={`w-12 h-12 rounded-full border-primary/20 transition-all ${!isSpeaker ? 'bg-primary/20 border-primary' : ''}`}
                      size="icon"
                    >
                      {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
