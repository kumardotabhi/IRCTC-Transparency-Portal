import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { EventsController } from './events/eventsController';
import { DashboardController } from './dashboard/dashboardController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '2mb' }));

// 1. Health Probe
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'Analytics-Ingest-Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    privacyMode: 'STRICT_ANONYMIZATION'
  });
});

// 2. Ingest API (Opt-in Anonymized Batch)
app.post('/events/batch', EventsController.ingestBatch);

// 3. Public Dashboard Summary
app.get('/dashboard/summary', DashboardController.getSummary);

// 4. 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found on Analytics Service.`
  });
});

// 5. Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Analytics Service Error]:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error in Analytics Ingest Service.'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Analytics-Service] 📊 Anonymized Analytics Ingest running on http://localhost:${PORT}`);
  });
}

export default app;

