import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createAgentRouter } from './agent/routes.js';
import { PrismDatabase } from './db.js';
import { createApiRouter, releaseHeldShabbosDrafts } from './routes.js';
import { startShabbosReleaseLoop } from './shabbosGuard.js';

const PORT = Number(process.env.PORT || 3456);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServerApp(dbPath?: string) {
  const db = new PrismDatabase(dbPath);
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Mount core REST API and Claude Inbox Agent API
  app.use('/api', createApiRouter(db));
  app.use('/api/agent', createAgentRouter(db.createAgentContext()));

  // Production static asset serving for built Vite bundle
  const clientDistDir = path.resolve(__dirname, '../../client/dist');
  const shouldServeStatic =
    process.env.NODE_ENV === 'production' && fs.existsSync(path.join(clientDistDir, 'index.html'));

  if (shouldServeStatic) {
    app.use(express.static(clientDistDir));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  // Fallback JSON 404 for unknown API paths
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global JSON error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[prism-server] Unhandled error:', err);
    res.status(500).json({ error: message });
  });

  return { app, db };
}

const { app, db } = createServerApp();

startShabbosReleaseLoop(async () => {
  const released = await releaseHeldShabbosDrafts(db);
  if (released > 0) {
    console.log(`[shabbos-guard] Released ${released} held message(s) after window ended.`);
  }
}, 60_000);

app.listen(PORT, () => {
  console.log(`[prism-server] Running on http://localhost:${PORT}`);
  console.log(`[prism-server] SQLite store: ${db.dbPath}`);
});
