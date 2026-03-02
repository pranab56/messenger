"use client";

import { useGetMeQuery, useLogoutMutation } from '@/features/auth/authApi';
import { Loader2, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
  const { data, isLoading } = useGetMeQuery(undefined);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout(undefined).unwrap();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userName = data?.user?.name || 'User';
  const initial = userName.charAt(0).toUpperCase();
  const profileImage = data?.user?.profileImage;

  return (
    <header className="h-20 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-50">
      <div className="flex items-center space-x-2 md:space-x-4">
        <h1 className="text-xl font-bold tracking-tight text-primary">Messenger</h1>

        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent/30 border border-border/50 text-muted-foreground hover:text-primary transition-all cursor-pointer active:scale-95"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 transition-all rotate-0 scale-100" />
            ) : (
              <Moon className="w-5 h-5 transition-all rotate-0 scale-100" />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center space-x-3 md:space-x-6">
        <div className="flex items-center space-x-2 md:space-x-3 bg-accent/50 p-1 md:p-1.5 rounded-xl pl-2 md:pl-3">
          <div className="flex flex-col items-end mr-1">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            ) : (
              <span className="text-[10px] md:text-xs font-bold leading-none uppercase truncate max-w-[80px] md:max-w-[120px]">{userName}</span>
            )}
            <span className="text-[9px] md:text-[10px] text-green-500 font-medium tracking-wider">ACTIVE</span>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black shadow-inner overflow-hidden relative border border-border/10">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : profileImage ? (
              <Image
                src={profileImage}
                alt={userName}
                fill
                className="object-cover"
              />
            ) : (
              initial
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="p-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all cursor-pointer border border-transparent hover:border-destructive/20"
          title="Sign Out"
        >
          {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}

