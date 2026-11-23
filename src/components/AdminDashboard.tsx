import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  PlusCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import type {
  AggregatorConfigStatus,
  BrandCampaign,
  Creator,
  CreatorApplication,
  MemoRequest,
  PredictionMarket,
  SyncLog,
  UnderwritingResult,
  UserProfile,
} from '../types/crippo';
import {
  adminAdvanceEscrowStage,
  adminApplyCulturalCatalyst,
  adminBootstrapExchangeCatalog,
  adminCreateBrandCampaign,
  adminCreateCreatorListing,
  adminCreatePrediction,
  adminResolvePrediction,
  adminReviewApplication,
  adminRunAggregatorSync,
  adminUpdateMemoStatus,
  fetchAggregatorStatus,
  runUnderwritingAudit,
  subscribeAllApplications,
  subscribeAllMemoRequests,
  subscribeBrandCampaigns,
  subscribeSyncLogs,
} from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface AdminDashboardProps {
  user: UserProfile | null;
  creators: Creator[];
  predictions: PredictionMarket[];
  onExit: () => void;
}

type AdminSection = 'applications' | 'raises_escrow' | 'predictions' | 'brands_memos' | 'sync';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  creators,
  predictions,
  onExit,
}) => {
  const [section, setSection] = useState<AdminSection>('applications');
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [memos, setMemos] = useState<MemoRequest[]>([]);
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [aggStatus, setAggStatus] = useState<AggregatorConfigStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [priceByAppId, setPriceByAppId] = useState<Record<string, number>>({});

  // Create Raise state
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [raiseTitle, setRaiseTitle] = useState('');
  const [category, setCategory] = useState<Creator['category']>('Music & Albums');
  const [city, setCity] = useState('Douala');
  const [platform, setPlatform] = useState<Creator['platform']>('Multi-Platform');
  const [followersCount, setFollowersCount] = useState(125000);
  const [engagementRate, setEngagementRate] = useState(6.8);
  const [viewVelocity, setViewVelocity] = useState(85000);
  const [netBudgetXAF, setNetBudgetXAF] = useState(2500000);
  const [totalShares, setTotalShares] = useState(1000);
  const [revSharePct, setRevSharePct] = useState(25);
  const [roiDurationMonths, setRoiDurationMonths] = useState(12);
  const [underwriting, setUnderwriting] = useState<UnderwritingResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [creatingListing, setCreatingListing] = useState(false);

  // Cultural Catalyst dispatcher state
  const [catCreatorId, setCatCreatorId] = useState('');
  const [catSource, setCatSource] = useState('237 Showbiz');
  const [catHeadline, setCatHeadline] = useState('');
  const [catImpactPct, setCatImpactPct] = useState(8.5);
  const [postingCatalyst, setPostingCatalyst] = useState(false);

  // Prediction creator state
  const [predQuestionEn, setPredQuestionEn] = useState('');
  const [predQuestionFr, setPredQuestionFr] = useState('');
  const [predCategory, setPredCategory] = useState<PredictionMarket['category']>('Awards');
  const [predCriteria, setPredCriteria] = useState('');
  const [predYesPool, setPredYesPool] = useState(65000);
  const [predNoPool, setPredNoPool] = useState(35000);
  const [creatingPred, setCreatingPred] = useState(false);

  // Brand Campaign creator state
  const [brandName, setBrandName] = useState('');
  const [brandTitleEn, setBrandTitleEn] = useState('');
  const [brandTitleFr, setBrandTitleFr] = useState('');
  const [brandCategory, setBrandCategory] = useState('Music & Albums');
  const [brandBudget, setBrandBudget] = useState(2500000);
  const [brandDeliverable, setBrandDeliverable] = useState('');
  const [creatingBrand, setCreatingBrand] = useState(false);

  useEffect(() => {
    if (!user?.admin) return;
    const unsubApps = subscribeAllApplications(setApplications);
    const unsubMemos = subscribeAllMemoRequests(setMemos);
    const unsubBrands = subscribeBrandCampaigns(setCampaigns);
    const unsubLogs = subscribeSyncLogs(setSyncLogs);
    fetchAggregatorStatus().then(setAggStatus).catch(() => {});
    return () => {
      unsubApps();
      unsubMemos();
      unsubBrands();
      unsubLogs();
    };
  }, [user?.admin]);

  if (!user || !user.admin) {
    return (
      <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-[#11081F] dark:text-[#F8F7FC]">Committee Access Required</h1>
          <p className="text-xs text-[#645582] dark:text-[#A99BC8] max-w-xs mx-auto">
            This terminal is restricted to verified exchange administrators.
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
        >
          Back to Exchange
        </button>
      </div>
    );
  }

  async function handleReview(app: CreatorApplication, decision: 'approved' | 'rejected') {
    setBusyId(app.id);
    setBanner(null);
    try {
      await adminReviewApplication({
        app,
        decision,
        initialSharePriceXAF: priceByAppId[app.id],
      });
      setBanner(`${app.stageName} ${decision}.`);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRunUnderwriting() {
    setAuditing(true);
    setBanner(null);
    try {
      const res = await runUnderwritingAudit({
        stageName: name || 'New Project',
        category,
        youtube30dViews: viewVelocity,
        spotifyMonthlyListeners: Math.round(followersCount * 0.2),
        tiktokVelocity: viewVelocity,
        engagementRate,
        diasporaSharePct: 26,
        requestedNetBudgetXAF: netBudgetXAF,
        totalFixedShares: totalShares,
        roiDurationMonths,
      });
      setUnderwriting(res);
      setBanner(`AI Market Index: ${res.underwritingScore}/100 · P₀ ${formatXAF(res.initialSharePriceXAF)}`);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Underwriting failed.');
    } finally {
      setAuditing(false);
    }
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreatingListing(true);
    setBanner(null);
    try {
      const created = await adminCreateCreatorListing({
        ownerUid: user.uid,
        name,
        handle,
        raiseTitle: raiseTitle || undefined,
        category,
        city,
        platform,
        followersCount,
        engagementRate,
        viewVelocity,
        netBudgetXAF,
        totalShares,
        revSharePct,
        roiDurationMonths,
      });
      setBanner(`Listed ${created.name} at ${formatXAF(created.sharePriceXAF)}/share.`);
      setName('');
      setHandle('');
      setRaiseTitle('');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Failed to publish listing.');
    } finally {
      setCreatingListing(false);
    }
  }

  async function handlePostCatalyst(e: React.FormEvent) {
    e.preventDefault();
    const targetCreator = creators.find((c) => c.id === catCreatorId) || creators[0];
    if (!targetCreator) return;
    setPostingCatalyst(true);
    setBanner(null);
    try {
      await adminApplyCulturalCatalyst({
        creator: targetCreator,
        sourceName: catSource,
        headline: catHeadline,
        impactPct: catImpactPct,
        city: targetCreator.city,
      });
      setBanner(`Catalyst published: ${targetCreator.name} (${catImpactPct >= 0 ? '+' : ''}${catImpactPct}%).`);
      setCatHeadline('');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Catalyst failed.');
    } finally {
      setPostingCatalyst(false);
    }
  }

  async function handleCreatePrediction(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPred(true);
    setBanner(null);
    try {
      const created = await adminCreatePrediction({
        questionEn: predQuestionEn,
        questionFr: predQuestionFr || predQuestionEn,
        category: predCategory,
        resolutionCriteria: predCriteria,
        initialYesPoolXAF: predYesPool,
        initialNoPoolXAF: predNoPool,
      });
      setBanner(`Published prediction contract: ${created.questionEn}`);
      setPredQuestionEn('');
      setPredQuestionFr('');
      setPredCriteria('');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Prediction creation failed.');
    } finally {
      setCreatingPred(false);
    }
  }

  async function handleCreateBrand(e: React.FormEvent) {
    e.preventDefault();
    setCreatingBrand(true);
    setBanner(null);
    try {
      await adminCreateBrandCampaign({
        brandName,
        titleEn: brandTitleEn,
        titleFr: brandTitleFr || brandTitleEn,
        category: brandCategory,
        budgetXAF: brandBudget,
        deliverable: brandDeliverable,
      });
      setBanner(`Published brand campaign for ${brandName}.`);
      setBrandName('');
      setBrandTitleEn('');
      setBrandTitleFr('');
      setBrandDeliverable('');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Brand campaign creation failed.');
    } finally {
      setCreatingBrand(false);
    }
  }

  async function handleBootstrapCatalog() {
    if (!user) return;
    setBootstrapping(true);
    setBanner(null);
    try {
      await adminBootstrapExchangeCatalog(user.uid);
      setBanner('Published starter Cameroon Raises, Cultural Predictions, Catalysts & Brand Campaigns.');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Catalog bootstrap failed.');
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleSyncNow() {
    if (!user) return;
    setSyncing(true);
    setBanner(null);
    try {
      const res = await adminRunAggregatorSync(user.uid);
      setBanner(res.message);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Pipeline sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Exchange</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={bootstrapping}
            onClick={handleBootstrapCatalog}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>{bootstrapping ? 'Publishing...' : 'Publish Cameroon Starter Markets'}</span>
          </button>
          <span className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold">
            Exchange Console
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'applications', label: `Applications (${applications.filter((a) => a.status === 'pending').length})` },
          { id: 'raises_escrow', label: `Raises & Escrow (${creators.length})` },
          { id: 'predictions', label: `Predictions (${predictions.length})` },
          { id: 'brands_memos', label: `Brands & Memos (${memos.filter((m) => m.status === 'pending').length})` },
          { id: 'sync', label: 'Social Pulse Sync' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id as AdminSection)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              section === item.id
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] text-[#645582] dark:text-[#A99BC8]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {banner && (
        <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/35 text-xs font-medium text-[#11081F] dark:text-[#F8F7FC]">
          {banner}
        </div>
      )}

      {/* 1. APPLICATIONS */}
      {section === 'applications' && (
        <div className="space-y-3">
          {applications.length === 0 ? (
            <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-8 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
              No creator raise applications submitted yet.
            </div>
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
                      {app.stageName}
                    </h3>
                    <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                      {app.handle} · {app.category} {app.city ? `· ${app.city}` : ''}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold capitalize ${
                      app.status === 'approved'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : app.status === 'rejected'
                        ? 'bg-red-500/15 text-red-500'
                        : 'bg-violet-500/15 text-violet-400'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] tabular-nums">
                  <div>
                    <span className="text-[#645582] dark:text-[#A99BC8]">Bio-Code:</span>{' '}
                    <strong className="font-mono text-violet-500">{app.bioVerificationCode || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-[#645582] dark:text-[#A99BC8]">KYC:</span>{' '}
                    <strong className="text-[#11081F] dark:text-[#F8F7FC]">{app.kycDocType || 'CNI'}</strong>
                  </div>
                  <div>
                    <span className="text-[#645582] dark:text-[#A99BC8]">MoMo:</span>{' '}
                    <strong className="text-[#11081F] dark:text-[#F8F7FC]">{app.momoNumber || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-[#645582] dark:text-[#A99BC8]">Net Budget:</span>{' '}
                    <strong className="text-[#11081F] dark:text-[#F8F7FC]">
                      {formatXAF(app.netBudgetXAF || app.targetRaiseXAF || 0)}
                    </strong>
                  </div>
                </div>

                {app.underwritingVerdict && (
                  <p className="text-xs text-emerald-500 font-medium">{app.underwritingVerdict}</p>
                )}

                <p className="text-xs text-[#544675] dark:text-[#B9ADD6] leading-relaxed">{app.pitch}</p>

                <div className="flex flex-wrap gap-3 text-[11px]">
                  {app.tiktokUrl && (
                    <a href={app.tiktokUrl} target="_blank" rel="noreferrer" className="underline text-violet-500">
                      TikTok / Social
                    </a>
                  )}
                  {app.facebookUrl && (
                    <a href={app.facebookUrl} target="_blank" rel="noreferrer" className="underline text-violet-500">
                      Facebook
                    </a>
                  )}
                  {app.verificationMediaUrl && (
                    <a href={app.verificationMediaUrl} target="_blank" rel="noreferrer" className="underline text-violet-500">
                      KYC Proof Document
                    </a>
                  )}
                </div>

                {app.status === 'pending' && (
                  <div className="pt-2 border-t border-[#E4DFF2] dark:border-[#2A174A] flex flex-wrap items-center gap-2.5">
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={priceByAppId[app.id] ?? ''}
                      placeholder="Override P₀ (opt)"
                      onChange={(e) =>
                        setPriceByAppId((prev) => ({
                          ...prev,
                          [app.id]: Number(e.target.value),
                        }))
                      }
                      className="w-36 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums text-[#11081F] dark:text-[#F8F7FC]"
                    />
                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => handleReview(app, 'approved')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Open Raise</span>
                    </button>
                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => handleReview(app, 'rejected')}
                      className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-500 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. RAISES, CULTURAL CATALYSTS & ESCROW */}
      {section === 'raises_escrow' && (
        <div className="space-y-5">
          {/* Publish Cultural Catalyst */}
          <form
            onSubmit={handlePostCatalyst}
            className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                Publish Cultural Catalyst (Live Share Repricing)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={catCreatorId || creators[0]?.id || ''}
                onChange={(e) => setCatCreatorId(e.target.value)}
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              >
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatXAF(c.sharePriceXAF)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={catSource}
                onChange={(e) => setCatSource(e.target.value)}
                placeholder="Source (e.g. 237 Showbiz)"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="number"
                step="0.1"
                required
                value={catImpactPct}
                onChange={(e) => setCatImpactPct(Number(e.target.value))}
                placeholder="Impact % (e.g. +14.2 or -8)"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] tabular-nums"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                required
                value={catHeadline}
                onChange={(e) => setCatHeadline(e.target.value)}
                placeholder="Catalyst headline (e.g. Single enters TRACE Africa Top 10...)"
                className="flex-1 px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <button
                type="submit"
                disabled={postingCatalyst || creators.length === 0}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {postingCatalyst ? 'Repricing...' : 'Dispatch Catalyst'}
              </button>
            </div>
          </form>

          {/* Active Raises & Clearinghouse Escrow Controls */}
          <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl divide-y divide-[#E4DFF2] dark:divide-[#2A174A] overflow-hidden">
            {creators.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
                No active Raises yet. Use “Publish Cameroon Starter Markets” above or create a listing below.
              </div>
            ) : (
              creators.map((c) => (
                <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-[#11081F] dark:text-[#F8F7FC]">
                      {c.raiseTitle || c.name} · <span className="text-violet-500">{c.status || 'OPEN'}</span>
                    </div>
                    <div className="text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums mt-0.5">
                      {c.name} · {formatXAF(c.sharePriceXAF)}/sh · Escrow: {c.escrowStatus || 'ESCROW_HOLDING'}
                      {c.distributorSplitEmail ? ` · Split: ${c.distributorSplitEmail}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => adminAdvanceEscrowStage(c, 'TRANCHE_1_RELEASED', 'OPEN')}
                      className="px-3 py-1.5 rounded-lg bg-violet-600/15 hover:bg-violet-600/25 text-violet-500 font-semibold"
                    >
                      Release Tranche 1 (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => adminAdvanceEscrowStage(c, 'COMPLETED_LOCKED', 'FUNDED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 font-semibold"
                    >
                      Verify Master & Lock Split
                    </button>
                    <button
                      type="button"
                      onClick={() => adminAdvanceEscrowStage(c, c.escrowStatus || 'COMPLETED_LOCKED', 'ENDED')}
                      className="px-3 py-1.5 rounded-lg bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-[#645582] dark:text-[#A99BC8] font-semibold"
                    >
                      Mark Ended
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Direct Create Raise with Pre-Listing AI Underwriting */}
          <form
            onSubmit={handleCreateListing}
            className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                  Underwrite & List New Project Raise
                </h2>
              </div>
              <button
                type="button"
                disabled={auditing}
                onClick={handleRunUnderwriting}
                className="px-3 py-1.5 rounded-xl bg-violet-600/15 text-violet-500 text-xs font-semibold"
              >
                {auditing ? 'Auditing...' : 'Run AI Audit'}
              </button>
            </div>

            {underwriting && (
              <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-violet-500/35 text-xs space-y-1">
                <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums">
                  Score {underwriting.underwritingScore}/100 · Gross Target (+5%): {formatXAF(underwriting.grossTargetXAF)} · P₀:{' '}
                  {formatXAF(underwriting.initialSharePriceXAF)}
                </div>
                <div className="text-[#645582] dark:text-[#A99BC8]">{underwriting.verdictEn}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Creator Name *"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle *"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="text"
                value={raiseTitle}
                onChange={(e) => setRaiseTitle(e.target.value)}
                placeholder="Project Raise Title"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Creator['category'])}
                className="px-3 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              >
                <option value="Music & Albums">Music & Albums</option>
                <option value="TikTok Series">TikTok Series</option>
                <option value="Movies & Docs">Movies & Docs</option>
                <option value="Podcasts">Podcasts</option>
              </select>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Creator['platform'])}
                className="px-3 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              >
                <option value="Multi-Platform">Multi-Platform</option>
                <option value="TikTok">TikTok</option>
                <option value="Facebook">Facebook</option>
                <option value="YouTube">YouTube</option>
              </select>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="px-3 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="number"
                min={100000}
                step={50000}
                value={netBudgetXAF}
                onChange={(e) => setNetBudgetXAF(Number(e.target.value))}
                placeholder="Net Budget XAF"
                className="px-3 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">Fixed Shares</label>
                <input
                  type="number"
                  min={100}
                  value={totalShares}
                  onChange={(e) => setTotalShares(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">Rev Share %</label>
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={revSharePct}
                  onChange={(e) => setRevSharePct(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">Engagement %</label>
                <input
                  type="number"
                  step="0.1"
                  value={engagementRate}
                  onChange={(e) => setEngagementRate(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">ROI Months</label>
                <input
                  type="number"
                  min={3}
                  max={36}
                  value={roiDurationMonths}
                  onChange={(e) => setRoiDurationMonths(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingListing}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {creatingListing ? 'Listing...' : 'Publish Raise to Market'}
            </button>
          </form>
        </div>
      )}

      {/* 3. PREDICTION CONTRACTS */}
      {section === 'predictions' && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreatePrediction}
            className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                Launch Cultural Prediction Contract (Yes / No)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={predQuestionEn}
                onChange={(e) => setPredQuestionEn(e.target.value)}
                placeholder="Question (English) *"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="text"
                value={predQuestionFr}
                onChange={(e) => setPredQuestionFr(e.target.value)}
                placeholder="Question (Français)"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <select
                value={predCategory}
                onChange={(e) => setPredCategory(e.target.value as PredictionMarket['category'])}
                className="px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              >
                <option value="Awards">Awards</option>
                <option value="Music & Albums">Music & Albums</option>
                <option value="TikTok Series">TikTok Series</option>
                <option value="Movies & Docs">Movies & Docs</option>
                <option value="Culture">Culture</option>
                <option value="Tech">Tech</option>
              </select>
              <input
                type="number"
                min={5000}
                step={5000}
                value={predYesPool}
                onChange={(e) => setPredYesPool(Number(e.target.value))}
                placeholder="Initial Yes Pool XAF"
                className="px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
              />
              <input
                type="number"
                min={5000}
                step={5000}
                value={predNoPool}
                onChange={(e) => setPredNoPool(Number(e.target.value))}
                placeholder="Initial No Pool XAF"
                className="px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
              />
            </div>

            <input
              type="text"
              value={predCriteria}
              onChange={(e) => setPredCriteria(e.target.value)}
              placeholder="Resolution criteria..."
              className="w-full px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
            />

            <button
              type="submit"
              disabled={creatingPred}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {creatingPred ? 'Publishing...' : 'Publish Prediction Contract'}
            </button>
          </form>

          <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl divide-y divide-[#E4DFF2] dark:divide-[#2A174A] overflow-hidden">
            {predictions.map((p) => (
              <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-bold text-[#11081F] dark:text-[#F8F7FC]">{p.questionEn}</div>
                  <div className="text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
                    Yes {p.yesProbabilityPct}% · No {p.noProbabilityPct}% · Vol {formatXAF(p.totalVolumeXAF)} · {p.status}
                  </div>
                </div>
                {p.status === 'OPEN' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => adminResolvePrediction(p.id, 'RESOLVED_YES')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 font-semibold"
                    >
                      Resolve YES
                    </button>
                    <button
                      type="button"
                      onClick={() => adminResolvePrediction(p.id, 'RESOLVED_NO')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-500 font-semibold"
                    >
                      Resolve NO
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BRAND CAMPAIGNS & MEMOS */}
      {section === 'brands_memos' && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreateBrand}
            className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
              Create Brand Sponsorship Campaign
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Brand (e.g. MTN Cameroon) *"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="text"
                required
                value={brandTitleEn}
                onChange={(e) => setBrandTitleEn(e.target.value)}
                placeholder="Campaign Title (EN) *"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <input
                type="number"
                min={50000}
                step={50000}
                value={brandBudget}
                onChange={(e) => setBrandBudget(Number(e.target.value))}
                placeholder="Budget XAF"
                className="px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl tabular-nums"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={brandDeliverable}
                onChange={(e) => setBrandDeliverable(e.target.value)}
                placeholder="Deliverable brief..."
                className="flex-1 px-3.5 py-2.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
              />
              <button
                type="submit"
                disabled={creatingBrand}
                className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
              >
                {creatingBrand ? 'Saving...' : 'Publish Campaign'}
              </button>
            </div>
            {campaigns.length > 0 && (
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">
                {campaigns.length} active brand sponsorship campaign(s) live on exchange.
              </div>
            )}
          </form>

          {memos.length === 0 ? (
            <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-6 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
              No unlisted creator memo requests yet.
            </div>
          ) : (
            memos.map((memo) => (
              <div
                key={memo.id}
                className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">{memo.creatorName}</h3>
                    <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                      {memo.platform} {memo.handle ? `· ${memo.handle}` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-violet-500/15 text-violet-400 text-[11px] font-semibold capitalize">
                    {memo.status}
                  </span>
                </div>
                {memo.reason && <p className="text-xs text-[#544675] dark:text-[#B9ADD6]">{memo.reason}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setName(memo.creatorName);
                      setHandle(memo.handle || `@${memo.creatorName.toLowerCase().replace(/\s+/g, '')}`);
                      setSection('raises_escrow');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold"
                  >
                    Prefill Raise Form
                  </button>
                  {memo.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => adminUpdateMemoStatus(memo.id, 'reviewed')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold"
                    >
                      Mark Reviewed
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. SOCIAL PULSE SYNC */}
      {section === 'sync' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
                  Live Social & Cultural Feed Pipeline
                </h2>
                <p className="text-xs text-[#645582] dark:text-[#A99BC8] mt-0.5">
                  Synchronizes configured Cameroon creator feeds and updates cultural catalyst telemetry.
                </p>
              </div>
              <button
                type="button"
                disabled={syncing}
                onClick={handleSyncNow}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Syncing...' : 'Run Live Sync'}</span>
              </button>
            </div>

            {aggStatus && (
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                  <div className="text-[#645582] dark:text-[#A99BC8]">Facebook</div>
                  <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] mt-0.5">{aggStatus.facebookProvider}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                  <div className="text-[#645582] dark:text-[#A99BC8]">TikTok</div>
                  <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] mt-0.5">{aggStatus.tiktokProvider}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
                  <div className="text-[#645582] dark:text-[#A99BC8]">Classification</div>
                  <div className="font-bold text-[#11081F] dark:text-[#F8F7FC] mt-0.5">
                    {aggStatus.geminiConfigured ? 'AI Market Index' : 'Rule Classifier'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-2xl divide-y divide-[#E4DFF2] dark:divide-[#2A174A] overflow-hidden">
            {syncLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#645582] dark:text-[#A99BC8]">
                No pipeline runs recorded yet.
              </div>
            ) : (
              syncLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#11081F] dark:text-[#F8F7FC] truncate">
                      {log.provider} · {log.postsFetched} items
                    </div>
                    <div className="text-[#645582] dark:text-[#A99BC8] truncate mt-0.5">{log.message}</div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold capitalize shrink-0 ${
                      log.status === 'success'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : log.status === 'unconfigured'
                        ? 'bg-violet-500/15 text-violet-400'
                        : 'bg-red-500/15 text-red-500'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
