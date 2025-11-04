import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireTenant } from '@/middleware/tenancy';
import { successResponse, errorResponse, internalServerErrorProblem, badRequestProblem } from '@/lib/response';
import bcrypt from 'bcryptjs';

// GET - List all users in the organization
export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId, user } = tenantResult;

    // Only org_admin and super_admin can view users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only administrators can view users',
        instance: request.url,
      });
    }

    const users = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at, last_login
       FROM users
       WHERE organization_id = ?
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return successResponse(users);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch users'));
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    const tenantResult = await requireTenant(request);
    if ('error' in tenantResult) {
      return errorResponse(tenantResult.error);
    }
    const { tenantId, user } = tenantResult;

    // Only org_admin and super_admin can create users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only administrators can create users',
        instance: request.url,
      });
    }

    const body = await request.json();
    const { email, password, first_name, last_name, role } = body;

    // Validation
    if (!email || !password) {
      return errorResponse(badRequestProblem('Email and password are required'));
    }

    if (password.length < 8) {
      return errorResponse(badRequestProblem('Password must be at least 8 characters'));
    }

    const validRoles = ['org_admin', 'org_user', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return errorResponse(badRequestProblem(`Role must be one of: ${validRoles.join(', ')}`));
    }

    // Check if email already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/duplicate-email',
        title: 'Duplicate Email',
        status: 409,
        detail: `A user with email ${email} already exists`,
        instance: request.url,
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [email, passwordHash, first_name || null, last_name || null, role || 'org_user', tenantId]
    );

    const insertId = (result as any).insertId;

    // Fetch created user
    const [createdUser] = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at
       FROM users WHERE id = ?`,
      [insertId]
    ) as any[];

    return NextResponse.json(createdUser, { status: 201 });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to create user'));
  }
}
