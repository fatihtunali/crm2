/**
 * Basic health check endpoint
 * Returns 200 OK if service is running
 *
 * GET /api/health
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CRM API',
    version: '1.0.0',
  });
}
