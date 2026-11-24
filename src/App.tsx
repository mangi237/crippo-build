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
  Wallet,
} from 'lucide-react';
import { auth, testConnection } from './services/firebase';
import {
  ensureUserProfile,
  subscribeBrandCampaigns,
  subscribeCreators,
  subscribeMyApplications,
  subscribeMyBrandApplications,
  subscribeNewsPosts,
  subscribeNotifications,
  subscribePredictions,
  subscribeUserPredictionVotes,
  subscribeUserProfile,
  subscribeUserTrades,
  subscribeUserWalletTxs,
} from './services/firestoreService';
import type {
  BrandApplication,
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
import { RaceDetail } from './components/RaceDetail';
import { CreatorDossier } from './components/CreatorDossier';
import { PredictionSheet } from './components/PredictionSheet';
import { OrderExecution } from './components/OrderExecution';
import { NotificationsDrawer, WalletModal } from './components/WalletAndAlerts';
import { PortfolioView } from './components/PortfolioView';
import { RaiseQuestionnaire } from './components/RaiseQuestionnaire';
import { CreatorKyc } from './components/CreatorKyc';
import { BrandApplySheet } from './components/BrandApplySheet';
import { SearchScreen } from './components/SearchScreen';
import { AccountProfile } from './components/AccountProfile';
import { AdminConsole } from './components/AdminConsole';
import { AuthModal } from './components/AuthModal';
import { OnboardingFlow, SplashScreen } from './components/Onboarding';

type WorkspaceTab = 'markets' | 'races' | 'predictions' | 'portfolio' | 'search' | 'profile';

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

const ONBOARDING_STORAGE_KEY = 'crippo_onboarded_v1';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<AppLang>('EN');
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
  });
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
  const [myBrandApplications, setMyBrandApplications] = useState<BrandApplication[]>([]);

  // Overlays & Detail Views
  const [selectedRaise, setSelectedRaise] = useState<{ creator: Creator; side: 'BUY' | 'SELL' } | null>(null);
  const [claimTargetCreator, setClaimTargetCreator] = useState<Creator | null>(null);
  const [votingPrediction, setVotingPrediction] = useState<{
    prediction: PredictionMarket;
    side: 'YES' | 'NO';
  } | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [studioView, setStudioView] = useState<'raise' | 'kyc' | null>(null);
  const [dossierCreator, setDossierCreator] = useState<Creator | null>(null);
  const [brandApplyCampaign, setBrandApplyCampaign] = useState<BrandCampaign | null>(null);
  const myVerifiedCreators = useMemo(
    () => (user ? creators.filter((c) => c.claimedByUid === user.uid && c.claimStatus === 'CLAIMED') : []),
    [creators, user]
  );
  // Raises and brand partnerships are for verified creators only; everyone else goes through verification first.
  const canRaise = !!user && user.isVerifiedCreator;
  function startRaise() {
    setStudioView(canRaise ? 'raise' : 'kyc');
  }
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const t = translations[lang];

  // Auto-dismiss Splash screen after brief branded intro
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  // Leaving a tab closes any open studio screen (raise questionnaire or KYC).
  useEffect(() => {
    setStudioView(null);
    setDossierCreator(null);
  }, [activeTab]);

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

  function finishOnboarding() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    }
    setShowOnboarding(false);
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
    let unsubBrandApps: (() => void) | undefined;
    let unsubNotifs: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      unsubProfile?.();
      unsubTrades?.();
      unsubVotes?.();
      unsubWtx?.();
      unsubApps?.();
      unsubBrandApps?.();
      unsubNotifs?.();

      if (!fbUser) {
        setUser(null);
        setTrades([]);
        setPredictionVotes([]);
        setWalletTxs([]);
        setMyApplications([]);
        setMyBrandApplications([]);
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
      unsubBrandApps = subscribeMyBrandApplications(fbUser.uid, setMyBrandApplications);
      unsubNotifs = subscribeNotifications(fbUser.uid, setNotifications);
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
      unsubTrades?.();
      unsubVotes?.();
      unsubWtx?.();
      unsubApps?.();
      unsubBrandApps?.();
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

  function handleClaimCreator(creator: Creator) {
    setSelectedRaise(null);
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setClaimTargetCreator(creator);
    setActiveTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const showShell = !isAdminRoute && !liveSelectedRaiseCreator;

  const navItems: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'markets', label: t.markets, icon: CandlestickChart },
    { id: 'races', label: lang === 'FR' ? 'Courses' : 'Races', icon: LayoutGrid },
    { id: 'predictions', label: t.predictions, icon: Percent },
    { id: 'portfolio', label: t.portfolio, icon: Briefcase },
    { id: 'profile', label: user?.isVerifiedCreator ? 'Studio' : t.profile, icon: UserIcon },
  ];

  const sideRaiseCreator = selectedRaise?.side === 'SELL' ? liveSelectedRaiseCreator : null;

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#0F172A] transition-colors">
      {showSplash && <SplashScreen />}
      {!showSplash && showOnboarding && !isAdminRoute && (
        <OnboardingFlow lang={lang} onFinish={finishOnboarding} />
      )}

      {/* Top header + live ticker */}
      <TopTerminalBar
        user={user}
        portfolioValueXAF={portfolioValueXAF}
        lang={lang}
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

      {/* Desktop sidebar */}
      {showShell && (
        <aside className="hidden md:flex fixed left-0 top-[68px] bottom-0 w-60 flex-col gap-1 bg-white px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-[8px] text-sm font-semibold transition-colors ${
                  active ? 'bg-[#EAEDFF] text-[#1E0B36]' : 'text-[#64748B] hover:bg-[#F2F3FF] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          {user?.admin && (
            <button
              type="button"
              onClick={() => navigateAdmin(true)}
              className="mt-2 flex items-center gap-3 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-[#6C2BD9] hover:bg-[#F2F3FF]"
            >
              <Sparkles className="w-4 h-4" />
              {t.adminConsole}
            </button>
          )}
          <div className="mt-auto rounded-[8px] bg-[#F8F9FC] p-4">
            <p className="label-xs text-[#64748B]">MoMo cash</p>
            <p className="num font-display text-lg font-bold text-[#0F172A] mt-1">
              {authReady && user ? formatXAF(user.walletBalanceXAF || 0) : '—'}
            </p>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main
        className={`max-w-[1200px] mx-auto px-4 md:px-8 pt-5 pb-28 md:pb-12 ${
          showShell ? 'md:pl-[17rem]' : ''
        }`}
      >
        {isAdminRoute ? (
          <AdminConsole
            user={user}
            creators={creators}
            predictions={predictions}
            onExit={() => navigateAdmin(false)}
          />
        ) : sideRaiseCreator ? (
          <OrderExecution
            creator={sideRaiseCreator}
            trades={trades}
            user={user}
            lang={lang}
            initialSide="SELL"
            onBack={() => setSelectedRaise(null)}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        ) : liveSelectedRaiseCreator ? (
          <RaceDetail
            creator={liveSelectedRaiseCreator}
            user={user}
            lang={lang}
            onBack={() => setSelectedRaise(null)}
            onRequireAuth={() => setAuthModalOpen(true)}
            onClaim={handleClaimCreator}
            onOpenDossier={(c) => {
              setSelectedRaise(null);
              setDossierCreator(c);
            }}
          />
        ) : dossierCreator ? (
          <CreatorDossier
            creator={creators.find((c) => c.id === dossierCreator.id) || dossierCreator}
            lang={lang}
            onBack={() => setDossierCreator(null)}
            onBuy={(c) => {
              setDossierCreator(null);
              openRaise(c, 'BUY');
            }}
            onClaim={handleClaimCreator}
          />
        ) : studioView === 'raise' ? (
          <div className="max-w-5xl mx-auto">
            <RaiseQuestionnaire
              user={user}
              lang={lang}
              onBack={() => setStudioView(null)}
              onRequireAuth={() => setAuthModalOpen(true)}
              onSubmitted={() => undefined}
            />
          </div>
        ) : studioView === 'kyc' ? (
          <div className="max-w-5xl mx-auto">
            <CreatorKyc
              user={user}
              lang={lang}
              claimCreator={claimTargetCreator}
              onBack={() => setStudioView(null)}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          </div>
        ) : activeTab === 'portfolio' ? (
          <div className="max-w-4xl mx-auto">
            <PortfolioView
              user={user}
              trades={trades}
              creators={creators}
              lang={lang}
              onRequireAuth={() => setAuthModalOpen(true)}
              onSelectCreator={(c, side) => openRaise(c, side)}
              onGoToMarket={() => setActiveTab('markets')}
              onOpenWallet={() => setWalletOpen(true)}
            />
          </div>
        ) : activeTab === 'search' ? (
          <div className="max-w-3xl mx-auto">
            <SearchScreen
              user={user}
              creators={creators}
              predictions={predictions}
              lang={lang}
              onSelectCreator={(c, side) => openRaise(c, side || 'BUY')}
              onClaimCreator={handleClaimCreator}
              onVotePrediction={(prediction, side) => setVotingPrediction({ prediction, side })}
              onRequireAuth={() => setAuthModalOpen(true)}
            />
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-3xl mx-auto">
            <AccountProfile
              user={user}
              creators={creators}
              trades={trades}
              predictionVotes={predictionVotes}
              walletTxs={walletTxs}
              myApplications={myApplications}
              myBrandApplications={myBrandApplications}
              claimTargetCreator={claimTargetCreator}
              onClearClaimTarget={() => setClaimTargetCreator(null)}
              lang={lang}
              onToggleLang={() => setLang((l) => (l === 'EN' ? 'FR' : 'EN'))}
              onReplayOnboarding={() => setShowOnboarding(true)}
              onSelectCreator={(c) => openRaise(c, 'BUY')}
              onOpenPortfolio={() => setActiveTab('portfolio')}
              onOpenWallet={() => setWalletOpen(true)}
              onRequireAuth={() => setAuthModalOpen(true)}
              onOpenAdmin={() => navigateAdmin(true)}
              onStartRaise={startRaise}
              onVerifyIdentity={() => setStudioView('kyc')}
            />
          </div>
        ) : activeTab === 'predictions' ? (
          /* Cultural Predictions screen */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold text-[#0F172A]">{t.predictionMarkets}</h1>
              <span className="num text-xs text-[#64748B]">{filteredPredictions.length} live</span>
            </div>
            {filteredPredictions.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748B]">{t.emptyPredictions}</div>
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
            <CatalystFeed posts={newsPosts} creators={creators} onSelect={(c) => openRaise(c, 'BUY')} title={t.culturalCatalysts} />
          </div>
        ) : activeTab === 'races' ? (
          /* Live Creator Races catalog */
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-[#0F172A]">
                  {lang === 'FR' ? 'Catalogue des courses' : 'Creator Race Catalog'}
                </h1>
                <p className="text-xs text-[#64748B] mt-1">
                  {lang === 'FR'
                    ? 'Syndicats de redevances et partages de revenus, réglés en MoMo.'
                    : 'Royalty and revenue-share syndicates, settled via Mobile Money.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStudioView('kyc')}
                  className="hidden sm:inline-flex px-4 py-2 rounded-[4px] bg-white shadow-sm text-xs font-semibold"
                >
                  {lang === 'FR' ? 'Vérifier mon identité' : 'Verify identity'}
                </button>
                <button
                  type="button"
                  onClick={startRaise}
                  className="px-4 py-2 rounded-[4px] bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold"
                >
                  {canRaise ? (lang === 'FR' ? 'Lancer une course' : 'Start a raise') : lang === 'FR' ? 'Vérifier pour lever' : 'Verify to raise'}
                </button>
              </div>
              <div className="hidden sm:inline-flex items-center p-1 rounded-[8px] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold ${
                    viewMode === 'cards' ? 'bg-[#1E0B36] text-white' : 'text-[#64748B]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t.cardsView}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-semibold ${
                    viewMode === 'table' ? 'bg-[#1E0B36] text-white' : 'text-[#64748B]'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>{t.tableView}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {MARKET_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#6C2BD9] text-white'
                      : 'bg-white text-[#64748B] shadow-sm hover:text-[#0F172A]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {selectedCategory === 'Brand Campaigns' ? (
              <BrandCampaignList
                campaigns={brandCampaigns}
                lang={lang}
                onApply={(camp) => {
                  if (!user) setAuthModalOpen(true);
                  else if (!canRaise) setStudioView('kyc');
                  else setBrandApplyCampaign(camp);
                }}
              />
            ) : filteredCreators.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#6C2BD9]/10 text-[#6C2BD9] flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#0F172A]">{t.emptyRaises}</p>
                  <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
                    {user?.admin
                      ? 'Open the Exchange Console to publish initial Cameroon creator Raises or approve pending claims.'
                      : 'Request an unlisted creator listing memo or claim your creator profile in Profile -> Creator Mode.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className="px-5 py-2.5 rounded-full bg-white shadow-sm text-xs font-semibold"
                  >
                    {t.requestListing}
                  </button>
                  {user?.admin && (
                    <button
                      type="button"
                      onClick={() => navigateAdmin(true)}
                      className="px-5 py-2.5 rounded-full bg-[#1E0B36] text-white text-xs font-semibold"
                    >
                      {t.adminConsole}
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === 'table' ? (
              <MarketTableView creators={filteredCreators} lang={lang} onTrade={(c, side) => openRaise(c, side)} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCreators.map((creator) => (
                  <CreatorMarketCard
                    key={creator.id}
                    creator={creator}
                    lang={lang}
                    onTrade={(c, side) => openRaise(c, side || 'BUY')}
                    onClaim={handleClaimCreator}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* MARKET HOME: MoMo recharge, cultural predictions, open races, cultural radar */
          <div className="space-y-6">
            <section className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-11 h-11 rounded-[8px] bg-[#EAEDFF] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-[#6C2BD9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[#0F172A]">Instant MoMo &amp; Cash</p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {lang === 'FR'
                    ? 'Déposez via MTN MoMo ou Orange Money (CamPay).'
                    : 'Deposit with MTN MoMo or Orange Money (CamPay).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWalletOpen(true)}
                className="px-5 py-2.5 rounded-[4px] bg-[#1E0B36] hover:bg-[#4C1D95] text-white text-xs font-semibold uppercase tracking-wide"
              >
                {lang === 'FR' ? 'Recharger' : 'Recharge'}
              </button>
            </section>

            {selectedCategory === 'Trending' && !normalizedQuery && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-[#0F172A]">{t.predictionMarkets}</h2>
                </div>
                <FeaturedHeroCarousel
                  creators={creators.filter((c) => c.status !== 'ENDED')}
                  predictions={predictions.filter((p) => p.status === 'OPEN')}
                  lang={lang}
                  onSelectCreator={(c) => openRaise(c, 'BUY')}
                  onVotePrediction={(p, side) => setVotingPrediction({ prediction: p, side })}
                />
              </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-[#0F172A]">{t.marketsToWatch}</h2>
                  <span className="label-xs text-[#6C2BD9] bg-[#6C2BD9]/10 px-2 py-0.5 rounded-full">Live</span>
                </div>
                <button type="button" onClick={() => setActiveTab('races')} className="text-xs font-semibold text-[#6C2BD9]">
                  {lang === 'FR' ? 'Tout voir' : 'View all'} ({filteredCreators.length})
                </button>
              </div>
              {filteredCreators.length === 0 ? (
                <p className="py-6 text-xs text-[#64748B] text-center">{t.emptyRaises}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredCreators.slice(0, 4).map((creator) => (
                    <CreatorMarketCard
                      key={creator.id}
                      creator={creator}
                      lang={lang}
                      onTrade={(c, side) => openRaise(c, side || 'BUY')}
                      onClaim={handleClaimCreator}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CatalystFeed posts={newsPosts} creators={creators} onSelect={(c) => openRaise(c, 'BUY')} title={t.culturalCatalysts} />
              <section className="card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#059669]" />
                  <h2 className="font-display text-base font-semibold text-[#0F172A]">{t.topMovers}</h2>
                </div>
                {topMovers.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No active movers yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F0]">
                    {topMovers.map((c, idx) => {
                      const isUp = c.priceChangePct >= 0;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openRaise(c, 'BUY')}
                          className="w-full py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 text-[11px] num text-[#64748B]">#{idx + 1}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#0F172A] truncate">{c.name}</div>
                              <div className="text-[11px] text-[#64748B] num">
                                Score {c.crippoScore ?? 85} · {formatCompact(c.tradingVolumeXAF)} vol
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="num text-xs font-bold text-[#0F172A]">{formatXAF(c.sharePriceXAF)}</div>
                            <div className={`num text-[11px] font-semibold ${isUp ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
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
            </div>
          </div>
        )}
      </main>

      {/* Mobile floating bottom navigation */}
      {showShell && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden fixed bottom-4 left-4 right-4 max-w-md mx-auto z-40 rounded-full bg-white/80 backdrop-blur-xl border border-white px-2 py-1.5 shadow-[0_10px_30px_rgba(15,27,61,0.12)]"
        >
          <div className="grid grid-cols-5 gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-full min-h-[46px] transition-colors ${
                    active ? 'bg-[#1E0B36] text-white' : 'text-[#64748B]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <PredictionSheet
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

      <BrandApplySheet
        campaign={brandApplyCampaign}
        user={user}
        myCreators={myVerifiedCreators}
        lang={lang}
        onClose={() => setBrandApplyCampaign(null)}
        onDone={() => setBrandApplyCampaign(null)}
      />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

/** Cultural Radar / catalysts feed, shared by the home and predictions screens. */
function CatalystFeed({
  posts,
  creators,
  onSelect,
  title,
}: {
  posts: NewsPost[];
  creators: Creator[];
  onSelect: (c: Creator) => void;
  title: string;
}) {
  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-[#6C2BD9]" />
        <h2 className="font-display text-base font-semibold text-[#0F172A]">{title}</h2>
      </div>
      {posts.length === 0 ? (
        <p className="text-xs text-[#64748B]">
          Cultural market catalysts will appear here as local blogs and social hits move prices.
        </p>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {posts.slice(0, 5).map((post) => {
            const linked = creators.find((c) => c.id === post.creatorId);
            const isPos = (post.impactPct ?? 0) >= 0;
            return (
              <div
                key={post.id}
                onClick={() => linked && onSelect(linked)}
                className={`py-2.5 first:pt-0 last:pb-0 space-y-1 ${linked ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#6C2BD9]">
                    {post.sourceName} {post.city ? `· ${post.city}` : ''}
                  </span>
                  {typeof post.impactPct === 'number' && (
                    <span className={`num font-bold ${isPos ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                      {isPos ? '+' : ''}
                      {post.impactPct}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#0F172A] leading-snug">{post.headline}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Brand & agency sponsorship briefs, shown under the Races catalog. */
function BrandCampaignList({
  campaigns,
  lang,
  onApply,
}: {
  campaigns: BrandCampaign[];
  lang: AppLang;
  onApply: (campaign: BrandCampaign) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-sm font-bold text-[#0F172A]">No brand campaigns open yet</p>
        <p className="text-xs text-[#64748B] max-w-sm mx-auto">
          Partner brands and talent agencies publish verified creator sponsorship briefs here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {campaigns.map((camp) => (
        <div key={camp.id} className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-[#6C2BD9] truncate">
              {camp.brandName}
              {camp.agencyName ? ` · via ${camp.agencyName}` : ''}
            </span>
            <span className="label-xs px-2.5 py-0.5 rounded-full bg-[#059669]/10 text-[#059669] shrink-0">{camp.status}</span>
          </div>
          <h3 className="text-sm font-bold text-[#0F172A]">{lang === 'FR' ? camp.titleFr : camp.titleEn}</h3>
          {camp.deliverable && <p className="text-xs text-[#64748B] leading-relaxed">{camp.deliverable}</p>}
          <div className="pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-[#64748B]">Pool: </span>
              <strong className="num text-[#0F172A]">{formatXAF(camp.budgetXAF)}</strong>
            </div>
            <button type="button" onClick={() => onApply(camp)} className="px-4 py-1.5 rounded-full bg-[#1E0B36] text-white text-[11px] font-semibold">
              Apply as Creator
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
