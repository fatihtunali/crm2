/**
 * Error Handler Middleware
 * Converts various error types to RFC 7807 Problem format
 */

import { NextResponse } from 'next/server';
import type { Problem, ValidationProblem, ValidationError } from '@/types/api';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public type: string,
    public title: string,
    message?: string,
    public detail?: string
  ) {
    super(message || title);
    this.name = 'ApiError';
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationApiError extends ApiError {
  constructor(
    public errors: ValidationError[],
    message?: string
  ) {
    super(
      400,
      'https://api.crm2.com/problems/validation-error',
      'Validation Error',
      message,
      message || 'The request contains invalid data'
    );
    this.name = 'ValidationApiError';
  }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends ApiError {
  constructor(resource: string, identifier?: string | number) {
    const detail = identifier
      ? `${resource} with identifier '${identifier}' was not found`
      : `${resource} was not found`;

    super(
      404,
      'https://api.crm2.com/problems/not-found',
      'Resource Not Found',
      detail,
      detail
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Custom error class for unauthorized errors
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication is required to access this resource') {
    super(
      401,
      'https://api.crm2.com/problems/unauthorized',
      'Unauthorized',
      message,
      message
    );
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error class for forbidden errors
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'You do not have permission to access this resource') {
    super(
      403,
      'https://api.crm2.com/problems/forbidden',
      'Forbidden',
      message,
      message
    );
    this.name = 'ForbiddenError';
  }
}

/**
 * Custom error class for conflict errors
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'The request conflicts with the current state of the resource') {
    super(
      409,
      'https://api.crm2.com/problems/conflict',
      'Conflict',
      message,
      message
    );
    this.name = 'ConflictError';
  }
}

/**
 * Check if error is a database/SQL error
 */
function isDatabaseError(error: any): boolean {
  return (
    error.code !== undefined &&
    (error.code.startsWith('ER_') || // MySQL errors
      error.code.startsWith('SQLITE_') || // SQLite errors
      error.code.startsWith('23') || // PostgreSQL constraint violations
      error.code.startsWith('42') || // PostgreSQL syntax errors
      error.code === 'ECONNREFUSED' || // Connection errors
      error.code === 'PROTOCOL_CONNECTION_LOST')
  );
}

/**
 * Parse database error and convert to Problem
 */
function parseDatabaseError(error: any): Problem {
  const code = error.code || 'UNKNOWN';
  const sqlMessage = error.sqlMessage || error.message || 'Database operation failed';

  // Handle common database errors
  if (code.startsWith('23') || code.startsWith('ER_DUP')) {
    // Constraint violation / duplicate entry
    return {
      type: 'https://api.crm2.com/problems/database-constraint',
      title: 'Database Constraint Violation',
      status: 409,
      detail: 'The operation violates a database constraint',
      code,
      sqlMessage,
    };
  }

  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    // Schema error
    return {
      type: 'https://api.crm2.com/problems/database-schema',
      title: 'Database Schema Error',
      status: 500,
      detail: 'A database schema error occurred',
      code,
    };
  }

  if (code === 'ECONNREFUSED' || code === 'PROTOCOL_CONNECTION_LOST') {
    // Connection error
    return {
      type: 'https://api.crm2.com/problems/database-connection',
      title: 'Database Connection Error',
      status: 503,
      detail: 'Unable to connect to the database',
      code,
    };
  }

  // Generic database error
  return {
    type: 'https://api.crm2.com/problems/database-error',
    title: 'Database Error',
    status: 500,
    detail: 'A database error occurred while processing your request',
    code,
  };
}

/**
 * Check if error is a TypeError
 */
function isTypeError(error: any): error is TypeError {
  return error instanceof TypeError || error.name === 'TypeError';
}

/**
 * Log error with appropriate level
 */
function logError(error: any, problem: Problem): void {
  const logData = {
    type: problem.type,
    status: problem.status,
    title: problem.title,
    detail: problem.detail,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };

  if (problem.status >= 500) {
    // Server errors - log as error
    console.error('[Error Handler]', JSON.stringify(logData, null, 2));
  } else if (problem.status >= 400) {
    // Client errors - log as warning
    console.warn('[Error Handler]', JSON.stringify(logData, null, 2));
  } else {
    // Other - log as info
    console.info('[Error Handler]', JSON.stringify(logData, null, 2));
  }
}

/**
 * Convert any error to RFC 7807 Problem format and return as NextResponse
 * @param error - The error to handle
 * @param instance - Optional request URL for the instance field
 * @returns NextResponse with Problem JSON body
 */
export function handleError(error: any, instance?: string): NextResponse {
  let problem: Problem;

  // Handle custom API errors
  if (error instanceof ValidationApiError) {
    const validationProblem: ValidationProblem = {
      type: error.type,
      title: error.title,
      status: error.status,
      detail: error.detail,
      errors: error.errors,
    };

    if (instance) {
      validationProblem.instance = instance;
    }

    logError(error, validationProblem);

    return NextResponse.json(validationProblem, {
      status: validationProblem.status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    });
  }

  if (error instanceof ApiError) {
    problem = {
      type: error.type,
      title: error.title,
      status: error.status,
      detail: error.detail,
    };

    if (instance) {
      problem.instance = instance;
    }

    logError(error, problem);

    return NextResponse.json(problem, {
      status: problem.status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    });
  }

  // Handle database errors
  if (isDatabaseError(error)) {
    problem = parseDatabaseError(error);

    if (instance) {
      problem.instance = instance;
    }

    logError(error, problem);

    return NextResponse.json(problem, {
      status: problem.status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    });
  }

  // Handle TypeError (usually programming errors)
  if (isTypeError(error)) {
    problem = {
      type: 'https://api.crm2.com/problems/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An internal error occurred while processing your request',
    };

    if (instance) {
      problem.instance = instance;
    }

    // Include error message in development mode
    if (process.env.NODE_ENV === 'development') {
      problem.detail = error.message;
      problem.stack = error.stack;
    }

    logError(error, problem);

    return NextResponse.json(problem, {
      status: problem.status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    });
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    problem = {
      type: 'https://api.crm2.com/problems/internal-error',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred while processing your request',
    };

    if (instance) {
      problem.instance = instance;
    }

    // Include error message in development mode
    if (process.env.NODE_ENV === 'development') {
      problem.detail = error.message;
      problem.stack = error.stack;
    }

    logError(error, problem);

    return NextResponse.json(problem, {
      status: problem.status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    });
  }

  // Handle unknown error types
  problem = {
    type: 'https://api.crm2.com/problems/unknown-error',
    title: 'Unknown Error',
    status: 500,
    detail: 'An unknown error occurred while processing your request',
  };

  if (instance) {
    problem.instance = instance;
  }

  // Include error details in development mode
  if (process.env.NODE_ENV === 'development') {
    problem.detail = String(error);
  }

  logError(error, problem);

  return NextResponse.json(problem, {
    status: problem.status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}

/**
 * Wrap an async route handler with error handling
 * @param handler - The async route handler function
 * @returns Wrapped handler with automatic error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Try to extract request URL if available
      const request = args.find((arg) => arg && typeof arg === 'object' && 'url' in arg);
      const instance = request?.url;

      return handleError(error, instance);
    }
  };
}
