#!/usr/bin/env python3
"""
Fix all HTTP methods in RBAC-enabled files to have correct actions.
"""

import re
from pathlib import Path

# Files and their resources
FILES_AND_RESOURCES = [
    ("src/app/api/users/route.ts", "users"),
    ("src/app/api/users/[id]/route.ts", "users"),
    ("src/app/api/invoices/payable/route.ts", "invoices"),
    ("src/app/api/invoices/receivable/route.ts", "invoices"),
    ("src/app/api/invoices/payable/[id]/route.ts", "invoices"),
    ("src/app/api/invoices/receivable/[id]/route.ts", "invoices"),
    ("src/app/api/invoices/payable/[id]/payment/route.ts", "invoices"),
    ("src/app/api/invoices/receivable/[id]/payment/route.ts", "invoices"),
    ("src/app/api/providers/route.ts", "providers"),
    ("src/app/api/providers/[id]/route.ts", "providers"),
    ("src/app/api/hotels/route.ts", "providers"),
    ("src/app/api/hotels/[id]/route.ts", "providers"),
    ("src/app/api/guides/route.ts", "providers"),
    ("src/app/api/guides/[id]/route.ts", "providers"),
    ("src/app/api/vehicles/route.ts", "providers"),
    ("src/app/api/vehicles/[id]/route.ts", "providers"),
    ("src/app/api/restaurants/route.ts", "providers"),
    ("src/app/api/transfers/route.ts", "providers"),
    ("src/app/api/entrance-fees/route.ts", "providers"),
    ("src/app/api/suppliers/search/route.ts", "providers"),
    ("src/app/api/requests/route.ts", "requests"),
    ("src/app/api/requests/[id]/route.ts", "requests"),
    ("src/app/api/finance/summary/route.ts", "finance"),
    ("src/app/api/finance/customers/route.ts", "finance"),
    ("src/app/api/finance/suppliers/route.ts", "finance"),
    ("src/app/api/dashboard/stats/route.ts", "dashboard"),
    ("src/app/api/dashboard/recent-requests/route.ts", "dashboard"),
    ("src/app/api/dashboard/upcoming-tours/route.ts", "dashboard"),
    ("src/app/api/admin/cleanup-tours/route.ts", "admin"),
    ("src/app/api/admin/migrate-providers/route.ts", "admin"),
    ("src/app/api/admin/check-schema/route.ts", "admin"),
]

# Add all reports files
REPORTS_DIR = Path("src/app/api/reports")
if REPORTS_DIR.exists():
    for route_file in REPORTS_DIR.rglob("route.ts"):
        FILES_AND_RESOURCES.append((str(route_file), "reports"))

# Method to action mapping
METHOD_ACTIONS = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
}

def fix_method_in_content(content, method, correct_action, resource):
    """Fix a specific method's RBAC action."""
    # Pattern to find: export async function METHOD(...) { ... requirePermission(request, 'resource', 'someaction')
    # We want to replace 'someaction' with correct_action

    # Find the method declaration and its first requirePermission call
    method_pattern = rf'(export\s+async\s+function\s+{method}\s*\([^)]*\)\s*\{{[\s\S]*?requirePermission\(request,\s*[\'"]){resource}([\'"],\s*[\'"])(\w+)([\'"])'

    def replacer(match):
        current_action = match.group(3)
        if current_action != correct_action:
            return f"{match.group(1)}{resource}{match.group(2)}{correct_action}{match.group(4)}"
        return match.group(0)

    return re.sub(method_pattern, replacer, content, count=1)

def process_file(file_path, resource):
    """Process a single file to fix all method actions."""
    path = Path(file_path)

    if not path.exists():
        print(f"  [?] Not found: {file_path}")
        return False

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Skip if no requirePermission
        if 'requirePermission' not in content:
            return False

        original_content = content
        changes_made = False

        # Fix each HTTP method
        for method, action in METHOD_ACTIONS.items():
            if f'export async function {method}(' in content:
                new_content = fix_method_in_content(content, method, action, resource)
                if new_content != content:
                    content = new_content
                    changes_made = True

        # Write back if changed
        if changes_made:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"  [OK] Fixed: {file_path}")
            return True
        else:
            print(f"  [-] No changes: {file_path}")
            return False

    except Exception as e:
        print(f"  [ERR] Error: {file_path}: {e}")
        return False

def main():
    """Main function."""
    print("Fixing HTTP method actions in RBAC calls...\n")

    fixed = 0
    for file_path, resource in FILES_AND_RESOURCES:
        if process_file(file_path, resource):
            fixed += 1

    print(f"\n{'='*60}")
    print(f"Fixed {fixed} files")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
