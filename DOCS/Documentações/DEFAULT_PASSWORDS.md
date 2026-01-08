# Default Access Passwords

This document contains the default access credentials for the multitenant secure system. These passwords should be changed immediately after the initial setup for security reasons.

## Default Credentials

| Role | Username | Default Password |
|------|----------|------------------|
| SUPER_ADMIN | admin@system.com | admin123 |
| ADMIN | admin@empresa1.com | admin123 |
| USER | user@empresa1.com | user123 |

## Security Recommendations

1. Change all default passwords immediately after system installation
2. Use strong, unique passwords for each account
3. Enable Two-Factor Authentication (2FA) where available
4. Regularly rotate passwords according to your organization's security policy
5. Restrict access to these accounts to authorized personnel only

## Role Descriptions

- **SUPER_ADMIN**: Has access to system-wide settings and can manage all tenants
- **ADMIN**: Has administrative access within a specific tenant
- **USER**: Regular user with limited permissions within a tenant

## Changing Passwords

Passwords can be changed through the user profile section after logging in. Administrators can also change passwords for other users through the user management interface.