/**
 * Dependency health check endpoint
 * Checks health of database and external services
 *
 * GET /api/health/deps
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { env } from '@/lib/env';

interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<DependencyStatus> {
  const startTime = Date.now();

  try {
    // Simple ping query
    await query('SELECT 1 as ping');

    const responseTime = Date.now() - startTime;

    return {
      name: 'database',
      status: responseTime < 100 ? 'healthy' : 'degraded',
      response_time_ms: responseTime,
      details: {
        host: env.DATABASE_HOST,
        port: env.DATABASE_PORT,
        database: env.DATABASE_NAME,
      },
    };
  } catch (error: any) {
    return {
      name: 'database',
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      error: error.message || 'Database connection failed',
    };
  }
}

/**
 * Check Anthropic AI service availability
 */
async function checkAnthropicAI(): Promise<DependencyStatus> {
  // Note: We don't actually ping the API to avoid costs
  // Just check if API key is configured
  const hasApiKey = env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.length > 0;

  return {
    name: 'anthropic_ai',
    status: hasApiKey ? 'healthy' : 'unhealthy',
    details: {
      configured: hasApiKey,
      key_length: hasApiKey ? env.ANTHROPIC_API_KEY.length : 0,
    },
    ...(hasApiKey ? {} : { error: 'API key not configured' }),
  };
}

export async function GET() {
  const startTime = Date.now();

  // Check all dependencies in parallel
  const [databaseStatus, aiStatus] = await Promise.all([
    checkDatabase(),
    checkAnthropicAI(),
  ]);

  const dependencies = [databaseStatus, aiStatus];

  // Determine overall health
  const hasUnhealthy = dependencies.some(dep => dep.status === 'unhealthy');
  const hasDegraded = dependencies.some(dep => dep.status === 'degraded');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  let httpStatus: number;

  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
    httpStatus = 503; // Service Unavailable
  } else if (hasDegraded) {
    overallStatus = 'degraded';
    httpStatus = 200; // Still operational but degraded
  } else {
    overallStatus = 'healthy';
    httpStatus = 200;
  }

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'CRM API',
      version: '1.0.0',
      check_duration_ms: Date.now() - startTime,
      dependencies,
    },
    { status: httpStatus }
  );
}
