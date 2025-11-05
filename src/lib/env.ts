/**
 * Centralized Environment Configuration
 *
 * This file validates and exports all environment variables used in the application.
 * It fails fast at startup if required variables are missing, preventing runtime errors.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const connection = await mysql.createConnection({
 *     host: env.DATABASE_HOST,
 *     user: env.DATABASE_USER,
 *     password: env.DATABASE_PASSWORD,
 *   });
 */

interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';

  // Database
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;

  // Authentication
  JWT_SECRET: string;

  // External APIs
  ANTHROPIC_API_KEY: string;

  // Optional configurations
  LOG_LEVEL?: string;
}

/**
 * Validates that a required environment variable is set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ CONFIGURATION ERROR: Required environment variable "${name}" is not set.\n` +
      `Please add it to your .env file.\n` +
      `Example: ${name}=your_value_here`
    );
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : defaultValue;
}

/**
 * Validates environment variable length for security
 */
function requireMinLength(name: string, value: string, minLength: number): string {
  if (value.length < minLength) {
    throw new Error(
      `❌ SECURITY ERROR: Environment variable "${name}" must be at least ${minLength} characters long.\n` +
      `Current length: ${value.length} characters.\n` +
      `Please generate a secure value using: openssl rand -base64 ${minLength}`
    );
  }
  return value;
}

/**
 * Converts string to number and validates
 */
function requireNumber(name: string, value: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(
      `❌ CONFIGURATION ERROR: Environment variable "${name}" must be a valid number.\n` +
      `Received: "${value}"`
    );
  }
  return num;
}

/**
 * Validates and exports environment configuration
 *
 * This function runs immediately when the module is imported,
 * ensuring all required environment variables are set before
 * the application starts.
 */
function loadEnvironment(): EnvironmentConfig {
  // Validate NODE_ENV
  const nodeEnv = getEnv('NODE_ENV', 'development');
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(
      `❌ CONFIGURATION ERROR: NODE_ENV must be "development", "production", or "test".\n` +
      `Received: "${nodeEnv}"`
    );
  }

  // Database configuration
  const dbHost = requireEnv('DATABASE_HOST');
  const dbPort = requireNumber('DATABASE_PORT', getEnv('DATABASE_PORT', '3306'));
  const dbUser = requireEnv('DATABASE_USER');
  const dbPassword = requireEnv('DATABASE_PASSWORD');
  const dbName = requireEnv('DATABASE_NAME');

  // Validate database password strength (minimum 8 characters)
  if (dbPassword.length < 8) {
    console.warn(
      `⚠️  WARNING: DATABASE_PASSWORD is only ${dbPassword.length} characters. ` +
      `Consider using a stronger password (16+ characters).`
    );
  }

  // JWT Secret (must be at least 32 characters for security)
  const jwtSecret = requireEnv('JWT_SECRET');
  requireMinLength('JWT_SECRET', jwtSecret, 32);

  // Anthropic API Key
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');

  // Validate API key format (should start with sk-ant-)
  if (!anthropicApiKey.startsWith('sk-ant-')) {
    console.warn(
      `⚠️  WARNING: ANTHROPIC_API_KEY doesn't match expected format (should start with "sk-ant-"). ` +
      `This may cause API calls to fail.`
    );
  }

  // Optional configurations
  const logLevel = getEnv('LOG_LEVEL', 'info');

  // Log successful configuration load (only in development)
  if (nodeEnv === 'development') {
    console.log('✅ Environment configuration loaded successfully');
    console.log(`   - Database: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
    console.log(`   - JWT Secret: ${jwtSecret.substring(0, 8)}... (${jwtSecret.length} chars)`);
    console.log(`   - Anthropic API Key: ${anthropicApiKey.substring(0, 15)}...`);
    console.log(`   - Log Level: ${logLevel}`);
  }

  return {
    NODE_ENV: nodeEnv as 'development' | 'production' | 'test',
    DATABASE_HOST: dbHost,
    DATABASE_PORT: dbPort,
    DATABASE_USER: dbUser,
    DATABASE_PASSWORD: dbPassword,
    DATABASE_NAME: dbName,
    JWT_SECRET: jwtSecret,
    ANTHROPIC_API_KEY: anthropicApiKey,
    LOG_LEVEL: logLevel,
  };
}

// Load and validate environment on module import
// This ensures the app crashes immediately if configuration is invalid
export const env = loadEnvironment();

/**
 * Type-safe environment variable access
 *
 * This ensures TypeScript knows the exact types of all environment variables,
 * preventing typos and providing autocomplete.
 */
export type Env = typeof env;

/**
 * Helper to check if we're in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Helper to check if we're in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Helper to check if we're in test mode
 */
export const isTest = env.NODE_ENV === 'test';
