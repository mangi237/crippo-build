import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import type { AggregatorConfigStatus, NewsCategory, NewsPost } from '../src/types/crippo.ts';

function hasEnv(key: string): boolean {
  const val = process.env[key];
  return Boolean(val && val.trim() !== '' && !val.startsWith('MY_'));
}

export function getAggregatorConfigStatus(): AggregatorConfigStatus {
  const fbProvider = hasEnv('META_GRAPH_ACCESS_TOKEN')
    ? 'Meta Graph API'
    : hasEnv('APIFY_API_TOKEN') && hasEnv('APIFY_FACEBOOK_ACTOR_ID')
      ? 'Apify Facebook Pages'
      : 'Not Configured';

  const ttProvider = hasEnv('RAPIDAPI_KEY') && hasEnv('RAPIDAPI_TIKTOK_HOST')
    ? 'RapidAPI TikTok'
    : hasEnv('APIFY_API_TOKEN') && hasEnv('APIFY_TIKTOK_ACTOR_ID')
      ? 'Apify TikTok'
      : hasEnv('TIKTOK_CLIENT_KEY') && hasEnv('TIKTOK_CLIENT_SECRET')
        ? 'TikTok Research API'
        : 'Not Configured';

  return {
    facebookConfigured: fbProvider !== 'Not Configured',
    facebookProvider: fbProvider,
    tiktokConfigured: ttProvider !== 'Not Configured',
    tiktokProvider: ttProvider,
    geminiConfigured: hasEnv('GEMINI_API_KEY'),
  };
}

export function classifyByKeywords(text: string, engagementScore = 0): NewsCategory {
  const lower = text.toLowerCase();
  if (/(album|single|music|song|concert|afrobeats|mbole|makossa|studio|spotify|clip|track|dj|rap)/.test(lower)) {
    return 'Music';
  }
  if (/(ai|tech|startup|app|software|fintech|momo|digital|coding|hackathon|cimfest)/.test(lower)) {
    return 'Tech';
  }
  if (/(douala|yaounde|yaoundé|buea|cameroon|cameroun|bamenda|limbe|civic|city|municipal|local)/.test(lower)) {
    return 'Local News';
  }
  if (/(film|movie|cinema|comedy|skit|actor|award|canal d'or|festival|showbiz|celebrity)/.test(lower)) {
    return 'Entertainment';
  }
  if (engagementScore >= 5000) {
    return 'Trending';
  }
  return 'Trending';
}

async function classifyBatchWithGemini(posts: NewsPost[]): Promise<NewsPost[]> {
  if (!hasEnv('GEMINI_API_KEY') || posts.length === 0) {
    return posts;
  }
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const inputList = posts.slice(0, 25).map((p, idx) => ({
      index: idx,
      sourcePlatform: p.sourcePlatform,
      headline: p.headline,
      engagementScore: p.engagementScore ?? 0,
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Categorize each social media post into exactly one category from: Trending, Entertainment, Tech, Local News, Music.\nPosts:\n${JSON.stringify(inputList)}`,
      config: {
        systemInstruction: 'Return JSON array mapping each post index to its best category.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              category: { type: Type.STRING },
            },
            required: ['index', 'category'],
          },
        },
      },
    });

    const classifications = JSON.parse((response.text ?? '[]').trim()) as Array<{ index: number; category: string }>;
    const validCategories: NewsCategory[] = ['Trending', 'Entertainment', 'Tech', 'Local News', 'Music'];
    const mapped = [...posts];
    for (const item of classifications) {
      if (mapped[item.index] && validCategories.includes(item.category as NewsCategory)) {
        mapped[item.index] = { ...mapped[item.index], category: item.category as NewsCategory };
      }
    }
    return mapped;
  } catch {
    return posts;
  }
}

function makeStableId(prefix: string, seed: string): string {
  return `${prefix}_${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16)}`;
}

async function fetchFacebookPosts(): Promise<{ provider: string; posts: NewsPost[]; note?: string }> {
  const urls = (process.env.AGGREGATOR_FACEBOOK_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (hasEnv('META_GRAPH_ACCESS_TOKEN')) {
    if (urls.length === 0) {
      return {
        provider: 'Meta Graph API',
        posts: [],
        note: 'META_GRAPH_ACCESS_TOKEN is set, but AGGREGATOR_FACEBOOK_URLS is empty.',
      };
    }
    const token = process.env.META_GRAPH_ACCESS_TOKEN!;
    const collected: NewsPost[] = [];
    for (const pageUrl of urls.slice(0, 5)) {
      const pageSlug = pageUrl.split('/').filter(Boolean).pop() || pageUrl;
      const endpoint = `https://graph.facebook.com/v20.0/${encodeURIComponent(pageSlug)}/posts?fields=id,message,created_time,full_picture,permalink_url,shares&limit=10&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          message?: string;
          created_time?: string;
          full_picture?: string;
          permalink_url?: string;
          shares?: { count?: number };
        }>;
      };
      for (const item of data.data || []) {
        if (!item.message) continue;
        const headline = item.message.replace(/\s+/g, ' ').trim().slice(0, 220);
        const engagementScore = Number(item.shares?.count || 0) * 10;
        collected.push({
          id: makeStableId('fb', item.id || headline),
          sourcePlatform: 'facebook',
          sourceName: pageSlug,
          authorHandle: `@${pageSlug}`,
          headline,
          thumbnailUrl: item.full_picture || undefined,
          externalUrl: item.permalink_url || pageUrl,
          category: classifyByKeywords(headline, engagementScore),
          engagementScore,
          publishedAt: item.created_time || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        });
      }
    }
    return { provider: 'Meta Graph API', posts: collected };
  }

  if (hasEnv('APIFY_API_TOKEN') && hasEnv('APIFY_FACEBOOK_ACTOR_ID')) {
    if (urls.length === 0) {
      return {
        provider: 'Apify Facebook Pages',
        posts: [],
        note: 'APIFY_API_TOKEN is set, but AGGREGATOR_FACEBOOK_URLS is empty.',
      };
    }
    const actorId = process.env.APIFY_FACEBOOK_ACTOR_ID!;
    const token = process.env.APIFY_API_TOKEN!;
    const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=30`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: urls.map((url) => ({ url })),
        resultsLimit: 12,
      }),
    });
    if (!res.ok) {
      throw new Error(`Apify Facebook sync failed with HTTP ${res.status}`);
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const collected: NewsPost[] = [];
    for (const row of rows) {
      const text = String(row.text || row.message || row.title || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const headline = text.slice(0, 220);
      const likes = Number(row.likes || 0);
      const shares = Number(row.shares || 0);
      const engagementScore = likes + shares * 5;
      const pageName = String(row.pageName || row.userName || 'Facebook Creator');
      const postUrl = String(row.url || row.postUrl || '');
      const thumb = typeof row.media === 'string' ? row.media : typeof row.thumbnail === 'string' ? row.thumbnail : undefined;
      collected.push({
        id: makeStableId('fb', postUrl || headline),
        sourcePlatform: 'facebook',
        sourceName: pageName.slice(0, 110),
        authorHandle: `@${pageName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)}`,
        headline,
        thumbnailUrl: thumb,
        externalUrl: postUrl || undefined,
        category: classifyByKeywords(headline, engagementScore),
        engagementScore,
        publishedAt: String(row.time || row.timestamp || new Date().toISOString()),
        syncedAt: new Date().toISOString(),
      });
    }
    return { provider: 'Apify Facebook Pages', posts: collected };
  }

  return {
    provider: 'Facebook (Unconfigured)',
    posts: [],
    note: 'Add META_GRAPH_ACCESS_TOKEN or APIFY_API_TOKEN + APIFY_FACEBOOK_ACTOR_ID + AGGREGATOR_FACEBOOK_URLS in .env.',
  };
}

async function fetchTikTokPosts(): Promise<{ provider: string; posts: NewsPost[]; note?: string }> {
  const hashtags = (process.env.AGGREGATOR_TIKTOK_HASHTAGS || '237')
    .split(',')
    .map((s) => s.trim().replace(/^#/, ''))
    .filter(Boolean);

  if (hasEnv('RAPIDAPI_KEY') && hasEnv('RAPIDAPI_TIKTOK_HOST')) {
    const host = process.env.RAPIDAPI_TIKTOK_HOST!;
    const key = process.env.RAPIDAPI_KEY!;
    const tag = hashtags[0] || '237';
    const endpoint = `https://${host}/feed/search?keywords=${encodeURIComponent(tag)}&count=12`;
    const res = await fetch(endpoint, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
      },
    });
    if (!res.ok) {
      throw new Error(`RapidAPI TikTok sync failed with HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { data?: { videos?: Array<Record<string, unknown>> } };
    const videos = payload?.data?.videos || [];
    const collected: NewsPost[] = [];
    for (const v of videos) {
      const title = String(v.title || '').replace(/\s+/g, ' ').trim();
      if (!title) continue;
      const author = (v.author as Record<string, unknown> | undefined) || {};
      const handle = String(author.unique_id || 'tiktokcreator');
      const playCount = Number(v.play_count || 0);
      const diggCount = Number(v.digg_count || 0);
      const engagementScore = playCount + diggCount * 5;
      collected.push({
        id: makeStableId('tt', String(v.video_id || title)),
        sourcePlatform: 'tiktok',
        sourceName: String(author.nickname || handle).slice(0, 110),
        authorHandle: `@${handle}`,
        headline: title.slice(0, 220),
        thumbnailUrl: typeof v.cover === 'string' ? v.cover : undefined,
        externalUrl: `https://www.tiktok.com/@${handle}/video/${String(v.video_id || '')}`,
        category: classifyByKeywords(title, engagementScore),
        engagementScore,
        publishedAt: v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      });
    }
    return { provider: 'RapidAPI TikTok', posts: collected };
  }

  if (hasEnv('APIFY_API_TOKEN') && hasEnv('APIFY_TIKTOK_ACTOR_ID')) {
    const actorId = process.env.APIFY_TIKTOK_ACTOR_ID!;
    const token = process.env.APIFY_API_TOKEN!;
    const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=30`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags,
        resultsPerPage: 12,
      }),
    });
    if (!res.ok) {
      throw new Error(`Apify TikTok sync failed with HTTP ${res.status}`);
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const collected: NewsPost[] = [];
    for (const row of rows) {
      const text = String(row.text || row.desc || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const authorMeta = (row.authorMeta as Record<string, unknown> | undefined) || {};
      const handle = String(authorMeta.name || 'tiktokcreator');
      const plays = Number(row.playCount || 0);
      const likes = Number(row.diggCount || 0);
      const engagementScore = plays + likes * 5;
      const webUrl = String(row.webVideoUrl || '');
      const cover =
        typeof (row.videoMeta as Record<string, unknown> | undefined)?.coverUrl === 'string'
          ? String((row.videoMeta as Record<string, unknown>).coverUrl)
          : undefined;
      collected.push({
        id: makeStableId('tt', webUrl || text),
        sourcePlatform: 'tiktok',
        sourceName: String(authorMeta.nickName || handle).slice(0, 110),
        authorHandle: `@${handle}`,
        headline: text.slice(0, 220),
        thumbnailUrl: cover,
        externalUrl: webUrl || undefined,
        category: classifyByKeywords(text, engagementScore),
        engagementScore,
        publishedAt: String(row.createTimeISO || new Date().toISOString()),
        syncedAt: new Date().toISOString(),
      });
    }
    return { provider: 'Apify TikTok', posts: collected };
  }

  return {
    provider: 'TikTok (Unconfigured)',
    posts: [],
    note: 'Add RAPIDAPI_KEY + RAPIDAPI_TIKTOK_HOST or APIFY_API_TOKEN + APIFY_TIKTOK_ACTOR_ID in .env.',
  };
}

export async function runUnifiedSocialSync(): Promise<{
  status: 'success' | 'unconfigured' | 'error';
  posts: NewsPost[];
  providers: string[];
  notes: string[];
}> {
  const [fbResult, ttResult] = await Promise.all([
    fetchFacebookPosts().catch((err) => ({
      provider: 'Facebook (Error)',
      posts: [] as NewsPost[],
      note: err instanceof Error ? err.message : 'Facebook fetch failed',
    })),
    fetchTikTokPosts().catch((err) => ({
      provider: 'TikTok (Error)',
      posts: [] as NewsPost[],
      note: err instanceof Error ? err.message : 'TikTok fetch failed',
    })),
  ]);

  const combined = [...fbResult.posts, ...ttResult.posts];
  const classified = await classifyBatchWithGemini(combined);
  const notes = [fbResult.note, ttResult.note].filter((n): n is string => Boolean(n));

  const status: 'success' | 'unconfigured' | 'error' =
    classified.length > 0
      ? 'success'
      : notes.some((n) => n.toLowerCase().includes('failed'))
        ? 'error'
        : 'unconfigured';

  return {
    status,
    posts: classified,
    providers: [fbResult.provider, ttResult.provider],
    notes,
  };
}
