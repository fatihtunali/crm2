import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requirePermission } from '@/middleware/permissions';
import { successResponse, errorResponse, internalServerErrorProblem, badRequestProblem } from '@/lib/response';
import bcrypt from 'bcryptjs';

// GET - Get single user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requirePermission(request, 'users', 'read');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

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
       WHERE id = ? AND organization_id = ?`,
      [id, tenantId]
    );

    if (users.length === 0) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `User with ID ${id} not found`,
        instance: request.url,
      });
    }

    return successResponse(users[0]);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to fetch user'));
  }
}

// PATCH - Update user details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requirePermission(request, 'users', 'update');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Only org_admin and super_admin can update users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only administrators can update users',
        instance: request.url,
      });
    }

    const body = await request.json();
    const { first_name, last_name, role, status, password } = body;

    // Verify user exists and belongs to same organization
    const existingUsers = await query(
      'SELECT id, role FROM users WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    );

    if (existingUsers.length === 0) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `User with ID ${id} not found`,
        instance: request.url,
      });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['org_admin', 'org_user', 'viewer'];
      if (!validRoles.includes(role)) {
        return errorResponse(badRequestProblem(`Role must be one of: ${validRoles.join(', ')}`));
      }
    }

    // Validate status if provided
    if (status && !['active', 'inactive'].includes(status)) {
      return errorResponse(badRequestProblem('Status must be either "active" or "inactive"'));
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(first_name || null);
    }
    if (last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(last_name || null);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    // Handle password update separately
    if (password) {
      if (password.length < 8) {
        return errorResponse(badRequestProblem('Password must be at least 8 characters'));
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return errorResponse(badRequestProblem('No fields to update'));
    }

    values.push(id);
    values.push(tenantId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      values
    );

    // Fetch updated user
    const [updatedUser] = await query(
      `SELECT id, email, first_name, last_name, role, organization_id, status, created_at, last_login
       FROM users WHERE id = ?`,
      [id]
    ) as any[];

    return successResponse(updatedUser);
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to update user'));
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await requirePermission(request, 'users', 'delete');
    if ('error' in authResult) {
      return authResult.error;
    }
    const { tenantId, user } = authResult;

    // Only org_admin and super_admin can delete users
    if (user.role !== 'org_admin' && user.role !== 'super_admin') {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only administrators can delete users',
        instance: request.url,
      });
    }

    // Prevent self-deletion
    if (parseInt(id) === user.userId) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'You cannot delete your own account',
        instance: request.url,
      });
    }

    // Verify user exists and belongs to same organization
    const existingUsers = await query(
      'SELECT id FROM users WHERE id = ? AND organization_id = ?',
      [id, tenantId]
    );

    if (existingUsers.length === 0) {
      return errorResponse({
        type: 'https://api.crm2.com/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `User with ID ${id} not found`,
        instance: request.url,
      });
    }

    // Delete the user
    await query('DELETE FROM users WHERE id = ? AND organization_id = ?', [id, tenantId]);

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Database error:', error);
    return errorResponse(internalServerErrorProblem('Failed to delete user'));
  }
}
