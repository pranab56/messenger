import { TooltipProvider } from "@/components/ui/tooltip";
import StoreProvider from "@/providers/StoreProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SocketProvider } from "@/providers/socket-provider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Messenger",
  description: "Messenger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <SocketProvider>
              <StoreProvider>
                {children}
                <Toaster richColors position="top-right" />
              </StoreProvider>
            </SocketProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

