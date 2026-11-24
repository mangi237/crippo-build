import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, X, ArrowRight, Lightbulb } from 'lucide-react';
import { auth, googleProvider } from '../services/firebase';
import { ensureUserProfile } from '../services/firestoreService';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Unified Access screen (Crippo Exchange design, "Unified Auth / Anonymous Trader Setup").
 * One authentication step: Google or email + passkey. Identity (KYC) and MoMo linking
 * happen after sign-in, from the Studio / claim flow.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewHint, setShowNewHint] = useState(true);
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

  const fieldClass =
    'w-full pl-11 pr-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F172A]/40 p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#F8F9FC] rounded-t-[12px] sm:rounded-[12px] p-5 sm:p-7 relative max-h-[94vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#64748B]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center pt-4 pb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9] label-xs">
            Regulated Pan-African Exchange
          </span>
          <h2 className="font-display text-3xl font-bold text-[#1E0B36] mt-4 tracking-tight">
            Crippo<span className="text-[#6C2BD9]">.</span>
          </h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            Own a piece of African talent. Real FCFA, zero virtual tokens.
          </p>
        </div>

        {/* Step indicator: 1 Unified Access -> 2 Identity & MoMo (completed after sign-in) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEF1F8] rounded-full">
          <div className="flex items-center justify-center gap-2 py-2 rounded-full bg-white text-xs font-semibold text-[#0F172A] shadow-sm">
            <span className="w-5 h-5 rounded-full bg-[#1E0B36] text-white text-[10px] flex items-center justify-center">1</span>
            Unified Access
          </div>
          <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-[#64748B]">
            <span className="w-5 h-5 rounded-full bg-[#DAE2FD] text-[#1E0B36] text-[10px] flex items-center justify-center">2</span>
            Trader &amp; MoMo
          </div>
        </div>

        <div className="mt-4 bg-white rounded-[8px] p-5 shadow-[0_1px_3px_0_rgba(30,11,54,0.04)]">
          {showNewHint && mode === 'login' && (
            <div className="flex items-start gap-3 p-4 mb-5 rounded-[8px] bg-[#F2F3FF]">
              <Lightbulb className="w-5 h-5 text-[#6C2BD9] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F172A]">New to Crippo?</p>
                <p className="text-xs text-[#64748B] mt-0.5">No account with this email? We can create one in seconds.</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss hint"
                onClick={() => setShowNewHint(false)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-5 rounded-[4px] bg-[#F2F3FF] hover:bg-[#EAEDFF] disabled:opacity-50 text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="label-xs text-[#64748B]">or email terminal</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 mb-4 bg-[#F8F9FC] rounded-full">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-full transition-colors ${
                mode === 'login' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
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
              className={`py-2 text-xs font-semibold rounded-full transition-colors ${
                mode === 'register' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
              }`}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-[8px] bg-[#FEE2E2] text-xs text-[#93000A] leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label-xs text-[#64748B]">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="As on your national ID"
                  className="mt-1.5 w-full px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]"
                />
              </div>
            )}

            <div>
              <label className="label-xs text-[#64748B]">Corporate / diaspora email</label>
              <div className="relative mt-1.5">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@douala-ventures.cm"
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label-xs text-[#64748B]">Master passkey</label>
                <span className="label-xs text-[#6C2BD9] normal-case tracking-normal">Forgot key?</span>
              </div>
              <div className="relative mt-1.5">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={`${fieldClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide passkey' : 'Show passkey'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-[4px] bg-[#1E0B36] hover:bg-[#4C1D95] disabled:opacity-50 text-white text-sm font-semibold uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Continue to identity & MoMo' : 'Create account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-[8px] bg-white/70 text-xs">
          <span className="flex items-center gap-2 font-semibold text-[#0F172A]">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            LIVE FLOOR IPO
          </span>
          <span className="font-display font-bold text-[#0F172A]">LIBIANCA #LBN</span>
          <span className="num font-semibold text-[#059669]">+14.8%</span>
        </div>
      </div>
    </div>
  );
};
