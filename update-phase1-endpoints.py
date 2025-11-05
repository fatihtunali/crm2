#!/usr/bin/env python3
"""
Phase 1 Standards Update Script
Updates all API endpoints to use Phase 1 standards:
- Request correlation IDs
- Rate limiting
- Standardized pagination
- Standardized errors
- Standard headers
"""

import os
import re
from pathlib import Path

# Define the imports that should be present
REQUIRED_IMPORTS = {
    'correlation': "import { getRequestId, logRequest, logResponse } from '@/middleware/correlation';",
    'rateLimit': "import { addRateLimitHeaders, globalRateLimitTracker } from '@/middleware/rateLimit';",
    'response': "import { standardErrorResponse, validationErrorResponse, ErrorCodes, addStandardHeaders } from '@/lib/response';",
    'pagination': "import { parseStandardPaginationParams, buildStandardListResponse } from '@/lib/pagination';",
}

# Rate limits by method
RATE_LIMITS = {
    'GET': (100, 3600),  # 100 requests per hour
    'POST': (50, 3600),  # 50 requests per hour
    'PUT': (50, 3600),   # 50 requests per hour
    'PATCH': (50, 3600), # 50 requests per hour
    'DELETE': (20, 3600),# 20 requests per hour
}

def add_imports(content: str, file_path: str) -> str:
    """Add required imports if not present"""
    lines = content.split('\n')

    # Find the last import statement
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i

    # Check which imports are missing
    imports_to_add = []

    # Always add correlation
    if 'getRequestId' not in content or 'logResponse' not in content:
        imports_to_add.append(REQUIRED_IMPORTS['correlation'])

    # Add rateLimit for non-GET or check if it's list endpoint
    if 'globalRateLimitTracker' not in content:
        imports_to_add.append(REQUIRED_IMPORTS['rateLimit'])

    # Check for standardized error responses
    if 'standardErrorResponse' not in content or 'errorResponse(' in content:
        if REQUIRED_IMPORTS['response'] not in content:
            # Replace old import
            for i, line in enumerate(lines):
                if '@/lib/response' in line and 'standardErrorResponse' not in line:
                    # Update the import line
                    lines[i] = REQUIRED_IMPORTS['response']
                    break
            else:
                imports_to_add.append(REQUIRED_IMPORTS['response'])

    # Check for pagination in list endpoints (route.ts files, not [id])
    if 'route.ts' in file_path and '[id]' not in file_path:
        if 'parseStandardPaginationParams' not in content:
            imports_to_add.append(REQUIRED_IMPORTS['pagination'])

    # Insert new imports after last import
    if imports_to_add:
        for imp in reversed(imports_to_add):
            if imp not in content:
                lines.insert(last_import_idx + 1, imp)

    return '\n'.join(lines)

def update_method_handler(content: str, method: str, is_list_endpoint: bool = False) -> str:
    """Update a method handler to include Phase 1 standards"""

    # Pattern to find the method export
    method_pattern = rf'export async function {method}\s*\([^)]+\)\s*\{{'

    match = re.search(method_pattern, content)
    if not match:
        return content

    start_pos = match.end()

    # Check if requestId already exists
    if 'const requestId = getRequestId(request);' in content[start_pos:start_pos+500]:
        # Already updated
        return content

    # Find the opening brace and add Phase 1 initialization
    phase1_init = f"""
  const requestId = getRequestId(request);
  const startTime = Date.now();
"""

    # Insert after the opening brace
    content = content[:start_pos] + phase1_init + content[start_pos:]

    return content

def add_rate_limiting(content: str, method: str) -> str:
    """Add rate limiting after authentication"""

    # Find the auth result section
    auth_pattern = r'const \{ tenantId, user \} = authResult;'
    match = re.search(auth_pattern, content)

    if not match:
        return content

    # Check if rate limiting already exists
    if 'globalRateLimitTracker.trackRequest' in content:
        return content

    limit, window = RATE_LIMITS.get(method, (100, 3600))

    # Different key for different operations
    if method == 'GET':
        key_suffix = ''
    elif method == 'POST':
        key_suffix = '_create'
    elif method in ['PUT', 'PATCH']:
        key_suffix = '_update'
    elif method == 'DELETE':
        key_suffix = '_delete'
    else:
        key_suffix = ''

    rate_limit_code = f"""

    // Rate limiting ({limit} requests per hour per user)
    const rateLimit = globalRateLimitTracker.trackRequest(
      `user_${{user.userId}}{key_suffix}`,
      {limit},
      {window}
    );

    if (rateLimit.remaining === 0) {{
      const minutesLeft = Math.ceil((rateLimit.reset - Math.floor(Date.now() / 1000)) / 60);
      return standardErrorResponse(
        ErrorCodes.RATE_LIMIT_EXCEEDED,
        `Rate limit exceeded. Try again in ${{minutesLeft}} minutes.`,
        429,
        undefined,
        requestId
      );
    }}
"""

    insert_pos = match.end()
    content = content[:insert_pos] + rate_limit_code + content[insert_pos:]

    return content

def update_response_headers(content: str) -> str:
    """Update response creation to include standard headers"""

    # Pattern: const response = NextResponse.json(
    # or: return NextResponse.json(

    # Replace inline returns
    content = re.sub(
        r'return NextResponse\.json\(([^)]+)\);',
        lambda m: f'''const response = NextResponse.json({m.group(1)});
    addStandardHeaders(response, requestId);
    return response;''',
        content
    )

    # Add rate limit headers where we create response
    # Find: const response = NextResponse.json
    # Add after: addRateLimitHeaders(response, rateLimit);

    return content

def replace_old_error_functions(content: str) -> str:
    """Replace old error functions with standardized ones"""

    # errorResponse(notFoundProblem(...)) -> standardErrorResponse(ErrorCodes.NOT_FOUND, ...)
    content = re.sub(
        r'errorResponse\(notFoundProblem\([\'"]([^\'\"]+)[\'"],\s*[^\)]+\)\)',
        r"standardErrorResponse(ErrorCodes.NOT_FOUND, '\1', 404, undefined, requestId)",
        content
    )

    # errorResponse(badRequestProblem(...)) -> standardErrorResponse(ErrorCodes.VALIDATION_ERROR, ...)
    content = re.sub(
        r'errorResponse\(badRequestProblem\([\'"]([^\'\"]+)[\'"],\s*[^\)]+\)\)',
        r"standardErrorResponse(ErrorCodes.VALIDATION_ERROR, '\1', 400, undefined, requestId)",
        content
    )

    # errorResponse(internalServerErrorProblem(...)) -> standardErrorResponse(ErrorCodes.INTERNAL_ERROR, ...)
    content = re.sub(
        r'errorResponse\(internalServerErrorProblem\([\'"]([^\'\"]+)[\'"],\s*[^\)]+\)\)',
        r"standardErrorResponse(ErrorCodes.INTERNAL_ERROR, '\1', 500, undefined, requestId)",
        content
    )

    content = re.sub(
        r'errorResponse\(internalServerErrorProblem\([^\)]+\)\)',
        r"standardErrorResponse(ErrorCodes.INTERNAL_ERROR, 'An unexpected error occurred', 500, undefined, requestId)",
        content
    )

    # successResponse(...) -> NextResponse.json(...)
    content = re.sub(
        r'return successResponse\(([^)]+)\);',
        r'''const response = NextResponse.json(\1);
    addStandardHeaders(response, requestId);
    return response;''',
        content
    )

    return content

def add_logging_to_catch(content: str) -> str:
    """Add logResponse to catch blocks"""

    # Find catch blocks
    catch_pattern = r'} catch \(error[^{]*\{([^}]*console\.error[^}]*)'

    def add_log(match):
        catch_body = match.group(1)
        if 'logResponse' not in catch_body:
            # Add logResponse after console.error
            catch_body = catch_body.replace(
                'console.error',
                '''logResponse(requestId, 500, Date.now() - startTime, {
      error: error.message,
    });

    console.error'''
            )
        return '} catch (error: any) {' + catch_body

    content = re.sub(catch_pattern, add_log, content, flags=re.DOTALL)

    return content

def update_file(file_path: str) -> bool:
    """Update a single file with Phase 1 standards"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Skip if already fully updated (has all Phase 1 markers)
        if all(marker in content for marker in [
            'getRequestId(request)',
            'standardErrorResponse',
            'addStandardHeaders'
        ]) and 'errorResponse(' not in content:
            print(f"✓ Already updated: {file_path}")
            return False

        is_list_endpoint = 'route.ts' in file_path and '[id]' not in file_path

        # Step 1: Add/update imports
        content = add_imports(content, file_path)

        # Step 2: Replace old error functions
        content = replace_old_error_functions(content)

        # Step 3: Update method handlers
        for method in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']:
            if f'export async function {method}' in content:
                content = update_method_handler(content, method, is_list_endpoint)
                content = add_rate_limiting(content, method)

        # Step 4: Add logging to catch blocks
        content = add_logging_to_catch(content)

        # Step 5: Update response headers
        content = update_response_headers(content)

        # Only write if changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ Updated: {file_path}")
            return True
        else:
            print(f"○ No changes: {file_path}")
            return False

    except Exception as e:
        print(f"✗ Error updating {file_path}: {e}")
        return False

def main():
    """Main execution"""
    base_dir = Path(__file__).parent / 'src' / 'app' / 'api'

    # Define all endpoint files to update
    endpoints = [
        # Category 1: Core Resources
        'clients/route.ts',
        'clients/[id]/route.ts',
        'bookings/route.ts',
        'bookings/[id]/route.ts',
        'invoices/payable/route.ts',
        'invoices/receivable/route.ts',
        'invoices/payable/[id]/route.ts',
        'invoices/receivable/[id]/route.ts',
        'invoices/payable/[id]/payment/route.ts',
        'invoices/receivable/[id]/payment/route.ts',

        # Category 2: Quotation Sub-routes
        'quotations/[id]/route.ts',
        'quotations/[id]/status/route.ts',
        'quotations/[id]/days/route.ts',
        'quotations/[id]/expenses/route.ts',
        'quotations/[id]/generate-itinerary/route.ts',

        # Category 3: Providers
        'hotels/route.ts',
        'hotels/[id]/route.ts',
        'guides/route.ts',
        'guides/[id]/route.ts',
        'vehicles/route.ts',
        'vehicles/[id]/route.ts',
        'restaurants/route.ts',
        'restaurants/[id]/route.ts',
        'transfers/route.ts',
        'transfers/[id]/route.ts',
        'providers/route.ts',
        'providers/[id]/route.ts',
        'suppliers/search/route.ts',

        # Category 4: Reports (22 endpoints)
        'reports/agents/clients/route.ts',
        'reports/agents/performance/route.ts',
        'reports/clients/acquisition-retention/route.ts',
        'reports/clients/demographics/route.ts',
        'reports/clients/lifetime-value/route.ts',
        'reports/executive/summary/route.ts',
        'reports/financial/aging/route.ts',
        'reports/financial/commissions/route.ts',
        'reports/financial/dashboard/route.ts',
        'reports/financial/profit-loss/route.ts',
        'reports/financial/providers/route.ts',
        'reports/operations/booking-status/route.ts',
        'reports/operations/capacity/route.ts',
        'reports/operations/response-times/route.ts',
        'reports/operations/service-usage/route.ts',
        'reports/operations/upcoming-tours/route.ts',
        'reports/pricing/analysis/route.ts',
        'reports/pricing/cost-structure/route.ts',
        'reports/sales/destinations/route.ts',
        'reports/sales/overview/route.ts',
        'reports/sales/quotes/route.ts',
        'reports/sales/trends/route.ts',

        # Category 5: Finance & Dashboard
        'finance/summary/route.ts',
        'finance/customers/route.ts',
        'finance/suppliers/route.ts',
        'dashboard/stats/route.ts',
        'dashboard/recent-requests/route.ts',
        'dashboard/upcoming-tours/route.ts',

        # Category 6: Users, Requests, Admin
        'users/route.ts',
        'users/[id]/route.ts',
        'requests/route.ts',
        'requests/[id]/route.ts',
        'admin/check-schema/route.ts',
        'admin/cleanup-tours/route.ts',
        'admin/migrate-providers/route.ts',
    ]

    updated = 0
    failed = 0
    skipped = 0

    print("Starting Phase 1 Standards Update...\n")

    for endpoint in endpoints:
        file_path = base_dir / endpoint
        if file_path.exists():
            if update_file(str(file_path)):
                updated += 1
            else:
                skipped += 1
        else:
            print(f"⚠ File not found: {file_path}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Phase 1 Update Complete!")
    print(f"{'='*60}")
    print(f"✓ Updated: {updated}")
    print(f"○ Skipped: {skipped}")
    print(f"✗ Failed: {failed}")
    print(f"Total: {len(endpoints)}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
