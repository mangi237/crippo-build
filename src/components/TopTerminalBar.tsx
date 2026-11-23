import React from 'react';
import { Bell, Search, Wallet } from 'lucide-react';
import type { Creator, NewsPost, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatXAF } from '../utils/format';

interface TopTerminalBarProps {
  user: UserProfile | null;
  portfolioValueXAF: number;
  lang: AppLang;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onOpenWallet: () => void;
  onOpenAuth: () => void;
  onGoHome: () => void;
  creators: Creator[];
  catalysts: NewsPost[];
  onSelectCreator: (creator: Creator) => void;
}

export const TopTerminalBar: React.FC<TopTerminalBarProps> = ({
  user,
  portfolioValueXAF,
  lang,
  searchQuery,
  onSearchChange,
  unreadNotifications,
  onOpenNotifications,
  onOpenWallet,
  onOpenAuth,
  onGoHome,
  creators,
  catalysts,
  onSelectCreator,
}) => {
  const t = translations[lang];

  const tickerItems = [
    ...creators.slice(0, 8).map((c) => ({
      id: `cr_${c.id}`,
      creator: c,
      city: (c.city || '237').toUpperCase(),
      label: `${c.name} ${c.raiseTitle ? `— ${c.raiseTitle}` : ''}`.trim(),
      price: formatXAF(c.sharePriceXAF),
      deltaPct: c.priceChangePct,
    })),
    ...catalysts.slice(0, 6).map((n) => ({
      id: `cat_${n.id}`,
      creator: creators.find((c) => c.id === n.creatorId),
      city: (n.city || 'PULSE').toUpperCase(),
      label: `${n.headline}`,
      price: n.sourceName,
      deltaPct: n.impactPct ?? 0,
    })),
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F8F7FC] dark:bg-[#0B0514] border-b border-[#E4DFF2] dark:border-[#2A174A]">
      {/* Desktop Top Exchange Bar */}
      <div className="hidden md:flex max-w-[1440px] mx-auto px-6 h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight whitespace-nowrap"
          >
            <span className="w-9 h-9 rounded-full bg-violet-600 text-white font-extrabold text-sm flex items-center justify-center">
              C
            </span>
            <span className="text-[#11081F] dark:text-[#F8F7FC]">Crippo</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t.marketOpen}
          </span>
        </div>

        {/* Center: Taller Instant Search Bar */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 text-[#6E608D] dark:text-[#9686B8] absolute left-5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full h-12 pl-12 pr-5 text-sm rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-[#11081F] dark:text-[#F8F7FC] placeholder:text-[#7E6FA1] focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Right: Alerts + Wallet / Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={t.notifications}
            className="relative w-11 h-11 rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC] hover:border-violet-500"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>

          {user ? (
            <button
              type="button"
              onClick={onOpenWallet}
              className="flex items-center gap-2 h-11 px-5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors whitespace-nowrap tabular-nums"
            >
              <Wallet className="w-4 h-4" />
              <span>{formatXAF((user.walletBalanceXAF || 0) + portfolioValueXAF)}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-11 px-5 rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC] hover:border-violet-500 whitespace-nowrap"
              >
                {t.logIn}
              </button>
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-11 px-5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold whitespace-nowrap"
              >
                {t.signUp}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Header + Taller Rounded Search Bar */}
      <div className="md:hidden px-4 pt-3.5 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onGoHome} className="flex items-center gap-2 font-bold text-base">
            <span className="w-8 h-8 rounded-full bg-violet-600 text-white font-extrabold text-sm flex items-center justify-center">
              C
            </span>
            <span className="text-[#11081F] dark:text-[#F8F7FC]">Crippo</span>
          </button>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={onOpenWallet}
                className="h-9 px-3.5 rounded-full bg-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{formatXAF(user.walletBalanceXAF || 0)}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-9 px-4 rounded-full bg-violet-600 text-white text-xs font-semibold"
              >
                {t.logIn}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label={t.notifications}
              className="relative w-9 h-9 rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC]"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#7E6FA1] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.mobileSearchPlaceholder}
            className="w-full h-12 pl-11 pr-4 text-sm rounded-full bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-[#11081F] dark:text-[#F8F7FC] placeholder:text-[#7E6FA1] focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Live Catalyst Ticker (Pure Solid Surface) */}
      {tickerItems.length > 0 && (
        <div className="border-t border-[#E4DFF2] dark:border-[#2A174A] bg-white dark:bg-[#11081F] overflow-hidden py-1.5">
          <div className="animate-crippo-ticker items-center gap-6 px-4 text-xs">
            {[...tickerItems, ...tickerItems].map((item, idx) => {
              const isUp = item.deltaPct >= 0;
              return (
                <button
                  key={`${item.id}_${idx}`}
                  type="button"
                  onClick={() => item.creator && onSelectCreator(item.creator)}
                  className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 hover:opacity-80"
                >
                  <span className="font-mono text-[10px] font-bold text-violet-600 dark:text-violet-400">
                    [{item.city}]
                  </span>
                  <span className="font-medium text-[#11081F] dark:text-[#F8F7FC]">{item.label}</span>
                  <span className="font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
                    {item.price}
                  </span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      isUp ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {isUp ? '▲ +' : '▼ '}
                    {item.deltaPct}%
                  </span>
                  <span className="text-[#D6CEE8] dark:text-[#2A174A]" aria-hidden="true">
                    •
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
