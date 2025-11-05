#!/usr/bin/env python3
"""
Script to automatically migrate API endpoints to Phase 1 standards.
This script updates imports, adds request correlation, and migrates to standardized responses.
"""

import os
import re
from pathlib import Path

# Define the base directory
BASE_DIR = Path(r"C:\Users\fatih\Desktop\CRM\src\app\api")

# Endpoints to migrate (excluding already migrated ones)
ENDPOINTS_TO_MIGRATE = [
    # Core resources
    "agents/route.ts",
    "agents/[id]/route.ts",

    # Suppliers
    "hotels/route.ts",
    "hotels/[id]/route.ts",
    "guides/route.ts",
    "guides/[id]/route.ts",
    "vehicles/route.ts",
    "vehicles/[id]/route.ts",
    "daily-tours/route.ts",
    "daily-tours/[id]/route.ts",

    # Financial
    "invoices/receivable/route.ts",
    "invoices/receivable/[id]/route.ts",
    "invoices/payable/route.ts",
    "invoices/payable/[id]/route.ts",

    # Pricing
    "hotel-pricing/route.ts",
    "hotel-pricing/[id]/route.ts",
    "guide-pricing/route.ts",
    "guide-pricing/[id]/route.ts",
    "vehicle-pricing/route.ts",
    "vehicle-pricing/[id]/route.ts",
    "tour-pricing/route.ts",
    "tour-pricing/[id]/route.ts",
    "entrance-fee-pricing/route.ts",
    "entrance-fee-pricing/[id]/route.ts",

    # Other resources
    "providers/route.ts",
    "providers/[id]/route.ts",
    "requests/route.ts",
    "requests/[id]/route.ts",
    "bookings/route.ts",
    "bookings/[id]/route.ts",
    "users/route.ts",
    "users/[id]/route.ts",
    "transfers/route.ts",
    "transfers/[id]/route.ts",
    "restaurants/route.ts",
    "restaurants/[id]/route.ts",
    "entrance-fees/route.ts",
    "entrance-fees/[id]/route.ts",
    "extra-expenses/route.ts",
    "extra-expenses/[id]/route.ts",

    # Finance
    "finance/summary/route.ts",
    "finance/exchange-rates/route.ts",
    "finance/exchange-rates/latest/route.ts",
    "finance/customers/route.ts",
    "finance/suppliers/route.ts",

    # Dashboard
    "dashboard/stats/route.ts",
    "dashboard/recent-requests/route.ts",
    "dashboard/upcoming-tours/route.ts",

    # Reports
    "reports/agents/clients/route.ts",
    "reports/agents/performance/route.ts",
    "reports/clients/demographics/route.ts",
    "reports/clients/acquisition-retention/route.ts",
    "reports/clients/lifetime-value/route.ts",
    "reports/executive/summary/route.ts",
    "reports/financial/aging/route.ts",
    "reports/financial/commissions/route.ts",
    "reports/financial/dashboard/route.ts",
    "reports/financial/providers/route.ts",
    "reports/financial/profit-loss/route.ts",
    "reports/operations/booking-status/route.ts",
    "reports/operations/service-usage/route.ts",
    "reports/operations/response-times/route.ts",
    "reports/operations/capacity/route.ts",
    "reports/operations/upcoming-tours/route.ts",
    "reports/pricing/analysis/route.ts",
    "reports/pricing/cost-structure/route.ts",
    "reports/sales/overview/route.ts",
    "reports/sales/destinations/route.ts",
    "reports/sales/quotes/route.ts",
    "reports/sales/trends/route.ts",
]


def update_imports(content):
    """Update imports to use Phase 1 utilities."""
    # Update pagination imports
    content = re.sub(
        r'from [\'"]@/lib/pagination[\'"] import \{([^}]+)\}',
        lambda m: f'from \'@/lib/pagination\' import {{ {update_pagination_imports(m.group(1))} }}',
        content
    )

    # Update response imports
    content = re.sub(
        r'from [\'"]@/lib/response[\'"] import \{([^}]+)\}',
        lambda m: 'from \'@/lib/response\' import { standardErrorResponse, notFoundErrorResponse, validationErrorResponse, ErrorCodes }',
        content
    )

    # Add correlation import if not present
    if 'from \'@/middleware/correlation\'' not in content:
        # Find last import line
        import_lines = re.findall(r'import .+ from [\'"][^\'"]+ [\'"];?\n', content)
        if import_lines:
            last_import = import_lines[-1]
            content = content.replace(
                last_import,
                last_import + 'import { getRequestId, logResponse } from \'@/middleware/correlation\';\n'
            )

    # Ensure NextResponse is imported
    if 'NextResponse' not in content and 'from \'next/server\'' in content:
        content = re.sub(
            r'import \{ NextRequest \} from [\'"]next/server[\'"]',
            'import { NextRequest, NextResponse } from \'next/server\'',
            content
        )

    return content


def update_pagination_imports(imports_str):
    """Update pagination import names."""
    imports = [imp.strip() for imp in imports_str.split(',')]
    new_imports = []

    for imp in imports:
        if 'parsePaginationParams' in imp:
            new_imports.append('parseStandardPaginationParams')
        elif 'buildPagedResponse' in imp:
            new_imports.append('buildStandardListResponse')
        elif imp.strip() not in ['parseStandardPaginationParams', 'buildStandardListResponse']:
            new_imports.append(imp.strip())

    # Remove duplicates while preserving order
    seen = set()
    result = []
    for imp in new_imports:
        if imp not in seen:
            seen.add(imp)
            result.append(imp)

    return ', '.join(result)


def add_request_correlation_to_handler(content, handler_name):
    """Add request correlation ID to a handler function."""
    # Pattern to match the handler function
    pattern = rf'export async function {handler_name}\([^)]+\)\s*\{{'

    def replace_func(match):
        return match.group(0) + '\n  const requestId = getRequestId(request);\n  const startTime = Date.now();'

    # Check if already migrated
    if 'const requestId = getRequestId(request)' in content:
        return content

    content = re.sub(pattern, replace_func, content)
    return content


def update_error_responses(content):
    """Update error responses to use standardized format."""
    # Update errorResponse calls
    content = re.sub(
        r'return errorResponse\(tenantResult\.error\)',
        '''return standardErrorResponse(
        ErrorCodes.AUTHENTICATION_REQUIRED,
        tenantResult.error.detail || 'Authentication required',
        tenantResult.error.status,
        undefined,
        requestId
      )''',
        content
    )

    # Update notFoundProblem
    content = re.sub(
        r'return errorResponse\(notFoundProblem\([\'"]([^\'"]+ not found)[\'"](?:, [^)]+)?\)\)',
        r"return notFoundErrorResponse('\1', requestId)",
        content
    )

    # Update internalServerErrorProblem
    content = re.sub(
        r'return errorResponse\(\s*internalServerErrorProblem\([^)]+\)\s*\)',
        lambda m: f'return standardErrorResponse(\n      ErrorCodes.INTERNAL_ERROR,\n      {extract_error_message(m.group(0))},\n      500,\n      undefined,\n      requestId\n    )',
        content
    )

    # Update successResponse to NextResponse.json
    content = re.sub(
        r'return successResponse\(([^,)]+)\)',
        lambda m: update_success_response(m.group(1)),
        content
    )

    return content


def extract_error_message(error_call):
    """Extract error message from internalServerErrorProblem call."""
    match = re.search(r'internalServerErrorProblem\([\'"]([^\'\"]+)[\'"]', error_call)
    if match:
        return f"'{match.group(1)}'"
    return "'An error occurred'"


def update_success_response(response_data):
    """Update successResponse to NextResponse.json with X-Request-Id header."""
    return f'''NextResponse.json({response_data});\n    response.headers.set('X-Request-Id', requestId);\n    return response'''


def update_pagination_calls(content):
    """Update pagination parsing and response building."""
    # Update parsePaginationParams
    content = re.sub(
        r'parsePaginationParams\(',
        'parseStandardPaginationParams(',
        content
    )

    # Update buildPagedResponse
    # This is complex, needs manual review for each case
    content = re.sub(
        r'buildPagedResponse\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)',
        lambda m: f'buildStandardListResponse({m.group(1)}, {m.group(2)}, {m.group(3)}, {m.group(4)}, baseUrl, appliedFilters)',
        content
    )

    return content


def add_logging(content, handler_name):
    """Add logResponse calls before returns."""
    # This is complex and error-prone, so we'll just add a comment
    # indicating manual review is needed
    return content


def migrate_endpoint(file_path):
    """Migrate a single endpoint file."""
    print(f"Migrating: {file_path}")

    if not os.path.exists(file_path):
        print(f"  ⚠️  File not found: {file_path}")
        return False

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Skip if already migrated
        if 'parseStandardPaginationParams' in content or 'getRequestId' in content:
            print(f"  ✅ Already migrated")
            return True

        original_content = content

        # Apply transformations
        content = update_imports(content)

        # Add request correlation to all handlers
        for handler in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']:
            if f'export async function {handler}' in content:
                content = add_request_correlation_to_handler(content, handler)

        content = update_pagination_calls(content)
        content = update_error_responses(content)

        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✅ Migrated successfully")
            return True
        else:
            print(f"  ℹ️  No changes needed")
            return True

    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False


def main():
    """Main migration function."""
    print("🚀 Starting API endpoint migration to Phase 1 standards\n")

    migrated_count = 0
    failed_count = 0
    skipped_count = 0

    for endpoint in ENDPOINTS_TO_MIGRATE:
        file_path = BASE_DIR / endpoint

        if migrate_endpoint(file_path):
            migrated_count += 1
        else:
            if os.path.exists(file_path):
                failed_count += 1
            else:
                skipped_count += 1

    print(f"\n📊 Migration Summary:")
    print(f"  ✅ Successfully migrated: {migrated_count}")
    print(f"  ❌ Failed: {failed_count}")
    print(f"  ⚠️  Skipped (not found): {skipped_count}")
    print(f"\n⚠️  Note: Manual review is required for:")
    print(f"  - Proper baseUrl and appliedFilters extraction for list endpoints")
    print(f"  - Adding logResponse calls in appropriate places")
    print(f"  - Validation error responses")
    print(f"  - X-Request-Id header additions")


if __name__ == '__main__':
    main()
