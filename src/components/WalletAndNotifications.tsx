import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Bell, Phone, Wallet, X } from 'lucide-react';
import type { NotificationItem, UserProfile, WalletTransaction } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { executeWalletTransfer } from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface WalletModalProps {
  open: boolean;
  user: UserProfile | null;
  portfolioValueXAF: number;
  transactions: WalletTransaction[];
  lang: AppLang;
  onClose: () => void;
  onRequireAuth: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  open,
  user,
  portfolioValueXAF,
  transactions,
  lang,
  onClose,
  onRequireAuth,
}) => {
  const t = translations[lang];
  const [mode, setMode] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [network, setNetwork] = useState<'MTN MoMo' | 'Orange Money'>(
    user?.momoNetwork || 'MTN MoMo'
  );
  const [phone, setPhone] = useState(user?.momoPhone || '+237 6');
  const [amountXAF, setAmountXAF] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const created = await executeWalletTransfer({
        uid: user.uid,
        type: mode,
        network,
        phone,
        amountXAF,
      });
      setSuccess(
        `${mode === 'DEPOSIT' ? 'Deposited' : 'Withdrew'} ${formatXAF(created.amountXAF)} via ${network} (${created.reference}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-6 space-y-5 max-h-[92vh] overflow-y-auto relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet"
          className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#11081F] dark:text-[#F8F7FC]">{t.wallet}</h2>
            <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
              MTN MoMo & Orange Money Settlement
            </p>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
            <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Cash Wallet</div>
            <div className="text-lg font-bold font-mono text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
              {formatXAF(user?.walletBalanceXAF || 0)}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
            <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.portfolio}</div>
            <div className="text-lg font-bold font-mono text-emerald-500 tabular-nums mt-0.5">
              {formatXAF(portfolioValueXAF)}
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
          <button
            type="button"
            onClick={() => setMode('DEPOSIT')}
            className={`py-2 rounded-xl text-xs font-bold ${
              mode === 'DEPOSIT' ? 'bg-violet-600 text-white' : 'text-[#645582] dark:text-[#A99BC8]'
            }`}
          >
            {t.depositMomo}
          </button>
          <button
            type="button"
            onClick={() => setMode('WITHDRAW')}
            className={`py-2 rounded-xl text-xs font-bold ${
              mode === 'WITHDRAW' ? 'bg-violet-600 text-white' : 'text-[#645582] dark:text-[#A99BC8]'
            }`}
          >
            {t.withdrawMomo}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            {(['MTN MoMo', 'Orange Money'] as const).map((net) => (
              <button
                key={net}
                type="button"
                onClick={() => setNetwork(net)}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border ${
                  network === net
                    ? 'bg-violet-600/15 border-violet-500 text-violet-500'
                    : 'bg-[#F8F7FC] dark:bg-[#11081F] border-[#E4DFF2] dark:border-[#2A174A] text-[#645582] dark:text-[#A99BC8]'
                }`}
              >
                {net}
              </button>
            ))}
          </div>

          <div className="relative">
            <Phone className="w-4 h-4 text-[#7E6FA1] absolute left-3.5 top-3.5" />
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+237 6XX XXX XXX"
              className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[5000, 10000, 25000, 50000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountXAF(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border ${
                  amountXAF === preset
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-[#F8F7FC] dark:bg-[#11081F] border-[#E4DFF2] dark:border-[#2A174A]'
                }`}
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>

          <input
            type="number"
            min={500}
            step={500}
            required
            value={amountXAF}
            onChange={(e) => setAmountXAF(Number(e.target.value))}
            className="w-full px-4 py-3 text-sm font-mono rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] focus:outline-none focus:border-violet-500 tabular-nums"
          />

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            {busy
              ? 'Processing...'
              : `${mode === 'DEPOSIT' ? t.depositMomo : t.withdrawMomo} · ${formatXAF(amountXAF)}`}
          </button>
        </form>

        {/* Recent Ledger */}
        {transactions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E4DFF2] dark:border-[#2A174A]">
            <div className="text-xs font-semibold text-[#645582] dark:text-[#A99BC8]">Recent Ledger</div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {transactions.slice(0, 6).map((tx) => {
                const isCredit = tx.type === 'DEPOSIT' || tx.type === 'TRADE_SELL' || tx.type === 'ROYALTY_PAYOUT';
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isCredit ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {tx.type.replace('_', ' ')} · {tx.network}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        isCredit ? 'text-emerald-500' : 'text-[#11081F] dark:text-[#F8F7FC]'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatXAF(tx.amountXAF)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface NotificationsDrawerProps {
  open: boolean;
  notifications: NotificationItem[];
  lang: AppLang;
  onClose: () => void;
  onSelectCreatorId?: (creatorId: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  open,
  notifications,
  lang,
  onClose,
  onSelectCreatorId,
}) => {
  const t = translations[lang];
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#180D2B] border-l border-[#E4DFF2] dark:border-[#2A174A] p-6 flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[#E4DFF2] dark:border-[#2A174A]">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-violet-500" />
            <h2 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">{t.notifications}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
              No live price spikes, catalyst alerts, or escrow releases yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.creatorId && onSelectCreatorId) {
                    onSelectCreatorId(n.creatorId);
                    onClose();
                  }
                }}
                className={`p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] space-y-1 ${
                  n.creatorId && onSelectCreatorId ? 'cursor-pointer hover:border-violet-500/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500">
                    {n.kind.replace('_', ' ')}
                  </span>
                  {n.deltaPct !== undefined && (
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${
                        n.deltaPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}
                    >
                      {n.deltaPct >= 0 ? '+' : ''}
                      {n.deltaPct}%
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-[#11081F] dark:text-[#F8F7FC]">
                  {lang === 'FR' ? n.titleFr : n.titleEn}
                </div>
                {(n.bodyEn || n.bodyFr) && (
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                    {lang === 'FR' ? n.bodyFr || n.bodyEn : n.bodyEn}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
