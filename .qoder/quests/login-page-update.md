# Login Page Update Design

## Overview
This document outlines the updates to be made to the login page of the multitenant secure application. The primary changes involve replacing the current test credentials information with company identification details and documenting the default access passwords.

## Current Implementation
The login page currently displays the following test credentials information:
```
Credenciais de teste:
SUPER_ADMIN: admin@system.com / admin123
ADMIN: admin@empresa1.com / admin123
USER: user@empresa1.com / user123
```

## Proposed Changes
Replace the test credentials information with the following company identification details:
```
Desenvolvido por: GOR Informática - 2024
Whatsapp: (61) 33659-7358
```

Additionally, create a section to document the default access passwords.

## Default Access Passwords Documentation
The default access passwords for the system roles should be documented as follows:

| Role | Username | Default Password |
|------|----------|------------------|
| SUPER_ADMIN | admin@system.com | admin123 |
| ADMIN | admin@empresa1.com | admin123 |
| USER | user@empresa1.com | user123 |

Note: These passwords should be changed immediately after the initial setup for security reasons.

## Implementation Considerations
1. The company information should be displayed in a visually distinct section from the login form
2. The default passwords documentation should be easily accessible but not prominently displayed
3. The year in "Desenvolvido por: GOR Informática - ANO" should be dynamically updated or set to the current year
4. All changes should maintain the existing security measures and not expose sensitive information3. The year in "Desenvolvido por: GOR Informática - ANO" should be dynamically updated or set to the current year
