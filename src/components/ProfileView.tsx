import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  ArrowRight,
  Award,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Layers,
  LogOut,
  Moon,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  runUnderwritingAudit,
  submitBrandApplication,
  submitCreatorApplication,
  updateUserProfileFields,
  uploadFileToStorage,
} from '../services/firestoreService';
import type {
  BrandApplication,
  BrandCampaign,
  Creator,
  CreatorApplication,
  PredictionVote,
  Trade,
  UnderwritingResult,
  UserProfile,
  WalletTransaction,
} from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatTimeRemaining, formatXAF } from '../utils/format';

interface ProfileViewProps {
  user: UserProfile | null;
  creators: Creator[];
  trades: Trade[];
  predictionVotes: PredictionVote[];
  walletTxs: WalletTransaction[];
  brandCampaigns: BrandCampaign[];
  myBrandApplications: BrandApplication[];
  myApplications: CreatorApplication[];
  claimTargetCreator?: Creator | null;
  onClearClaimTarget?: () => void;
  lang: AppLang;
  onToggleLang: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onReplayOnboarding: () => void;
  onSelectCreator: (creator: Creator) => void;
  onOpenPortfolio: () => void;
  onRequireAuth: () => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  creators,
  trades,
  predictionVotes,
  walletTxs,
  brandCampaigns,
  myBrandApplications,
  myApplications,
  claimTargetCreator,
  onClearClaimTarget,
  lang,
  onToggleLang,
  isDark,
  onToggleTheme,
  onReplayOnboarding,
  onSelectCreator,
  onOpenPortfolio,
  onRequireAuth,
  onOpenAdmin,
  onOpenWallet,
}) => {
  const t = translations[lang];
  const [roleMode, setRoleMode] = useState<'investor' | 'creator'>('investor');
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(user?.fullName || '');
  const [cityInput, setCityInput] = useState(user?.city || '');
  const [momoPhoneInput, setMomoPhoneInput] = useState(user?.momoPhone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Claim / Launch Raise Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [claimCreatorId, setClaimCreatorId] = useState<string | undefined>(undefined);
  const [stageName, setStageName] = useState('');
  const [handle, setHandle] = useState('');
  const [category, setCategory] = useState('Music & Albums');
  const [city, setCity] = useState('Douala');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [kycDocType, setKycDocType] = useState<'CNI' | 'Passport' | 'RCCM'>('CNI');
  const [momoNumber, setMomoNumber] = useState(user?.momoPhone || '+237 6');
  const [netBudgetXAF, setNetBudgetXAF] = useState(2000000);
  const [totalShares, setTotalShares] = useState(1000);
  const [revSharePct, setRevSharePct] = useState(25);
  const [youtube30dViews, setYoutube30dViews] = useState(120000);
  const [spotifyMonthlyListeners, setSpotifyMonthlyListeners] = useState(24000);
  const [tiktokVelocity, setTiktokVelocity] = useState(180000);
  const [engagementRate, setEngagementRate] = useState(6.8);
  const [diasporaSharePct] = useState(28);
  const [auditResult, setAuditResult] = useState<UnderwritingResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [pitch, setPitch] = useState('');
  const [verificationMediaUrl, setVerificationMediaUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Brand Campaign Pitch Modal (Verified Creators Only)
  const [applyingCampaign, setApplyingCampaign] = useState<BrandCampaign | null>(null);
  const [brandPitch, setBrandPitch] = useState('');
  const [brandFeeXAF, setBrandFeeXAF] = useState(1500000);
  const [submittingBrandApp, setSubmittingBrandApp] = useState(false);
  const [brandAppError, setBrandAppError] = useState<string | null>(null);

  const bioCode = useMemo(() => {
    if (!user) return 'CRIPPO-237';
    return `CRIPPO-${user.uid.slice(0, 6).toUpperCase()}`;
  }, [user]);

  useEffect(() => {
    if (claimTargetCreator && user) {
      setRoleMode('creator');
      setClaimCreatorId(claimTargetCreator.id);
      setStageName(claimTargetCreator.name);
      setHandle(claimTargetCreator.handle);
      setCategory(claimTargetCreator.category || 'Music & Albums');
      setCity(claimTargetCreator.city || 'Douala');
      setWizardError(null);
      setWizardStep(1);
      setAuditResult(null);
      setWizardOpen(true);
      onClearClaimTarget?.();
    }
  }, [claimTargetCreator, user, onClearClaimTarget]);

  const unclaimedCreators = useMemo(
    () => creators.filter((c) => c.claimStatus === 'UNCLAIMED'),
    [creators]
  );

  const creatorMap = useMemo(() => {
    const m = new Map<string, Creator>();
    for (const c of creators) m.set(c.id, c);
    return m;
  }, [creators]);

  const liveEquityXAF = useMemo(() => {
    let total = 0;
    const netByCreator = new Map<string, number>();
    for (const tr of trades) {
      const prev = netByCreator.get(tr.creatorId) || 0;
      netByCreator.set(tr.creatorId, prev + (tr.side === 'SELL' ? -tr.sharesHeld : tr.sharesHeld));
    }
    for (const [cid, qty] of netByCreator.entries()) {
      if (qty <= 0) continue;
      const c = creatorMap.get(cid);
      if (c) total += qty * c.sharePriceXAF;
    }
    return total;
  }, [trades, creatorMap]);

  if (!user) {
    return (
      <div className="space-y-8 py-10 px-2">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#6C2BD9]/15 text-[#6C2BD9] flex items-center justify-center mx-auto">
            <UserIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8F9FC]">{t.profile}</h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#A99BC8] max-w-sm mx-auto leading-relaxed">
              {lang === 'FR'
                ? 'Connectez-vous pour gérer votre argent Mobile Money, suivre vos trades et réclamer votre profil créateur.'
                : 'Sign in to manage your MoMo wallet, inspect active trades, switch to Creator Studio, or claim your creator profile.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-7 py-3.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold transition-colors"
          >
            {t.logIn}
          </button>
        </div>

        {/* App Preferences remain accessible even before sign-in */}
        <div className="rounded-lg bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A99BC8]">
            {lang === 'FR' ? 'Préférences' : 'App Preferences'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold"
            >
              <span>{lang === 'FR' ? 'Thème' : 'Theme'}</span>
              <span className="inline-flex items-center gap-1.5 text-[#6C2BD9]">
                {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {isDark ? 'Dark' : 'Light'}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold"
            >
              <span>{lang === 'FR' ? 'Langue' : 'Language'}</span>
              <span className="inline-flex items-center gap-1.5 text-[#6C2BD9]">
                <Globe className="w-3.5 h-3.5" />
                {lang === 'FR' ? 'Français' : 'English'}
              </span>
            </button>
            <button
              type="button"
              onClick={onReplayOnboarding}
              className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold"
            >
              <span>{lang === 'FR' ? 'Guide d’accueil' : 'Intro Guide'}</span>
              <Sparkles className="w-3.5 h-3.5 text-[#6C2BD9]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myCreatorListing = user.creatorId
    ? creators.find((c) => c.id === user.creatorId)
    : creators.find((c) => c.claimedByUid === user.uid || c.ownerUid === user.uid);

  const latestApp = myApplications[0];

  function openClaimWizard(preset?: Creator) {
    if (preset) {
      setClaimCreatorId(preset.id);
      setStageName(preset.name);
      setHandle(preset.handle);
      setCategory(preset.category || 'Music & Albums');
      setCity(preset.city || 'Douala');
    } else {
      setClaimCreatorId(undefined);
    }
    setWizardError(null);
    setWizardStep(1);
    setAuditResult(null);
    setWizardOpen(true);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    setProfileNotice(null);
    try {
      const url = await uploadFileToStorage('avatars', user.uid, file);
      await updateUserProfileFields(user.uid, { avatarUrl: url });
      setProfileNotice(lang === 'FR' ? 'Photo de profil mise à jour.' : 'Profile photo updated.');
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      await updateUserProfileFields(user.uid, {
        fullName: fullNameInput || user.fullName,
        city: cityInput,
        momoPhone: momoPhoneInput || undefined,
      });
      setEditingProfile(false);
      setProfileNotice(lang === 'FR' ? 'Profil enregistré.' : 'Profile saved.');
    } catch (err) {
      setProfileNotice(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleVerificationUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setMediaUploading(true);
    setWizardError(null);
    try {
      const url = await uploadFileToStorage('verifications', user.uid, file);
      setVerificationMediaUrl(url);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Verification upload failed.');
    } finally {
      setMediaUploading(false);
    }
  }

  async function handleRunAudit() {
    setAuditing(true);
    setWizardError(null);
    try {
      const result = await runUnderwritingAudit({
        stageName: stageName || user?.fullName || 'Creator',
        category,
        youtube30dViews,
        spotifyMonthlyListeners,
        tiktokVelocity,
        engagementRate,
        diasporaSharePct,
        requestedNetBudgetXAF: netBudgetXAF,
        totalFixedShares: totalShares,
        roiDurationMonths: 12,
      });
      setAuditResult(result);
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Underwriting evaluation failed.');
    } finally {
      setAuditing(false);
    }
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setWizardError(null);
    setWizardSubmitting(true);
    try {
      const grossTarget = auditResult?.grossTargetXAF || Math.round(netBudgetXAF * 1.05);
      await submitCreatorApplication({
        uid: user.uid,
        claimCreatorId,
        stageName,
        handle,
        category,
        city,
        facebookUrl: facebookUrl || undefined,
        tiktokUrl: tiktokUrl || undefined,
        verificationMediaUrl: verificationMediaUrl || undefined,
        bioVerificationCode: bioCode,
        kycDocType,
        momoNumber,
        netBudgetXAF,
        totalShares,
        targetRaiseXAF: grossTarget,
        revSharePct,
        underwritingVerdict: auditResult?.verdictEn,
        pitch,
      });
      setWizardOpen(false);
      setWizardStep(1);
      setClaimCreatorId(undefined);
      setProfileNotice(
        lang === 'FR'
          ? 'Demande de réclamation/vérification envoyée au comité.'
          : 'Creator profile claim submitted for verification.'
      );
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setWizardSubmitting(false);
    }
  }

  async function handleSubmitBrandPitch(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !applyingCampaign || !user.isVerifiedCreator) return;
    setSubmittingBrandApp(true);
    setBrandAppError(null);
    try {
      await submitBrandApplication({
        campaign: applyingCampaign,
        uid: user.uid,
        creatorId: myCreatorListing?.id || user.creatorId || user.uid,
        creatorName: myCreatorListing?.name || user.fullName,
        pitch: brandPitch,
        proposedFeeXAF: brandFeeXAF,
      });
      setApplyingCampaign(null);
      setBrandPitch('');
      setProfileNotice(
        lang === 'FR'
          ? 'Candidature envoyée à la marque & agence.'
          : 'Brand campaign pitch submitted for brand/agency review.'
      );
    } catch (err) {
      setBrandAppError(err instanceof Error ? err.message : 'Could not apply to campaign.');
    } finally {
      setSubmittingBrandApp(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. User Identity + Investor ↔ Creator Mode Switch */}
      <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <label className="relative cursor-pointer group shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-full object-cover bg-[#F8F9FC] dark:bg-[#0F172A]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#6C2BD9] text-white text-lg font-bold flex items-center justify-center">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-center text-[#0F172A] dark:text-[#F8F9FC] group-hover:text-[#6C2BD9]">
                <Camera className="w-3.5 h-3.5" />
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
                className="hidden"
              />
            </label>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8F9FC] truncate">
                  {user.fullName}
                </h1>
                {user.isVerifiedCreator && <CheckCircle2 className="w-4 h-4 text-[#6C2BD9] shrink-0" />}
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#A99BC8] truncate">{user.email}</p>
              <p className="text-[11px] text-[#7E6FA1] mt-0.5 truncate">
                {user.anonymousId}
                {user.city ? ` · ${user.city}` : ''}
                {user.momoPhone ? ` · ${user.momoPhone}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFullNameInput(user.fullName);
              setCityInput(user.city || '');
              setMomoPhoneInput(user.momoPhone || '');
              setEditingProfile((v) => !v);
            }}
            className="px-4 py-2 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold text-[#0F172A] dark:text-[#F8F9FC] shrink-0"
          >
            {editingProfile ? (lang === 'FR' ? 'Annuler' : 'Cancel') : lang === 'FR' ? 'Modifier' : 'Edit'}
          </button>
        </div>

        {/* Investor ↔ Creator Studio Mode Switch */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A]">
          <button
            type="button"
            onClick={() => setRoleMode('investor')}
            className={`py-2.5 px-4 rounded-full text-xs font-bold transition-colors ${
              roleMode === 'investor'
                ? 'bg-[#6C2BD9] text-white'
                : 'text-[#64748B] dark:text-[#A99BC8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {lang === 'FR' ? 'Investisseur & Trades' : 'Investor & Trades'}
          </button>
          <button
            type="button"
            onClick={() => setRoleMode('creator')}
            className={`py-2.5 px-4 rounded-full text-xs font-bold transition-colors ${
              roleMode === 'creator'
                ? 'bg-[#6C2BD9] text-white'
                : 'text-[#64748B] dark:text-[#A99BC8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {user.isVerifiedCreator
              ? 'Creator Studio'
              : lang === 'FR'
              ? 'Réclamer Profil Créateur'
              : 'Creator Mode & Claim'}
          </button>
        </div>

        {profileNotice && (
          <div className="px-4 py-3 rounded-lg bg-[#6C2BD9]/15 border border-violet-500/35 text-xs text-[#6C2BD9] dark:text-violet-300">
            {profileNotice}
          </div>
        )}

        {editingProfile && (
          <form onSubmit={handleSaveProfile} className="pt-3 border-t border-[#E2E8F0] dark:border-[#2A174A] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                placeholder="Full name"
                className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] focus:outline-none focus:border-violet-500"
              />
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="City (e.g. Buea, Douala)"
                className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] focus:outline-none focus:border-violet-500"
              />
              <input
                type="tel"
                value={momoPhoneInput}
                onChange={(e) => setMomoPhoneInput(e.target.value)}
                placeholder="MoMo (+237 6...)"
                className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold"
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}
      </div>

      {/* INVESTOR VIEW: YOUR MONEY + YOUR ACTIVE TRADES */}
      {roleMode === 'investor' ? (
        <div className="space-y-5">
          {/* Your Money Summary */}
          <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#6C2BD9]">
                  {lang === 'FR' ? 'Votre Argent' : 'Your Money'}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold font-display num text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-1">
                  {formatXAF((user.walletBalanceXAF || 0) + liveEquityXAF)}
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-5 py-3 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                <span>{t.depositMomo} / {t.withdrawMomo}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#2A174A] text-xs">
              <div>
                <div className="text-[#64748B] dark:text-[#A99BC8]">MoMo Cash</div>
                <div className="font-display num font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                  {formatXAF(user.walletBalanceXAF || 0)}
                </div>
              </div>
              <div>
                <div className="text-[#64748B] dark:text-[#A99BC8]">Active Equity</div>
                <div className="font-display num font-bold text-[#059669] tabular-nums mt-0.5">
                  {formatXAF(liveEquityXAF)}
                </div>
              </div>
              <div>
                <div className="text-[#64748B] dark:text-[#A99BC8]">Ledger Entries</div>
                <div className="font-display num font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                  {walletTxs.length}
                </div>
              </div>
            </div>
          </div>

          {/* Your Trades & Time Windows */}
          <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6C2BD9]" />
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                  {lang === 'FR' ? 'Vos Trades & Temps Restant' : 'Your Active Trades & Time Windows'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onOpenPortfolio}
                className="text-xs font-semibold text-[#6C2BD9] hover:underline"
              >
                {lang === 'FR' ? 'Tout voir' : 'Full Portfolio'} ({trades.length + predictionVotes.length})
              </button>
            </div>

            {trades.length === 0 && predictionVotes.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                {lang === 'FR'
                  ? 'Aucun trade actif pour le moment. Explorez le marché pour acheter des parts ou voter.'
                  : 'No active trades yet. Back a creator Raise or vote on a cultural pool to start tracking timelines.'}
              </p>
            ) : (
              <div className="divide-y divide-[#E2E8F0] dark:divide-[#2A174A]">
                {trades.slice(0, 5).map((tr) => {
                  const live = creatorMap.get(tr.creatorId);
                  const liveVal = tr.sharesHeld * (live?.sharePriceXAF || tr.entryPriceXAF);
                  return (
                    <div
                      key={tr.id}
                      onClick={() => live && onSelectCreator(live)}
                      className={`py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs ${
                        live ? 'cursor-pointer hover:opacity-80' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#0F172A] dark:text-[#F8F9FC] truncate">
                          {tr.side || 'BUY'} · {tr.creatorName}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8] flex items-center gap-2 mt-0.5 tabular-nums">
                          <span>{tr.sharesHeld} shares</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[#6C2BD9] font-semibold">
                            <Clock className="w-3 h-3" />
                            {tr.closesAt ? formatTimeRemaining(tr.closesAt) : 'Active'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-display num font-bold tabular-nums">
                        {formatXAF(liveVal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CREATOR STUDIO MODE (GATED BY CREATOR PROFILE CLAIMING) */
        <div className="space-y-5">
          {user.isVerifiedCreator ? (
            <>
              {/* Verified Creator Studio Telemetry */}
              <div className="bg-white dark:bg-[#180D2B] border border-violet-500/40 rounded-lg p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#6C2BD9]" />
                    <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                      Verified Creator Studio
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#059669]">
                    {myCreatorListing?.escrowStatus || 'VERIFIED & CLAIMED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A]">
                    <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">{t.raised}</div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                      {formatXAF(myCreatorListing?.totalRaisedXAF ?? user.totalRaisedXAF ?? 0)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A]">
                    <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">{t.sharePrice}</div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                      {formatXAF(myCreatorListing?.sharePriceXAF ?? user.currentValuationXAF ?? 0)}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A]">
                    <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">{t.sharesLeft}</div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                      {myCreatorListing?.sharesRemaining ?? myCreatorListing?.totalShares ?? 0}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A]">
                    <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">{t.investors}</div>
                    <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC] tabular-nums mt-0.5">
                      {myCreatorListing?.investorsCount ?? 0}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {myCreatorListing?.distributorSplitEmail && (
                    <div className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                      Clearinghouse Split:{' '}
                      <span className="font-display num font-semibold text-[#6C2BD9]">
                        {myCreatorListing.distributorSplitEmail}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => openClaimWizard()}
                    className="px-5 py-2.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold"
                  >
                    Launch New AI-Underwritten Raise
                  </button>
                </div>
              </div>

              {/* Brand & Agency Campaign Applications (Unlocked for Claimed Creators) */}
              <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#6C2BD9]" />
                    <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                      Open Brand & Agency Campaigns
                    </h2>
                  </div>
                  <span className="text-xs text-[#64748B] dark:text-[#A99BC8] tabular-nums">
                    {brandCampaigns.filter((b) => b.status === 'OPEN').length} open
                  </span>
                </div>

                {brandCampaigns.length === 0 ? (
                  <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                    No open brand or agency campaigns at the moment.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {brandCampaigns.map((camp) => {
                      const alreadyApplied = myBrandApplications.find((a) => a.campaignId === camp.id);
                      return (
                        <div
                          key={camp.id}
                          className="p-4 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-[#6C2BD9]">
                              {camp.brandName}
                              {camp.agencyName ? ` · via ${camp.agencyName}` : ''}
                            </span>
                            <span className="font-display num font-bold text-[#059669] tabular-nums">
                              {formatXAF(camp.budgetXAF)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                            {lang === 'FR' ? camp.titleFr : camp.titleEn}
                          </div>
                          {camp.deliverable && (
                            <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">{camp.deliverable}</p>
                          )}
                          <div className="pt-1">
                            {alreadyApplied ? (
                              <span className="text-xs font-semibold text-[#6C2BD9] capitalize">
                                Pitch Status: {alreadyApplied.status} ({formatXAF(alreadyApplied.proposedFeeXAF)})
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={camp.status !== 'OPEN'}
                                onClick={() => {
                                  setApplyingCampaign(camp);
                                  setBrandFeeXAF(Math.round(camp.budgetXAF * 0.4));
                                  setBrandAppError(null);
                                }}
                                className="px-5 py-2 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] disabled:opacity-40 text-white text-xs font-semibold"
                              >
                                Apply to Campaign
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* CREATOR CLAIM GATE: Must claim & verify profile before raising or applying to brands */
            <div className="space-y-4">
              {latestApp && (
                <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                      {latestApp.claimCreatorId ? 'Profile Claim' : 'Creator Verification'} · {latestApp.stageName}
                    </span>
                    <span
                      className={`text-xs font-bold capitalize ${
                        latestApp.status === 'approved'
                          ? 'text-[#059669]'
                          : latestApp.status === 'rejected'
                          ? 'text-[#DC2626]'
                          : 'text-[#6C2BD9]'
                      }`}
                    >
                      {latestApp.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                    {latestApp.status === 'pending'
                      ? 'Your Bio-Code ownership check, KYC, and Underwriting Audit are under review.'
                      : latestApp.adminNotes || 'Reviewed by Crippo Exchange Committee.'}
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                      {lang === 'FR' ? 'Réclamez votre profil créateur' : 'Claim & Verify Your Creator Profile'}
                    </h2>
                    <p className="text-xs text-[#64748B] dark:text-[#A99BC8] leading-relaxed">
                      {lang === 'FR'
                        ? 'Seuls les créateurs ayant réclamé et vérifié leur profil (Code Bio + CNI/Passeport + MoMo) peuvent lancer une levée ou postuler aux campagnes marques & agences.'
                        : 'Users cannot launch Raises or apply to Brand & Agency campaigns without first claiming and verifying their Creator Profile (Bio-Code + KYC + MoMo match).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openClaimWizard()}
                    className="px-5 py-2.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-xs font-semibold shrink-0"
                  >
                    {t.becomeCreator}
                  </button>
                </div>

                {unclaimedCreators.length > 0 && (
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#2A174A] space-y-2.5">
                    <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                      Pre-Indexed Unclaimed Directory Profiles
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {unclaimedCreators.map((uc) => (
                        <div
                          key={uc.id}
                          className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8F9FC] truncate">
                              {uc.name}
                            </div>
                            <div className="text-[11px] text-[#64748B] dark:text-[#A99BC8] truncate">
                              {uc.handle} · {uc.city || 'Cameroon'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openClaimWizard(uc)}
                            className="px-3.5 py-1.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-[11px] font-semibold shrink-0"
                          >
                            Claim
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Quick Entry */}
      {user.admin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full bg-[#0F172A] hover:bg-[#1c1033] border border-[#2A174A] text-white rounded-lg p-5 flex items-center justify-between gap-4 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#6C2BD9] text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">{t.adminConsole}</div>
              <div className="text-xs text-[#A99BC8]">
                AI Pulse Agents, Bio-Code Claim Verification, Brand Deals & Clearinghouse Escrow
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[#A99BC8] shrink-0" />
        </button>
      )}

      {/* App Preferences (Theme, Language, Replay Onboarding) */}
      <div className="bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A99BC8]">
          {lang === 'FR' ? 'Préférences & Apparence' : 'App Preferences'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold hover:border-violet-500"
          >
            <span>{lang === 'FR' ? 'Thème' : 'Theme'}</span>
            <span className="inline-flex items-center gap-1.5 text-[#6C2BD9]">
              {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {isDark ? 'Dark Purple' : 'Light'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold hover:border-violet-500"
          >
            <span>{lang === 'FR' ? 'Langue' : 'Language'}</span>
            <span className="inline-flex items-center gap-1.5 text-[#6C2BD9]">
              <Globe className="w-3.5 h-3.5" />
              {lang === 'FR' ? 'Français (FR)' : 'English (EN)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onReplayOnboarding}
            className="flex items-center justify-between px-4 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold hover:border-violet-500"
          >
            <span>{lang === 'FR' ? 'Revoir le guide' : 'Replay Intro Guide'}</span>
            <Sparkles className="w-3.5 h-3.5 text-[#6C2BD9]" />
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <button
        type="button"
        onClick={() => signOut(auth)}
        className="w-full py-3.5 px-5 rounded-full bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] hover:border-red-500/60 text-[#0F172A] dark:text-[#F8F9FC] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>{lang === 'FR' ? 'Déconnexion' : 'Sign out'}</span>
      </button>

      {/* Brand Campaign Pitch Modal */}
      {applyingCampaign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
          <form
            onSubmit={handleSubmitBrandPitch}
            className="w-full max-w-md bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-t-3xl sm:rounded-lg p-6 space-y-4 relative"
          >
            <button
              type="button"
              onClick={() => setApplyingCampaign(null)}
              aria-label="Close campaign pitch"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-10">
              <div className="text-xs font-bold text-[#6C2BD9]">
                {applyingCampaign.brandName}
                {applyingCampaign.agencyName ? ` · via ${applyingCampaign.agencyName}` : ''}
              </div>
              <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8F9FC] mt-0.5">
                {lang === 'FR' ? applyingCampaign.titleFr : applyingCampaign.titleEn}
              </h3>
            </div>

            {brandAppError && (
              <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-red-500/30 text-xs text-[#DC2626]">
                {brandAppError}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-[#64748B] dark:text-[#A99BC8]">
                Proposed Creator Fee (XAF)
              </label>
              <input
                type="number"
                min={50000}
                step={25000}
                required
                value={brandFeeXAF}
                onChange={(e) => setBrandFeeXAF(Number(e.target.value))}
                className="w-full mt-1 px-4 py-3 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full tabular-nums"
              />
            </div>

            <textarea
              required
              minLength={10}
              rows={3}
              value={brandPitch}
              onChange={(e) => setBrandPitch(e.target.value)}
              placeholder="Outline your integration concept, audience reach in Cameroon, and delivery timeline..."
              className="w-full px-4 py-3 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg resize-none"
            />

            <button
              type="submit"
              disabled={submittingBrandApp}
              className="w-full py-3.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{submittingBrandApp ? 'Sending Pitch...' : 'Submit Campaign Application'}</span>
            </button>
          </form>
        </div>
      )}

      {/* 3-Step Creator Claim & Pre-Listing Underwriting Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#180D2B] border border-[#E2E8F0] dark:border-[#2A174A] rounded-t-3xl sm:rounded-lg p-6 relative max-h-[92vh] overflow-y-auto space-y-5">
            <button
              type="button"
              onClick={() => setWizardOpen(false)}
              aria-label="Close onboarding wizard"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] flex items-center justify-center text-[#64748B] dark:text-[#A99BC8]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-10">
              <span className="text-xs font-semibold text-[#6C2BD9]">Step {wizardStep} of 3</span>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8F9FC] mt-0.5">
                {claimCreatorId
                  ? `Claim Directory Profile: ${stageName}`
                  : 'Creator Profile Verification & Raise Application'}
              </h2>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] space-y-2">
                  <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                    1. Social Bio-Code Ownership Proof
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                    Paste this unique code into your TikTok, YouTube, or Facebook bio until verification is approved:
                  </p>
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white dark:bg-[#180D2B] border border-violet-500/40">
                    <span className="font-display num text-sm font-bold text-[#6C2BD9]">{bioCode}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(bioCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 1800);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#6C2BD9]/15 text-[#6C2BD9] text-xs font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] space-y-1">
                  <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                    2. Two-Tranche Clearinghouse Escrow Protection
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#A99BC8]">
                    Tranche 1 (50%) releases at Raise Close; Tranche 2 (50%) unlocks upon verified master submission & distributor royalty split routing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="w-full py-3.5 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] text-white text-sm font-semibold"
                >
                  Continue to Identity & KYC
                </button>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    placeholder="Stage / Project Name *"
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  />
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@handle *"
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  >
                    <option value="Music & Albums">Music & Albums</option>
                    <option value="TikTok Series">TikTok Series</option>
                    <option value="Movies & Docs">Movies & Docs</option>
                    <option value="Podcasts">Podcasts</option>
                  </select>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City (Buea, Douala, Yaoundé)"
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value as 'CNI' | 'Passport' | 'RCCM')}
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  >
                    <option value="CNI">National ID (CNI)</option>
                    <option value="Passport">Passport</option>
                    <option value="RCCM">Label / Business RCCM</option>
                  </select>
                  <input
                    type="tel"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    placeholder="Verified MoMo (+237 6...)"
                    className="px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                  />
                </div>

                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="TikTok or YouTube profile URL"
                  className="w-full px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                />
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="Facebook page URL"
                  className="w-full px-4 py-2.5 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC]"
                />

                <label className="flex items-center justify-between p-4 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-dashed border-[#E2E8F0] dark:border-[#2A174A] cursor-pointer hover:border-violet-500">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Upload className="w-4 h-4 text-[#6C2BD9] shrink-0" />
                    <span className="text-xs font-medium text-[#0F172A] dark:text-[#F8F9FC] truncate">
                      {mediaUploading
                        ? 'Uploading to Verification Vault...'
                        : verificationMediaUrl
                        ? 'KYC / Channel Proof Attached'
                        : 'Upload CNI / Passport / Channel Screenshot'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleVerificationUpload}
                    disabled={mediaUploading}
                    className="hidden"
                  />
                </label>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-5 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold text-[#0F172A] dark:text-[#F8F9FC]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={stageName.trim().length < 2 || handle.trim().length < 2}
                    onClick={() => setWizardStep(3)}
                    className="flex-1 py-3 rounded-full bg-[#6C2BD9] disabled:opacity-40 text-white text-sm font-semibold"
                  >
                    Next: Budget & AI Underwriting
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <form onSubmit={handleSubmitApplication} className="space-y-3.5">
                {wizardError && (
                  <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-red-500/30 text-xs text-[#DC2626]">
                    {wizardError}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">Net Budget (XAF)</label>
                    <input
                      type="number"
                      min={100000}
                      step={50000}
                      value={netBudgetXAF}
                      onChange={(e) => setNetBudgetXAF(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">Fixed Shares</label>
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={totalShares}
                      onChange={(e) => setTotalShares(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#64748B] dark:text-[#A99BC8]">Rev Share (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={75}
                      value={revSharePct}
                      onChange={(e) => setRevSharePct(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full text-[#0F172A] dark:text-[#F8F9FC] tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-[#64748B] dark:text-[#A99BC8]">YouTube 30d</label>
                    <input
                      type="number"
                      min={0}
                      value={youtube30dViews}
                      onChange={(e) => setYoutube30dViews(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] dark:text-[#A99BC8]">Spotify Monthly</label>
                    <input
                      type="number"
                      min={0}
                      value={spotifyMonthlyListeners}
                      onChange={(e) => setSpotifyMonthlyListeners(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] dark:text-[#A99BC8]">TikTok Velocity</label>
                    <input
                      type="number"
                      min={0}
                      value={tiktokVelocity}
                      onChange={(e) => setTiktokVelocity(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] dark:text-[#A99BC8]">Engagement %</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={engagementRate}
                      onChange={(e) => setEngagementRate(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 text-xs bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-full tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={auditing}
                  onClick={handleRunAudit}
                  className="w-full py-2.5 rounded-full bg-[#6C2BD9]/15 hover:bg-[#6C2BD9]/25 border border-violet-500/40 text-[#6C2BD9] text-xs font-semibold"
                >
                  {auditing ? 'Running AI Underwriting Audit...' : 'Run Pre-Listing AI Underwriting Check'}
                </button>

                {auditResult && (
                  <div className="p-3.5 rounded-lg bg-[#F8F9FC] dark:bg-[#0F172A] border border-violet-500/35 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A] dark:text-[#F8F9FC]">
                        AI Market Index: {auditResult.underwritingScore}/100
                      </span>
                      <span className="font-display num font-bold text-[#059669]">
                        P₀ {formatXAF(auditResult.initialSharePriceXAF)}/share
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B] dark:text-[#A99BC8] tabular-nums">
                      <div>Gross Target (+5%): {formatXAF(auditResult.grossTargetXAF)}</div>
                      <div>12m Est. Rev: {formatXAF(auditResult.projected12mRevenueXAF)}</div>
                    </div>
                    <p className="text-[11px] text-[#544675] dark:text-[#B9ADD6]">
                      {lang === 'FR' ? auditResult.verdictFr : auditResult.verdictEn}
                    </p>
                  </div>
                )}

                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Describe your project deliverables, release timeline, and royalty sources *"
                  className="w-full px-4 py-3 text-sm bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] rounded-lg text-[#0F172A] dark:text-[#F8F9FC] resize-none"
                />

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-3 rounded-full bg-[#F8F9FC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2A174A] text-xs font-semibold text-[#0F172A] dark:text-[#F8F9FC]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={wizardSubmitting || mediaUploading}
                    className="flex-1 py-3 rounded-full bg-[#6C2BD9] hover:bg-[#6C2BD9] disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {wizardSubmitting
                      ? 'Submitting...'
                      : claimCreatorId
                      ? 'Submit Profile Claim'
                      : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
