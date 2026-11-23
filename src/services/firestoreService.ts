import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import type {
  AgentPulseResult,
  AggregatorConfigStatus,
  BioVerificationAgentResult,
  BrandApplication,
  BrandCampaign,
  Creator,
  CreatorApplication,
  MemoRequest,
  NewsPost,
  NotificationItem,
  PredictionMarket,
  PredictionVote,
  SyncLog,
  Trade,
  UnderwritingResult,
  UserProfile,
  WalletTransaction,
} from '../types/crippo';
import { FIELD_LIMITS } from '../types/crippo';
import {
  appendPriceHistoryPoint,
  buildNextSparkline,
  calculateCatalystRepricing,
  calculateDynamicShareMetrics,
  calculateInitialSharePrice,
  calculateInvestorOwnershipPct,
  calculateOrderRepricing,
  calculatePredictionProbabilities,
  SECONDARY_SPREAD_RATE,
} from '../utils/sharePricing';

function stripUndefined<T extends object>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined && val !== '') {
      clean[key] = val;
    }
  }
  return clean as T;
}

function makeDocId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// =========================================================================
// USERS & WALLET
// =========================================================================

export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  try {
    const userRef = doc(db, 'users', params.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const nowIso = new Date().toISOString();
    const isBootstrappedAdmin = params.email.toLowerCase() === 'nanolabsolutions26@gmail.com';
    const randNum = 1000 + Math.floor(Math.random() * 8999);

    const newProfile = stripUndefined<UserProfile>({
      uid: params.uid,
      fullName: (params.fullName || params.email.split('@')[0] || 'Crippo Investor').slice(0, FIELD_LIMITS.NAME_MAX),
      email: params.email.toLowerCase(),
      anonymousId: `Investor #${randNum}`,
      avatarUrl: params.avatarUrl,
      walletBalanceXAF: 0,
      admin: isBootstrappedAdmin,
      isVerifiedCreator: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await setDoc(userRef, newProfile);
    return newProfile;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function updateUserProfileFields(
  uid: string,
  updates: { fullName?: string; city?: string; avatarUrl?: string; momoPhone?: string; momoNetwork?: 'MTN MoMo' | 'Orange Money' }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload = stripUndefined({
      fullName: updates.fullName?.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      city: updates.city?.trim().slice(0, FIELD_LIMITS.CITY_MAX),
      avatarUrl: updates.avatarUrl,
      momoPhone: updates.momoPhone?.trim().slice(0, 40),
      momoNetwork: updates.momoNetwork,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function uploadFileToStorage(folder: 'avatars' | 'verifications', uid: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `${folder}/${uid}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function executeWalletTransfer(params: {
  uid: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  network: 'MTN MoMo' | 'Orange Money';
  phone: string;
  amountXAF: number;
}): Promise<WalletTransaction> {
  const amount = Math.max(500, Math.round(params.amountXAF));
  const txId = makeDocId('wtx');
  const userRef = doc(db, 'users', params.uid);
  const txRef = doc(db, 'wallet_transactions', txId);
  const nowIso = new Date().toISOString();

  try {
    const created = await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('Account profile missing.');
      const profile = userSnap.data() as UserProfile;
      const currentBal = profile.walletBalanceXAF || 0;

      if (params.type === 'WITHDRAW' && currentBal < amount) {
        throw new Error('Insufficient cash wallet balance for withdrawal.');
      }

      const nextBal = params.type === 'DEPOSIT' ? currentBal + amount : currentBal - amount;

      tx.update(userRef, {
        walletBalanceXAF: nextBal,
        momoPhone: params.phone.trim().slice(0, 40),
        momoNetwork: params.network,
        updatedAt: nowIso,
      });

      const entry = stripUndefined<WalletTransaction>({
        id: txId,
        uid: params.uid,
        type: params.type,
        network: params.network,
        phone: params.phone.trim().slice(0, 40),
        amountXAF: amount,
        reference: `MOMO-${Date.now().toString().slice(-6)}`,
        status: 'COMPLETED',
        createdAt: nowIso,
      });

      tx.set(txRef, entry);
      return entry;
    });
    return created;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `wallet_transactions/${txId}`);
  }
}

export function subscribeUserWalletTxs(uid: string, onData: (txs: WalletTransaction[]) => void): Unsubscribe {
  const q = query(collection(db, 'wallet_transactions'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as WalletTransaction)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'wallet_transactions')
  );
}

// =========================================================================
// CREATORS & RAISES (REAL-TIME MARKET LISTINGS)
// =========================================================================

export function subscribeCreators(onData: (creators: Creator[]) => void): Unsubscribe {
  const q = query(collection(db, 'creators'), orderBy('tradingVolumeXAF', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Creator)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'creators')
  );
}

export async function executeRaiseOrder(params: {
  uid: string;
  creator: Creator;
  shares: number;
  side: 'BUY' | 'SELL';
  paymentMethod: 'MTN MoMo' | 'Orange Money' | 'Wallet';
}): Promise<Trade> {
  const shares = Math.max(1, Math.min(10000, Math.floor(params.shares)));
  const tradeId = makeDocId('trd');
  const wtxId = makeDocId('wtx');
  const creatorRef = doc(db, 'creators', params.creator.id);
  const tradeRef = doc(db, 'trades', tradeId);
  const userRef = doc(db, 'users', params.uid);
  const wtxRef = doc(db, 'wallet_transactions', wtxId);
  const nowIso = new Date().toISOString();

  try {
    const createdTrade = await runTransaction(db, async (tx) => {
      const [creatorSnap, userSnap] = await Promise.all([tx.get(creatorRef), tx.get(userRef)]);
      if (!creatorSnap.exists()) {
        throw new Error('Raise market listing no longer exists.');
      }
      if (!userSnap.exists()) {
        throw new Error('Account profile not found.');
      }

      const liveCreator = creatorSnap.data() as Creator;
      const profile = userSnap.data() as UserProfile;
      const totalFixedShares = Math.max(100, liveCreator.totalShares || 1000);
      const currentRemaining = liveCreator.sharesRemaining ?? totalFixedShares;

      if (params.side === 'BUY' && currentRemaining < shares) {
        throw new Error(`Only ${currentRemaining} shares remain in this Raise.`);
      }

      const entryPriceXAF = liveCreator.sharePriceXAF;
      const grossValueXAF = shares * entryPriceXAF;
      const netProceedsXAF =
        params.side === 'SELL' ? Math.max(100, Math.round(grossValueXAF * (1 - SECONDARY_SPREAD_RATE))) : grossValueXAF;

      const currentWallet = profile.walletBalanceXAF || 0;
      if (params.side === 'BUY' && params.paymentMethod === 'Wallet') {
        if (currentWallet < grossValueXAF) {
          throw new Error('Insufficient wallet balance. Deposit via MTN MoMo or Orange Money, or pay directly via MoMo.');
        }
        tx.update(userRef, { walletBalanceXAF: currentWallet - grossValueXAF, updatedAt: nowIso });
      } else if (params.side === 'SELL') {
        tx.update(userRef, { walletBalanceXAF: currentWallet + netProceedsXAF, updatedAt: nowIso });
      }

      const repriced = calculateOrderRepricing({
        previousPriceXAF: entryPriceXAF,
        baseSharePriceXAF: liveCreator.baseSharePriceXAF || entryPriceXAF,
        totalFixedShares,
        sharesDelta: shares,
        side: params.side,
      });

      const nextTradingVolumeXAF = (liveCreator.tradingVolumeXAF || 0) + grossValueXAF;
      const nextTotalRaisedXAF =
        params.side === 'BUY'
          ? (liveCreator.totalRaisedXAF || 0) + grossValueXAF
          : Math.max(0, (liveCreator.totalRaisedXAF || 0) - netProceedsXAF);
      const nextSharesRemaining =
        params.side === 'BUY'
          ? Math.max(0, currentRemaining - shares)
          : Math.min(totalFixedShares, currentRemaining + shares);
      const nextInvestorsCount =
        params.side === 'BUY' ? (liveCreator.investorsCount || 0) + 1 : liveCreator.investorsCount || 0;

      const nextSparkline = buildNextSparkline(liveCreator, repriced.nextPriceXAF);
      const nextHistory = appendPriceHistoryPoint(liveCreator.priceHistory, {
        time: nowIso,
        priceXAF: repriced.nextPriceXAF,
      });

      tx.update(creatorRef, {
        tradingVolumeXAF: nextTradingVolumeXAF,
        totalRaisedXAF: nextTotalRaisedXAF,
        sharesRemaining: nextSharesRemaining,
        investorsCount: nextInvestorsCount,
        sharePriceXAF: repriced.nextPriceXAF,
        priceChangePct: repriced.priceChangePct,
        sparkline: nextSparkline,
        priceHistory: nextHistory,
        updatedAt: nowIso,
      });

      const ownership = calculateInvestorOwnershipPct(shares, totalFixedShares, liveCreator.revSharePct || 15);

      const trade = stripUndefined<Trade>({
        id: tradeId,
        uid: params.uid,
        creatorId: liveCreator.id,
        creatorName: liveCreator.name,
        creatorHandle: liveCreator.handle,
        creatorAvatarUrl: liveCreator.avatarUrl,
        side: params.side,
        sharesHeld: shares,
        entryPriceXAF,
        totalPaidXAF: params.side === 'BUY' ? grossValueXAF : netProceedsXAF,
        ownershipPct: ownership.effectiveRoyaltySharePct,
        revSharePct: liveCreator.revSharePct,
        paymentMethod: params.paymentMethod,
        status: liveCreator.status === 'FUNDED' ? 'roi_active' : liveCreator.status === 'ENDED' ? 'settled' : 'in_race',
        closesAt: liveCreator.closesAt,
        roiDurationMonths: liveCreator.roiDurationMonths,
        createdAt: nowIso,
      });

      tx.set(tradeRef, trade);

      const walletTx = stripUndefined<WalletTransaction>({
        id: wtxId,
        uid: params.uid,
        type: params.side === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
        network: params.paymentMethod,
        amountXAF: params.side === 'BUY' ? grossValueXAF : netProceedsXAF,
        reference: `${params.side}-${liveCreator.handle}-${shares}`,
        status: 'COMPLETED',
        createdAt: nowIso,
      });
      tx.set(wtxRef, walletTx);

      return trade;
    });

    return createdTrade;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `trades/${tradeId}`);
  }
}

export async function executeShareTrade(params: {
  uid: string;
  creator: Creator;
  shares: number;
}): Promise<Trade> {
  return executeRaiseOrder({
    uid: params.uid,
    creator: params.creator,
    shares: params.shares,
    side: 'BUY',
    paymentMethod: 'MTN MoMo',
  });
}

// =========================================================================
// PREDICTION MARKETS (YES / NO DYNAMIC VOTING)
// =========================================================================

export function subscribePredictions(onData: (items: PredictionMarket[]) => void): Unsubscribe {
  const q = query(collection(db, 'predictions'), orderBy('totalVolumeXAF', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as PredictionMarket)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'predictions')
  );
}

export function subscribeUserPredictionVotes(uid: string, onData: (votes: PredictionVote[]) => void): Unsubscribe {
  const q = query(collection(db, 'prediction_votes'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as PredictionVote)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'prediction_votes')
  );
}

export async function executePredictionVote(params: {
  uid: string;
  prediction: PredictionMarket;
  side: 'YES' | 'NO';
  shares: number;
  paymentMethod?: 'MTN MoMo' | 'Orange Money' | 'Wallet';
}): Promise<PredictionVote> {
  const shares = Math.max(1, Math.min(10000, Math.floor(params.shares)));
  const voteId = makeDocId('vot');
  const wtxId = makeDocId('wtx');
  const predRef = doc(db, 'predictions', params.prediction.id);
  const voteRef = doc(db, 'prediction_votes', voteId);
  const userRef = doc(db, 'users', params.uid);
  const wtxRef = doc(db, 'wallet_transactions', wtxId);
  const nowIso = new Date().toISOString();
  const network = params.paymentMethod || 'MTN MoMo';

  try {
    const created = await runTransaction(db, async (tx) => {
      const [predSnap, userSnap] = await Promise.all([tx.get(predRef), tx.get(userRef)]);
      if (!predSnap.exists()) throw new Error('Prediction market not found.');
      if (!userSnap.exists()) throw new Error('User profile not found.');

      const livePred = predSnap.data() as PredictionMarket;
      if (livePred.status !== 'OPEN') {
        throw new Error('This prediction contract is already resolved.');
      }

      const oddsBefore = calculatePredictionProbabilities(livePred.yesPoolXAF, livePred.noPoolXAF);
      const sharePriceXAF = params.side === 'YES' ? oddsBefore.yesSharePriceXAF : oddsBefore.noSharePriceXAF;
      const totalPaidXAF = shares * sharePriceXAF;

      if (network === 'Wallet') {
        const profile = userSnap.data() as UserProfile;
        const bal = profile.walletBalanceXAF || 0;
        if (bal < totalPaidXAF) {
          throw new Error('Insufficient cash wallet balance. Choose MTN MoMo or deposit funds.');
        }
        tx.update(userRef, { walletBalanceXAF: bal - totalPaidXAF, updatedAt: nowIso });
      }

      const nextYesShares = livePred.yesShares + (params.side === 'YES' ? shares : 0);
      const nextNoShares = livePred.noShares + (params.side === 'NO' ? shares : 0);
      const nextYesPool = livePred.yesPoolXAF + (params.side === 'YES' ? totalPaidXAF : 0);
      const nextNoPool = livePred.noPoolXAF + (params.side === 'NO' ? totalPaidXAF : 0);
      const oddsAfter = calculatePredictionProbabilities(nextYesPool, nextNoPool);
      const nextSparkline = [...(livePred.sparkline || [oddsBefore.yesProbabilityPct]).slice(-29), oddsAfter.yesProbabilityPct];

      tx.update(predRef, {
        yesShares: nextYesShares,
        noShares: nextNoShares,
        yesPoolXAF: nextYesPool,
        noPoolXAF: nextNoPool,
        yesProbabilityPct: oddsAfter.yesProbabilityPct,
        noProbabilityPct: oddsAfter.noProbabilityPct,
        totalVolumeXAF: (livePred.totalVolumeXAF || 0) + totalPaidXAF,
        sparkline: nextSparkline,
        updatedAt: nowIso,
      });

      const vote = stripUndefined<PredictionVote>({
        id: voteId,
        uid: params.uid,
        predictionId: livePred.id,
        questionEn: livePred.questionEn,
        questionFr: livePred.questionFr,
        side: params.side,
        shares,
        priceXAF: sharePriceXAF,
        totalPaidXAF,
        createdAt: nowIso,
      });
      tx.set(voteRef, vote);

      const walletTx = stripUndefined<WalletTransaction>({
        id: wtxId,
        uid: params.uid,
        type: 'PREDICTION_VOTE',
        network,
        amountXAF: totalPaidXAF,
        reference: `${params.side}-${livePred.id.slice(-6)}`,
        status: 'COMPLETED',
        createdAt: nowIso,
      });
      tx.set(wtxRef, walletTx);

      return vote;
    });

    return created;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `prediction_votes/${voteId}`);
  }
}

// =========================================================================
// TRADES (USER POSITIONS)
// =========================================================================

export function subscribeUserTrades(uid: string, onData: (trades: Trade[]) => void): Unsubscribe {
  const q = query(collection(db, 'trades'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as Trade)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'trades')
  );
}

// =========================================================================
// NOTIFICATIONS & BRAND CAMPAIGNS
// =========================================================================

export function subscribeNotifications(uid: string | null, onData: (items: NotificationItem[]) => void): Unsubscribe {
  let allItems: NotificationItem[] = [];
  let userItems: NotificationItem[] = [];

  const emit = () => {
    const merged = new Map<string, NotificationItem>();
    for (const item of allItems) merged.set(item.id, item);
    for (const item of userItems) merged.set(item.id, item);
    onData(Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  };

  const unsubAll = onSnapshot(
    query(collection(db, 'notifications'), where('uid', '==', 'ALL')),
    (snap) => {
      allItems = snap.docs.map((d) => d.data() as NotificationItem);
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
  );

  const unsubUser = uid
    ? onSnapshot(
        query(collection(db, 'notifications'), where('uid', '==', uid)),
        (snap) => {
          userItems = snap.docs.map((d) => d.data() as NotificationItem);
          emit();
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    : undefined;

  return () => {
    unsubAll();
    unsubUser?.();
  };
}

export function subscribeBrandCampaigns(onData: (items: BrandCampaign[]) => void): Unsubscribe {
  const q = query(collection(db, 'brand_campaigns'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as BrandCampaign)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'brand_campaigns')
  );
}

// =========================================================================
// CREATOR ONBOARDING, UNDERWRITING & MEMO REQUESTS
// =========================================================================

export async function runUnderwritingAudit(payload: {
  stageName: string;
  category: string;
  youtube30dViews: number;
  spotifyMonthlyListeners: number;
  tiktokVelocity: number;
  engagementRate: number;
  diasporaSharePct: number;
  requestedNetBudgetXAF: number;
  totalFixedShares: number;
  roiDurationMonths: number;
}): Promise<UnderwritingResult> {
  const res = await fetch('/api/v1/underwrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Underwriting evaluation failed.');
  }
  return json.data as UnderwritingResult;
}

export function subscribeMyApplications(uid: string, onData: (apps: CreatorApplication[]) => void): Unsubscribe {
  const q = query(collection(db, 'creator_applications'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as CreatorApplication)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'creator_applications')
  );
}

export async function submitCreatorApplication(params: {
  uid: string;
  claimCreatorId?: string;
  stageName: string;
  handle: string;
  category: string;
  city?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  verificationMediaUrl?: string;
  bioVerificationCode?: string;
  kycDocType?: 'CNI' | 'Passport' | 'RCCM';
  momoNumber?: string;
  netBudgetXAF?: number;
  totalShares?: number;
  targetRaiseXAF?: number;
  revSharePct?: number;
  underwritingVerdict?: string;
  pitch: string;
}): Promise<CreatorApplication> {
  const id = makeDocId('app');
  const nowIso = new Date().toISOString();
  const appDoc = stripUndefined<CreatorApplication>({
    id,
    uid: params.uid,
    claimCreatorId: params.claimCreatorId,
    stageName: params.stageName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    handle: params.handle.trim().slice(0, FIELD_LIMITS.HANDLE_MAX),
    category: params.category.trim().slice(0, 60),
    city: params.city?.trim().slice(0, FIELD_LIMITS.CITY_MAX),
    facebookUrl: params.facebookUrl?.trim().slice(0, 300),
    tiktokUrl: params.tiktokUrl?.trim().slice(0, 300),
    verificationMediaUrl: params.verificationMediaUrl,
    bioVerificationCode: params.bioVerificationCode?.trim().slice(0, 40),
    kycDocType: params.kycDocType,
    momoNumber: params.momoNumber?.trim().slice(0, 40),
    netBudgetXAF: params.netBudgetXAF,
    totalShares: params.totalShares,
    targetRaiseXAF: params.targetRaiseXAF,
    revSharePct: params.revSharePct,
    underwritingVerdict: params.underwritingVerdict?.trim().slice(0, 500),
    pitch: params.pitch.trim().slice(0, FIELD_LIMITS.PITCH_MAX),
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'creator_applications', id), appDoc);
    return appDoc;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `creator_applications/${id}`);
  }
}

export function subscribeMyBrandApplications(uid: string, onData: (apps: BrandApplication[]) => void): Unsubscribe {
  const q = query(collection(db, 'brand_applications'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => d.data() as BrandApplication)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'brand_applications')
  );
}

export function subscribeAllBrandApplications(onData: (apps: BrandApplication[]) => void): Unsubscribe {
  const q = query(collection(db, 'brand_applications'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as BrandApplication)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'brand_applications')
  );
}

export async function submitBrandApplication(params: {
  campaign: BrandCampaign;
  uid: string;
  creatorId: string;
  creatorName: string;
  pitch: string;
  proposedFeeXAF: number;
}): Promise<BrandApplication> {
  const id = makeDocId('bapp');
  const nowIso = new Date().toISOString();
  const docData = stripUndefined<BrandApplication>({
    id,
    campaignId: params.campaign.id,
    campaignTitle: params.campaign.titleEn,
    brandName: params.campaign.brandName,
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    uid: params.uid,
    pitch: params.pitch.trim().slice(0, FIELD_LIMITS.PITCH_MAX),
    proposedFeeXAF: Math.max(50000, Math.round(params.proposedFeeXAF)),
    status: 'pending',
    createdAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'brand_applications', id), docData);
    return docData;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `brand_applications/${id}`);
  }
}

export async function adminReviewBrandApplication(
  application: BrandApplication,
  decision: 'accepted' | 'rejected'
): Promise<void> {
  const nowIso = new Date().toISOString();
  const notifId = makeDocId('ntf');
  const batch = writeBatch(db);
  try {
    batch.update(doc(db, 'brand_applications', application.id), { status: decision });
    if (decision === 'accepted') {
      batch.update(doc(db, 'brand_campaigns', application.campaignId), { status: 'MATCHED' });
      batch.set(
        doc(db, 'notifications', notifId),
        stripUndefined<NotificationItem>({
          id: notifId,
          uid: application.uid,
          titleEn: `Brand Deal Accepted: ${application.brandName}`,
          titleFr: `Contrat Marque Accepté : ${application.brandName}`,
          bodyEn: `${application.creatorName} matched with "${application.campaignTitle}" (${application.proposedFeeXAF.toLocaleString()} XAF).`,
          bodyFr: `${application.creatorName} sélectionné pour « ${application.campaignTitle} » (${application.proposedFeeXAF.toLocaleString()} XAF).`,
          kind: 'ESCROW',
          creatorId: application.creatorId,
          createdAt: nowIso,
        })
      );
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `brand_applications/${application.id}`);
  }
}

export async function submitMemoRequest(params: {
  requestedByUid: string;
  creatorName: string;
  handle?: string;
  platform: 'TikTok' | 'Facebook' | 'YouTube' | 'Other';
  socialUrl?: string;
  reason?: string;
}): Promise<MemoRequest> {
  const id = makeDocId('memo');
  const memo = stripUndefined<MemoRequest>({
    id,
    requestedByUid: params.requestedByUid,
    creatorName: params.creatorName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    handle: params.handle?.trim().slice(0, FIELD_LIMITS.HANDLE_MAX),
    platform: params.platform,
    socialUrl: params.socialUrl?.trim().slice(0, 300),
    reason: params.reason?.trim().slice(0, 500),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  try {
    await setDoc(doc(db, 'memo_requests', id), memo);
    return memo;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `memo_requests/${id}`);
  }
}

// =========================================================================
// CULTURAL CATALYSTS & NEWS PULSE
// =========================================================================

export function subscribeNewsPosts(onData: (posts: NewsPost[]) => void): Unsubscribe {
  const q = query(collection(db, 'news_posts'), orderBy('publishedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as NewsPost)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'news_posts')
  );
}

// =========================================================================
// ADMIN DASHBOARD OPERATIONS
// =========================================================================

export function subscribeAllApplications(onData: (apps: CreatorApplication[]) => void): Unsubscribe {
  const q = query(collection(db, 'creator_applications'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as CreatorApplication)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'creator_applications')
  );
}

export function subscribeAllMemoRequests(onData: (memos: MemoRequest[]) => void): Unsubscribe {
  const q = query(collection(db, 'memo_requests'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as MemoRequest)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'memo_requests')
  );
}

export function subscribeSyncLogs(onData: (logs: SyncLog[]) => void): Unsubscribe {
  const q = query(collection(db, 'sync_logs'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as SyncLog)),
    (err) => handleFirestoreError(err, OperationType.LIST, 'sync_logs')
  );
}

export async function adminReviewApplication(params: {
  app: CreatorApplication;
  decision: 'approved' | 'rejected';
  adminNotes?: string;
  initialSharePriceXAF?: number;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);

  try {
    batch.update(doc(db, 'creator_applications', params.app.id), {
      status: params.decision,
      adminNotes: params.adminNotes?.trim().slice(0, FIELD_LIMITS.NOTES_MAX) || '',
      updatedAt: nowIso,
    });

    if (params.decision === 'approved') {
      if (params.app.claimCreatorId) {
        const claimedId = params.app.claimCreatorId;
        batch.update(doc(db, 'creators', claimedId), {
          ownerUid: params.app.uid,
          claimedByUid: params.app.uid,
          claimStatus: 'CLAIMED',
          isVerified: true,
          updatedAt: nowIso,
        });

        batch.update(doc(db, 'users', params.app.uid), {
          isVerifiedCreator: true,
          creatorId: claimedId,
          updatedAt: nowIso,
        });
      } else {
        const creatorId = makeDocId('crt');
        const totalShares = Math.max(100, params.app.totalShares || 1000);
        const netBudget = params.app.netBudgetXAF || 1000000;
        const pricing = calculateInitialSharePrice(netBudget, totalShares);
        const basePrice = Math.max(100, params.initialSharePriceXAF || pricing.initialSharePriceXAF);

        const validCategories = ['Music & Albums', 'TikTok Series', 'Movies & Docs', 'Podcasts', 'Brand Campaigns', 'Music', 'Entertainment', 'Comedy', 'Film', 'Tech', 'Lifestyle'];
        const category = validCategories.includes(params.app.category)
          ? (params.app.category as Creator['category'])
          : 'Music & Albums';

        const creatorDoc = stripUndefined<Creator>({
          id: creatorId,
          ownerUid: params.app.uid,
          claimedByUid: params.app.uid,
          claimStatus: 'CLAIMED',
          name: params.app.stageName,
          handle: params.app.handle.startsWith('@') ? params.app.handle : `@${params.app.handle}`,
          raiseTitle: `${params.app.stageName} Revenue Raise`,
          raiseTitleFr: `Levée de Revenus ${params.app.stageName}`,
          summary: params.app.pitch.slice(0, 480),
          category,
          city: params.app.city || 'Douala',
          platform: params.app.tiktokUrl && params.app.facebookUrl ? 'Multi-Platform' : params.app.tiktokUrl ? 'TikTok' : 'Facebook',
          status: 'OPEN',
          escrowStatus: 'ESCROW_HOLDING',
          distributorSplitEmail: `raise-${creatorId}@clearing.crippo.cm`,
          followersCount: 0,
          engagementRate: 5.5,
          viewVelocity: 10000,
          crippoScore: 84,
          underwritingScore: 86,
          netBudgetXAF: netBudget,
          grossTargetXAF: pricing.grossTargetXAF,
          totalShares,
          sharesRemaining: totalShares,
          investorsCount: 0,
          tradingVolumeXAF: 0,
          baseSharePriceXAF: basePrice,
          sharePriceXAF: basePrice,
          priceChangePct: 0,
          sparkline: [basePrice, basePrice],
          priceHistory: [{ time: nowIso, priceXAF: basePrice, catalystTitle: 'Initial Underwritten Listing', deltaPct: 0 }],
          totalRaisedXAF: 0,
          targetRaiseXAF: params.app.targetRaiseXAF || pricing.grossTargetXAF,
          revSharePct: params.app.revSharePct || 25,
          roiDurationMonths: 12,
          closesAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          isVerified: true,
          milestonesCompleted: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        batch.set(doc(db, 'creators', creatorId), creatorDoc);

        batch.update(doc(db, 'users', params.app.uid), {
          isVerifiedCreator: true,
          creatorId,
          totalRaisedXAF: 0,
          currentValuationXAF: basePrice * totalShares,
          completedMilestones: 0,
          updatedAt: nowIso,
        });
      }
    }

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `creator_applications/${params.app.id}`);
  }
}

export async function adminUpdateMemoStatus(memoId: string, status: 'pending' | 'reviewed' | 'listed'): Promise<void> {
  try {
    await updateDoc(doc(db, 'memo_requests', memoId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `memo_requests/${memoId}`);
  }
}

export async function adminCreateCreatorListing(params: {
  ownerUid: string;
  name: string;
  handle: string;
  raiseTitle?: string;
  raiseTitleFr?: string;
  summary?: string;
  category: Creator['category'];
  city?: string;
  platform: Creator['platform'];
  followersCount: number;
  engagementRate: number;
  viewVelocity: number;
  netBudgetXAF: number;
  totalShares: number;
  revSharePct: number;
  roiDurationMonths: number;
}): Promise<Creator> {
  const id = makeDocId('crt');
  const nowIso = new Date().toISOString();
  const totalShares = Math.max(100, Math.round(params.totalShares));
  const initialPricing = calculateInitialSharePrice(params.netBudgetXAF, totalShares);
  const dynamic = calculateDynamicShareMetrics({
    baseSharePriceXAF: initialPricing.initialSharePriceXAF,
    engagementRate: params.engagementRate,
    viewVelocity: params.viewVelocity,
    followersCount: params.followersCount,
    tradingVolumeXAF: 0,
  });

  const creator = stripUndefined<Creator>({
    id,
    ownerUid: params.ownerUid,
    name: params.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    handle: params.handle.startsWith('@') ? params.handle : `@${params.handle}`,
    raiseTitle: params.raiseTitle?.trim() || `${params.name.trim()} Project Raise`,
    raiseTitleFr: params.raiseTitleFr?.trim() || `Levée ${params.name.trim()}`,
    summary: params.summary?.trim().slice(0, 480),
    category: params.category,
    city: params.city || 'Douala',
    platform: params.platform || 'Multi-Platform',
    status: 'OPEN',
    escrowStatus: 'ESCROW_HOLDING',
    distributorSplitEmail: `raise-${id}@clearing.crippo.cm`,
    followersCount: Math.max(0, params.followersCount),
    engagementRate: Math.max(0, params.engagementRate),
    viewVelocity: Math.max(0, params.viewVelocity),
    crippoScore: Math.min(99, Math.round(70 + params.engagementRate * 2)),
    underwritingScore: 88,
    netBudgetXAF: params.netBudgetXAF,
    grossTargetXAF: initialPricing.grossTargetXAF,
    totalShares,
    sharesRemaining: totalShares,
    investorsCount: 0,
    tradingVolumeXAF: 0,
    baseSharePriceXAF: initialPricing.initialSharePriceXAF,
    sharePriceXAF: dynamic.sharePriceXAF,
    priceChangePct: dynamic.priceChangePct,
    sparkline: [initialPricing.initialSharePriceXAF, dynamic.sharePriceXAF],
    priceHistory: [
      {
        time: nowIso,
        priceXAF: initialPricing.initialSharePriceXAF,
        catalystTitle: 'Pre-Listing Audit P₀',
        deltaPct: 0,
      },
      {
        time: nowIso,
        priceXAF: dynamic.sharePriceXAF,
        catalystTitle: 'Opening Liquidity Index',
        deltaPct: dynamic.priceChangePct,
      },
    ],
    totalRaisedXAF: 0,
    targetRaiseXAF: initialPricing.grossTargetXAF,
    revSharePct: params.revSharePct,
    roiDurationMonths: params.roiDurationMonths,
    closesAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    isVerified: true,
    milestonesCompleted: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'creators', id), creator);
    return creator;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `creators/${id}`);
  }
}

export async function adminCreatePrediction(params: {
  questionEn: string;
  questionFr: string;
  category: PredictionMarket['category'];
  creatorId?: string;
  creatorName?: string;
  resolutionCriteria?: string;
  initialYesPoolXAF?: number;
  initialNoPoolXAF?: number;
  daysOpen?: number;
}): Promise<PredictionMarket> {
  const id = makeDocId('prd');
  const nowIso = new Date().toISOString();
  const yesPool = Math.max(5000, params.initialYesPoolXAF || 50000);
  const noPool = Math.max(5000, params.initialNoPoolXAF || 50000);
  const odds = calculatePredictionProbabilities(yesPool, noPool);

  const pred = stripUndefined<PredictionMarket>({
    id,
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    category: params.category,
    questionEn: params.questionEn.trim().slice(0, 240),
    questionFr: params.questionFr.trim().slice(0, 240),
    resolutionCriteria: params.resolutionCriteria?.trim().slice(0, 480),
    yesShares: Math.round(yesPool / odds.yesSharePriceXAF),
    noShares: Math.round(noPool / odds.noSharePriceXAF),
    yesPoolXAF: yesPool,
    noPoolXAF: noPool,
    yesProbabilityPct: odds.yesProbabilityPct,
    noProbabilityPct: odds.noProbabilityPct,
    totalVolumeXAF: yesPool + noPool,
    sparkline: [odds.yesProbabilityPct, odds.yesProbabilityPct],
    status: 'OPEN',
    closesAt: new Date(Date.now() + (params.daysOpen || 21) * 24 * 3600 * 1000).toISOString(),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'predictions', id), pred);
    return pred;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `predictions/${id}`);
  }
}

export async function adminApplyCulturalCatalyst(params: {
  creator: Creator;
  sourceName: string;
  headline: string;
  impactPct: number;
  city?: string;
}): Promise<void> {
  const postId = makeDocId('cat');
  const notifId = makeDocId('ntf');
  const nowIso = new Date().toISOString();

  const repriced = calculateCatalystRepricing({
    previousPriceXAF: params.creator.sharePriceXAF,
    baseSharePriceXAF: params.creator.baseSharePriceXAF || params.creator.sharePriceXAF,
    impactPct: params.impactPct,
  });

  const batch = writeBatch(db);
  try {
    const postDoc = stripUndefined<NewsPost>({
      id: postId,
      sourcePlatform: 'editorial',
      sourceName: params.sourceName.trim().slice(0, 110),
      headline: params.headline.trim().slice(0, 230),
      category: 'Trending',
      creatorId: params.creator.id,
      creatorName: params.creator.name,
      city: params.city || params.creator.city || 'Douala',
      sentiment: params.impactPct >= 0 ? 'POSITIVE' : 'NEGATIVE',
      impactPct: params.impactPct,
      publishedAt: nowIso,
      syncedAt: nowIso,
    });
    batch.set(doc(db, 'news_posts', postId), postDoc);

    const nextSparkline = buildNextSparkline(params.creator, repriced.nextPriceXAF);
    const nextHistory = appendPriceHistoryPoint(params.creator.priceHistory, {
      time: nowIso,
      priceXAF: repriced.nextPriceXAF,
      catalystTitle: params.headline.slice(0, 90),
      deltaPct: params.impactPct,
    });

    batch.update(doc(db, 'creators', params.creator.id), {
      sharePriceXAF: repriced.nextPriceXAF,
      priceChangePct: repriced.priceChangePct,
      sparkline: nextSparkline,
      priceHistory: nextHistory,
      updatedAt: nowIso,
    });

    const notif = stripUndefined<NotificationItem>({
      id: notifId,
      uid: 'ALL',
      titleEn: `${params.creator.name} ${params.impactPct >= 0 ? '+' : ''}${params.impactPct}% (${params.sourceName})`,
      titleFr: `${params.creator.name} ${params.impactPct >= 0 ? '+' : ''}${params.impactPct}% (${params.sourceName})`,
      bodyEn: params.headline.slice(0, 240),
      bodyFr: params.headline.slice(0, 240),
      kind: Math.abs(params.impactPct) >= 5 ? 'PRICE_SPIKE' : 'CATALYST',
      creatorId: params.creator.id,
      deltaPct: params.impactPct,
      createdAt: nowIso,
    });
    batch.set(doc(db, 'notifications', notifId), notif);

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `creators/${params.creator.id}`);
  }
}

export async function adminAdvanceEscrowStage(
  creator: Creator,
  escrowStatus: Creator['escrowStatus'],
  status?: Creator['status']
): Promise<void> {
  const nowIso = new Date().toISOString();
  const notifId = makeDocId('ntf');
  const batch = writeBatch(db);
  try {
    batch.update(doc(db, 'creators', creator.id), stripUndefined({
      escrowStatus,
      status: status || creator.status,
      milestonesCompleted:
        escrowStatus === 'COMPLETED_LOCKED'
          ? (creator.milestonesCompleted || 0) + 1
          : creator.milestonesCompleted || 0,
      updatedAt: nowIso,
    }));

    batch.set(
      doc(db, 'notifications', notifId),
      stripUndefined<NotificationItem>({
        id: notifId,
        uid: 'ALL',
        titleEn: `${creator.name}: ${escrowStatus === 'TRANCHE_1_RELEASED' ? 'Tranche 1 (50%) Released' : 'Master Verified & Split Locked'}`,
        titleFr: `${creator.name} : ${escrowStatus === 'TRANCHE_1_RELEASED' ? 'Tranche 1 (50%) Libérée' : 'Master Validé & Split Verrouillé'}`,
        bodyEn: `Clearinghouse escrow updated for ${creator.raiseTitle || creator.name}.`,
        bodyFr: `Statut du séquestre mis à jour pour ${creator.raiseTitleFr || creator.name}.`,
        kind: 'ESCROW',
        creatorId: creator.id,
        createdAt: nowIso,
      })
    );

    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `creators/${creator.id}`);
  }
}

export async function adminCreateBrandCampaign(params: {
  brandName: string;
  agencyName?: string;
  titleEn: string;
  titleFr: string;
  category: string;
  budgetXAF: number;
  deliverable: string;
}): Promise<void> {
  const id = makeDocId('brd');
  try {
    await setDoc(
      doc(db, 'brand_campaigns', id),
      stripUndefined<BrandCampaign>({
        id,
        brandName: params.brandName.trim().slice(0, 120),
        agencyName: params.agencyName?.trim().slice(0, 120),
        titleEn: params.titleEn.trim().slice(0, 180),
        titleFr: params.titleFr.trim().slice(0, 180),
        category: params.category.trim().slice(0, 80),
        budgetXAF: Math.max(50000, params.budgetXAF),
        deliverable: params.deliverable.trim().slice(0, 240),
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `brand_campaigns/${id}`);
  }
}

export async function adminResolvePrediction(
  predictionId: string,
  outcome: 'RESOLVED_YES' | 'RESOLVED_NO'
): Promise<void> {
  try {
    await updateDoc(doc(db, 'predictions', predictionId), {
      status: outcome,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `predictions/${predictionId}`);
  }
}

export async function adminBootstrapExchangeCatalog(adminUid: string): Promise<void> {
  const now = Date.now();
  const iso = (offsetMins: number) => new Date(now - offsetMins * 60000).toISOString();
  const closesInDays = (d: number) => new Date(now + d * 24 * 3600 * 1000).toISOString();
  const batch = writeBatch(db);

  const starterRaises: Creator[] = [
    {
      id: 'crt_stanley_enow_album',
      ownerUid: adminUid,
      name: 'Stanley Enow',
      handle: '@stanleyenow',
      raiseTitle: 'Motherland Acoustic EP Raise',
      raiseTitleFr: 'Levée EP Acoustique Motherland',
      summary: '6-track bilingual acoustic LP recorded between Buea & Douala with diaspora distribution and 25% master royalty sharing.',
      summaryFr: 'Album acoustique bilingue 6 titres enregistré entre Buea et Douala avec 25% des redevances partagées.',
      category: 'Music & Albums',
      city: 'Buea',
      platform: 'Multi-Platform',
      status: 'OPEN',
      escrowStatus: 'TRANCHE_1_RELEASED',
      distributorSplitEmail: 'raise-crt_stanley_enow_album@clearing.crippo.cm',
      followersCount: 1420000,
      engagementRate: 7.4,
      viewVelocity: 215000,
      crippoScore: 94,
      underwritingScore: 92,
      projected12mRevenueXAF: 18500000,
      netBudgetXAF: 5000000,
      grossTargetXAF: 5250000,
      totalShares: 1050,
      sharesRemaining: 312,
      investorsCount: 148,
      tradingVolumeXAF: 4820000,
      baseSharePriceXAF: 5000,
      sharePriceXAF: 5850,
      priceChangePct: 17.0,
      sparkline: [5000, 5120, 5260, 5190, 5410, 5600, 5850],
      priceHistory: [
        { time: iso(360), priceXAF: 5000, catalystTitle: 'Pre-Listing Audit P₀', deltaPct: 0 },
        { time: iso(240), priceXAF: 5260 },
        { time: iso(160), priceXAF: 5190 },
        { time: iso(80), priceXAF: 5600, catalystTitle: 'TRACE Africa Teaser Airplay', deltaPct: 7.9 },
        { time: iso(10), priceXAF: 5850, catalystTitle: 'Tranche 1 Escrow Cleared', deltaPct: 4.5 },
      ],
      totalRaisedXAF: 3690000,
      targetRaiseXAF: 5250000,
      revSharePct: 25,
      roiDurationMonths: 12,
      closesAt: closesInDays(12),
      isVerified: true,
      milestonesCompleted: 1,
      createdAt: iso(400),
      updatedAt: iso(10),
    },
    {
      id: 'crt_koc_japoma_ep',
      ownerUid: adminUid,
      name: 'Ko-C',
      handle: '@koc_237',
      raiseTitle: 'Douala Live Tour Visuals & EP',
      raiseTitleFr: 'Visuels Tournée Douala & EP',
      summary: 'High-energy concert documentary and 4-track street-pop visual project backed by 20% streaming + YouTube monetization split.',
      summaryFr: 'Documentaire concert et 4 clips street-pop avec 20% des revenus streaming et YouTube partagés.',
      category: 'Music & Albums',
      city: 'Douala',
      platform: 'YouTube',
      status: 'OPEN',
      escrowStatus: 'ESCROW_HOLDING',
      distributorSplitEmail: 'raise-crt_koc_japoma_ep@clearing.crippo.cm',
      followersCount: 980000,
      engagementRate: 6.9,
      viewVelocity: 174000,
      crippoScore: 91,
      underwritingScore: 89,
      projected12mRevenueXAF: 12400000,
      netBudgetXAF: 3500000,
      grossTargetXAF: 3675000,
      totalShares: 1050,
      sharesRemaining: 488,
      investorsCount: 96,
      tradingVolumeXAF: 2490000,
      baseSharePriceXAF: 3500,
      sharePriceXAF: 3890,
      priceChangePct: 11.1,
      sparkline: [3500, 3540, 3620, 3710, 3780, 3890],
      priceHistory: [
        { time: iso(300), priceXAF: 3500, catalystTitle: 'Initial Underwriting P₀', deltaPct: 0 },
        { time: iso(180), priceXAF: 3620 },
        { time: iso(90), priceXAF: 3780, catalystTitle: 'Douala Stadium Rehearsal Leak', deltaPct: 4.4 },
        { time: iso(12), priceXAF: 3890 },
      ],
      totalRaisedXAF: 2180000,
      targetRaiseXAF: 3675000,
      revSharePct: 20,
      roiDurationMonths: 10,
      closesAt: closesInDays(16),
      isVerified: true,
      milestonesCompleted: 0,
      createdAt: iso(320),
      updatedAt: iso(12),
    },
    {
      id: 'crt_buea_skit_series',
      ownerUid: adminUid,
      name: 'Mola & Tchop Squad',
      handle: '@molatchop237',
      raiseTitle: 'Molyko Campus Season 2 (TikTok Series)',
      raiseTitleFr: 'Série TikTok Campus Molyko Saison 2',
      summary: '16-episode viral comedy series filmed in Buea with integrated product placement and TikTok + Facebook Reels payout sharing.',
      summaryFr: 'Série comique de 16 épisodes tournée à Buea avec partage des revenus TikTok et Facebook Reels.',
      category: 'TikTok Series',
      city: 'Buea',
      platform: 'TikTok',
      status: 'OPEN',
      escrowStatus: 'ESCROW_HOLDING',
      distributorSplitEmail: 'raise-crt_buea_skit_series@clearing.crippo.cm',
      followersCount: 640000,
      engagementRate: 9.2,
      viewVelocity: 310000,
      crippoScore: 89,
      underwritingScore: 86,
      projected12mRevenueXAF: 7200000,
      netBudgetXAF: 1800000,
      grossTargetXAF: 1890000,
      totalShares: 900,
      sharesRemaining: 245,
      investorsCount: 118,
      tradingVolumeXAF: 1940000,
      baseSharePriceXAF: 2100,
      sharePriceXAF: 2420,
      priceChangePct: 15.2,
      sparkline: [2100, 2180, 2240, 2190, 2340, 2420],
      priceHistory: [
        { time: iso(280), priceXAF: 2100, catalystTitle: 'Pre-Listing Audit P₀', deltaPct: 0 },
        { time: iso(140), priceXAF: 2240 },
        { time: iso(60), priceXAF: 2340, catalystTitle: 'Episode 1 Teaser Hits 1.1M Views', deltaPct: 6.8 },
        { time: iso(8), priceXAF: 2420 },
      ],
      totalRaisedXAF: 1375500,
      targetRaiseXAF: 1890000,
      revSharePct: 30,
      roiDurationMonths: 8,
      closesAt: closesInDays(9),
      isVerified: true,
      milestonesCompleted: 0,
      createdAt: iso(290),
      updatedAt: iso(8),
    },
    {
      id: 'crt_yaounde_doc_cinema',
      ownerUid: adminUid,
      name: 'Nadia Etoundi Films',
      handle: '@etoundifilms',
      raiseTitle: 'Wouri Bridge: Independent Docu-Film',
      raiseTitleFr: 'Pont du Wouri : Documentaire Cinéma',
      summary: 'Feature-length Cameroonian documentary submitted to FESPACO & Canal+ Afrique acquisition slate with 22% licensing split.',
      summaryFr: 'Long-métrage documentaire soumis au FESPACO & Canal+ Afrique avec 22% des droits partagés.',
      category: 'Movies & Docs',
      city: 'Yaoundé',
      platform: 'Multi-Platform',
      status: 'OPEN',
      escrowStatus: 'TRANCHE_1_RELEASED',
      distributorSplitEmail: 'raise-crt_yaounde_doc_cinema@clearing.crippo.cm',
      followersCount: 285000,
      engagementRate: 5.8,
      viewVelocity: 64000,
      crippoScore: 85,
      underwritingScore: 88,
      projected12mRevenueXAF: 14000000,
      netBudgetXAF: 4000000,
      grossTargetXAF: 4200000,
      totalShares: 1200,
      sharesRemaining: 590,
      investorsCount: 74,
      tradingVolumeXAF: 2120000,
      baseSharePriceXAF: 3500,
      sharePriceXAF: 3390,
      priceChangePct: -3.1,
      sparkline: [3500, 3550, 3490, 3420, 3390],
      priceHistory: [
        { time: iso(350), priceXAF: 3500, catalystTitle: 'Initial Underwriting P₀', deltaPct: 0 },
        { time: iso(200), priceXAF: 3550 },
        { time: iso(45), priceXAF: 3390, catalystTitle: 'Edit Schedule Extended by 10 Days', deltaPct: -3.1 },
      ],
      totalRaisedXAF: 2135000,
      targetRaiseXAF: 4200000,
      revSharePct: 22,
      roiDurationMonths: 14,
      closesAt: closesInDays(18),
      isVerified: true,
      claimStatus: 'CLAIMED',
      claimedByUid: adminUid,
      milestonesCompleted: 1,
      createdAt: iso(360),
      updatedAt: iso(45),
    },
    {
      id: 'crt_mimie_directory',
      ownerUid: adminUid,
      name: 'Mimie',
      handle: '@mimieofficial',
      raiseTitle: 'Douala Acoustic Live Sessions (Directory Listing)',
      raiseTitleFr: 'Sessions Live Douala (Profil Répertoire)',
      summary: 'Pre-indexed Cameroon Afropop artist directory card. Official artist can verify bio-code to claim and open Raise rounds or Brand pitches.',
      summaryFr: 'Profil artiste pré-indexé. L’artiste peut vérifier son code bio pour réclamer son profil et lancer une levée.',
      category: 'Music & Albums',
      city: 'Douala',
      platform: 'Multi-Platform',
      status: 'OPEN',
      claimStatus: 'UNCLAIMED',
      escrowStatus: 'ESCROW_HOLDING',
      distributorSplitEmail: 'raise-crt_mimie_directory@clearing.crippo.cm',
      followersCount: 1180000,
      engagementRate: 7.1,
      viewVelocity: 162000,
      crippoScore: 90,
      underwritingScore: 88,
      projected12mRevenueXAF: 11200000,
      netBudgetXAF: 3000000,
      grossTargetXAF: 3150000,
      totalShares: 1000,
      sharesRemaining: 1000,
      investorsCount: 41,
      tradingVolumeXAF: 920000,
      baseSharePriceXAF: 3150,
      sharePriceXAF: 3340,
      priceChangePct: 6.0,
      sparkline: [3150, 3190, 3240, 3300, 3340],
      priceHistory: [
        { time: iso(240), priceXAF: 3150, catalystTitle: 'Directory Indexing P₀', deltaPct: 0 },
        { time: iso(30), priceXAF: 3340, catalystTitle: 'Canal d’Or Nomination Momentum', deltaPct: 6.0 },
      ],
      totalRaisedXAF: 540000,
      targetRaiseXAF: 3150000,
      revSharePct: 20,
      roiDurationMonths: 12,
      closesAt: closesInDays(22),
      isVerified: false,
      milestonesCompleted: 0,
      createdAt: iso(250),
      updatedAt: iso(30),
    },
    {
      id: 'crt_locko_directory',
      ownerUid: adminUid,
      name: 'Locko',
      handle: '@lockoofficial',
      raiseTitle: 'Yaoundé Symphony Live Visuals (Unclaimed Profile)',
      raiseTitleFr: 'Visuels Symphonie Yaoundé (Profil À Réclamer)',
      summary: 'Directory creator listing open for official verification and creator studio claiming.',
      summaryFr: 'Profil créateur répertoire ouvert à la vérification officielle.',
      category: 'Music & Albums',
      city: 'Yaoundé',
      platform: 'YouTube',
      status: 'OPEN',
      claimStatus: 'UNCLAIMED',
      escrowStatus: 'ESCROW_HOLDING',
      distributorSplitEmail: 'raise-crt_locko_directory@clearing.crippo.cm',
      followersCount: 1550000,
      engagementRate: 6.4,
      viewVelocity: 195000,
      crippoScore: 92,
      underwritingScore: 90,
      projected12mRevenueXAF: 15000000,
      netBudgetXAF: 4500000,
      grossTargetXAF: 4725000,
      totalShares: 1050,
      sharesRemaining: 1050,
      investorsCount: 52,
      tradingVolumeXAF: 1180000,
      baseSharePriceXAF: 4500,
      sharePriceXAF: 4680,
      priceChangePct: 4.0,
      sparkline: [4500, 4540, 4600, 4680],
      priceHistory: [
        { time: iso(200), priceXAF: 4500, catalystTitle: 'Directory Indexing P₀', deltaPct: 0 },
        { time: iso(25), priceXAF: 4680, catalystTitle: 'Francophonie Airplay Spike', deltaPct: 4.0 },
      ],
      totalRaisedXAF: 680000,
      targetRaiseXAF: 4725000,
      revSharePct: 22,
      roiDurationMonths: 12,
      closesAt: closesInDays(24),
      isVerified: false,
      milestonesCompleted: 0,
      createdAt: iso(210),
      updatedAt: iso(25),
    },
  ];

  for (const c of starterRaises) {
    batch.set(
      doc(db, 'creators', c.id),
      stripUndefined({
        ...c,
        claimStatus: c.claimStatus || 'CLAIMED',
        claimedByUid: c.claimStatus === 'UNCLAIMED' ? undefined : c.claimedByUid || adminUid,
      })
    );
  }

  const starterPredictions: PredictionMarket[] = [
    {
      id: 'prd_mimie_canaldor_2026',
      creatorName: 'Mimie',
      category: 'Awards',
      questionEn: 'Will Mimie win Canal d’Or Best Female Artist 2026?',
      questionFr: 'Mimie va-t-elle remporter le Canal d’Or Meilleure Artiste Féminine 2026 ?',
      resolutionCriteria: 'Resolves YES if official Canal d’Or 2026 ceremony awards Best Female Artist to Mimie.',
      yesShares: 68,
      noShares: 32,
      yesPoolXAF: 680000,
      noPoolXAF: 320000,
      yesProbabilityPct: 68,
      noProbabilityPct: 32,
      totalVolumeXAF: 1000000,
      sparkline: [54, 58, 61, 65, 68],
      status: 'OPEN',
      closesAt: closesInDays(45),
      createdAt: iso(300),
      updatedAt: iso(5),
    },
    {
      id: 'prd_salatiel_5m_views',
      creatorName: 'Salatiel',
      category: 'Music & Albums',
      questionEn: 'Will Salatiel’s next single cross 5M YouTube views in 30 days?',
      questionFr: 'Le prochain single de Salatiel dépassera-t-il 5M de vues YouTube en 30 jours ?',
      resolutionCriteria: 'Measured via official YouTube counter 30 days post-release.',
      yesShares: 57,
      noShares: 43,
      yesPoolXAF: 456000,
      noPoolXAF: 344000,
      yesProbabilityPct: 57,
      noProbabilityPct: 43,
      totalVolumeXAF: 800000,
      sparkline: [50, 52, 55, 54, 57],
      status: 'OPEN',
      closesAt: closesInDays(30),
      createdAt: iso(260),
      updatedAt: iso(15),
    },
    {
      id: 'prd_koc_japoma_sellout',
      creatorId: 'crt_koc_japoma_ep',
      creatorName: 'Ko-C',
      category: 'Culture',
      questionEn: 'Will Ko-C sell out Douala Japoma Arena before December?',
      questionFr: 'Ko-C remplira-t-il le Stade de Japoma Douala avant décembre ?',
      resolutionCriteria: 'Resolves YES upon official promoter announcement of full ticket sellout.',
      yesShares: 42,
      noShares: 58,
      yesPoolXAF: 252000,
      noPoolXAF: 348000,
      yesProbabilityPct: 42,
      noProbabilityPct: 58,
      totalVolumeXAF: 600000,
      sparkline: [46, 44, 41, 43, 42],
      status: 'OPEN',
      closesAt: closesInDays(25),
      createdAt: iso(220),
      updatedAt: iso(20),
    },
  ];

  for (const p of starterPredictions) {
    batch.set(doc(db, 'predictions', p.id), stripUndefined(p));
  }

  const starterCatalysts: NewsPost[] = [
    {
      id: 'cat_stanley_trace_237',
      sourcePlatform: 'editorial',
      sourceName: '237 Showbiz',
      headline: 'Stanley Enow acoustic teaser enters TRACE Africa Top 10 Countdown across Central Africa.',
      category: 'Music',
      creatorId: 'crt_stanley_enow_album',
      creatorName: 'Stanley Enow',
      city: 'Buea',
      sentiment: 'POSITIVE',
      impactPct: 7.9,
      publishedAt: iso(80),
      syncedAt: iso(80),
    },
    {
      id: 'cat_molyko_viral_tiktok',
      sourcePlatform: 'tiktok',
      sourceName: 'Cameroon Pulse',
      headline: 'Molyko Campus Season 2 trailer crosses 1.1M organic TikTok views in 48 hours.',
      category: 'Entertainment',
      creatorId: 'crt_buea_skit_series',
      creatorName: 'Mola & Tchop Squad',
      city: 'Buea',
      sentiment: 'POSITIVE',
      impactPct: 6.8,
      publishedAt: iso(60),
      syncedAt: iso(60),
    },
    {
      id: 'cat_etoundi_schedule_shift',
      sourcePlatform: 'editorial',
      sourceName: 'Yaoundé Cinema Desk',
      headline: 'Post-production color grading extended by 10 days ahead of Canal+ Afrique screening.',
      category: 'Local News',
      creatorId: 'crt_yaounde_doc_cinema',
      creatorName: 'Nadia Etoundi Films',
      city: 'Yaoundé',
      sentiment: 'NEGATIVE',
      impactPct: -3.1,
      publishedAt: iso(45),
      syncedAt: iso(45),
    },
  ];

  for (const n of starterCatalysts) {
    batch.set(doc(db, 'news_posts', n.id), stripUndefined(n));
  }

  const starterBrands: BrandCampaign[] = [
    {
      id: 'brd_mtn_pulse_237',
      brandName: 'MTN Cameroon',
      agencyName: 'Kamer Talent Agency',
      titleEn: 'MTN Pulse Back-to-Campus Creator Integration',
      titleFr: 'Campagne Créateurs Rentrée MTN Pulse',
      category: 'TikTok Series',
      budgetXAF: 3500000,
      deliverable: '6 native 45s campus comedy integrations + Douala/Buea story takeovers',
      status: 'OPEN',
      createdAt: iso(180),
    },
    {
      id: 'brd_castel_afro_sessions',
      brandName: 'Castel Beer Cameroun',
      agencyName: '237 Creative Hub',
      titleEn: 'Acoustic Live Sessions Douala & Kribi',
      titleFr: 'Sessions Live Acoustiques Douala & Kribi',
      category: 'Music & Albums',
      budgetXAF: 6000000,
      deliverable: 'Title integration on live EP visualizers + 2 VIP listening showcases',
      status: 'OPEN',
      createdAt: iso(140),
    },
    {
      id: 'brd_orange_money_fintech',
      brandName: 'Orange Cameroun',
      agencyName: 'Akwa Media Partners',
      titleEn: 'Orange Money Zero-Fee Creator Payout Week',
      titleFr: 'Semaine Paiements Créateurs Orange Money',
      category: 'Podcasts',
      budgetXAF: 2800000,
      deliverable: '4 bilingual podcast host-reads + YouTube Shorts demonstration',
      status: 'OPEN',
      createdAt: iso(110),
    },
  ];

  for (const b of starterBrands) {
    batch.set(doc(db, 'brand_campaigns', b.id), stripUndefined(b));
  }

  const starterNotifs: NotificationItem[] = [
    {
      id: 'ntf_stanley_spike',
      uid: 'ALL',
      titleEn: 'Stanley Enow +7.9% (237 Showbiz)',
      titleFr: 'Stanley Enow +7,9% (237 Showbiz)',
      bodyEn: 'Motherland Acoustic EP teaser entered TRACE Africa Top 10; share price repriced to 5,850 XAF.',
      bodyFr: 'Le teaser de Motherland Acoustic EP est entré dans le Top 10 TRACE Africa.',
      kind: 'PRICE_SPIKE',
      creatorId: 'crt_stanley_enow_album',
      deltaPct: 7.9,
      createdAt: iso(75),
    },
    {
      id: 'ntf_escrow_t1',
      uid: 'ALL',
      titleEn: 'Tranche 1 (50%) Escrow Released — Stanley Enow',
      titleFr: 'Tranche 1 (50%) Séquestre Libérée — Stanley Enow',
      bodyEn: 'Studio recording milestone verified; distributor split locked at raise-crt_stanley_enow_album@clearing.crippo.cm.',
      bodyFr: 'Étape studio validée ; répartition distributeur verrouillée.',
      kind: 'ESCROW',
      creatorId: 'crt_stanley_enow_album',
      createdAt: iso(10),
    },
  ];

  for (const n of starterNotifs) {
    batch.set(doc(db, 'notifications', n.id), stripUndefined(n));
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'creators/bootstrap');
  }
}

export async function fetchAggregatorStatus(): Promise<AggregatorConfigStatus> {
  const res = await fetch('/api/v1/aggregator/status');
  const json = await res.json();
  return json.data as AggregatorConfigStatus;
}

export async function adminRunAggregatorSync(adminUid: string): Promise<{
  status: 'success' | 'unconfigured' | 'error';
  postsCount: number;
  message: string;
}> {
  const res = await fetch('/api/v1/aggregator/sync', { method: 'POST' });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Aggregator sync failed');
  }

  const data = json.data as {
    status: 'success' | 'unconfigured' | 'error';
    posts: NewsPost[];
    providers: string[];
    notes: string[];
  };

  const nowIso = new Date().toISOString();

  if (data.posts.length > 0) {
    const batch = writeBatch(db);
    for (const post of data.posts) {
      batch.set(doc(db, 'news_posts', post.id), stripUndefined({ ...post }));
    }
    await batch.commit();
  }

  const logId = makeDocId('sync');
  const logDoc = stripUndefined<SyncLog>({
    id: logId,
    triggeredByUid: adminUid,
    provider: data.providers.join(' + ').slice(0, 80),
    postsFetched: data.posts.length,
    metricsUpdated: 0,
    status: data.status,
    message: data.notes.join(' | ').slice(0, 500) || `Synced ${data.posts.length} posts`,
    createdAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'sync_logs', logId), logDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `sync_logs/${logId}`);
  }

  return {
    status: data.status,
    postsCount: data.posts.length,
    message: logDoc.message || 'Sync complete',
  };
}

export async function runPulseAgentOnServer(params: {
  creators: Creator[];
  blogUrls?: string[];
  manualHeadlines?: Array<{ sourceName: string; headline: string; url?: string }>;
}): Promise<AgentPulseResult> {
  const res = await fetch('/api/v1/agents/run-pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creators: params.creators.map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        category: c.category,
        city: c.city,
      })),
      blogUrls: params.blogUrls || [],
      manualHeadlines: params.manualHeadlines || [],
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Market pulse agent failed');
  }
  return json.data as AgentPulseResult;
}

export async function verifyClaimBioCodeOnServer(params: {
  stageName: string;
  handle: string;
  bioVerificationCode: string;
  socialUrl?: string;
}): Promise<BioVerificationAgentResult> {
  const res = await fetch('/api/v1/agents/verify-claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || 'Verification agent failed');
  }
  return json.data as BioVerificationAgentResult;
}

export async function adminCommitAgentPulse(params: {
  adminUid: string;
  creators: Creator[];
  pulse: AgentPulseResult;
  includeCatalysts?: boolean;
  includePredictions?: boolean;
}): Promise<{ postsCommitted: number; creatorsRepriced: number; predictionsOpened: number }> {
  const nowIso = new Date().toISOString();
  const batch = writeBatch(db);
  const creatorMap = new Map(params.creators.map((c) => [c.id, c]));

  let postsCommitted = 0;
  let creatorsRepriced = 0;
  let predictionsOpened = 0;

  if (params.includeCatalysts !== false) {
    for (const post of params.pulse.catalysts) {
      batch.set(doc(db, 'news_posts', post.id), stripUndefined({ ...post }));
      postsCommitted += 1;

      if (post.creatorId && post.impactPct && Math.abs(post.impactPct) > 0.1) {
        const target = creatorMap.get(post.creatorId);
        if (target) {
          const repriced = calculateCatalystRepricing({
            previousPriceXAF: target.sharePriceXAF,
            baseSharePriceXAF: target.baseSharePriceXAF || target.sharePriceXAF,
            impactPct: post.impactPct,
          });
          const nextSparkline = buildNextSparkline(target, repriced.nextPriceXAF);
          const nextHistory = appendPriceHistoryPoint(target.priceHistory, {
            time: nowIso,
            priceXAF: repriced.nextPriceXAF,
            catalystTitle: post.headline.slice(0, 90),
            deltaPct: post.impactPct,
          });
          creatorMap.set(target.id, {
            ...target,
            sharePriceXAF: repriced.nextPriceXAF,
            priceChangePct: repriced.priceChangePct,
            sparkline: nextSparkline,
            priceHistory: nextHistory,
          });
          batch.update(doc(db, 'creators', target.id), {
            sharePriceXAF: repriced.nextPriceXAF,
            priceChangePct: repriced.priceChangePct,
            sparkline: nextSparkline,
            priceHistory: nextHistory,
            updatedAt: nowIso,
          });
          creatorsRepriced += 1;

          const notifId = makeDocId('ntf');
          batch.set(
            doc(db, 'notifications', notifId),
            stripUndefined<NotificationItem>({
              id: notifId,
              uid: 'ALL',
              titleEn: `${target.name} ${post.impactPct >= 0 ? '+' : ''}${post.impactPct}% (${post.sourceName})`,
              titleFr: `${target.name} ${post.impactPct >= 0 ? '+' : ''}${post.impactPct}% (${post.sourceName})`,
              bodyEn: post.headline.slice(0, 220),
              bodyFr: post.headline.slice(0, 220),
              kind: Math.abs(post.impactPct) >= 5 ? 'PRICE_SPIKE' : 'CATALYST',
              creatorId: target.id,
              deltaPct: post.impactPct,
              createdAt: nowIso,
            })
          );
        }
      }
    }
  }

  if (params.includePredictions !== false) {
    for (const proposal of params.pulse.generatedPredictions) {
      const predId = makeDocId('prd');
      const yesPool = Math.max(10000, Math.round(proposal.initialYesProbabilityPct * 1000));
      const noPool = Math.max(10000, Math.round((100 - proposal.initialYesProbabilityPct) * 1000));
      const odds = calculatePredictionProbabilities(yesPool, noPool);

      const pred = stripUndefined<PredictionMarket>({
        id: predId,
        creatorId: proposal.creatorId,
        creatorName: proposal.creatorName,
        category: proposal.category,
        questionEn: proposal.questionEn,
        questionFr: proposal.questionFr,
        resolutionCriteria: proposal.resolutionCriteria,
        yesShares: Math.round(yesPool / odds.yesSharePriceXAF),
        noShares: Math.round(noPool / odds.noSharePriceXAF),
        yesPoolXAF: yesPool,
        noPoolXAF: noPool,
        yesProbabilityPct: odds.yesProbabilityPct,
        noProbabilityPct: odds.noProbabilityPct,
        totalVolumeXAF: yesPool + noPool,
        sparkline: [odds.yesProbabilityPct, odds.yesProbabilityPct],
        status: 'OPEN',
        closesAt: new Date(Date.now() + 21 * 24 * 3600 * 1000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      batch.set(doc(db, 'predictions', predId), pred);
      predictionsOpened += 1;
    }
  }

  const logId = makeDocId('sync');
  batch.set(
    doc(db, 'sync_logs', logId),
    stripUndefined<SyncLog>({
      id: logId,
      triggeredByUid: params.adminUid,
      provider: params.pulse.sourcesChecked.join(' + ').slice(0, 80) || 'Autonomous Agent',
      postsFetched: postsCommitted,
      metricsUpdated: creatorsRepriced + predictionsOpened,
      status: 'success',
      message: `Committed ${postsCommitted} catalysts, repriced ${creatorsRepriced} creators, opened ${predictionsOpened} prediction pools.`,
      createdAt: nowIso,
    })
  );

  try {
    await batch.commit();
    return { postsCommitted, creatorsRepriced, predictionsOpened };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'news_posts/agent_commit');
  }
}
