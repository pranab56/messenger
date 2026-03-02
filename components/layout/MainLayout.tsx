"use client";

import Header from './Header';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/20 transition-colors duration-300 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <main className="flex-1 p-0 overflow-hidden">
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

