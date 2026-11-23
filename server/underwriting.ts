import { GoogleGenAI, Type } from '@google/genai';
import type { UnderwritingResult } from '../src/types/crippo.ts';

export interface UnderwritingRequest {
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
}

export async function runPreListingUnderwriting(input: UnderwritingRequest): Promise<UnderwritingResult> {
  const ytViews = Math.max(0, Number(input.youtube30dViews) || 0);
  const spotifyListeners = Math.max(0, Number(input.spotifyMonthlyListeners) || 0);
  const tiktokViews = Math.max(0, Number(input.tiktokVelocity) || 0);
  const engagement = Math.max(0.5, Number(input.engagementRate) || 3);
  const diasporaRatio = Math.min(0.85, Math.max(0.05, (Number(input.diasporaSharePct) || 20) / 100));
  const localRatio = 1 - diasporaRatio;

  const months = Math.max(3, Math.min(36, Number(input.roiDurationMonths) || 12));
  const totalShares = Math.max(100, Math.round(Number(input.totalFixedShares) || 1000));
  const requestedNet = Math.max(50000, Math.round(Number(input.requestedNetBudgetXAF) || 500000));

  // Projected 12-month cross-market streaming & creator monetization revenue (XAF)
  // Diaspora CPM/payout (~1.85 XAF/stream blended) + Local African payout (~0.42 XAF/stream blended)
  const projectedAnnualStreams = ytViews * 12 + spotifyListeners * 18 + tiktokViews * 4;
  const blendedPayoutPerStream = diasporaRatio * 1.85 + localRatio * 0.42;
  const engagementMultiplier = Math.min(1.85, Math.max(0.85, 0.8 + engagement / 18));

  const projected12mRevenueXAF = Math.round(
    Math.max(350000, projectedAnnualStreams * blendedPayoutPerStream * engagementMultiplier)
  );

  // Inflation blocker: cap feasible net budget to projected revenue across ROI window * 0.72 safety margin
  const windowCapacity = Math.round(projected12mRevenueXAF * (months / 12) * 0.72);
  const approved = requestedNet <= windowCapacity;
  const approvedNetBudgetXAF = approved ? requestedNet : Math.max(100000, windowCapacity);

  // 5% Origination Gross-Up
  const grossTargetXAF = Math.round(approvedNetBudgetXAF * 1.05);
  const initialSharePriceXAF = Math.max(100, Math.round(grossTargetXAF / totalShares));

  const coverageRatio = windowCapacity / Math.max(1, requestedNet);
  const underwritingScore = Math.min(98, Math.max(38, Math.round(52 + coverageRatio * 24 + Math.min(15, engagement))));

  let verdictEn = approved
    ? `Audit passed: ${Math.round(projected12mRevenueXAF).toLocaleString()} XAF projected 12m royalties support ${grossTargetXAF.toLocaleString()} XAF gross target.`
    : `Inflation blocker triggered: Requested net budget exceeds safe 12m royalty capacity. Capped net budget to ${approvedNetBudgetXAF.toLocaleString()} XAF.`;

  let verdictFr = approved
    ? `Audit validé : ${Math.round(projected12mRevenueXAF).toLocaleString()} XAF de revenus projetés sur 12 mois couvrent l'objectif brut de ${grossTargetXAF.toLocaleString()} XAF.`
    : `Blocage d'inflation : Budget demandé supérieur à la capacité de redevances. Plafonné à ${approvedNetBudgetXAF.toLocaleString()} XAF net.`;

  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('MY_')) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Summarize this creator capital market underwriting audit concisely (max 22 words each in English and French).
Creator: ${input.stageName} (${input.category})
Projected 12m Revenue: ${projected12mRevenueXAF} XAF
Requested Net Budget: ${requestedNet} XAF
Approved: ${approved}
Gross Target (+5%): ${grossTargetXAF} XAF
Initial Share Price: ${initialSharePriceXAF} XAF`,
        config: {
          systemInstruction: 'Output crisp institutional financial underwriting verdicts in English and French. Never mention internal model or database names.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdictEn: { type: Type.STRING },
              verdictFr: { type: Type.STRING },
            },
            required: ['verdictEn', 'verdictFr'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        verdictEn?: string;
        verdictFr?: string;
      };
      if (parsed.verdictEn) verdictEn = parsed.verdictEn;
      if (parsed.verdictFr) verdictFr = parsed.verdictFr;
    } catch {
      // Keep deterministic financial verdict
    }
  }

  return {
    approved,
    projected12mRevenueXAF,
    recommendedMaxNetBudgetXAF: approvedNetBudgetXAF,
    grossTargetXAF,
    initialSharePriceXAF,
    underwritingScore,
    verdictEn,
    verdictFr,
  };
}
