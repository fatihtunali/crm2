#!/usr/bin/env python3
"""
Script to apply RBAC to all API endpoints systematically.
"""

import os
import re
from pathlib import Path

# Mapping of API paths to resources
RESOURCE_MAP = {
    '/api/quotations': 'quotations',
    '/api/clients': 'clients',
    '/api/bookings': 'bookings',
    '/api/invoices': 'invoices',
    '/api/reports': 'reports',
    '/api/users': 'users',
    '/api/agents': 'agents',
    '/api/providers': 'providers',
    '/api/hotels': 'providers',
    '/api/guides': 'providers',
    '/api/vehicles': 'providers',
    '/api/restaurants': 'providers',
    '/api/transfers': 'providers',
    '/api/suppliers': 'providers',
    '/api/requests': 'requests',
    '/api/finance': 'finance',
    '/api/admin': 'admin',
    '/api/dashboard': 'dashboard',
    '/api/hotel-pricing': 'pricing',
    '/api/guide-pricing': 'pricing',
    '/api/vehicle-pricing': 'pricing',
    '/api/tour-pricing': 'pricing',
    '/api/entrance-fee-pricing': 'pricing',
    '/api/entrance-fees': 'providers',
    '/api/daily-tours': 'providers',
    '/api/extra-expenses': 'providers',
}

# HTTP method to action mapping
METHOD_TO_ACTION = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
}

# Skip these paths (already done or should not have RBAC)
SKIP_PATHS = [
    '/api/auth',
    '/api/health',
    '/api/roles',
    '/api/audit-logs',
]

def get_resource_from_path(file_path):
    """Determine resource name from file path."""
    path_str = str(file_path)

    # Get the API path segment
    if '/api/' in path_str:
        api_segment = path_str.split('/api/')[1].split('/')[0]
        api_path = f'/api/{api_segment}'

        # Check if we should skip
        for skip in SKIP_PATHS:
            if skip in api_path:
                return None

        # Get resource from map
        return RESOURCE_MAP.get(api_path)

    return None

def should_add_import(content):
    """Check if we need to add the requirePermission import."""
    return 'requirePermission' not in content

def should_replace_tenant(content):
    """Check if file uses requireTenant."""
    return 'requireTenant' in content

def replace_import(content):
    """Replace requireTenant import with requirePermission."""
    # Replace the import statement
    content = re.sub(
        r"import\s+{\s*requireTenant\s*}\s+from\s+['\"]@/middleware/tenancy['\"];?",
        "import { requirePermission } from '@/middleware/permissions';",
        content
    )
    return content

def add_import(content):
    """Add requirePermission import if not present."""
    if should_add_import(content):
        # Find a good place to add the import (after other imports from @/)
        import_pattern = r"(import\s+{[^}]+}\s+from\s+['\"]@/[^'\"]+['\"];?\s*\n)"
        matches = list(re.finditer(import_pattern, content))
        if matches:
            # Add after the last @ import
            last_match = matches[-1]
            insert_pos = last_match.end()
            new_import = "import { requirePermission } from '@/middleware/permissions';\n"
            content = content[:insert_pos] + new_import + content[insert_pos:]
    return content

def replace_auth_in_method(content, method_name, resource_name, action):
    """Replace authentication in a specific HTTP method."""

    # Pattern to find the method and its authentication
    # This matches: export async function GET/POST/etc(
    method_pattern = rf'export\s+async\s+function\s+{method_name}\s*\([^)]*\)\s*{{[^{{]*'

    # Find the method
    method_match = re.search(method_pattern, content, re.DOTALL)
    if not method_match:
        return content

    method_start = method_match.end()

    # Find the authentication block within this method
    # Look for requireTenant pattern
    auth_pattern = r'const\s+\w+Result\s*=\s*await\s+requireTenant\(request\);?\s*if\s*\([^\)]*[\'"]error[\'"]\s+in\s+\w+Result[^\)]*\)\s*{[^}]+}[^}]*const\s*{\s*([^}]+)\s*}\s*=\s*\w+Result;?'

    # Search for auth pattern after method start
    remaining_content = content[method_start:]
    auth_match = re.search(auth_pattern, remaining_content, re.DOTALL)

    if auth_match:
        # Calculate actual position in full content
        auth_start_in_remaining = auth_match.start()
        auth_end_in_remaining = auth_match.end()

        auth_start = method_start + auth_start_in_remaining
        auth_end = method_start + auth_end_in_remaining

        # Extract variable names from destructuring
        vars_match = auth_match.group(1)

        # Build replacement
        replacement = f"const authResult = await requirePermission(request, '{resource_name}', '{action}');\n    if ('error' in authResult) {{\n      return authResult.error;\n    }}\n    const {{ {vars_match} }} = authResult;"

        # Replace in content
        content = content[:auth_start] + replacement + content[auth_end:]

    return content

def process_file(file_path, resource_name):
    """Process a single route file to add RBAC."""
    print(f"Processing: {file_path}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Step 1: Replace or add import
        if should_replace_tenant(content):
            content = replace_import(content)
        else:
            content = add_import(content)

        # Step 2: Find all HTTP methods in the file and replace their auth
        for method, action in METHOD_TO_ACTION.items():
            if f'export async function {method}(' in content:
                content = replace_auth_in_method(content, method, resource_name, action)

        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  ✓ Updated {file_path}")
            return True
        else:
            print(f"  - No changes needed for {file_path}")
            return False

    except Exception as e:
        print(f"  ✗ Error processing {file_path}: {e}")
        return False

def main():
    """Main function to process all route files."""
    base_path = Path(__file__).parent / 'src' / 'app' / 'api'

    if not base_path.exists():
        print(f"Error: API directory not found at {base_path}")
        return

    # Find all route.ts files
    route_files = list(base_path.rglob('route.ts'))
    print(f"Found {len(route_files)} route files\n")

    processed = 0
    updated = 0
    skipped = 0

    for route_file in route_files:
        # Determine resource
        resource = get_resource_from_path(route_file)

        if resource is None:
            skipped += 1
            print(f"Skipping: {route_file}")
            continue

        # Process the file
        if process_file(route_file, resource):
            updated += 1
        processed += 1

    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Total files: {len(route_files)}")
    print(f"  Processed: {processed}")
    print(f"  Updated: {updated}")
    print(f"  Skipped: {skipped}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
