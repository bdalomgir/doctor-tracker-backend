import type { Request, Response } from 'express';
import type { DashboardQuery } from './dashboard.schema.js';
import * as dashboardService from './dashboard.service.js';

export async function stats(req: Request, res: Response) {
  // Parsed & coerced by the `validate` middleware (Express types it as raw ParsedQs).
  const data = await dashboardService.getDashboardStats(req.query as unknown as DashboardQuery);
  res.json({ success: true, data });
}
