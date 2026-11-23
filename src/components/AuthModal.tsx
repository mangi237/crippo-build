import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Lock, Mail, X } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import { ensureUserProfile } from '../services/firestoreService';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile({
        uid: cred.user.uid,
        email: cred.user.email || '',
        fullName: cred.user.displayName || undefined,
        avatarUrl: cred.user.photoURL || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        await ensureUserProfile({
          uid: cred.user.uid,
          email: cred.user.email || email.trim(),
          fullName: fullName.trim() || undefined,
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile({
          uid: cred.user.uid,
          email: cred.user.email || email.trim(),
          fullName: cred.user.displayName || undefined,
        });
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      if (msg.includes('operation-not-allowed')) {
        setError('Use Google Sign-In above, or enable Email/Password in your authentication provider settings.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#645582] dark:text-[#A99BC8]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-10">
          <h2 className="text-xl font-bold text-[#11081F] dark:text-[#F8F7FC]">
            {mode === 'login' ? 'Sign in to Crippo' : 'Create your Crippo account'}
          </h2>
          <p className="text-xs text-[#645582] dark:text-[#A99BC8] mt-1">
            Trade creator Raises, vote on cultural predictions, and manage MoMo settlements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="mt-5 w-full py-3.5 px-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#E4DFF2] dark:bg-[#2A174A]" />
          <span className="text-xs font-medium text-[#645582] dark:text-[#A99BC8]">or email</span>
          <div className="flex-1 h-px bg-[#E4DFF2] dark:bg-[#2A174A]" />
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-[#180D2B] text-[#11081F] dark:text-white'
                : 'text-[#645582] dark:text-[#A99BC8]'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-[#180D2B] text-[#11081F] dark:text-white'
                : 'text-[#645582] dark:text-[#A99BC8]'
            }`}
          >
            Sign up
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-4 space-y-3.5">
          {mode === 'register' && (
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
          )}

          <div className="relative">
            <Mail className="w-4 h-4 text-[#7E6FA1] absolute left-4 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full pl-11 pr-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="relative">
            <Lock className="w-4 h-4 text-[#7E6FA1] absolute left-4 top-3.5" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="w-full pl-11 pr-4 py-3 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl focus:outline-none focus:border-violet-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
};
