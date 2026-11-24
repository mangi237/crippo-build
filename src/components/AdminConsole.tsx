import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Flame, PlusCircle, RefreshCw, Rocket, ShieldAlert, XCircle } from 'lucide-react';
import type {
  AgentPulseResult,
  AggregatorConfigStatus,
  BioVerificationAgentResult,
  BrandApplication,
  BrandCampaign,
  Creator,
  CreatorApplication,
  MemoRequest,
  PredictionMarket,
  SyncLog,
  Label,
  UnderwritingResult,
  UserProfile,
} from '../types/crippo';
import {
  adminAdvanceEscrowStage,
  adminApplyCulturalCatalyst,
  adminBootstrapExchangeCatalog,
  adminCommitAgentPulse,
  adminCreateBrandCampaign,
  adminCreateCreatorListing,
  adminCreatePrediction,
  adminResolvePrediction,
  adminReviewApplication,
  adminReviewBrandApplication,
  adminRunAggregatorSync,
  adminUpdateMemoStatus,
  fetchAggregatorStatus,
  runPulseAgentOnServer,
  runUnderwritingAudit,
  subscribeAllApplications,
  subscribeAllBrandApplications,
  subscribeAllMemoRequests,
  subscribeBrandCampaigns,
  subscribeSyncLogs,
  subscribeAllLabels,
  adminReviewLabel,
  verifyClaimBioCodeOnServer,
} from '../services/firestoreService';
import { formatXAF } from '../utils/format';

interface AdminConsoleProps {
  user: UserProfile | null;
  creators: Creator[];
  predictions: PredictionMarket[];
  onExit: () => void;
}

type Section = 'overview' | 'applications' | 'labels' | 'agents' | 'raises' | 'predictions' | 'brands' | 'sync';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
  { id: 'labels', label: 'Labels' },
  { id: 'agents', label: 'Agents & pulse' },
  { id: 'raises', label: 'Raises & escrow' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'brands', label: 'Brands & memos' },
  { id: 'sync', label: 'Pipeline' },
];

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-[4px] focus:outline-none focus:border-[1.5px] focus:border-[#6C2BD9]';
const labelClass = 'label-xs text-[#64748B]';

/**
 * Admin console (Crippo Exchange design, "Creator Studio Treasury Dashboard" + admin terminal).
 * Reachable at /admin for accounts with admin = true. Every action calls the same
 * services as before: reviews, underwriting, listings, escrow, predictions, catalysts, brands, memos, pipeline.
 */
export const AdminConsole: React.FC<AdminConsoleProps> = ({ user, creators, predictions, onExit }) => {
  const [section, setSection] = useState<Section>('overview');
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [brandApplications, setBrandApplications] = useState<BrandApplication[]>([]);
  const [memos, setMemos] = useState<MemoRequest[]>([]);
  const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [aggStatus, setAggStatus] = useState<AggregatorConfigStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);

  // applications
  const [priceByAppId, setPriceByAppId] = useState<Record<string, number>>({});
  const [bioCheckByAppId, setBioCheckByAppId] = useState<Record<string, BioVerificationAgentResult>>({});
  const [checkingBioAppId, setCheckingBioAppId] = useState<string | null>(null);

  // underwriting + listing
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [raiseTitle, setRaiseTitle] = useState('');
  const [category, setCategory] = useState<Creator['category']>('Music & Albums');
  const [city, setCity] = useState('Douala');
  const [platform, setPlatform] = useState<NonNullable<Creator['platform']>>('Multi-Platform');
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

  // pulse agent + catalysts
  const [blogUrlsInput, setBlogUrlsInput] = useState('');
  const [manualHeadlinesInput, setManualHeadlinesInput] = useState('');
  const [runningPulse, setRunningPulse] = useState(false);
  const [committingPulse, setCommittingPulse] = useState(false);
  const [pulsePreview, setPulsePreview] = useState<AgentPulseResult | null>(null);
  const [catCreatorId, setCatCreatorId] = useState('');
  const [catSource, setCatSource] = useState('237 Showbiz');
  const [catHeadline, setCatHeadline] = useState('');
  const [catImpactPct, setCatImpactPct] = useState(8.5);
  const [postingCatalyst, setPostingCatalyst] = useState(false);

  // predictions
  const [predQuestionEn, setPredQuestionEn] = useState('');
  const [predQuestionFr, setPredQuestionFr] = useState('');
  const [predCategory, setPredCategory] = useState<PredictionMarket['category']>('Awards');
  const [predCriteria, setPredCriteria] = useState('');
  const [predYesPool, setPredYesPool] = useState(65000);
  const [predNoPool, setPredNoPool] = useState(35000);
  const [creatingPred, setCreatingPred] = useState(false);

  // brands
  const [brandName, setBrandName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [brandTitleEn, setBrandTitleEn] = useState('');
  const [brandTitleFr, setBrandTitleFr] = useState('');
  const [brandCategory, setBrandCategory] = useState('Music & Albums');
  const [brandBudget, setBrandBudget] = useState(2500000);
  const [brandDeliverable, setBrandDeliverable] = useState('');
  const [creatingBrand, setCreatingBrand] = useState(false);

  useEffect(() => {
    if (!user?.admin) return;
    const unsubApps = subscribeAllApplications(setApplications);
    const unsubBrandApps = subscribeAllBrandApplications(setBrandApplications);
    const unsubMemos = subscribeAllMemoRequests(setMemos);
    const unsubBrands = subscribeBrandCampaigns(setCampaigns);
    const unsubLogs = subscribeSyncLogs(setSyncLogs);
    const unsubLabels = subscribeAllLabels(setLabels);
    fetchAggregatorStatus().then(setAggStatus).catch(() => {});
    return () => {
      unsubApps();
      unsubBrandApps();
      unsubMemos();
      unsubBrands();
      unsubLogs();
      unsubLabels();
    };
  }, [user?.admin]);

  const pendingApps = useMemo(() => applications.filter((a) => a.status === 'pending'), [applications]);
  const pendingMemos = useMemo(() => memos.filter((m) => m.status === 'pending'), [memos]);
  const openPredictions = predictions.filter((p) => p.status === 'OPEN');
  const liveRaises = creators.filter((c) => c.status !== 'ENDED');
  const totalRaised = creators.reduce((sum, c) => sum + (c.totalRaisedXAF ?? 0), 0);

  if (!user || !user.admin) {
    return (
      <div className="py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-display text-lg font-bold">Committee access required</h1>
        <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">This terminal is restricted to verified exchange administrators.</p>
        <button type="button" onClick={onExit} className="px-6 py-2.5 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold">
          Back to exchange
        </button>
      </div>
    );
  }

  // Shared action runner: sets a banner and busy state around any async admin call.
  async function run(label: string, fn: () => Promise<string | void>, after?: () => void) {
    setBanner(null);
    try {
      const msg = await fn();
      setBanner(msg || label);
      after?.();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : `${label} failed.`);
    }
  }

  async function reviewApp(app: CreatorApplication, decision: 'approved' | 'rejected') {
    setBusyId(app.id);
    await run(`${app.stageName} ${decision}`, async () => {
      await adminReviewApplication({ app, decision, initialSharePriceXAF: priceByAppId[app.id] });
      return `${app.stageName} ${decision}.`;
    });
    setBusyId(null);
  }

  async function checkBio(app: CreatorApplication) {
    setCheckingBioAppId(app.id);
    await run('Bio check', async () => {
      const result = await verifyClaimBioCodeOnServer({
        stageName: app.stageName,
        handle: app.handle,
        bioVerificationCode: app.bioVerificationCode || `CRIPPO-${app.uid.slice(0, 6).toUpperCase()}`,
        socialUrl: app.tiktokUrl || app.facebookUrl,
      });
      setBioCheckByAppId((prev) => ({ ...prev, [app.id]: result }));
      return result.codeFoundInPublicProfile
        ? `Bio code verified on ${app.stageName} (${result.confidenceScore}% confidence).`
        : `Bio code not found for ${app.stageName}: ${result.notes}`;
    });
    setCheckingBioAppId(null);
  }

  async function audit() {
    setAuditing(true);
    await run('Underwriting', async () => {
      const res = await runUnderwritingAudit({
        stageName: name || 'New project',
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
      return `AI market index ${res.underwritingScore}/100 · initial price ${formatXAF(res.initialSharePriceXAF)}`;
    });
    setAuditing(false);
  }

  async function createListing(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreatingListing(true);
    await run('Listing', async () => {
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
      setName('');
      setHandle('');
      setRaiseTitle('');
      return `Listed ${created.name} at ${formatXAF(created.sharePriceXAF)}/share.`;
    });
    setCreatingListing(false);
  }

  async function postCatalyst(e: React.FormEvent) {
    e.preventDefault();
    const target = creators.find((c) => c.id === catCreatorId) || creators[0];
    if (!target) return;
    setPostingCatalyst(true);
    await run('Catalyst', async () => {
      await adminApplyCulturalCatalyst({ creator: target, sourceName: catSource, headline: catHeadline, impactPct: catImpactPct, city: target.city });
      setCatHeadline('');
      return `Catalyst published for ${target.name} (${catImpactPct >= 0 ? '+' : ''}${catImpactPct}%).`;
    });
    setPostingCatalyst(false);
  }

  async function runPulse(e: React.FormEvent) {
    e.preventDefault();
    setRunningPulse(true);
    await run('Pulse agent', async () => {
      const blogUrls = blogUrlsInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s));
      const manualHeadlines = manualHeadlinesInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split('|');
          return parts.length >= 2
            ? { sourceName: parts[0].trim(), headline: parts.slice(1).join('|').trim() }
            : { sourceName: 'Cameroon Entertainment Desk', headline: line };
        });
      const res = await runPulseAgentOnServer({ creators, blogUrls, manualHeadlines });
      setPulsePreview(res);
      return res.summary;
    });
    setRunningPulse(false);
  }

  async function commitPulse() {
    if (!user || !pulsePreview) return;
    setCommittingPulse(true);
    await run('Commit pulse', async () => {
      const stats = await adminCommitAgentPulse({ adminUid: user.uid, creators, pulse: pulsePreview, includeCatalysts: true, includePredictions: true });
      setPulsePreview(null);
      return `Committed ${stats.postsCommitted} catalysts, repriced ${stats.creatorsRepriced} raises, opened ${stats.predictionsOpened} prediction pools.`;
    });
    setCommittingPulse(false);
  }

  async function createPrediction(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPred(true);
    await run('Prediction', async () => {
      const created = await adminCreatePrediction({
        questionEn: predQuestionEn,
        questionFr: predQuestionFr || predQuestionEn,
        category: predCategory,
        resolutionCriteria: predCriteria,
        initialYesPoolXAF: predYesPool,
        initialNoPoolXAF: predNoPool,
      });
      setPredQuestionEn('');
      setPredQuestionFr('');
      setPredCriteria('');
      return `Published prediction: ${created.questionEn}`;
    });
    setCreatingPred(false);
  }

  async function createBrand(e: React.FormEvent) {
    e.preventDefault();
    setCreatingBrand(true);
    await run('Brand campaign', async () => {
      await adminCreateBrandCampaign({
        brandName,
        agencyName: agencyName || undefined,
        titleEn: brandTitleEn,
        titleFr: brandTitleFr || brandTitleEn,
        category: brandCategory,
        budgetXAF: brandBudget,
        deliverable: brandDeliverable,
      });
      setBrandName('');
      setAgencyName('');
      setBrandTitleEn('');
      setBrandTitleFr('');
      setBrandDeliverable('');
      return `Published brand campaign for ${brandName}.`;
    });
    setCreatingBrand(false);
  }

  async function bootstrap() {
    setBootstrapping(true);
    await run('Starter markets', async () => {
      await adminBootstrapExchangeCatalog(user!.uid);
      return 'Published starter Cameroon raises, predictions, catalysts and brand campaigns.';
    });
    setBootstrapping(false);
  }

  async function syncNow() {
    setSyncing(true);
    await run('Sync', async () => {
      const res = await adminRunAggregatorSync(user!.uid);
      return res.message;
    });
    setSyncing(false);
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-2 px-4 py-2 rounded-[4px] bg-white shadow-sm text-xs font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to exchange
        </button>
        <div className="flex items-center gap-2">
          <span className="label-xs px-2.5 py-1 rounded-full bg-[#059669]/10 text-[#059669]">Admin · {user.fullName}</span>
          <button type="button" disabled={bootstrapping} onClick={bootstrap} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold disabled:opacity-50">
            <Rocket className="w-3.5 h-3.5" /> {bootstrapping ? 'Publishing…' : 'Publish starter markets'}
          </button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">Creator Studio · Treasury</h1>
        <p className="text-xs text-[#64748B]">Underwriting, escrow, predictions, brands and pipeline.</p>
      </div>

      {banner && <div className="card p-3.5 text-xs leading-relaxed text-[#1E0B36] border border-[#6C2BD9]/20">{banner}</div>}

      {/* Section nav: horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setSection(s.id)} className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap ${section === s.id ? 'bg-[#1E0B36] text-white' : 'bg-white shadow-sm text-[#64748B]'}`}>
            {s.label}
            {s.id === 'applications' && pendingApps.length > 0 && <span className="ml-1.5 num">({pendingApps.length})</span>}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Pending applications" value={pendingApps.length} />
            <Kpi label="Live raises" value={liveRaises.length} />
            <Kpi label="Capital raised" value={formatXAF(totalRaised)} />
            <Kpi label="Open predictions" value={openPredictions.length} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Integrations</h2>
              <IntegrationRow label="Gemini (underwriting, agents)" ok={!!aggStatus?.geminiConfigured} />
              <IntegrationRow label={`Facebook · ${aggStatus?.facebookProvider || '—'}`} ok={!!aggStatus?.facebookConfigured} />
              <IntegrationRow label={`TikTok · ${aggStatus?.tiktokProvider || '—'}`} ok={!!aggStatus?.tiktokConfigured} />
            </div>
            <div className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Pending memos</h2>
              {pendingMemos.length === 0 ? (
                <p className="text-xs text-[#64748B]">No pending memo requests.</p>
              ) : (
                pendingMemos.slice(0, 4).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="font-semibold truncate">{m.creatorName}</span>
                    <span className="label-xs text-[#6C2BD9]">{m.platform}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'applications' && (
        <div className="space-y-4">
          {applications.length === 0 && <p className="text-xs text-[#64748B]">No applications yet.</p>}
          {applications.map((app) => {
            const bio = bioCheckByAppId[app.id];
            return (
              <div key={app.id} className="card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{app.stageName} <span className="text-[#64748B] font-normal text-xs">{app.handle}</span></p>
                    <p className="text-xs text-[#64748B]">{app.category} · {app.city || '—'} · {new Date(app.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`label-xs px-2.5 py-1 rounded-full ${app.status === 'pending' ? 'bg-[#6C2BD9]/10 text-[#6C2BD9]' : app.status === 'approved' ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#DC2626]/10 text-[#DC2626]'}`}>
                    {app.status}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">{app.pitch}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Field label="Budget" value={app.netBudgetXAF ? formatXAF(app.netBudgetXAF) : '—'} />
                  <Field label="Shares" value={app.totalShares ? app.totalShares.toLocaleString() : '—'} />
                  <Field label="Rev share" value={app.revSharePct ? `${app.revSharePct}%` : '—'} />
                  <Field label="MoMo" value={app.momoNumber || '—'} />
                </div>
                {bio && (
                  <p className={`text-xs ${bio.codeFoundInPublicProfile ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                    Bio check: {bio.codeFoundInPublicProfile ? 'found' : 'not found'} · {bio.confidenceScore}% · {bio.notes}
                  </p>
                )}
                {app.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button type="button" onClick={() => checkBio(app)} disabled={checkingBioAppId === app.id} className="px-3.5 py-2 rounded-[4px] bg-[#F2F3FF] text-xs font-semibold disabled:opacity-50">
                      {checkingBioAppId === app.id ? 'Checking…' : 'Check bio code'}
                    </button>
                    <input
                      type="number"
                      placeholder="Initial price XAF"
                      value={priceByAppId[app.id] ?? ''}
                      onChange={(e) => setPriceByAppId((p) => ({ ...p, [app.id]: Number(e.target.value) || 0 }))}
                      className="w-40 px-3 py-2 text-xs bg-white border border-[#E2E8F0] rounded-[4px] num"
                    />
                    <button type="button" disabled={busyId === app.id} onClick={() => reviewApp(app, 'approved')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-[#059669] text-white text-xs font-semibold disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button type="button" disabled={busyId === app.id} onClick={() => reviewApp(app, 'rejected')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-[#DC2626] text-white text-xs font-semibold disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {section === 'labels' && (
        <div className="space-y-3">
          {labels.length === 0 && <p className="text-xs text-[#64748B]">No labels registered yet.</p>}
          {labels.map((l) => (
            <div key={l.id} className="card p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-semibold">{l.name}</p>
                <p className="text-xs text-[#64748B]">{l.country}{l.rccmNumber ? ` · RCCM ${l.rccmNumber}` : ''} · {new Date(l.createdAt).toLocaleDateString()}</p>
                <p className="text-xs text-[#64748B] line-clamp-2 mt-1">{l.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`label-xs px-2.5 py-1 rounded-full ${l.status === 'approved' ? 'bg-[#059669]/10 text-[#059669]' : l.status === 'rejected' ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-[#6C2BD9]/10 text-[#6C2BD9]'}`}>{l.status}</span>
                {l.status === 'pending' && (
                  <>
                    <button type="button" onClick={() => run('Label', async () => { await adminReviewLabel(l.id, 'approved'); return `${l.name} approved.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#059669] text-white text-xs font-semibold">Approve</button>
                    <button type="button" onClick={() => run('Label', async () => { await adminReviewLabel(l.id, 'rejected'); return `${l.name} rejected.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#DC2626] text-white text-xs font-semibold">Reject</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'agents' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={(e) => { e.preventDefault(); audit(); }} className="card p-5 space-y-4">
            <div className="flex items-center gap-2"><Bot className="w-4 h-4 text-[#6C2BD9]" /><h2 className="font-display text-base font-semibold">Underwriting audit</h2></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelClass}>Stage name</label><input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} /></div>
              <div><label className={labelClass}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as Creator['category'])} className={`${inputClass} mt-1`}>
                  {['Music & Albums', 'TikTok Series', 'Movies & Docs', 'Podcasts'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={labelClass}>Followers</label><input type="number" value={followersCount} onChange={(e) => setFollowersCount(Number(e.target.value) || 0)} className={`${inputClass} mt-1 num`} /></div>
              <div><label className={labelClass}>Engagement %</label><input type="number" step="0.1" value={engagementRate} onChange={(e) => setEngagementRate(Number(e.target.value) || 0)} className={`${inputClass} mt-1 num`} /></div>
              <div><label className={labelClass}>View velocity</label><input type="number" value={viewVelocity} onChange={(e) => setViewVelocity(Number(e.target.value) || 0)} className={`${inputClass} mt-1 num`} /></div>
              <div><label className={labelClass}>Net budget XAF</label><input type="number" value={netBudgetXAF} onChange={(e) => setNetBudgetXAF(Number(e.target.value) || 0)} className={`${inputClass} mt-1 num`} /></div>
            </div>
            <button type="submit" disabled={auditing} className="w-full py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">{auditing ? 'Auditing…' : 'Run underwriting'}</button>
            {underwriting && (
              <div className="rounded-[8px] bg-[#F8F9FC] p-4 grid grid-cols-2 gap-3 text-xs">
                <Field label="Score" value={`${underwriting.underwritingScore}/100`} />
                <Field label="Initial price" value={formatXAF(underwriting.initialSharePriceXAF)} />
                <Field label="Gross target" value={formatXAF(underwriting.grossTargetXAF)} />
                <Field label="Max net budget" value={formatXAF(underwriting.recommendedMaxNetBudgetXAF)} />
                <p className="col-span-2 text-[#64748B] leading-relaxed">{underwriting.verdictEn}</p>
              </div>
            )}
          </form>

          <div className="space-y-5">
            <form onSubmit={runPulse} className="card p-5 space-y-3">
              <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-[#6C2BD9]" /><h2 className="font-display text-base font-semibold">Market pulse agent</h2></div>
              <textarea value={blogUrlsInput} onChange={(e) => setBlogUrlsInput(e.target.value)} rows={3} placeholder="Blog or RSS URLs, one per line" className={inputClass} />
              <textarea value={manualHeadlinesInput} onChange={(e) => setManualHeadlinesInput(e.target.value)} rows={3} placeholder="Source | Headline (one per line)" className={inputClass} />
              <button type="submit" disabled={runningPulse} className="w-full py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">{runningPulse ? 'Running…' : 'Run pulse'}</button>
              {pulsePreview && (
                <div className="rounded-[8px] bg-[#F8F9FC] p-4 space-y-2 text-xs">
                  <p className="text-[#64748B]">{pulsePreview.summary}</p>
                  <p>{pulsePreview.catalysts.length} catalysts · {pulsePreview.generatedPredictions.length} predictions</p>
                  <button type="button" onClick={commitPulse} disabled={committingPulse} className="px-4 py-2 rounded-[4px] bg-[#059669] text-white font-semibold disabled:opacity-50">
                    {committingPulse ? 'Committing…' : 'Commit to market'}
                  </button>
                </div>
              )}
            </form>

            <form onSubmit={postCatalyst} className="card p-5 space-y-3">
              <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-[#6C2BD9]" /><h2 className="font-display text-base font-semibold">Cultural catalyst</h2></div>
              <select value={catCreatorId} onChange={(e) => setCatCreatorId(e.target.value)} className={inputClass}>
                <option value="">{creators[0]?.name || 'No creators yet'}</option>
                {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input value={catSource} onChange={(e) => setCatSource(e.target.value)} placeholder="Source" className={inputClass} />
                <input type="number" step="0.5" value={catImpactPct} onChange={(e) => setCatImpactPct(Number(e.target.value) || 0)} className={`${inputClass} num`} />
              </div>
              <input value={catHeadline} onChange={(e) => setCatHeadline(e.target.value)} placeholder="Headline" className={inputClass} />
              <button type="submit" disabled={postingCatalyst || !creators.length} className="w-full py-3 rounded-[4px] bg-[#6C2BD9] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">{postingCatalyst ? 'Posting…' : 'Publish catalyst'}</button>
            </form>
          </div>
        </div>
      )}

      {section === 'raises' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Escrow stages</h2>
            {creators.length === 0 && <p className="text-xs text-[#64748B]">No raises yet.</p>}
            {creators.map((c) => (
              <div key={c.id} className="rounded-[8px] bg-[#F8F9FC] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm truncate">{c.raiseTitle || c.name}</p>
                  <span className="label-xs text-[#6C2BD9]">{c.escrowStatus || 'ESCROW_HOLDING'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => run('Escrow', async () => { await adminAdvanceEscrowStage(c, 'TRANCHE_1_RELEASED', 'OPEN'); return `${c.name}: tranche 1 released.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#6C2BD9]/10 text-[#6C2BD9] text-xs font-semibold">Release tranche 1</button>
                  <button type="button" onClick={() => run('Escrow', async () => { await adminAdvanceEscrowStage(c, 'COMPLETED_LOCKED', 'FUNDED'); return `${c.name}: master verified and split locked.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#059669]/10 text-[#059669] text-xs font-semibold">Verify master & lock</button>
                  <button type="button" onClick={() => run('Escrow', async () => { await adminAdvanceEscrowStage(c, c.escrowStatus || 'COMPLETED_LOCKED', 'ENDED'); return `${c.name}: race closed.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#F2F3FF] text-xs font-semibold">Close race</button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={createListing} className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Publish a raise</h2>
            <div className="grid grid-cols-2 gap-3">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Creator name" className={inputClass} />
              <input required value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className={inputClass} />
              <input value={raiseTitle} onChange={(e) => setRaiseTitle(e.target.value)} placeholder="Raise title" className={`${inputClass} col-span-2`} />
              <select value={platform} onChange={(e) => setPlatform(e.target.value as NonNullable<Creator['platform']>)} className={inputClass}>
                {['TikTok', 'Facebook', 'YouTube', 'Multi-Platform'].map((p) => <option key={p}>{p}</option>)}
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={inputClass} />
              <input type="number" value={totalShares} onChange={(e) => setTotalShares(Number(e.target.value) || 0)} placeholder="Total shares" className={`${inputClass} num`} />
              <input type="number" value={revSharePct} onChange={(e) => setRevSharePct(Number(e.target.value) || 0)} placeholder="Rev share %" className={`${inputClass} num`} />
              <input type="number" value={roiDurationMonths} onChange={(e) => setRoiDurationMonths(Number(e.target.value) || 0)} placeholder="ROI months" className={`${inputClass} num`} />
              <input type="number" value={netBudgetXAF} onChange={(e) => setNetBudgetXAF(Number(e.target.value) || 0)} placeholder="Net budget XAF" className={`${inputClass} num col-span-2`} />
            </div>
            <button type="submit" disabled={creatingListing} className="w-full flex items-center justify-center gap-2 py-3 rounded-[4px] bg-[#059669] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">
              <PlusCircle className="w-4 h-4" /> {creatingListing ? 'Publishing…' : 'Publish raise'}
            </button>
          </form>
        </div>
      )}

      {section === 'predictions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Open predictions</h2>
            {openPredictions.length === 0 && <p className="text-xs text-[#64748B]">No open predictions.</p>}
            {openPredictions.map((p) => (
              <div key={p.id} className="rounded-[8px] bg-[#F8F9FC] p-4 space-y-2">
                <p className="text-sm font-semibold">{p.questionEn}</p>
                <p className="num text-xs text-[#64748B]">{p.yesProbabilityPct}% YES · {formatXAF(p.totalVolumeXAF)} volume</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => run('Resolve', async () => { await adminResolvePrediction(p.id, 'RESOLVED_YES'); return 'Resolved YES.'; })} className="px-3 py-1.5 rounded-[4px] bg-[#059669]/10 text-[#059669] text-xs font-semibold">Resolve YES</button>
                  <button type="button" onClick={() => run('Resolve', async () => { await adminResolvePrediction(p.id, 'RESOLVED_NO'); return 'Resolved NO.'; })} className="px-3 py-1.5 rounded-[4px] bg-[#DC2626]/10 text-[#DC2626] text-xs font-semibold">Resolve NO</button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={createPrediction} className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">New prediction contract</h2>
            <input required value={predQuestionEn} onChange={(e) => setPredQuestionEn(e.target.value)} placeholder="Question (EN)" className={inputClass} />
            <input value={predQuestionFr} onChange={(e) => setPredQuestionFr(e.target.value)} placeholder="Question (FR)" className={inputClass} />
            <select value={predCategory} onChange={(e) => setPredCategory(e.target.value as PredictionMarket['category'])} className={inputClass}>
              {['Music & Albums', 'TikTok Series', 'Movies & Docs', 'Awards', 'Culture', 'Tech'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <textarea value={predCriteria} onChange={(e) => setPredCriteria(e.target.value)} rows={2} placeholder="Resolution criteria" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={predYesPool} onChange={(e) => setPredYesPool(Number(e.target.value) || 0)} className={`${inputClass} num`} placeholder="YES pool" />
              <input type="number" value={predNoPool} onChange={(e) => setPredNoPool(Number(e.target.value) || 0)} className={`${inputClass} num`} placeholder="NO pool" />
            </div>
            <button type="submit" disabled={creatingPred} className="w-full py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">{creatingPred ? 'Publishing…' : 'Publish prediction'}</button>
          </form>
        </div>
      )}

      {section === 'brands' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-5">
            <div className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Brand applications</h2>
              {brandApplications.length === 0 && <p className="text-xs text-[#64748B]">No brand applications.</p>}
              {brandApplications.map((b) => (
                <div key={b.id} className="rounded-[8px] bg-[#F8F9FC] p-4 space-y-2 text-xs">
                  <p className="font-semibold">{b.creatorName} → {b.brandName}</p>
                  <p className="text-[#64748B]">{b.campaignTitle} · {formatXAF(b.proposedFeeXAF)}</p>
                  {b.status === 'pending' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => run('Brand review', async () => { await adminReviewBrandApplication(b, 'accepted'); return `Accepted ${b.creatorName}.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#059669] text-white font-semibold">Accept</button>
                      <button type="button" onClick={() => run('Brand review', async () => { await adminReviewBrandApplication(b, 'rejected'); return `Rejected ${b.creatorName}.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#DC2626] text-white font-semibold">Reject</button>
                    </div>
                  )}
                  {b.status !== 'pending' && <span className="label-xs">{b.status}</span>}
                </div>
              ))}
            </div>
            <div className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Memo requests</h2>
              {memos.length === 0 && <p className="text-xs text-[#64748B]">No memo requests.</p>}
              {memos.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-xs py-2 border-b border-[#E2E8F0] last:border-0">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{m.creatorName}</p>
                    <p className="text-[#64748B]">{m.platform} · {m.status}</p>
                  </div>
                  {m.status === 'pending' && (
                    <button type="button" onClick={() => run('Memo', async () => { await adminUpdateMemoStatus(m.id, 'reviewed'); return `${m.creatorName} marked reviewed.`; })} className="px-3 py-1.5 rounded-[4px] bg-[#F2F3FF] font-semibold shrink-0">Mark reviewed</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <form onSubmit={createBrand} className="card p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">New brand campaign</h2>
              <div className="grid grid-cols-2 gap-3">
                <input required value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand" className={inputClass} />
                <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Agency (optional)" className={inputClass} />
                <input required value={brandTitleEn} onChange={(e) => setBrandTitleEn(e.target.value)} placeholder="Title (EN)" className={`${inputClass} col-span-2`} />
                <input value={brandTitleFr} onChange={(e) => setBrandTitleFr(e.target.value)} placeholder="Title (FR)" className={`${inputClass} col-span-2`} />
                <select value={brandCategory} onChange={(e) => setBrandCategory(e.target.value)} className={inputClass}>
                  {['Music & Albums', 'TikTok Series', 'Movies & Docs', 'Podcasts'].map((c) => <option key={c}>{c}</option>)}
                </select>
                <input type="number" value={brandBudget} onChange={(e) => setBrandBudget(Number(e.target.value) || 0)} className={`${inputClass} num`} placeholder="Budget XAF" />
                <textarea value={brandDeliverable} onChange={(e) => setBrandDeliverable(e.target.value)} rows={2} placeholder="Deliverable" className={`${inputClass} col-span-2`} />
              </div>
              <button type="submit" disabled={creatingBrand} className="w-full py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">{creatingBrand ? 'Publishing…' : 'Publish campaign'}</button>
            </form>
            <div className="card p-5 space-y-2">
              <h2 className="font-display text-base font-semibold">Live campaigns</h2>
              {campaigns.length === 0 && <p className="text-xs text-[#64748B]">None yet.</p>}
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1.5">
                  <span className="truncate">{c.brandName} · {c.titleEn}</span>
                  <span className="num font-semibold">{formatXAF(c.budgetXAF)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Pipeline</h2>
            <IntegrationRow label="Gemini" ok={!!aggStatus?.geminiConfigured} />
            <IntegrationRow label={`Facebook · ${aggStatus?.facebookProvider || '—'}`} ok={!!aggStatus?.facebookConfigured} />
            <IntegrationRow label={`TikTok · ${aggStatus?.tiktokProvider || '—'}`} ok={!!aggStatus?.tiktokConfigured} />
            <button type="button" onClick={syncNow} disabled={syncing} className="w-full py-3 rounded-[4px] bg-[#1E0B36] text-white text-xs font-semibold uppercase tracking-wide disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Run sync now'}
            </button>
          </div>
          <div className="card p-5 space-y-2">
            <h2 className="font-display text-base font-semibold">Sync log</h2>
            {syncLogs.length === 0 && <p className="text-xs text-[#64748B]">No sync runs yet.</p>}
            {syncLogs.slice(0, 15).map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 text-xs py-2 border-b border-[#E2E8F0] last:border-0">
                <div className="min-w-0">
                  <p className="font-semibold">{l.provider} · {l.postsFetched} posts</p>
                  <p className="text-[#64748B] truncate">{l.message || ''}</p>
                </div>
                <span className={`label-xs shrink-0 ${l.status === 'success' ? 'text-[#059669]' : l.status === 'error' ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>{l.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="card p-4">
    <p className="label-xs text-[#64748B]">{label}</p>
    <p className="num font-display text-2xl font-bold mt-1">{value}</p>
  </div>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="label-xs text-[#64748B]">{label}</p>
    <p className="num font-semibold mt-0.5 truncate">{value}</p>
  </div>
);

const IntegrationRow: React.FC<{ label: string; ok: boolean }> = ({ label, ok }) => (
  <div className="flex items-center justify-between text-xs py-1.5">
    <span>{label}</span>
    <span className={`label-xs px-2 py-0.5 rounded-full ${ok ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#F2F3FF] text-[#64748B]'}`}>{ok ? 'Configured' : 'Not set'}</span>
  </div>
);
