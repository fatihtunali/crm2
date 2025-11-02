import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const agents = await query(`
      SELECT
        id,
        name,
        email,
        phone,
        country,
        website,
        status,
        created_at,
        updated_at
      FROM organizations
      ORDER BY created_at DESC
    `);

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Agents error:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate slug from name
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const sql = `
      INSERT INTO organizations (
        name,
        slug,
        email,
        phone,
        country,
        website,
        status,
        primary_color,
        secondary_color
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', '#3B82F6', '#6366F1')
    `;

    const params = [
      body.name,
      slug,
      body.email,
      body.phone || null,
      body.country || null,
      body.website || null
    ];

    await query(sql, params);

    return NextResponse.json({ success: true, message: 'Agent created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Create agent error:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Update slug if name changed
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const sql = `
      UPDATE organizations SET
        name = ?,
        slug = ?,
        email = ?,
        phone = ?,
        country = ?,
        website = ?,
        status = ?
      WHERE id = ?
    `;

    const params = [
      body.name,
      slug,
      body.email,
      body.phone || null,
      body.country || null,
      body.website || null,
      body.status || 'active',
      body.id
    ];

    await query(sql, params);

    return NextResponse.json({ success: true, message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Update agent error:', error);
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Soft delete - set status to suspended
    const sql = `
      UPDATE organizations SET
        status = 'suspended'
      WHERE id = ?
    `;

    await query(sql, [body.id]);

    return NextResponse.json({ success: true, message: 'Agent archived successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    return NextResponse.json({ error: 'Failed to archive agent' }, { status: 500 });
  }
}
