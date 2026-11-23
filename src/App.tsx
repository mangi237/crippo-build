import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Briefcase,
  CandlestickChart,
  Flame,
  LayoutGrid,
  Percent,
  Sparkles,
  Table2,
  TrendingUp,
  User as UserIcon,
} from 'lucide-react';
import { auth, testConnection } from './services/firebase';
import {
  ensureUserProfile,
  subscribeBrandCampaigns,
  subscribeCreators,
  subscribeMyApplications,
  subscribeNewsPosts,
  subscribeNotifications,
  subscribePredictions,
  subscribeUserPredictionVotes,
  subscribeUserProfile,
  subscribeUserTrades,
  subscribeUserWalletTxs,
} from './services/firestoreService';
import type {
  BrandCampaign,
  Creator,
  CreatorApplication,
  NewsPost,
  NotificationItem,
  PredictionMarket,
  PredictionVote,
  Trade,
  UserProfile,
  WalletTransaction,
} from './types/crippo';
import type { AppLang } from './i18n/translations';
import { translations } from './i18n/translations';
import { formatCompact, formatXAF } from './utils/format';
import { TopTerminalBar } from './components/TopTerminalBar';
import { FeaturedHeroCarousel } from './components/FeaturedHeroCarousel';
import { CreatorMarketCard } from './components/CreatorMarketCard';
import { MarketTableView } from './components/MarketTableView';
import { PredictionMarketCard } from './components/PredictionMarketCard';
import { RaiseDetailView } from './components/RaiseDetailView';
import { PredictionVoteModal } from './components/PredictionVoteModal';
import { NotificationsDrawer, WalletModal } from './components/WalletAndNotifications';
import { TradesView } from './components/TradesView';
import { SearchView } from './components/SearchView';
import { ProfileView } from './components/ProfileView';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';

type WorkspaceTab = 'markets' | 'predictions' | 'portfolio' | 'search' | 'profile';

type MarketCategoryFilter =
  | 'Trending'
  | 'Music & Albums'
  | 'TikTok Series'
  | 'Movies & Docs'
  | 'Podcasts'
  | 'Creators Directory'
  | 'Brand Campaigns'
  | 'Ended Raises';

const MARKET_CATEGORIES: MarketCategoryFilter[] = [
  'Trending',
  'Music & Albums',
  'TikTok Series',
  'Movies & Docs',
  'Podcasts',
  'Creators Directory',
  'Brand Campaigns',
  'Ended Raises',
];

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState<AppLang>('EN');
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.pathname === '/admin'
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('markets');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedCategory, setSelectedCategory] = useState<MarketCategoryFilter>('Trending');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth & User State
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Real-time Exchange State
  const [creators, setCreators] = useState<Creator[]>([]);
  const [predictions, setPredictions] = useState<PredictionMarket[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [brandCampaigns, setBrandCampaigns] = useState<BrandCampaign[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [predictionVotes, setPredictionVotes] = useState<PredictionVote[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>([]);
  const [myApplications, setMyApplications] = useState<CreatorApplication[]>([]);

  // Overlays & Detail Views
  const [selectedRaise, setSelectedRaise] = useState<{ creator: Creator; side: 'BUY' | 'SELL' } | null>(null);
  const [votingPrediction, setVotingPrediction] = useState<{
    prediction: PredictionMarket;
    side: 'YES' | 'NO';
  } | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const t = translations[lang];

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Sync browser /admin URL
  useEffect(() => {
    function handlePopState() {
      setIsAdminRoute(window.location.pathname === '/admin');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigateAdmin(open: boolean) {
    const nextPath = open ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setIsAdminRoute(open);
    setSelectedRaise(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Subscribe to public exchange feeds
  useEffect(() => {
    testConnection();
    const unsubCreators = subscribeCreators(setCreators);
    const unsubPreds = subscribePredictions(setPredictions);
    const unsubNews = subscribeNewsPosts(setNewsPosts);
    const unsubBrands = subscribeBrandCampaigns(setBrandCampaigns);
    return () => {
      unsubCreators();
      unsubPreds();
      unsubNews();
      unsubBrands();
    };
  }, []);

  // Auth listener & private subscriptions
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubTrades: (() => void) | undefined;
    let unsubVotes: (() => void) | undefined;
    let unsubWtx: (() => void) | undefined;
    let unsubApps: (() => void) | undefined;
    let unsubNotifs: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubProfile?.();
      unsubTrades?.();
      unsubVotes?.();
      unsubWtx?.();
      unsubApps?.();
      unsubNotifs?.();

      if (!fbUser) {
        setUser(null);
        setTrades([]);
        setPredictionVotes([]);
        setWalletTxs([]);
        setMyApplications([]);
        unsubNotifs = subscribeNotifications(null, setNotifications);
        setAuthReady(true);
        return;
      }

      try {
        const profile = await ensureUserProfile({
          uid: fbUser.uid,
          email: fbUser.email || '',
          fullName: fbUser.displayName || undefined,
          avatarUrl: fbUser.photoURL || undefined,
        });
        setUser(profile);
      } finally {
        setAuthReady(true);
      }

      unsubProfile = subscribeUserProfile(fbUser.uid, (p) => {
        if (p) setUser(p);
      });
      unsubTrades = subscribeUserTrades(fbUser.uid, setTrades);
      unsubVotes = subscribeUserPredictionVotes(fbUser.uid, setPredictionVotes);
      unsubWtx = subscribeUserWalletTxs(fbUser.uid, setWalletTxs);
      unsubApps = subscribeMyApplications(fbUser.uid, setMyApplications);
      unsubNotifs = subscribeNotifications(fbUser.uid, setNotifications);
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
      unsubTrades?.();
      unsubVotes?.();
      unsubWtx?.();
      unsubApps?.();
      unsubNotifs?.();
    };
  }, []);

  // Compute live portfolio holdings value across net Buy/Sell positions
  const portfolioValueXAF = useMemo(() => {
    const netSharesByCreator = new Map<string, number>();
    for (const tr of trades) {
      const prev = netSharesByCreator.get(tr.creatorId) || 0;
      const delta = tr.side === 'SELL' ? -tr.sharesHeld : tr.sharesHeld;
      netSharesByCreator.set(tr.creatorId, prev + delta);
    }
    let total = 0;
    for (const [creatorId, netShares] of netSharesByCreator.entries()) {
      if (netShares <= 0) continue;
      const liveCreator = creators.find((c) => c.id === creatorId);
      if (liveCreator) {
        total += netShares * liveCreator.sharePriceXAF;
      }
    }
    return total;
  }, [trades, creators]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter Raises based on category & instant search
  const filteredCreators = useMemo(() => {
    return creators.filter((c) => {
      if (normalizedQuery) {
        const hay = `${c.name} ${c.handle} ${c.raiseTitle || ''} ${c.raiseTitleFr || ''} ${c.category} ${c.city || ''}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      if (selectedCategory === 'Ended Raises') return c.status === 'ENDED' || c.status === 'FUNDED';
      if (selectedCategory === 'Trending' || selectedCategory === 'Creators Directory') {
        return c.status !== 'ENDED';
      }
      if (selectedCategory === 'Brand Campaigns') return false;
      return c.category === selectedCategory;
    });
  }, [creators, selectedCategory, normalizedQuery]);

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (!normalizedQuery) return true;
      const hay = `${p.questionEn} ${p.questionFr} ${p.category} ${p.creatorName || ''}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [predictions, normalizedQuery]);

  const topMovers = useMemo(() => {
    return [...creators]
      .sort((a, b) => Math.abs(b.priceChangePct) - Math.abs(a.priceChangePct))
      .slice(0, 5);
  }, [creators]);

  const liveSelectedRaiseCreator = selectedRaise
    ? creators.find((c) => c.id === selectedRaise.creator.id) || selectedRaise.creator
    : null;

  const liveVotingPrediction = votingPrediction
    ? predictions.find((p) => p.id === votingPrediction.prediction.id) || votingPrediction.prediction
    : null;

  function openRaise(creator: Creator, side: 'BUY' | 'SELL' = 'BUY') {
    setSelectedRaise({ creator, side });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-[#F8F7FC] dark:bg-[#0B0514] text-[#11081F] dark:text-[#F8F7FC] transition-colors">
      {/* Sticky Top Exchange Bar + Live Catalyst Ticker */}
      <TopTerminalBar
        user={user}
        portfolioValueXAF={portfolioValueXAF}
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'EN' ? 'FR' : 'EN'))}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (selectedRaise) setSelectedRaise(null);
        }}
        unreadNotifications={notifications.length}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onGoHome={() => {
          navigateAdmin(false);
          setSelectedRaise(null);
          setActiveTab('markets');
          setSelectedCategory('Trending');
          setSearchQuery('');
        }}
        creators={creators}
        catalysts={newsPosts}
        onSelectCreator={(c) => openRaise(c, 'BUY')}
      />

      {/* Desktop Sub-Navigation Bar for Switching Terminal Views */}
      {!isAdminRoute && !liveSelectedRaiseCreator && (
        <div className="hidden md:block border-b border-[#E4DFF2] dark:border-[#2A174A] bg-white/60 dark:bg-[#11081F]/90">
          <div className="max-w-[1440px] mx-auto px-6 h-11 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'markets', label: t.markets },
                { id: 'portfolio', label: t.portfolio },
                { id: 'search', label: lang === 'FR' ? 'Annuaire & Notes' : 'Directory & Memos' },
                { id: 'profile', label: user?.isVerifiedCreator ? 'Creator Studio' : t.profile },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as WorkspaceTab)}
                  className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
                    activeTab === item.id
                      ? 'bg-violet-600 text-white'
                      : 'text-[#645582] dark:text-[#A99BC8] hover:text-[#11081F] dark:hover:text-[#F8F7FC]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {authReady && user && (
              <div className="flex items-center gap-3 text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
                <span>
                  MoMo Cash: <strong className="text-[#11081F] dark:text-[#F8F7FC]">{formatXAF(user.walletBalanceXAF || 0)}</strong>
                </span>
                {user.admin && (
                  <button
                    type="button"
                    onClick={() => navigateAdmin(true)}
                    className="px-2.5 py-1 rounded-lg bg-violet-600/15 text-violet-500 font-semibold hover:bg-violet-600/25"
                  >
                    {t.adminConsole}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-[1440px] mx-auto px-4 md:px-6 pt-5 pb-24 md:pb-10">
        {isAdminRoute ? (
          <AdminDashboard
            user={user}
            creators={creators}
            predictions={predictions}
            onExit={() => navigateAdmin(false)}
          />
        ) : liveSelectedRaiseCreator ? (
          <RaiseDetailView
            creator={liveSelectedRaiseCreator}
            initialSide={selectedRaise?.side}
            user={user}
            lang={lang}
            onBack={() => setSelectedRaise(null)}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        ) : activeTab === 'portfolio' ? (
          <div className="max-w-4xl mx-auto">
            <TradesView
              user={user}
              trades={trades}
              predictionVotes={predictionVotes}
              creators={creators}
              lang={lang}
              onRequireAuth={() => setAuthModalOpen(true)}
              onSelectCreator={(c) => openRaise(c, 'BUY')}
              onGoToMarket={() => setActiveTab('markets')}
              onOpenWallet={() => setWalletOpen(true)}
            />
          </div>
        ) : activeTab === 'search' ? (
          <div className="max-w-4xl mx-auto">
            <SearchView
              user={user}
              creators={creators}
              predictions={predictions}
              lang={lang}
              onSelectCreator={(c, side) => openRaise(c, side || 'BUY')}
              onVotePrediction={(prediction, side) => setVotingPrediction({ prediction, side })}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-3xl mx-auto">
            <ProfileView
              user={user}
              creators={creators}
              myApplications={myApplications}
              lang={lang}
              onRequireAuth={() => setAuthModalOpen(true)}
              onOpenAdmin={() => navigateAdmin(true)}
              onOpenWallet={() => setWalletOpen(true)}
            />
          </div>
        ) : activeTab === 'predictions' ? (
          /* Mobile Dedicated Predictions Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
                {t.predictionMarkets}
              </h1>
              <span className="text-xs text-[#645582] dark:text-[#A99BC8] tabular-nums">
                {filteredPredictions.length} live
              </span>
            </div>

            {filteredPredictions.length === 0 ? (
              <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-8 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
                {t.emptyPredictions}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredPredictions.map((pred) => (
                  <PredictionMarketCard
                    key={pred.id}
                    prediction={pred}
                    lang={lang}
                    onVote={(p, side) => setVotingPrediction({ prediction: p, side })}
                  />
                ))}
              </div>
            )}

            {/* Cultural Catalysts below predictions on mobile */}
            <section className="pt-2 space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                  {t.culturalCatalysts}
                </h2>
              </div>
              <div className="space-y-2.5">
                {newsPosts.slice(0, 6).map((post) => {
                  const linked = creators.find((c) => c.id === post.creatorId);
                  const isPos = (post.impactPct ?? 0) >= 0;
                  return (
                    <div
                      key={post.id}
                      onClick={() => linked && openRaise(linked, 'BUY')}
                      className="cursor-pointer p-3.5 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-violet-500">{post.sourceName}</span>
                        {typeof post.impactPct === 'number' && (
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isPos ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {isPos ? '+' : ''}
                            {post.impactPct}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-[#11081F] dark:text-[#F8F7FC]">{post.headline}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          /* PRIMARY EXCHANGE WORKSPACE: 70% MAIN COLUMN + 30% STICKY INTELLIGENCE RAIL */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT 70% MAIN MARKET COLUMN */}
            <div className="lg:col-span-8 space-y-5">
              {/* Category Filter Strip */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {MARKET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      selectedCategory === cat
                        ? 'bg-violet-600 text-white'
                        : 'bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-[#645582] dark:text-[#A99BC8] hover:border-violet-500/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Featured Kalshi-Style Spotlight Hero Carousel */}
              {selectedCategory === 'Trending' && !normalizedQuery && (
                <FeaturedHeroCarousel
                  creators={creators.filter((c) => c.status !== 'ENDED')}
                  predictions={predictions.filter((p) => p.status === 'OPEN')}
                  lang={lang}
                  onSelectCreator={(c) => openRaise(c, 'BUY')}
                  onVotePrediction={(p, side) => setVotingPrediction({ prediction: p, side })}
                />
              )}

              {/* Brand Campaigns Panel when Brand Campaigns filter selected */}
              {selectedCategory === 'Brand Campaigns' ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC] flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-violet-500" />
                      <span>Brand Sponsorship Deals</span>
                    </h2>
                    <span className="text-xs text-[#645582] dark:text-[#A99BC8] tabular-nums">
                      {brandCampaigns.length} open
                    </span>
                  </div>

                  {brandCampaigns.length === 0 ? (
                    <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-8 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
                      No brand campaigns open yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {brandCampaigns.map((camp) => (
                        <div
                          key={camp.id}
                          className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-violet-500">{camp.brandName}</span>
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-500 font-semibold">
                              {camp.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                            {lang === 'FR' ? camp.titleFr : camp.titleEn}
                          </h3>
                          {camp.deliverable && (
                            <p className="text-xs text-[#645582] dark:text-[#A99BC8] leading-relaxed">
                              {camp.deliverable}
                            </p>
                          )}
                          <div className="pt-2 border-t border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-between text-xs">
                            <span className="text-[#645582] dark:text-[#A99BC8]">Campaign Pool</span>
                            <strong className="font-mono text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                              {formatXAF(camp.budgetXAF)}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : (
                /* Active Raises Grid / Order Table */
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
                        {selectedCategory === 'Trending' ? t.marketsToWatch : selectedCategory}
                      </h2>
                      <span className="text-xs text-[#645582] dark:text-[#A99BC8] tabular-nums">
                        ({filteredCreators.length})
                      </span>
                    </div>

                    {/* Desktop Cards vs Order Table Toggle */}
                    <div className="hidden sm:inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A]">
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                          viewMode === 'cards'
                            ? 'bg-violet-600 text-white'
                            : 'text-[#645582] dark:text-[#A99BC8]'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>{t.cardsView}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold ${
                          viewMode === 'table'
                            ? 'bg-violet-600 text-white'
                            : 'text-[#645582] dark:text-[#A99BC8]'
                        }`}
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        <span>{t.tableView}</span>
                      </button>
                    </div>
                  </div>

                  {filteredCreators.length === 0 ? (
                    <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-8 text-center space-y-4">
                      <div className="w-11 h-11 rounded-2xl bg-violet-600/15 text-violet-500 flex items-center justify-center mx-auto">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                          {t.emptyRaises}
                        </p>
                        <p className="text-xs text-[#645582] dark:text-[#A99BC8] max-w-sm mx-auto">
                          {user?.admin
                            ? 'Open the Exchange Console to publish initial Cameroon creator Raises or approve pending applications.'
                            : 'Request an unlisted creator listing memo or apply to launch your own Raise.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab('search')}
                          className="px-4 py-2.5 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold"
                        >
                          {t.requestListing}
                        </button>
                        {user?.admin && (
                          <button
                            type="button"
                            onClick={() => navigateAdmin(true)}
                            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                          >
                            {t.adminConsole}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : viewMode === 'table' ? (
                    <MarketTableView
                      creators={filteredCreators}
                      lang={lang}
                      onTrade={(c, side) => openRaise(c, side)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredCreators.map((creator) => (
                        <CreatorMarketCard
                          key={creator.id}
                          creator={creator}
                          lang={lang}
                          onTrade={(c, side) => openRaise(c, side || 'BUY')}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Mobile Inline Cultural Predictions Preview so mobile home always showcases Predictions too */}
              {predictions.length > 0 && (
                <section className="lg:hidden space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
                      {t.predictionMarkets}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('predictions')}
                      className="text-xs font-semibold text-violet-500"
                    >
                      View all ({predictions.length})
                    </button>
                  </div>
                  <div className="space-y-3">
                    {filteredPredictions.slice(0, 2).map((pred) => (
                      <PredictionMarketCard
                        key={pred.id}
                        prediction={pred}
                        lang={lang}
                        onVote={(p, side) => setVotingPrediction({ prediction: p, side })}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* RIGHT 30% STICKY MARKET INTELLIGENCE RAIL (DESKTOP) */}
            <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-28 space-y-5">
              {/* 1. Cultural Prediction Markets (Yes / No) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                      {t.predictionMarkets}
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
                    {filteredPredictions.length} live
                  </span>
                </div>

                {filteredPredictions.length === 0 ? (
                  <div className="rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-5 text-xs text-[#645582] dark:text-[#A99BC8] text-center">
                    {t.emptyPredictions}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPredictions.slice(0, 4).map((pred) => (
                      <PredictionMarketCard
                        key={pred.id}
                        prediction={pred}
                        lang={lang}
                        onVote={(p, side) => setVotingPrediction({ prediction: p, side })}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* 2. Cultural Catalysts Feed */}
              <section className="rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-violet-500" />
                    <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                      {t.culturalCatalysts}
                    </h2>
                  </div>
                  <span className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Live #237</span>
                </div>

                {newsPosts.length === 0 ? (
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                    Cultural market catalysts will appear here as creators hit milestones.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E4DFF2] dark:divide-[#2A174A]">
                    {newsPosts.slice(0, 4).map((post) => {
                      const linked = creators.find((c) => c.id === post.creatorId);
                      const isPos = (post.impactPct ?? 0) >= 0;
                      return (
                        <div
                          key={post.id}
                          onClick={() => linked && openRaise(linked, 'BUY')}
                          className={`py-2.5 first:pt-0 last:pb-0 space-y-1 ${
                            linked ? 'cursor-pointer hover:opacity-85' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-violet-500">
                              {post.sourceName} {post.city ? `· ${post.city}` : ''}
                            </span>
                            {typeof post.impactPct === 'number' && (
                              <span
                                className={`font-mono font-bold tabular-nums ${
                                  isPos ? 'text-emerald-500' : 'text-red-500'
                                }`}
                              >
                                {isPos ? '+' : ''}
                                {post.impactPct}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#11081F] dark:text-[#F8F7FC] leading-snug">
                            {post.headline}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 3. Top Movers & Creators Leaderboard */}
              <section className="rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                    {t.topMovers}
                  </h2>
                </div>

                {topMovers.length === 0 ? (
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">No active movers yet.</p>
                ) : (
                  <div className="divide-y divide-[#E4DFF2] dark:divide-[#2A174A]">
                    {topMovers.map((c, idx) => {
                      const isUp = c.priceChangePct >= 0;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openRaise(c, 'BUY')}
                          className="w-full py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-left hover:opacity-85"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 text-[11px] font-mono text-[#645582] dark:text-[#A99BC8] tabular-nums">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC] truncate">
                                {c.name}
                              </div>
                              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
                                Score {c.crippoScore ?? 85} · {formatCompact(c.tradingVolumeXAF)} vol
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 tabular-nums">
                            <div className="text-xs font-mono font-bold text-[#11081F] dark:text-[#F8F7FC]">
                              {formatXAF(c.sharePriceXAF)}
                            </div>
                            <div
                              className={`text-[11px] font-mono font-semibold ${
                                isUp ? 'text-emerald-500' : 'text-red-500'
                              }`}
                            >
                              {isUp ? '+' : ''}
                              {c.priceChangePct}%
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}
      </main>

      {/* Mobile Thumb-Driven Bottom Navigation Bar */}
      {!isAdminRoute && !liveSelectedRaiseCreator && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#11081F]/95 backdrop-blur-md border-t border-[#E4DFF2] dark:border-[#2A174A] px-2 py-1.5"
        >
          <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
            {[
              { id: 'markets', label: t.markets, icon: CandlestickChart },
              { id: 'predictions', label: t.predictions, icon: Percent },
              { id: 'portfolio', label: t.portfolio, icon: Briefcase },
              { id: 'profile', label: t.profile, icon: UserIcon },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as WorkspaceTab);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl min-h-[46px] transition-colors ${
                    active
                      ? 'bg-violet-600/15 text-violet-600 dark:text-violet-400 font-semibold'
                      : 'text-[#645582] dark:text-[#A99BC8]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Prediction Vote Order Modal */}
      <PredictionVoteModal
        prediction={liveVotingPrediction}
        initialSide={votingPrediction?.side || 'YES'}
        user={user}
        lang={lang}
        onClose={() => setVotingPrediction(null)}
        onRequireAuth={() => {
          setVotingPrediction(null);
          setAuthModalOpen(true);
        }}
      />

      {/* Mobile Money Cash Wallet Modal */}
      <WalletModal
        open={walletOpen}
        user={user}
        portfolioValueXAF={portfolioValueXAF}
        transactions={walletTxs}
        lang={lang}
        onClose={() => setWalletOpen(false)}
        onRequireAuth={() => {
          setWalletOpen(false);
          setAuthModalOpen(true);
        }}
      />

      {/* Live Market Alerts Slide-Over Drawer */}
      <NotificationsDrawer
        open={notificationsOpen}
        notifications={notifications}
        lang={lang}
        onClose={() => setNotificationsOpen(false)}
        onSelectCreatorId={(creatorId) => {
          const found = creators.find((c) => c.id === creatorId);
          if (found) openRaise(found, 'BUY');
        }}
      />

      {/* Firebase Authentication Modal */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
