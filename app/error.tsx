'use client';

import { AlertCircle, Home, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        {error.message || "We encountered an unexpected error. Please try again or return to the dashboard."}
      </p>
      <div className="flex items-center space-x-4">
        <button
          onClick={reset}
          className="flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="flex items-center space-x-2 bg-secondary text-secondary-foreground px-6 py-2.5 rounded-lg hover:bg-secondary/80 transition-colors font-medium"
        >
          <Home className="w-4 h-4" />
          <span>Back Home</span>
        </Link>
      </div>
    </div>
  );
}