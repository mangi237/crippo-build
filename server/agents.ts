import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AgentGeneratedPrediction,
  AgentPulseResult,
  BioVerificationAgentResult,
  NewsPost,
} from '../src/types/crippo.ts';
import { classifyByKeywords, runUnifiedSocialSync } from './socialAggregator.ts';

function hasGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && !key.startsWith('MY_'));
}

export interface AgentCreatorSummary {
  id: string;
  name: string;
  handle: string;
  category: string;
  city?: string;
}

export interface RunMarketPulseInput {
  creators: AgentCreatorSummary[];
  blogUrls?: string[];
  manualHeadlines?: Array<{ sourceName: string; headline: string; url?: string }>;
}

function deterministicScoreFallback(
  headline: string,
  creators: AgentCreatorSummary[]
): { creator?: AgentCreatorSummary; sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; impactPct: number } {
  const lower = headline.toLowerCase();
  const matched = creators.find(
    (c) => lower.includes(c.name.toLowerCase()) || lower.includes(c.handle.replace(/^@/, '').toLowerCase())
  );

  const posTerms = /(top 10|chart|sold out|viral|1m|million|award|won|winner|concert|tour|deal|partnership|release|drop|hit|trending)/i;
  const negTerms = /(delay|cancel|postpone|lawsuit|controversy|boycott|drop|leak|suspend|fail)/i;

  let sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
  let impactPct = 0;

  if (negTerms.test(lower)) {
    sentiment = 'NEGATIVE';
    impactPct = matched ? -4.2 : -1.5;
  } else if (posTerms.test(lower)) {
    sentiment = 'POSITIVE';
    impactPct = matched ? 5.8 : 2.0;
  }

  return { creator: matched, sentiment, impactPct };
}

export async function runMarketPulseAgent(input: RunMarketPulseInput): Promise<AgentPulseResult> {
  const nowIso = new Date().toISOString();
  const creators = (input.creators || []).slice(0, 40);
  const manualPosts: NewsPost[] = (input.manualHeadlines || [])
    .filter((m) => m.headline && m.headline.trim().length > 4)
    .map((m) => ({
      id: `man_${crypto.createHash('sha1').update(`${m.sourceName}:${m.headline}`).digest('hex').slice(0, 14)}`,
      sourcePlatform: 'editorial',
      sourceName: (m.sourceName || '237 News Desk').slice(0, 100),
      headline: m.headline.trim().slice(0, 220),
      externalUrl: m.url?.trim() || undefined,
      category: classifyByKeywords(m.headline, 3200),
      city: /yaound/i.test(m.headline) ? 'Yaoundé' : /buea/i.test(m.headline) ? 'Buea' : 'Douala',
      engagementScore: 3200,
      publishedAt: nowIso,
      syncedAt: nowIso,
    }));

  const syncResult = await runUnifiedSocialSync(input.blogUrls);
  const rawPosts = [...manualPosts, ...syncResult.posts].slice(0, 20);
  const sourcesChecked = [
    ...syncResult.providers,
    ...(manualPosts.length > 0 ? [`Editorial Desk (${manualPosts.length})`] : []),
  ];

  if (rawPosts.length === 0) {
    return {
      sourcesChecked,
      catalysts: [],
      generatedPredictions: [],
      summary:
        syncResult.notes.join(' | ') ||
        'No RSS, Facebook, TikTok, or headline items were available to analyze. Provide RSS feed URLs or headlines and retry.',
    };
  }

  if (!hasGeminiKey()) {
    const fallbackCatalysts: NewsPost[] = rawPosts.map((post) => {
      const scored = deterministicScoreFallback(post.headline, creators);
      return {
        ...post,
        creatorId: scored.creator?.id,
        creatorName: scored.creator?.name,
        sentiment: scored.sentiment,
        impactPct: scored.impactPct,
      };
    });

    return {
      sourcesChecked,
      catalysts: fallbackCatalysts,
      generatedPredictions: [],
      summary: `Fetched ${fallbackCatalysts.length} live posts across ${sourcesChecked.join(', ')}. Configure GEMINI_API_KEY in Secrets to enable autonomous AI Yes/No voting pool synthesis.`,
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const creatorRoster = creators.map((c) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
      category: c.category,
      city: c.city || 'Douala',
    }));

    const itemPayloads = rawPosts.map((p, index) => ({
      index,
      sourceName: p.sourceName,
      sourcePlatform: p.sourcePlatform,
      headline: p.headline,
      engagementScore: p.engagementScore || 0,
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are the Crippo Market Intelligence & Prediction Synthesis Agent for Cameroon's creator capital market.
Given the listed creators and the latest scraped local blog / social posts:
1) Match each post to a listed creatorId ONLY if clearly relevant (otherwise leave creatorId empty).
2) Assign sentiment (POSITIVE, NEGATIVE, NEUTRAL) and bounded share price impactPct between -12 and +15 (0 if no listed creator matched).
3) Generate 1 to 3 high-signal binary YES/NO Prediction Market proposals (in BOTH English and French) inspired by the top cultural stories, with objective verifiable resolutionCriteria and initialYesProbabilityPct between 25 and 75.

Listed Creators:
${JSON.stringify(creatorRoster)}

Incoming Blog & Social Posts:
${JSON.stringify(itemPayloads)}`,
      config: {
        systemInstruction:
          'Return strict JSON with catalysts and predictions arrays. Keep headlines concise and resolution criteria objective.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            catalysts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  creatorId: { type: Type.STRING },
                  sentiment: { type: Type.STRING },
                  impactPct: { type: Type.NUMBER },
                },
                required: ['index', 'sentiment', 'impactPct'],
              },
            },
            predictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  creatorId: { type: Type.STRING },
                  creatorName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  questionEn: { type: Type.STRING },
                  questionFr: { type: Type.STRING },
                  resolutionCriteria: { type: Type.STRING },
                  initialYesProbabilityPct: { type: Type.NUMBER },
                },
                required: ['category', 'questionEn', 'questionFr', 'resolutionCriteria', 'initialYesProbabilityPct'],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ['catalysts', 'predictions', 'summary'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      catalysts?: Array<{ index: number; creatorId?: string; sentiment: string; impactPct: number }>;
      predictions?: Array<AgentGeneratedPrediction>;
      summary?: string;
    };

    const creatorById = new Map(creators.map((c) => [c.id, c]));
    const analyzedPosts: NewsPost[] = rawPosts.map((post, idx) => {
      const match = (parsed.catalysts || []).find((c) => c.index === idx);
      const matchedCreator = match?.creatorId ? creatorById.get(match.creatorId) : undefined;
      const boundedImpact = matchedCreator
        ? Math.max(-12, Math.min(15, Number((match?.impactPct || 0).toFixed(1))))
        : 0;
      const sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' =
        match?.sentiment === 'POSITIVE' || match?.sentiment === 'NEGATIVE' ? match.sentiment : 'NEUTRAL';

      return {
        ...post,
        creatorId: matchedCreator?.id,
        creatorName: matchedCreator?.name,
        sentiment,
        impactPct: boundedImpact,
      };
    });

    const validPredCats: AgentGeneratedPrediction['category'][] = [
      'Music & Albums',
      'TikTok Series',
      'Movies & Docs',
      'Awards',
      'Culture',
      'Tech',
    ];

    const generatedPredictions: AgentGeneratedPrediction[] = (parsed.predictions || []).slice(0, 3).map((p) => {
      const matched = p.creatorId ? creatorById.get(p.creatorId) : undefined;
      return {
        creatorId: matched?.id,
        creatorName: matched?.name || p.creatorName,
        category: validPredCats.includes(p.category) ? p.category : 'Culture',
        questionEn: p.questionEn.slice(0, 220),
        questionFr: p.questionFr.slice(0, 220),
        resolutionCriteria: p.resolutionCriteria.slice(0, 420),
        initialYesProbabilityPct: Math.max(20, Math.min(80, Math.round(p.initialYesProbabilityPct || 50))),
      };
    });

    return {
      sourcesChecked,
      catalysts: analyzedPosts,
      generatedPredictions,
      summary:
        parsed.summary ||
        `Analyzed ${analyzedPosts.length} live articles/posts and synthesized ${generatedPredictions.length} prediction voting pools.`,
    };
  } catch (err) {
    const fallbackCatalysts: NewsPost[] = rawPosts.map((post) => {
      const scored = deterministicScoreFallback(post.headline, creators);
      return {
        ...post,
        creatorId: scored.creator?.id,
        creatorName: scored.creator?.name,
        sentiment: scored.sentiment,
        impactPct: scored.impactPct,
      };
    });
    return {
      sourcesChecked,
      catalysts: fallbackCatalysts,
      generatedPredictions: [],
      summary: `AI classification hit an error (${err instanceof Error ? err.message : 'unknown'}); applied deterministic creator matching across ${fallbackCatalysts.length} items.`,
    };
  }
}

export async function runBioCodeVerificationAgent(params: {
  stageName: string;
  handle: string;
  bioVerificationCode: string;
  socialUrl?: string;
}): Promise<BioVerificationAgentResult> {
  const code = (params.bioVerificationCode || '').trim();
  const targetUrl = (params.socialUrl || '').trim();

  if (!code || !targetUrl || !targetUrl.startsWith('http')) {
    return {
      codeFoundInPublicProfile: false,
      reachable: false,
      confidenceScore: 0,
      notes: 'Provide a valid http(s) public Facebook, TikTok, or YouTube URL alongside the CRIPPO verification code.',
    };
  }

  let htmlSnippet = '';
  let reachable = false;
  let exactMatch = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrippoVerificationBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    reachable = res.ok;
    if (res.ok) {
      const text = await res.text();
      exactMatch = text.toUpperCase().includes(code.toUpperCase());
      htmlSnippet = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 2200);
    }
  } catch {
    reachable = false;
  }

  if (exactMatch) {
    return {
      codeFoundInPublicProfile: true,
      reachable: true,
      confidenceScore: 98,
      notes: `Exact bio-code ${code} detected inside public HTML response of ${targetUrl}. Ready to grant verified claim.`,
    };
  }

  if (hasGeminiKey() && reachable && htmlSnippet.length > 60) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Evaluate whether this fetched social profile snippet belongs to ${params.stageName} (${params.handle}) and contains or references bio-code ${code}.
Snippet: ${htmlSnippet}`,
        config: {
          systemInstruction: 'Return JSON with codeFoundInPublicProfile, confidenceScore (0-100), and concise notes.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              codeFoundInPublicProfile: { type: Type.BOOLEAN },
              confidenceScore: { type: Type.NUMBER },
              notes: { type: Type.STRING },
            },
            required: ['codeFoundInPublicProfile', 'confidenceScore', 'notes'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        codeFoundInPublicProfile?: boolean;
        confidenceScore?: number;
        notes?: string;
      };
      return {
        codeFoundInPublicProfile: Boolean(parsed.codeFoundInPublicProfile),
        reachable: true,
        confidenceScore: Math.max(0, Math.min(100, Math.round(parsed.confidenceScore || 35))),
        notes: parsed.notes || 'Checked public profile content.',
      };
    } catch {
      // fall through
    }
  }

  return {
    codeFoundInPublicProfile: false,
    reachable,
    confidenceScore: reachable ? 30 : 10,
    notes: reachable
      ? `Profile loaded, but ${code} was not visibly rendered in initial SSR HTML (common on JavaScript-rendered social pages). Verify against uploaded KYC media.`
      : `Could not fetch ${targetUrl} directly (network block or login wall). Verify manually against uploaded KYC document.`,
  };
}
