import React, { useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Copy,
  LogOut,
  ShieldCheck,
  Sparkles,
  Upload,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  runUnderwritingAudit,
  submitCreatorApplication,
  updateUserProfileFields,
  uploadFileToStorage,
} from '../services/firestoreService';
import type { Creator, CreatorApplication, UnderwritingResult, UserProfile } from '../types/crippo';
import type { AppLang } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { formatXAF } from '../utils/format';

interface ProfileViewProps {
  user: UserProfile | null;
  creators: Creator[];
  myApplications: CreatorApplication[];
  lang: AppLang;
  onRequireAuth: () => void;
  onOpenAdmin: () => void;
  onOpenWallet: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  creators,
  myApplications,
  lang,
  onRequireAuth,
  onOpenAdmin,
  onOpenWallet,
}) => {
  const t = translations[lang];
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullNameInput, setFullNameInput] = useState(user?.fullName || '');
  const [cityInput, setCityInput] = useState(user?.city || '');
  const [momoPhoneInput, setMomoPhoneInput] = useState(user?.momoPhone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // 3-Step Creator Onboarding & Pre-Listing Underwriting Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
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
  const [diasporaSharePct, setDiasporaSharePct] = useState(28);
  const [auditResult, setAuditResult] = useState<UnderwritingResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [pitch, setPitch] = useState('');
  const [verificationMediaUrl, setVerificationMediaUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const bioCode = useMemo(() => {
    if (!user) return 'CRIPPO-237';
    return `CRIPPO-${user.uid.slice(0, 6).toUpperCase()}`;
  }, [user]);

  if (!user) {
    return (
      <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-600/15 text-violet-500 flex items-center justify-center mx-auto">
          <UserIcon className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#11081F] dark:text-[#F8F7FC]">{t.profile}</h2>
          <p className="text-xs text-[#645582] dark:text-[#A99BC8] max-w-xs mx-auto">
            {lang === 'FR'
              ? 'Connectez-vous pour gérer votre profil, votre portefeuille MoMo ou postuler comme créateur.'
              : 'Sign in to manage your investor account, MoMo wallet, or apply for a creator Raise.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
        >
          {t.logIn}
        </button>
      </div>
    );
  }

  const myCreatorListing = user.creatorId
    ? creators.find((c) => c.id === user.creatorId)
    : creators.find((c) => c.ownerUid === user.uid);

  const latestApp = myApplications[0];

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
    } catch (err) {
      setWizardError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setWizardSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* User Identity Card */}
      <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <label className="relative cursor-pointer group shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover bg-violet-500/15"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-violet-600 text-white text-lg font-bold flex items-center justify-center">
                  {user.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-white dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#11081F] dark:text-[#F8F7FC] group-hover:text-violet-500">
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
                <h1 className="text-lg sm:text-xl font-bold text-[#11081F] dark:text-[#F8F7FC] truncate">
                  {user.fullName}
                </h1>
                {user.isVerifiedCreator && <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />}
              </div>
              <p className="text-xs text-[#645582] dark:text-[#A99BC8] truncate">{user.email}</p>
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
            className="px-3.5 py-2 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC] shrink-0"
          >
            {editingProfile ? (lang === 'FR' ? 'Annuler' : 'Cancel') : lang === 'FR' ? 'Modifier' : 'Edit'}
          </button>
        </div>

        {/* MoMo Cash Wallet Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
          <div>
            <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">
              {lang === 'FR' ? 'Solde Cash Mobile Money' : 'Mobile Money Cash Balance'}
            </div>
            <div className="text-xl font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
              {formatXAF(user.walletBalanceXAF || 0)}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenWallet}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            <span>{t.wallet}</span>
          </button>
        </div>

        {profileNotice && (
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs text-violet-600 dark:text-violet-300">
            {profileNotice}
          </div>
        )}

        {editingProfile && (
          <form onSubmit={handleSaveProfile} className="pt-3 border-t border-[#E4DFF2] dark:border-[#2A174A] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={fullNameInput}
                onChange={(e) => setFullNameInput(e.target.value)}
                placeholder="Full name"
                className="px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] focus:outline-none focus:border-violet-500"
              />
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="City (e.g. Buea, Douala)"
                className="px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] focus:outline-none focus:border-violet-500"
              />
              <input
                type="tel"
                value={momoPhoneInput}
                onChange={(e) => setMomoPhoneInput(e.target.value)}
                placeholder="MoMo (+237 6...)"
                className="px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] focus:outline-none focus:border-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
            >
              {savingProfile ? 'Saving...' : 'Save'}
            </button>
          </form>
        )}
      </div>

      {/* Admin Quick Entry */}
      {user.admin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full bg-[#11081F] hover:bg-[#1c1033] border border-[#2A174A] text-white rounded-3xl p-5 flex items-center justify-between gap-4 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold">{t.adminConsole}</div>
              <div className="text-xs text-[#A99BC8]">
                Approve Raises, publish Cultural Catalysts, manage Escrow tranches & Prediction Contracts
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-[#A99BC8] shrink-0" />
        </button>
      )}

      {/* VERIFIED CREATOR STUDIO */}
      {user.isVerifiedCreator && (
        <div className="bg-white dark:bg-[#180D2B] border border-violet-500/40 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-bold text-[#11081F] dark:text-[#F8F7FC]">
                Verified Creator Studio
              </h2>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-500 text-[11px] font-semibold">
              {myCreatorListing?.escrowStatus || 'OPEN'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.raised}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                {formatXAF(myCreatorListing?.totalRaisedXAF ?? user.totalRaisedXAF ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.sharePrice}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                {formatXAF(myCreatorListing?.sharePriceXAF ?? user.currentValuationXAF ?? 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.sharesLeft}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                {myCreatorListing?.sharesRemaining ?? myCreatorListing?.totalShares ?? 0}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A]">
              <div className="text-[11px] text-[#645582] dark:text-[#A99BC8]">{t.investors}</div>
              <div className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC] tabular-nums mt-0.5">
                {myCreatorListing?.investorsCount ?? 0}
              </div>
            </div>
          </div>

          {myCreatorListing?.distributorSplitEmail && (
            <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#645582] dark:text-[#A99BC8]">Clearinghouse Split Address:</span>
              <span className="font-mono font-semibold text-violet-500">
                {myCreatorListing.distributorSplitEmail}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Application Status Banner */}
      {!user.isVerifiedCreator && latestApp && (
        <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">
              Creator Raise Application · {latestApp.stageName}
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold capitalize ${
                latestApp.status === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : latestApp.status === 'rejected'
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-violet-500/15 text-violet-400'
              }`}
            >
              {latestApp.status}
            </span>
          </div>
          <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
            {latestApp.status === 'pending'
              ? 'Your Social Bio-Code, KYC, and Underwriting Audit are under exchange committee review.'
              : latestApp.adminNotes || 'Reviewed by Crippo Exchange Committee.'}
          </p>
        </div>
      )}

      {/* Become a Creator Card */}
      {!user.isVerifiedCreator && (
        <div className="bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-3xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#11081F] dark:text-[#F8F7FC]">Creator Launchpad</h3>
              <p className="text-xs text-[#645582] dark:text-[#A99BC8] truncate">
                Social Bio-Code verification, AI Underwriting & XAF Raise listing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setWizardError(null);
              setWizardStep(1);
              setAuditResult(null);
              setWizardOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            {t.becomeCreator}
          </button>
        </div>
      )}

      {/* Sign Out */}
      <button
        type="button"
        onClick={() => signOut(auth)}
        className="w-full py-3.5 px-5 rounded-2xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] hover:border-red-500/50 text-[#11081F] dark:text-[#F8F7FC] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>{lang === 'FR' ? 'Déconnexion' : 'Sign out'}</span>
      </button>

      {/* 3-Step Creator Onboarding & Pre-Listing Underwriting Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#180D2B] border border-[#E4DFF2] dark:border-[#2A174A] rounded-t-3xl sm:rounded-3xl p-6 relative max-h-[92vh] overflow-y-auto space-y-5">
            <button
              type="button"
              onClick={() => setWizardOpen(false)}
              aria-label="Close onboarding wizard"
              className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] flex items-center justify-center text-[#645582] dark:text-[#A99BC8]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-10">
              <span className="text-xs font-semibold text-violet-500">Step {wizardStep} of 3</span>
              <h2 className="text-xl font-bold text-[#11081F] dark:text-[#F8F7FC] mt-0.5">
                Creator Project Raise Application
              </h2>
            </div>

            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] space-y-2">
                  <div className="text-xs font-bold text-[#11081F] dark:text-[#F8F7FC]">
                    1. Social Bio-Code Ownership Proof
                  </div>
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                    Paste this unique code into your TikTok, YouTube, or Facebook bio until listing approval to prove channel ownership:
                  </p>
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-[#180D2B] border border-violet-500/40">
                    <span className="font-mono text-sm font-bold text-violet-500">{bioCode}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(bioCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 1800);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/15 text-violet-500 text-xs font-semibold"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] space-y-1">
                  <div className="text-xs font-bold text-[#11081F] dark:text-[#F8F7FC]">
                    2. Two-Tranche Clearinghouse Escrow Protection
                  </div>
                  <p className="text-xs text-[#645582] dark:text-[#A99BC8]">
                    Tranche 1 (50%) releases at Raise Close for production; Tranche 2 (50%) unlocks upon verified master submission & distributor royalty split routing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
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
                    className="px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                  />
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@handle *"
                    className="px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-3.5 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
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
                    className="px-3.5 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={kycDocType}
                    onChange={(e) => setKycDocType(e.target.value as 'CNI' | 'Passport' | 'RCCM')}
                    className="px-3.5 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
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
                    className="px-3.5 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                  />
                </div>

                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="TikTok or YouTube profile URL"
                  className="w-full px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                />
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="Facebook page URL"
                  className="w-full px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC]"
                />

                <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-dashed border-[#E4DFF2] dark:border-[#2A174A] cursor-pointer hover:border-violet-500">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Upload className="w-4 h-4 text-violet-500 shrink-0" />
                    <span className="text-xs font-medium text-[#11081F] dark:text-[#F8F7FC] truncate">
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
                    className="px-5 py-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={stageName.trim().length < 2 || handle.trim().length < 2}
                    onClick={() => setWizardStep(3)}
                    className="flex-1 py-3 rounded-xl bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold"
                  >
                    Next: Budget & AI Underwriting
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <form onSubmit={handleSubmitApplication} className="space-y-3.5">
                {wizardError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                    {wizardError}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Net Budget (XAF)</label>
                    <input
                      type="number"
                      min={100000}
                      step={50000}
                      value={netBudgetXAF}
                      onChange={(e) => setNetBudgetXAF(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Fixed Shares</label>
                    <input
                      type="number"
                      min={100}
                      step={50}
                      value={totalShares}
                      onChange={(e) => setTotalShares(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#645582] dark:text-[#A99BC8]">Rev Share (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={75}
                      value={revSharePct}
                      onChange={(e) => setRevSharePct(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">YouTube 30d</label>
                    <input
                      type="number"
                      min={0}
                      value={youtube30dViews}
                      onChange={(e) => setYoutube30dViews(Number(e.target.value))}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">Spotify Monthly</label>
                    <input
                      type="number"
                      min={0}
                      value={spotifyMonthlyListeners}
                      onChange={(e) => setSpotifyMonthlyListeners(Number(e.target.value))}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">TikTok Velocity</label>
                    <input
                      type="number"
                      min={0}
                      value={tiktokVelocity}
                      onChange={(e) => setTiktokVelocity(Number(e.target.value))}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#645582] dark:text-[#A99BC8]">Engagement %</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={engagementRate}
                      onChange={(e) => setEngagementRate(Number(e.target.value))}
                      className="w-full mt-1 px-2.5 py-1.5 text-xs bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={auditing}
                  onClick={handleRunAudit}
                  className="w-full py-2.5 rounded-xl bg-violet-600/15 hover:bg-violet-600/25 border border-violet-500/40 text-violet-500 text-xs font-semibold"
                >
                  {auditing ? 'Running AI Underwriting Audit...' : 'Run Pre-Listing AI Underwriting Check'}
                </button>

                {auditResult && (
                  <div className="p-3.5 rounded-2xl bg-[#F8F7FC] dark:bg-[#11081F] border border-violet-500/35 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#11081F] dark:text-[#F8F7FC]">
                        AI Market Index: {auditResult.underwritingScore}/100
                      </span>
                      <span className="font-mono font-bold text-emerald-500">
                        P₀ {formatXAF(auditResult.initialSharePriceXAF)}/share
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#645582] dark:text-[#A99BC8] tabular-nums">
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
                  className="w-full px-4 py-2.5 text-sm bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] rounded-xl text-[#11081F] dark:text-[#F8F7FC] resize-none"
                />

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-3 rounded-xl bg-[#F8F7FC] dark:bg-[#11081F] border border-[#E4DFF2] dark:border-[#2A174A] text-xs font-semibold text-[#11081F] dark:text-[#F8F7FC]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={wizardSubmitting || mediaUploading}
                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {wizardSubmitting ? 'Submitting...' : 'Submit for Listing Review'}
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
