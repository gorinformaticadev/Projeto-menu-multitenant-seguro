# Email Settings Preconfiguration Feature Design

## 1. Objective

Enable super_admin users to configure default email settings for the platform through a preconfigured list of popular email providers in the settings interface. Selected configurations should override the email settings currently defined in the .env file.

## 2. Scope

This feature applies only to the super_admin user role and affects the platform-wide email configuration. Tenant-specific email configurations are out of scope for this initial implementation.

The feature focuses on SMTP configuration settings only. Actual email credentials (username and password) will remain as environment variables for security reasons.

## 2. Requirements Analysis

### 2.1 Functional Requirements

- Provide a dropdown list of popular email providers (Gmail, Hotmail, Titan) in the settings UI for super_admin users
- Pre-populate SMTP settings (host, port, security type) based on the selected provider
- Allow super_admin to save these settings which will override the current .env email configurations
- Display visual indication when database configuration is active vs .env configuration
- Ensure only super_admin role can access this configuration
- Allow super_admin to revert to .env configuration

### 2.2 Non-Functional Requirements

- Maintain security by not exposing actual credentials in the UI
- Preserve existing .env configuration structure
- Ensure settings are tenant-aware if applicable
- Minimize performance impact through caching

## 3. Design Approach

### 3.1 Architecture Overview

The solution involves creating a new configuration section in the existing settings module that allows super_admin users to select from predefined email provider configurations. These selections will dynamically populate the SMTP fields which can then be saved to override the .env settings.

### 3.2 Component Structure

- UI Component: Email Provider Selection Dropdown
- Backend Service: Email Configuration Management
- Data Model: Predefined Email Provider Settings
- Access Control: Super Admin Role Restriction

## 4. Implementation Details

### 4.1 Frontend Design

#### 4.1.1 UI Components

- Dropdown menu with predefined email providers (Gmail, Hotmail, Titan)
- Dynamic form fields that populate based on selection:
  - SMTP Host
  - SMTP Port
  - Encryption Type (SSL/TLS)
  - Authentication Method
- Credential fields (username/password) that remain editable
- Save button to store configuration
- Reset/Revert button to remove database configuration and fall back to .env
- Status indicator showing if current configuration is from database or .env

#### 4.1.2 User Flow

1. Super admin navigates to settings page
2. Selects email provider from dropdown
3. System automatically fills SMTP configuration fields
4. User enters/updates SMTP credentials (username/password)
5. User can review and save settings
6. System validates configuration (optional future enhancement)
7. Saved settings take precedence over .env values
8. UI indicates when database configuration is active vs .env
9. User can revert to .env configuration at any time

### 4.2 Backend Design

#### 4.2.1 Data Model

Predefined Email Provider Configurations:

| Provider | SMTP Host | SMTP Port | Encryption | Auth Method |
|----------|-----------|-----------|-----------|------------|
| Gmail | smtp.gmail.com | 587 | STARTTLS | OAuth 2.0 |
| Hotmail/Outlook | smtp-mail.outlook.com | 587 | STARTTLS | OAuth 2.0 |
| Titan | mail.titan.email | 587 | STARTTLS | PLAIN |

Configuration Storage Model:

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier for the configuration |
| providerName | String | Name of the selected email provider |
| smtpHost | String | SMTP server address |
| smtpPort | Number | SMTP server port |
| encryption | String | SSL/TLS encryption type |
| authMethod | String | Authentication method |
| isActive | Boolean | Flag indicating if this is the active configuration |
| createdBy | String | ID of user who created the configuration |
| updatedBy | String | ID of user who last updated the configuration |
| createdAt | DateTime | Timestamp when configuration was created |
| updatedAt | DateTime | Timestamp when configuration was last updated |

Integration with Existing Email Service:

The EmailService currently reads configuration from environment variables. It will be modified to:
1. Check for active database configuration first
2. Fall back to environment variables if no database configuration exists
3. Cache the active configuration to avoid repeated database queries
4. Refresh configuration when database settings are updated

The EmailService constructor and configuration loading mechanism will be enhanced to support dynamic configuration updates without requiring a server restart.

#### 4.2.2 Service Layer

EmailConfigurationService handles:
  - Retrieving predefined provider configurations
  - Saving selected configurations
  - Overriding .env settings with database values
  - Providing active configuration to email service
  - Managing active configuration state (activate/deactivate)
  - Notifying EmailService of configuration changes

Email Service Integration:
  - Check for active database configuration
  - Fall back to .env configuration if no database configuration exists
  - Cache active configuration for performance
  - Refresh configuration when notified by EmailConfigurationService

#### 4.2.3 API Endpoints

- GET /api/email-config/providers - Retrieve list of supported providers
- GET /api/email-config/provider/{provider} - Get configuration for specific provider
- GET /api/email-config/active - Get currently active configuration
- POST /api/email-config - Save selected configuration
- DELETE /api/email-config/active - Remove database configuration and revert to .env

### 4.3 Security Considerations

- Only super_admin role can access these settings
- No actual email credentials (SMTP_USER, SMTP_PASS) stored in configuration objects
- Existing authentication and authorization mechanisms apply
- All configuration changes are logged with user ID for audit purposes
- Environment variables remain the secure source for credentials

### 5. Integration Points

### 5.1 With Existing Systems

- Settings Module: New section added to existing settings UI
- Email Service: Will read from database configuration instead of .env when available
- Auth Module: Role-based access control for super_admin users
- Security Config Module: Extension of existing security configuration patterns

### 5.2 Database Schema Changes

A new table/collection will be created for email configurations:
- Table name: EmailConfiguration
- Primary key: id (UUID)
- Fields as defined in section 4.2.1
- Relationship: None (standalone configuration entity)

### 5.3 Environment Variable Integration

Current environment variables that will be overridden:
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE

Note: While the preconfigured providers will set SMTP_HOST, SMTP_PORT, and SMTP_SECURE, the actual credentials (SMTP_USER and SMTP_PASS) will still need to be entered by the user separately for security reasons. These credential fields will remain as environment variables and not be stored in the database.

## 6. Deployment Considerations

### 6.1 Backward Compatibility

Existing .env email configurations remain as fallback when no database configuration exists. Applications that do not use the database configuration will continue to function normally.

### 6.2 Migration Strategy

Initial deployment includes seeding the predefined provider configurations in the application.

No migration is required for existing .env configurations. They will continue to work as fallback values.

## 7. Testing Strategy

### 7.1 Unit Tests

- Validate provider configuration retrieval
- Test configuration saving functionality
- Verify role-based access control
- Test configuration override logic

### 7.2 Integration Tests

- End-to-end flow from UI selection to database storage
- Override functionality verification (.env vs database)
- Configuration caching behavior
- Reversion to .env when database configuration is deleted

## 8. Future Enhancements

- Ability to add custom email providers
- Validation of email configuration connectivity
- Audit logging for configuration changes
- Import/export of email configurations
- Support for OAuth2 authentication flows for providers like Gmail
- Email template customization per provider
