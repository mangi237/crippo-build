import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getAggregatorConfigStatus, runUnifiedSocialSync } from './server/socialAggregator.ts';
import { runPreListingUnderwriting } from './server/underwriting.ts';
import { runBioCodeVerificationAgent, runMarketPulseAgent } from './server/agents.ts';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/v1/aggregator/status', (_req, res) => {
    res.json({
      success: true,
      data: getAggregatorConfigStatus(),
    });
  });

  app.post('/api/v1/aggregator/sync', async (req, res) => {
    try {
      const blogUrls = Array.isArray(req.body?.blogUrls) ? req.body.blogUrls : undefined;
      const result = await runUnifiedSocialSync(blogUrls);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AGGREGATOR_ERROR',
          message: err instanceof Error ? err.message : 'Social aggregation failed.',
        },
      });
    }
  });

  app.post('/api/v1/underwrite', async (req, res) => {
    try {
      const result = await runPreListingUnderwriting(req.body || {});
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: 'UNDERWRITING_ERROR',
          message: err instanceof Error ? err.message : 'Underwriting evaluation failed.',
        },
      });
    }
  });

  app.post('/api/v1/agents/run-pulse', async (req, res) => {
    try {
      const result = await runMarketPulseAgent(req.body || {});
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AGENT_PULSE_ERROR',
          message: err instanceof Error ? err.message : 'Market pulse agent execution failed.',
        },
      });
    }
  });

  app.post('/api/v1/agents/verify-claim', async (req, res) => {
    try {
      const result = await runBioCodeVerificationAgent(req.body || {});
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: {
          code: 'AGENT_VERIFY_ERROR',
          message: err instanceof Error ? err.message : 'Bio-code verification agent failed.',
        },
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output missing. Run npm run build.');
      }
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Crippo server running on http://localhost:${port}`);
  });
}

startServer();
