# User Management Guide

## Current User

**Email:** info@funnytourism.com
**Role:** super_admin
**Organization:** Funny Tourism (ID: 5)

---

## Managing Users via Command Line

You can manage users using the `manage-users.js` script:

### List All Users
```bash
node manage-users.js list
```

### Add New User
```bash
node manage-users.js add <email> <password> [role] [org_id]

# Examples:
node manage-users.js add john@funnytourism.com password123
node manage-users.js add admin@example.com securepass super_admin 5
```

### Change User Role
```bash
node manage-users.js role <email> <new_role>

# Example:
node manage-users.js role john@funnytourism.com super_admin
```

Available roles:
- `super_admin` - Full system access, can manage all organizations
- `org_admin` - Can manage their organization's data
- `org_user` - Read-only access to their organization

### Delete User
```bash
node manage-users.js delete <email>

# Example:
node manage-users.js delete old@user.com
```

---

## Managing Users via Database (if needed)

### Reset User Password
```bash
node -e "
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
(async () => {
  const conn = await mysql.createConnection({
    host: '134.209.137.11',
    user: 'crm',
    password: 'Dlr235672.-Yt',
    database: 'crm_db'
  });
  const hash = await bcrypt.hash('newpassword123', 10);
  await conn.query('UPDATE users SET password_hash = ? WHERE email = ?',
    [hash, 'user@email.com']);
  console.log('✓ Password updated');
  await conn.end();
})();
"
```

### Make User Super Admin
```bash
node manage-users.js role user@email.com super_admin
```

---

## Important Notes

1. **After role changes:** Users must logout and login again to get updated permissions
2. **Super Admin Access:** Only super_admin role can:
   - Manage organizations (agents)
   - View all system data
   - Create/delete users (via script)
3. **Keep this file secure:** Contains database connection information
4. **Backup before bulk changes:** Always backup before deleting multiple users

---

## Quick Commands Reference

```bash
# See all users
node manage-users.js list

# Add new admin
node manage-users.js add newadmin@domain.com password123 super_admin 5

# Promote user to admin
node manage-users.js role user@domain.com super_admin

# Remove user
node manage-users.js delete olduser@domain.com
```

---

Generated: 2025-11-04
