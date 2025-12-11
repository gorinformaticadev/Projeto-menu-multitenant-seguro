# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 2.0.0 (2025-12-11)


### ⚠ BREAKING CHANGES

* **update:** Update system requires new database migrations for SystemSettings and UpdateLog models
* **email:** Email service now prioritizes database configuration over environment variables, requiring migration for existing setups.
* **security:** SecurityConfig model updated with new fields; migration required
* **security:** Token storage mechanism changed from sessionStorage to encrypted localStorage, requiring user re-authentication.
* Password validation now uses dynamic rules from security config, potentially affecting existing password update flows if config is not set.
* **security:** Security config API now includes new fields (loginLockDurationMinutes, sessionTimeoutMinutes) that may require frontend updates for full compatibility.
* **auth:** Login response now includes a refreshToken, necessitating updates in client code to handle and persist this token for ongoing authentication.
* **security:** Authentication flow now includes mandatory IP and user-agent logging for audit trails
* **users:** Introduces new users management requiring database schema updates for user entities
* **tenants:** Tenant creation now requires admin details (email, password, name) and creates an admin user automatically

### Features

* add CORS for static files, user profile editing, and favicon support ([f82c9e3](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/f82c9e3d08db68c9945849b503b64ae38be377ec))
* add tenant self-management for admins and enhance password validation ([c92ac81](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c92ac81610558a923f682a9e22a951a20c6b68ac))
* **auth:** add strong password validation and change password feature ([8fcbf1d](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/8fcbf1d8740a98293fffc34ca47cbe7313b9527e))
* **auth:** implement token rotation and secure session management ([23fc190](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/23fc1905d1b1418e6fbf52b15922c416334c1a8d))
* **config:** add configurable platform name and contact information ([293b409](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/293b4090604a452fbabbb2f8bc8de42db41451c3))
* **email:** add email configuration management with database support ([c47525a](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c47525a2985c5e53d1f8079ed0958762fdf1bdd3))
* **frontend:** add security logs and configurations pages ([a0fd8c2](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/a0fd8c2f007654e40a19f562c21884d6e5cfd363))
* **layout:** centralize sidebar in root AppLayout for unified UI structure  Introduce a new AppLayout component at the app root to handle sidebar globally, removing it from the dashboard-specific layout. This promotes consistent navigation across pages and streamlines layout management by avoiding duplication. ([8670f9e](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/8670f9e76bdc61f8908b6b000510ade3e68a8d0c))
* **security:** add email verification, enhanced 2FA, and security configurations ([427b9a2](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/427b9a25a5948c180572f1da8bbf956b927105a0))
* **security:** add login attempt blocking, Sentry monitoring, input sanitization, and HTTPS enforcement ([5f7829a](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/5f7829a7d3e96825b1cde92acaa191e553264755))
* **security:** add rate limiting, audit logging, and security headers ([4c996fb](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/4c996fb8745e14a69a4f8b9c7a5fb5e34bfa4436))
* **security:** add refresh functionality for security config and clean up login UI ([fd2b722](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/fd2b7227bff8ee3500979d60f9d25e05f4d6d5a9))
* **security:** add two-factor authentication and advanced CSP policies ([7079255](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/7079255ecf899c1665a10561cf8e5f5e3d1d46a5))
* **security:** enhance authentication and security configurations ([a9c02a5](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/a9c02a511e0b9c706cd0a4c87fca11843234b476))
* **security:** enhance login security with configurable lock duration and 2FA management ([a8443a9](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/a8443a92fa59ef39f4f401562c2ad058c1755338))
* **tenants:** add comprehensive tenant management with admin creation and CRUD operations ([4d04443](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/4d044432f8d397ac64ddc1f0e4fe40bd3c8d7955))
* **tenants:** add logo upload and management for tenants ([5a05245](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/5a05245854e749a0f9fc34ac4bf48742e28ca361))
* **tenants:** prevent deactivation of default tenant ([3bdac20](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/3bdac2074c805bc9794909bdcaaf7c72c475a85d))
* **ui:** add collapsible sidebar functionality  Implement a toggle button to expand or collapse the sidebar, allowing for a more flexible UI layout. The sidebar now transitions smoothly between expanded (showing full content) and collapsed (icon-only) states, improving space utilization on smaller screens. Adjusted the dashboard layout to remove fixed width, enabling dynamic sizing. ([e8823d5](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/e8823d5ba7b33b5e352caf5a4f5b580374ea4d5c))
* **ui:** add tenant logo display in top bar ([3ac66d9](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/3ac66d981c95148a4d0786dabbdfb389890b5efc))
* **ui:** add top bar component and update app layout ([d4805cf](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/d4805cff5e689a6946a4e6d86e0cf950d4cb3087))
* **update:** implement system update functionality with git integration ([2b85961](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/2b8596148efe834459119785b96d330a51727157))
* **users:** add users module and management interface ([c7df6a8](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c7df6a8a0b1c4c0fe4f731b058ad565f465de954))
