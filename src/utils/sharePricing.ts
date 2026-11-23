import type { Creator, PriceHistoryPoint } from '../types/crippo';

/**
 * Core Financial Algorithms & Dynamic Share Pricing Engine
 * Implements:
 * - Gross Target (XAF) = Net Production Budget * 1.05
 * - Initial Share Price (P0) = Gross Target / Total Fixed Shares
 * - Pt = P_{t-1} * (1 + Delta_Demand + Delta_CulturalNews)
 * - Exact Investor Ownership % = (Shares Owned / Total Fixed Shares) * Project Revenue Share %
 * - Secondary sell settlement minus 1.5% spread
 */

export const SECONDARY_SPREAD_RATE = 0.015;
export const ORIGINATION_FEE_MULTIPLIER = 1.05;

export function calculateInitialSharePrice(netBudgetXAF: number, totalFixedShares: number): {
  grossTargetXAF: number;
  initialSharePriceXAF: number;
} {
  const grossTargetXAF = Math.round(Math.max(50000, netBudgetXAF) * ORIGINATION_FEE_MULTIPLIER);
  const shares = Math.max(100, Math.round(totalFixedShares));
  const initialSharePriceXAF = Math.max(100, Math.round(grossTargetXAF / shares));
  return { grossTargetXAF, initialSharePriceXAF };
}

export function calculateInvestorOwnershipPct(
  sharesOwned: number,
  totalFixedShares: number,
  projectRevSharePct: number
): { poolOwnershipPct: number; effectiveRoyaltySharePct: number } {
  const total = Math.max(1, totalFixedShares);
  const poolFraction = Math.min(1, Math.max(0, sharesOwned / total));
  const poolOwnershipPct = Number((poolFraction * 100).toFixed(2));
  const effectiveRoyaltySharePct = Number((poolFraction * Math.max(0, projectRevSharePct)).toFixed(3));
  return { poolOwnershipPct, effectiveRoyaltySharePct };
}

export function calculateOrderRepricing(params: {
  previousPriceXAF: number;
  baseSharePriceXAF: number;
  totalFixedShares: number;
  sharesDelta: number;
  side: 'BUY' | 'SELL';
}): { nextPriceXAF: number; priceChangePct: number; deltaDemand: number } {
  const prev = Math.max(100, params.previousPriceXAF);
  const base = Math.max(100, params.baseSharePriceXAF || prev);
  const totalShares = Math.max(100, params.totalFixedShares || 1000);
  const orderFraction = Math.min(0.15, params.sharesDelta / totalShares);

  // Scarcity & order-flow pressure: buys push up (+0.4% to +8%), secondary sells push down (-0.3% to -6%)
  const rawShift = Math.max(0.004, orderFraction * 0.65);
  const deltaDemand = params.side === 'BUY' ? rawShift : -rawShift * 0.8;

  const nextPriceXAF = Math.max(100, Math.round(prev * (1 + deltaDemand)));
  const priceChangePct = Number((((nextPriceXAF - base) / base) * 100).toFixed(1));

  return { nextPriceXAF, priceChangePct, deltaDemand };
}

export function calculateCatalystRepricing(params: {
  previousPriceXAF: number;
  baseSharePriceXAF: number;
  impactPct: number;
}): { nextPriceXAF: number; priceChangePct: number } {
  const prev = Math.max(100, params.previousPriceXAF);
  const base = Math.max(100, params.baseSharePriceXAF || prev);
  const clampedImpact = Math.max(-25, Math.min(25, params.impactPct));
  const nextPriceXAF = Math.max(100, Math.round(prev * (1 + clampedImpact / 100)));
  const priceChangePct = Number((((nextPriceXAF - base) / base) * 100).toFixed(1));
  return { nextPriceXAF, priceChangePct };
}

export function calculateDynamicShareMetrics(params: {
  baseSharePriceXAF: number;
  engagementRate?: number;
  viewVelocity?: number;
  followersCount?: number;
  tradingVolumeXAF: number;
}): { sharePriceXAF: number; priceChangePct: number } {
  const base = Math.max(100, params.baseSharePriceXAF || 500);
  const engagement = Math.max(0, params.engagementRate || 0);
  const velocity = Math.max(0, params.viewVelocity || 0);
  const followers = Math.max(0, params.followersCount || 0);
  const volume = Math.max(0, params.tradingVolumeXAF || 0);

  const engagementFactor = Math.min(0.35, (engagement / 100) * 2.2);
  const velocityFactor = velocity > 0 ? Math.min(0.25, Math.log10(velocity) * 0.035) : 0;
  const followerFactor = followers > 0 ? Math.min(0.15, Math.log10(followers) * 0.02) : 0;
  const volumeFactor = volume > 0 ? Math.min(0.45, Math.log10(Math.max(1, volume / 1000)) * 0.07) : 0;

  const multiplier = 1 + engagementFactor + velocityFactor + followerFactor + volumeFactor;
  const sharePriceXAF = Math.max(100, Math.round(base * multiplier));
  const priceChangePct = Number((((sharePriceXAF - base) / base) * 100).toFixed(1));

  return { sharePriceXAF, priceChangePct };
}

export function buildNextSparkline(creator: Creator, nextPrice: number): number[] {
  const prev = Array.isArray(creator.sparkline) ? creator.sparkline : [];
  if (prev.length === 0) {
    return [creator.baseSharePriceXAF || creator.sharePriceXAF, nextPrice];
  }
  return [...prev.slice(-29), nextPrice];
}

export function appendPriceHistoryPoint(
  existing: PriceHistoryPoint[] | undefined,
  point: PriceHistoryPoint
): PriceHistoryPoint[] {
  const prev = Array.isArray(existing) ? existing : [];
  return [...prev.slice(-59), point];
}

export function calculatePredictionProbabilities(yesPoolXAF: number, noPoolXAF: number): {
  yesProbabilityPct: number;
  noProbabilityPct: number;
  yesSharePriceXAF: number;
  noSharePriceXAF: number;
} {
  const y = Math.max(1000, yesPoolXAF);
  const n = Math.max(1000, noPoolXAF);
  const total = y + n;
  const yesProb = Math.min(99, Math.max(1, Math.round((y / total) * 100)));
  const noProb = 100 - yesProb;
  // Standard 1,000 XAF par binary contract pricing (1% = 10 XAF)
  return {
    yesProbabilityPct: yesProb,
    noProbabilityPct: noProb,
    yesSharePriceXAF: Math.max(50, yesProb * 10),
    noSharePriceXAF: Math.max(50, noProb * 10),
  };
}

export function computeOrderBookLevels(midPriceXAF: number, sharesRemaining: number) {
  const baseLot = Math.max(10, Math.round(Math.min(500, sharesRemaining / 8)));
  const bids = [0.995, 0.99, 0.985, 0.98].map((mult, i) => ({
    priceXAF: Math.max(100, Math.round(midPriceXAF * mult)),
    lot: Math.max(5, Math.round(baseLot * (1 + i * 0.25))),
  }));
  const asks = [1.0, 1.005, 1.012, 1.02].map((mult, i) => ({
    priceXAF: Math.max(100, Math.round(midPriceXAF * mult)),
    lot: Math.max(5, Math.round(baseLot * (0.9 + i * 0.2))),
  }));
  return { bids, asks };
}
