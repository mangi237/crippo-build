export type NewsCategory = 'Trending' | 'Entertainment' | 'Tech' | 'Local News' | 'Music';

export type MarketCategory =
  | 'Trending'
  | 'Music & Albums'
  | 'TikTok Series'
  | 'Movies & Docs'
  | 'Podcasts'
  | 'Creators Directory'
  | 'Brand Campaigns'
  | 'Ended Raises';

export type CreatorCategory =
  | 'Music & Albums'
  | 'TikTok Series'
  | 'Movies & Docs'
  | 'Podcasts'
  | 'Brand Campaigns'
  | 'Music'
  | 'Entertainment'
  | 'Comedy'
  | 'Film'
  | 'Tech'
  | 'Lifestyle';

export interface PricePoint {
  label: string;
  priceXAF: number;
  catalystTitle?: string;
  deltaPct?: number;
}

export interface PriceHistoryPoint {
  time: string;
  priceXAF: number;
  catalystTitle?: string;
  deltaPct?: number;
}

export const FIELD_LIMITS = {
  NAME_MAX: 120,
  HANDLE_MAX: 80,
  CITY_MAX: 80,
  PITCH_MIN: 10,
  PITCH_MAX: 1000,
  HEADLINE_MAX: 240,
  NOTES_MAX: 500,
} as const;

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  city?: string;
  anonymousId: string;
  avatarUrl?: string;
  walletBalanceXAF?: number;
  momoPhone?: string;
  momoNetwork?: 'MTN MoMo' | 'Orange Money';
  admin: boolean;
  isVerifiedCreator: boolean;
  creatorId?: string;
  totalRaisedXAF?: number;
  currentValuationXAF?: number;
  completedMilestones?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Creator {
  id: string;
  ownerUid: string;
  name: string;
  handle: string;
  raiseTitle?: string;
  raiseTitleFr?: string;
  summary?: string;
  summaryFr?: string;
  avatarUrl?: string;
  coverUrl?: string;
  category: CreatorCategory;
  city?: string;
  platform?: 'TikTok' | 'Facebook' | 'YouTube' | 'Multi-Platform';
  status?: 'OPEN' | 'FUNDED' | 'ENDED';
  claimStatus?: 'UNCLAIMED' | 'CLAIMED';
  claimedByUid?: string;
  escrowStatus?: 'ESCROW_HOLDING' | 'TRANCHE_1_RELEASED' | 'COMPLETED_LOCKED';
  distributorSplitEmail?: string;
  followersCount?: number;
  engagementRate?: number;
  viewVelocity?: number;
  crippoScore?: number;
  underwritingScore?: number;
  projected12mRevenueXAF?: number;
  netBudgetXAF?: number;
  grossTargetXAF?: number;
  totalShares?: number;
  sharesRemaining?: number;
  investorsCount?: number;
  tradingVolumeXAF: number;
  baseSharePriceXAF?: number;
  sharePriceXAF: number;
  priceChangePct: number;
  sparkline?: number[];
  priceHistory?: PriceHistoryPoint[];
  totalRaisedXAF?: number;
  targetRaiseXAF?: number;
  revSharePct?: number;
  roiDurationMonths?: number;
  closesAt?: string;
  isVerified: boolean;
  milestonesCompleted?: number;
  // Public bio (Wikipedia-style profile), editable by the verified owner
  bio?: string;
  genres?: string[];
  activeSinceYear?: number;
  websiteUrl?: string;
  // Shown only when the creator opts in; birthYear is removed when they opt out
  ageVisible?: boolean;
  birthYear?: number;
  // Label membership, set when a creator accepts a label invitation
  labelId?: string;
  labelName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  ownerUid: string;
  name: string;
  country: string;
  description: string;
  foundedYear?: number;
  rccmNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface LabelInvitation {
  id: string; // `${labelId}_${creatorId}`
  labelId: string;
  labelName: string;
  labelOwnerUid: string;
  creatorId: string;
  creatorName: string;
  creatorUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface PredictionMarket {
  id: string;
  creatorId?: string;
  creatorName?: string;
  category: 'Music & Albums' | 'TikTok Series' | 'Movies & Docs' | 'Awards' | 'Culture' | 'Tech';
  questionEn: string;
  questionFr: string;
  resolutionCriteria?: string;
  thumbnailUrl?: string;
  yesShares: number;
  noShares: number;
  yesPoolXAF: number;
  noPoolXAF: number;
  yesProbabilityPct: number;
  noProbabilityPct: number;
  totalVolumeXAF: number;
  sparkline?: number[];
  status: 'OPEN' | 'RESOLVED_YES' | 'RESOLVED_NO';
  closesAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PredictionVote {
  id: string;
  uid: string;
  predictionId: string;
  questionEn?: string;
  questionFr?: string;
  side: 'YES' | 'NO';
  shares: number;
  priceXAF: number;
  totalPaidXAF: number;
  createdAt: string;
}

export interface Trade {
  id: string;
  uid: string;
  creatorId: string;
  creatorName: string;
  creatorHandle?: string;
  creatorAvatarUrl?: string;
  side?: 'BUY' | 'SELL';
  sharesHeld: number;
  entryPriceXAF: number;
  totalPaidXAF: number;
  ownershipPct?: number;
  revSharePct?: number;
  paymentMethod?: 'MTN MoMo' | 'Orange Money' | 'Wallet';
  status: 'in_race' | 'roi_active' | 'settled';
  closesAt?: string;
  roiDurationMonths?: number;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  uid: string;
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRADE_BUY' | 'TRADE_SELL' | 'PREDICTION_VOTE' | 'ROYALTY_PAYOUT';
  network: 'MTN MoMo' | 'Orange Money' | 'Wallet';
  phone?: string;
  amountXAF: number;
  reference: string;
  status: 'COMPLETED' | 'PENDING';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  uid: string;
  titleEn: string;
  titleFr: string;
  bodyEn?: string;
  bodyFr?: string;
  kind: 'CATALYST' | 'PRICE_SPIKE' | 'DIVIDEND' | 'ESCROW';
  creatorId?: string;
  deltaPct?: number;
  createdAt: string;
}

export interface BrandCampaign {
  id: string;
  brandName: string;
  agencyName?: string;
  titleEn: string;
  titleFr: string;
  category?: string;
  budgetXAF: number;
  deliverable?: string;
  status: 'OPEN' | 'MATCHED';
  createdAt: string;
}

export interface BrandApplication {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  creatorId: string;
  creatorName: string;
  uid: string;
  pitch: string;
  proposedFeeXAF: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface CreatorApplication {
  id: string;
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
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoRequest {
  id: string;
  requestedByUid: string;
  creatorName: string;
  handle?: string;
  platform: 'TikTok' | 'Facebook' | 'YouTube' | 'Other';
  socialUrl?: string;
  reason?: string;
  status: 'pending' | 'reviewed' | 'listed';
  createdAt: string;
}

export interface NewsPost {
  id: string;
  sourcePlatform: 'facebook' | 'tiktok' | 'editorial';
  sourceName: string;
  authorHandle?: string;
  headline: string;
  thumbnailUrl?: string;
  externalUrl?: string;
  category: NewsCategory;
  creatorId?: string;
  creatorName?: string;
  city?: string;
  sentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  impactPct?: number;
  engagementScore?: number;
  publishedAt: string;
  syncedAt: string;
}

export interface SyncLog {
  id: string;
  triggeredByUid: string;
  provider: string;
  postsFetched: number;
  metricsUpdated?: number;
  status: 'success' | 'error' | 'unconfigured';
  message?: string;
  createdAt: string;
}

export interface AggregatorConfigStatus {
  facebookConfigured: boolean;
  facebookProvider: string;
  tiktokConfigured: boolean;
  tiktokProvider: string;
  geminiConfigured: boolean;
}

export interface UnderwritingResult {
  approved: boolean;
  projected12mRevenueXAF: number;
  recommendedMaxNetBudgetXAF: number;
  grossTargetXAF: number;
  initialSharePriceXAF: number;
  underwritingScore: number;
  verdictEn: string;
  verdictFr: string;
}

export interface AgentGeneratedPrediction {
  creatorId?: string;
  creatorName?: string;
  category: PredictionMarket['category'];
  questionEn: string;
  questionFr: string;
  resolutionCriteria: string;
  initialYesProbabilityPct: number;
}

export interface AgentPulseResult {
  sourcesChecked: string[];
  catalysts: NewsPost[];
  generatedPredictions: AgentGeneratedPrediction[];
  summary: string;
}

export interface BioVerificationAgentResult {
  codeFoundInPublicProfile: boolean;
  reachable: boolean;
  confidenceScore: number;
  notes: string;
}
