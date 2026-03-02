'use client';

import { useSocket } from '@/providers/socket-provider';
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const formRef = useRef(null);

  const { refresh } = useSocket();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Refresh socket to pick up new session cookies
      refresh();

      // Success logic - redirect to messages
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (

    <div>
      {/* Right Side: Login Form */}
      <div className="flex items-center justify-center min-h-screen bg-background p-4 md:p-6">
        <div ref={formRef} className="w-full max-w-md space-y-6 md:space-y-8 px-6 md:px-8 py-8 md:py-10 rounded-xl shadow-lg bg-card border border-border">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold">Sign In</h2>
            <p className="text-muted-foreground mt-2 text-sm md:text-base italic">Authorized Users Only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none group-focus-within:text-primary transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-medium">Password</label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none group-focus-within:text-primary transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold flex items-center justify-center cursor-pointer gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <LogIn size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>  </div>

  );
}
