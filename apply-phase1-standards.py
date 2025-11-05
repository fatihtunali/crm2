#!/usr/bin/env python3
"""
Script to apply Phase 1 standards to all provider endpoint files
Applies:
- Standardized imports (correlation, rate limiting, pagination, errors)
- Request ID and logging
- Rate limiting
- parseStandardPaginationParams
- buildStandardListResponse
- standardErrorResponse
- Audit logging (keeping existing RBAC)
"""

import re
import os

# Phase 1 standard imports to add
PHASE1_IMPORTS = """import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  parseStandardPaginationParams,
  parseSortParams,
  buildStandardListResponse,
} from '@/lib/pagination';
import {
  buildWhereClause,
  buildSearchClause,
  buildQuery,
} from '@/lib/query-builder';
import {
  standardErrorResponse,
  validationErrorResponse,
  ErrorCodes,
  addStandardHeaders,
} from '@/lib/response';
import { requirePermission } from '@/middleware/permissions';
import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';
import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';
import { auditLog, AuditActions, AuditResources } from '@/middleware/audit';"""

# Files to update and their configurations
FILES_TO_UPDATE = [
    {
        'path': 'src/app/api/hotels/[id]/route.ts',
        'resource': 'hotel',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/guides/route.ts',
        'resource': 'guide',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/guides/[id]/route.ts',
        'resource': 'guide',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/vehicles/route.ts',
        'resource': 'vehicle',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/vehicles/[id]/route.ts',
        'resource': 'vehicle',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/restaurants/route.ts',
        'resource': 'restaurant',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/transfers/route.ts',
        'resource': 'transfer',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/providers/route.ts',
        'resource': 'provider',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/providers/[id]/route.ts',
        'resource': 'provider',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
    {
        'path': 'src/app/api/suppliers/search/route.ts',
        'resource': 'supplier',
        'audit_resource': 'PROVIDER',
        'audit_actions': {'create': 'PROVIDER_CREATED', 'update': 'PROVIDER_UPDATED', 'delete': 'PROVIDER_DELETED'}
    },
]

def apply_phase1_imports(content):
    """Replace imports with Phase 1 standard imports"""
    # Find the import section (everything before the first export)
    import_section_match = re.search(r'^(import.*?)\n\n(?=export|\/\/)', content, re.DOTALL | re.MULTILINE)

    if import_section_match:
        old_imports = import_section_match.group(1)
        # Replace the old imports with Phase 1 imports
        content = content.replace(old_imports, PHASE1_IMPORTS)

    return content

def add_request_tracking_to_get(content):
    """Add request ID and timing to GET methods"""
    # Pattern to match GET method start
    pattern = r'(export async function GET\([^)]+\) \{)'
    replacement = r'\1\n  const requestId = getRequestId(request);\n  const startTime = Date.now();'
    content = re.sub(pattern, replacement, content)

    # Add rate limiting after auth
    auth_pattern = r'(const \{ tenantId(?:, user)? \} = authResult;)'
    rate_limit_code = r'''\1

    // Rate limiting (100 requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${user.userId}`,
      100,
      3600
    );

    if (rateLimit.remaining === 0) {
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${minutesLeft} minutes.`,
        429,
        undefined,
        requestId
      );
    }'''

    content = re.sub(auth_pattern, rate_limit_code, content, count=1)

    return content

def replace_pagination_calls(content):
    """Replace parsePaginationParams with parseStandardPaginationParams"""
    content = content.replace('parsePaginationParams(', 'parseStandardPaginationParams(')
    content = content.replace('buildPagedResponse(', 'buildStandardListResponse(')
    return content

def replace_error_responses(content):
    """Replace errorResponse with standardErrorResponse"""
    # Simple errorResponse calls
    content = re.sub(
        r'errorResponse\(\s*internalServerErrorProblem\([^)]+\)\s*\)',
        lambda m: 'standardErrorResponse(ErrorCodes.INTERNAL_ERROR, ' +
                  re.search(r"'([^']+)'", m.group(0)).group(1) +
                  ", 500, undefined, requestId)",
        content
    )

    return content

def add_response_logging(content):
    """Add logResponse calls before return statements"""
    # This is a simplified version - manual review recommended
    pass

def process_file(file_config):
    """Process a single file"""
    file_path = file_config['path']

    if not os.path.exists(file_path):
        print(f"⚠️  File not found: {file_path}")
        return False

    print(f"Processing: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply transformations
    original_content = content

    # 1. Update imports
    content = apply_phase1_imports(content)

    # 2. Add request tracking
    content = add_request_tracking_to_get(content)

    # 3. Replace pagination calls
    content = replace_pagination_calls(content)

    # 4. Replace error responses
    content = replace_error_responses(content)

    # Only write if changes were made
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Updated: {file_path}")
        return True
    else:
        print(f"- No changes needed: {file_path}")
        return False

def main():
    """Main execution"""
    print("=" * 60)
    print("Phase 1 Standards Application Script")
    print("=" * 60)
    print()

    updated_count = 0

    for file_config in FILES_TO_UPDATE:
        if process_file(file_config):
            updated_count += 1
        print()

    print("=" * 60)
    print(f"Summary: {updated_count}/{len(FILES_TO_UPDATE)} files updated")
    print("=" * 60)
    print()
    print("⚠️  IMPORTANT: Manual review required for:")
    print("   - Response logging placement")
    print("   - Audit logging integration")
    print("   - Error handling completeness")
    print("   - Rate limit configuration per endpoint")

if __name__ == '__main__':
    main()
