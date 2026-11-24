import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Bell, X } from 'lucide-react';
import type { NotificationItem, UserProfile, WalletTransaction } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { executeWalletTransfer } from '../services/firestoreService';
import { formatXAF } from '../utils/format';

/* ---------- MoMo wallet sheet ---------- */

interface WalletModalProps {
  open: boolean;
  user: UserProfile | null;
  portfolioValueXAF: number;
  transactions: WalletTransaction[];
  lang: AppLang;
  onClose: () => void;
  onRequireAuth: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000] as const;

export const WalletModal: React.FC<WalletModalProps> = ({ open, user, portfolioValueXAF, transactions, lang, onClose, onRequireAuth }) => {
  const isFr = lang === 'FR';
  const [mode, setMode] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [network, setNetwork] = useState<'MTN MoMo' | 'Orange Money'>('MTN MoMo');
  const [phone, setPhone] = useState(user?.momoPhone || '');
  const [amount, setAmount] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!open) return null;

  async function submit() {
    setError(null);
    setOk(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    if (amount < 500) {
      setError(isFr ? 'Minimum 500 FCFA.' : 'Minimum is 500 XAF.');
      return;
    }
    if (mode === 'WITHDRAW' && amount > (user.walletBalanceXAF || 0)) {
      setError(isFr ? 'Solde insuffisant.' : 'Insufficient cash balance.');
      return;
    }
    setBusy(true);
    try {
      await executeWalletTransfer({ uid: user.uid, type: mode, network, phone, amountXAF: amount });
      setOk(isFr ? 'Confirmez l’invite USSD sur votre téléphone.' : 'Approve the USSD prompt on your phone.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0F172A]/40">
      <div className="w-full max-w-md bg-[#F8F9FC] rounded-t-[12px] sm:rounded-[12px] p-5 max-h-[92vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isFr ? 'Portefeuille MoMo' : 'MoMo wallet'}</h2>
          <button type="button" onClick={onClose} aria-label="Close wallet" className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="card p-5 grid grid-cols-2 gap-4">
          <div>
            <p className="label-xs text-[#64748B]">{isFr ? 'Solde espèces' : 'Cash balance'}</p>
            <p className="num font-display text-xl font-bold mt-1">{formatXAF(user?.walletBalanceXAF || 0)}</p>
          </div>
          <div>
            <p className="label-xs text-[#64748B]">{isFr ? 'Valeur des parts' : 'Holdings value'}</p>
            <p className="num font-display text-xl font-bold mt-1 text-[#6C2BD9]">{formatXAF(portfolioValueXAF)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-[#EEF1F8] rounded-[8px]">
          <button type="button" onClick={() => setMode('DEPOSIT')} className={`py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-2 ${mode === 'DEPOSIT' ? 'bg-white shadow-sm' : 'text-[#64748B]'}`}>
            <ArrowDownToLine className="w-4 h-4" /> {isFr ? 'Déposer' : 'Deposit'}
          </button>
          <button type="button" onClick={() => setMode('WITHDRAW')} className={`py-2.5 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-2 ${mode === 'WITHDRAW' ? 'bg-white shadow-sm' : 'text-[#64748B]'}`}>
            <ArrowUpFromLine className="w-4 h-4" /> {isFr ? 'Retirer' : 'Withdraw'}
          </button>
        </div>

        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['MTN MoMo', 'Orange Money'] as const).map((n) => (
              <button key={n} type="button" onClick={() => setNetwork(n)} className={`py-2.5 rounded-[4px] text-xs font-semibold border ${network === n ? 'border-[#6C2BD9]' : 'border-[#E2E8F0]'}`}>
                {n}
              </button>
            ))}
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6xx xxx xxx" className="w-full px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] num focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
          <input type="number" min={500} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="w-full px-4 py-3 text-sm bg-[#F8F9FC] border border-[#E2E8F0] rounded-[4px] num focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]" />
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => setAmount(a)} className={`py-2 rounded-[4px] text-[11px] font-semibold num ${amount === a ? 'bg-[#1E0B36] text-white' : 'bg-[#F2F3FF]'}`}>
                {a / 1000}k
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-[#DC2626]">{error}</p>}
          {ok && <p className="text-xs text-[#059669] font-semibold">{ok}</p>}
          <button type="button" onClick={submit} disabled={busy} className="w-full py-3.5 rounded-[4px] bg-[#1E0B36] text-white text-sm font-semibold uppercase tracking-wide disabled:opacity-40">
            {!user ? (isFr ? 'Connectez-vous' : 'Sign in') : busy ? '…' : mode === 'DEPOSIT' ? (isFr ? 'Déposer' : 'Deposit') : isFr ? 'Retirer' : 'Withdraw'}
          </button>
        </div>

        <div className="card p-4 space-y-2">
          <h3 className="font-display text-sm font-semibold">{isFr ? 'Historique' : 'Transactions'}</h3>
          {transactions.length === 0 ? (
            <p className="text-xs text-[#64748B]">{isFr ? 'Aucune transaction.' : 'No transactions yet.'}</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {transactions.slice(0, 12).map((tx) => {
                const credit = tx.type === 'DEPOSIT' || tx.type === 'TRADE_SELL' || tx.type === 'ROYALTY_PAYOUT';
                return (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-[#64748B] num truncate">{tx.network} · {tx.reference}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`num font-semibold ${credit ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                        {credit ? '+' : '−'}
                        {formatXAF(tx.amountXAF)}
                      </p>
                      <p className="label-xs text-[#64748B]">{tx.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Alerts drawer ---------- */

interface NotificationsDrawerProps {
  open: boolean;
  notifications: NotificationItem[];
  lang: AppLang;
  onClose: () => void;
  onSelectCreatorId: (creatorId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ open, notifications, lang, onClose, onSelectCreatorId }) => {
  const isFr = lang === 'FR';
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/30">
      <div className="w-full max-w-sm h-full bg-[#F8F9FC] p-5 overflow-y-auto space-y-4 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#6C2BD9]" /> {isFr ? 'Alertes' : 'Alerts'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close alerts" className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-[#64748B]">{isFr ? 'Aucune alerte pour le moment.' : 'No alerts right now.'}</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => n.creatorId && onSelectCreatorId(n.creatorId)}
              className="w-full text-left card p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="label-xs text-[#6C2BD9]">{n.kind.replace(/_/g, ' ')}</span>
                {typeof n.deltaPct === 'number' && (
                  <span className={`num text-xs font-semibold ${n.deltaPct >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    {n.deltaPct >= 0 ? '+' : ''}
                    {n.deltaPct}%
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold">{isFr ? n.titleFr : n.titleEn}</p>
              {(isFr ? n.bodyFr : n.bodyEn) && <p className="text-xs text-[#64748B] leading-relaxed">{isFr ? n.bodyFr : n.bodyEn}</p>}
              <p className="num text-[10px] text-[#64748B]">{new Date(n.createdAt).toLocaleString()}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
