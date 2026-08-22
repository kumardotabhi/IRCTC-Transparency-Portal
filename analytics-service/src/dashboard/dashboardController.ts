import { Request, Response } from 'express';
import { analyticsStore } from '../database/eventStore';

export class DashboardController {
  /**
   * Public dashboard summary endpoint.
   * Cached, anonymized, aggregate metrics.
   */
  static async getSummary(req: Request, res: Response) {
    try {
      const summary = analyticsStore.getDashboardSummary();
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      console.error('[Dashboard.getSummary] Error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate aggregate dashboard summary.'
      });
    }
  }
}

