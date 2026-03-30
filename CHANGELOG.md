# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.5](https://github.com/gorinformaticadev/Pluggor/compare/v0.2.4...v0.2.5) (2026-03-30)

### [0.2.4](https://github.com/gorinformaticadev/Pluggor/compare/v0.2.3...v0.2.4) (2026-03-30)

### [0.2.3](https://github.com/gorinformaticadev/Pluggor/compare/v0.2.2...v0.2.3) (2026-03-30)

### [0.2.2](https://github.com/gorinformaticadev/Pluggor/compare/v0.2.1...v0.2.2) (2026-03-30)

### [0.2.1](https://github.com/gorinformaticadev/Pluggor/compare/v0.2.0...v0.2.1) (2026-03-30)


### Features

* add native update shell script and corresponding runtime adapter for backend deployments ([c73a4d0](https://github.com/gorinformaticadev/Pluggor/commit/c73a4d039614b26239a358d89a3ec30464c5c7aa))

## 0.2.0 (2026-03-30)


### ⚠ BREAKING CHANGES

* **seguranca:** The ability to configure specific rate limits for critical operations (backup, restore, update) via the UI has been removed. Users can no longer manage these settings directly.
* **backup:** none
* **frontend:** Next.js major version update may introduce breaking changes in API or behavior
* **backend:** Prisma v7 upgrade requires database URL configuration changes and may affect existing migrations. Test thoroughly before deploying.
* **frontend:** Next.js downgrade may affect compatibility with v16 features
* **Core:** Module path changes may require updates in dependent code
* **backend:** NestJS major version update may introduce breaking changes; test thoroughly. Sentry downgrade to v8 may affect error reporting features.
* **sistema:** The GET /modules/sistema/config/notifications endpoint now returns an array of schedules instead of a single object. The POST endpoint creates a new schedule instead of updating an existing one.
* **db:** Internal database access methods changed, but API remains compatible. Requires testing for raw query performance.
* **cron:** CronService now requires PrismaService injection and async initialization
* **modules:** Modules must now strictly follow the path structure packages/modules/{moduleSlug}/frontend/pages/{route}/page.tsx without fallbacks. Update existing modules accordingly.
* **modules:** Module uninstall now preserves files, changing expected behavior for file removal. Update any scripts relying on automatic file deletion.
* **notifications:** Batch delete endpoint changed from DELETE /notifications/batch to POST /notifications/batch-delete
* **sistema:** Notification route changed from /model-notification to /modelNotification
* **modules:** Module removal now requires slug confirmation, and registry filters enabled modules
* **notifications:** Notification API methods refactored to use new core system, legacy methods deprecated
* Notifications page route removed; use taskbar dropdown for management
* **modules:** Module paths and imports may need updates due to relocation
* **modules:** Module system now requires backend API consumption; frontend no longer defines or registers modules directly. All module configurations must be managed through the new secure backend architecture.
* **backend:** Import paths have changed from relative to @core aliases, requiring updates to all import statements throughout the codebase.
* **demo-completo:** Components now require Next.js 13+ app router compatibility
* Module configuration now prioritizes JSON files, requiring migration of existing TypeScript configs to JSON format for compatibility.

Revert "Up"

This reverts commit 5e76319ddda8f7658008dc5a2dc5742b4bdb9228.

Up

Up
* **core/frontend:** Old module loading mechanism replaced with registry system, requiring updates to module configurations and component integrations.
* **modules:** ajuda module removed, update any references accordingly
* **modules:** New database migrations required for Module and TenantModule tables
* **ui:** Updated form state management may require review of existing form handlers
* **security:** Encryption format changed to include auth tags; existing encrypted data remains readable via legacy support, but new encryptions use the secure GCM format.
* Updates to seed script may require re-running database migrations for existing tenants
* cz
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

* `SecurityThrottlerGuard` para fornecer limitação de taxa de API adaptativa e baseada em escopo com métricas. ([8ccebc2](https://github.com/gorinformaticadev/Pluggor/commit/8ccebc207e64b88cd416a9ae1143a6302f186387))
* Add CI/CD pipeline with test, lint, audit, and Docker image build/push steps for backend and frontend applications. ([7459bb4](https://github.com/gorinformaticadev/Pluggor/commit/7459bb4f7e053b9abe94cd731f380c534e2d824e))
* Add CI/CD workflow for automated testing and Docker image builds, and document service order status improvements for service orders. ([800c1d9](https://github.com/gorinformaticadev/Pluggor/commit/800c1d9827cc7106269a2fdaab7c9f11e446301f))
* add core and modules directories with readiness documentation ([72c87b8](https://github.com/gorinformaticadev/Pluggor/commit/72c87b844f5772da9973935f75ddcbac367425e2))
* add CORS for static files, user profile editing, and favicon support ([f82c9e3](https://github.com/gorinformaticadev/Pluggor/commit/f82c9e3d08db68c9945849b503b64ae38be377ec))
* Add Dockerfile and package.json for backend containerization, introduce an ACME-compatible installation script, and enhance production database configuration. ([b28be7b](https://github.com/gorinformaticadev/Pluggor/commit/b28be7b6aa511dd85e81ae0c6b27d0bd11c6ffd2))
* Add Dockerfiles for frontend and backend, integrate a CI/CD pipeline, and adjust the backend service working directory in docker-compose. ([2b5346e](https://github.com/gorinformaticadev/Pluggor/commit/2b5346eb98dc0a35cf62b8df6e9c51f2e7697a04))
* Add multi-stage Dockerfile for NestJS backend with Prisma, production setup, and health checks. ([46a506a](https://github.com/gorinformaticadev/Pluggor/commit/46a506ab2c6d5c4c23454241109d2bccf2ceb59e))
* Add new NestJS backend with Redis-based rate limiting, comprehensive security features, and multi-tenant architecture. ([9bc5c9a](https://github.com/gorinformaticadev/Pluggor/commit/9bc5c9a675fd9406651656bdf3481337aec1d412))
* Add Nginx configuration templates for Docker and external deployments, an installation script, backend package setup, and documentation assets. ([f1ad514](https://github.com/gorinformaticadev/Pluggor/commit/f1ad514e2ed195f7c254335ef5334142fbe5d397))
* add Nginx native configuration template for secure multi-tenant application deployments. ([8ac9372](https://github.com/gorinformaticadev/Pluggor/commit/8ac93724f26a935521d5991b104da1d710036552))
* add table UI component with its sub-components for structured data display. ([240471d](https://github.com/gorinformaticadev/Pluggor/commit/240471dad7db2695682c140d46b80de0c1a8c5a1))
* add tenant branding and security configuration ([0f5884f](https://github.com/gorinformaticadev/Pluggor/commit/0f5884fe4fa0b5469a311cec9c9daf8d68806dc6))
* add tenant self-management for admins and enhance password validation ([c92ac81](https://github.com/gorinformaticadev/Pluggor/commit/c92ac81610558a923f682a9e22a951a20c6b68ac))
* add user preferences update and enhance dark theme UI ([4f621f0](https://github.com/gorinformaticadev/Pluggor/commit/4f621f04eead12c951bde7c7694ced515779b8cb))
* Adiciona armazenamento de rate limiting baseado em Redis e guard de segurança ao backend. ([a33c3ce](https://github.com/gorinformaticadev/Pluggor/commit/a33c3ce920bb7c8a45d15e8f0efcf5d1a2ce90a9))
* Adiciona guia de estilo neumórfico e implementa componente Sidebar dinâmico com configuração Tailwind. ([4d78bf4](https://github.com/gorinformaticadev/Pluggor/commit/4d78bf4046b40dfd7a1dd190e2c0df7f0bd986f1))
* adiciona instalador install-acme compatível com ticketz-docker-acme ([03a7e6d](https://github.com/gorinformaticadev/Pluggor/commit/03a7e6d3ce6705aac6ed0fb55b1f9d0c1289f8f4))
* adiciona instalador install-acme-int para Nginx interno (Docker) ([7750748](https://github.com/gorinformaticadev/Pluggor/commit/7750748add07025c4d8e16cd900467fbdd45f5c2))
* Adiciona relatório detalhado de credenciais ao final da instalação ([c3153d5](https://github.com/gorinformaticadev/Pluggor/commit/c3153d54602d28bd60b24ca632372d0063250bf4))
* adiciona script update-acme para atualizações inteligentes ([b48f6bb](https://github.com/gorinformaticadev/Pluggor/commit/b48f6bb3a2c91c701ba5fb41d1fe9cb21510fac3))
* Adiciona um serviço de monitoramento de tarefas do sistema para acompanhar e alertar sobre problemas em tarefas cron, como travamentos, tarefas obsoletas ou falhas repetidas. ([4b8a503](https://github.com/gorinformaticadev/Pluggor/commit/4b8a5038408bf3034996abedd5c65b63fecb8cc2))
* Adicionado módulo de notificação abrangente com WebSockets em tempo real, endpoints de API e gerenciamento de assinaturas push. ([2abcf17](https://github.com/gorinformaticadev/Pluggor/commit/2abcf1716cc7f975b12640381bf28483531880d7))
* Adicionado uma seção de configurações abrangente ao frontend e implemente a lógica de backend para configurações de segurança e notificações push na web. ([5997ef9](https://github.com/gorinformaticadev/Pluggor/commit/5997ef9d3f64c9b60081d8b78ac16373f467757e))
* amplia auditoria e notificações de backup/restore ([9b715e0](https://github.com/gorinformaticadev/Pluggor/commit/9b715e058181da4a6ddc091e41d76d2f518e6c90))
* **audit, notifications:** Aprimoramento do sistema de registro de auditoria e notificação ([b396a6d](https://github.com/gorinformaticadev/Pluggor/commit/b396a6dc9b8af43a86ef6a26b36239dc2bd1360e))
* **auditoria:** endurece sanitização e restringe consulta administrativa ([476edb0](https://github.com/gorinformaticadev/Pluggor/commit/476edb0a2b121440b1a2ae9cd7760ae28237f1e9))
* **auth:** add password reset functionality ([e8b81af](https://github.com/gorinformaticadev/Pluggor/commit/e8b81afa54a965d57a110a558d909b5af0c9f4bf))
* **auth:** add remember me functionality to login page ([6e27e9d](https://github.com/gorinformaticadev/Pluggor/commit/6e27e9d5ceedc5683cc3043bf234dcadf5480805))
* **auth:** add strong password validation and change password feature ([8fcbf1d](https://github.com/gorinformaticadev/Pluggor/commit/8fcbf1d8740a98293fffc34ca47cbe7313b9527e))
* **auth:** Adiciona dispositivos confiáveis ​​para ignorar a autenticação de dois fatores (2FA) ([80347dd](https://github.com/gorinformaticadev/Pluggor/commit/80347dd2da04d9a684450737aee3947005e7c0f2))
* **auth:** Aprimora a autenticação de usuários e o gerenciamento de perfis ([441caa5](https://github.com/gorinformaticadev/Pluggor/commit/441caa5e9c1326d27496e3ec4e686bbd2dee5812))
* **auth:** implement password input component with enhanced validation ([347b043](https://github.com/gorinformaticadev/Pluggor/commit/347b0432751e1a1efa8ffbc9796e446ba271280a))
* **auth:** implement token rotation and secure session management ([23fc190](https://github.com/gorinformaticadev/Pluggor/commit/23fc1905d1b1418e6fbf52b15922c416334c1a8d))
* **auth:** Implementação de autenticação robusta baseada em cookies e inscrição em 2FA ([89bc7dd](https://github.com/gorinformaticadev/Pluggor/commit/89bc7dd4a3aa366e59106127a200ea130f40a057))
* **backend:** Adiciona um adaptador Redis para escalabilidade horizontal do Socket.IO ([ccbb48d](https://github.com/gorinformaticadev/Pluggor/commit/ccbb48d5cfa2e256279a45d760caf2dbc21c40eb))
* **backend:** Adicionada a funcionalidade de registro de depuração em arquivo para o carregador de módulos dinâmico ([85718d5](https://github.com/gorinformaticadev/Pluggor/commit/85718d56bd91b520e4f28db7a1e50f2ebbdfdb2a))
* **backend:** Adicionadas melhorias de segurança para proteção contra CSRF e gerenciamento de segredos ([05ae681](https://github.com/gorinformaticadev/Pluggor/commit/05ae6815cf6a3eeb48428f5d780e0aac9effbad6))
* **backend:** Aprimoramento da segurança com listas negras de tokens e isolamento de locatários ([9e0e0b5](https://github.com/gorinformaticadev/Pluggor/commit/9e0e0b53b9656107a1bbde8b98511728b1b85897))
* **backend:** Autenticação JWT WebSocket aprimorada e segurança CORS reforçada ([35c4382](https://github.com/gorinformaticadev/Pluggor/commit/35c438256b6758b67c339caee453a6654aa8a3de))
* **backend:** implementar etapa 1 da auditoria persistente ([664c609](https://github.com/gorinformaticadev/Pluggor/commit/664c60975f3dbbc23536d79ddca6a0798c66a757))
* **backup:** add backup and restore functionality ([d3b3d71](https://github.com/gorinformaticadev/Pluggor/commit/d3b3d710e71e403e13659475d6ecb63b01695c97))
* **backup:** add delete backup functionality ([b8fe083](https://github.com/gorinformaticadev/Pluggor/commit/b8fe08398d77baf1d81f656321bcd5b5612832aa))
* **backup:** Implementa nova arquitetura de backup e restauração com suporte a API interna e melhorias na segurança ([e37422b](https://github.com/gorinformaticadev/Pluggor/commit/e37422b07cd1c9e6a2191fc4ea9ae24ac9e3f408))
* **ci:** Implementação de pipeline CI/CD com validações automatizadas ([4c0eecd](https://github.com/gorinformaticadev/Pluggor/commit/4c0eecdcfe72f05a5e51f5c2edb3cb5bf0ce28b7))
* **config:** add configurable platform name and contact information ([293b409](https://github.com/gorinformaticadev/Pluggor/commit/293b4090604a452fbabbb2f8bc8de42db41451c3))
* **config:** Habilitar configurações de segurança dinâmicas e notas operacionais ([630b616](https://github.com/gorinformaticadev/Pluggor/commit/630b6165da51b492c944d64a4ff179e8b6c2ed76))
* **config:** Melhorar a página de visão geral das configurações com novas seções e estatísticas ([89c3442](https://github.com/gorinformaticadev/Pluggor/commit/89c34427072ae2a23da9c20406ab95c7a8edc91e))
* **core/cron:** implement lease fencing token for cron job executions ([f740c2c](https://github.com/gorinformaticadev/Pluggor/commit/f740c2c9006be4bd9d8d5505c6a66cd65146cdbd))
* **cpf-cnpj:** adicionar validação para CPF/CNPJ em DTOs de locatários e formulários front-end ([6573e40](https://github.com/gorinformaticadev/Pluggor/commit/6573e4003bbc125b553544e9377aaa6d666183ae))
* create initial AppModule with core modules, guards, and middleware. ([c1943c6](https://github.com/gorinformaticadev/Pluggor/commit/c1943c64692e30d85bf08c43839746ff222a9fbc))
* **cron-ui:** refine scheduled tasks UX ([33e3bf8](https://github.com/gorinformaticadev/Pluggor/commit/33e3bf8ba43de323b0c6dda1b108ae9e56ce6c49))
* **cron:** add database persistence for cron jobs and notification schedules ([0c10d84](https://github.com/gorinformaticadev/Pluggor/commit/0c10d84244e6de35954ca3b06703f1c1b3d7f121))
* **cron:** add skipped status to cron job heartbeats ([cfa0a62](https://github.com/gorinformaticadev/Pluggor/commit/cfa0a62d96cb2b6f1060f2625abd7d239de8950b))
* **cron:** adicione sistema de cron job dinâmico com gerenciamento de UI ([c17607d](https://github.com/gorinformaticadev/Pluggor/commit/c17607dda6af0c2b78a8a6b6503af691996faec5))
* **cron:** implement materialized job execution mode ([dba883b](https://github.com/gorinformaticadev/Pluggor/commit/dba883b7ed4556ab4a95984632f129f48cf278f8))
* **dashboard:** add lightweight operational telemetry and route diagnostics ([f4db07e](https://github.com/gorinformaticadev/Pluggor/commit/f4db07ec01b1eef4de0e7780d724dbcca0bc83d3))
* **dashboard:** adicionar drill-down contextual e filtros rapidos ([ab27aac](https://github.com/gorinformaticadev/Pluggor/commit/ab27aaccc7b46e2e278a2f12571a35d3226e2256))
* **dashboard:** adicionar historico leve e auditoria incremental ([0914a1c](https://github.com/gorinformaticadev/Pluggor/commit/0914a1cbebadcd22dc1d8c64526622a536500d9c))
* **dashboard:** implementar dashboard operacional modular com persistência de layout ([ec70884](https://github.com/gorinformaticadev/Pluggor/commit/ec7088428778c8a5194a712fadb2b1434ca425c9))
* **dashboard:** unify platform cards and operational shell ([b6fd2c3](https://github.com/gorinformaticadev/Pluggor/commit/b6fd2c35feb14e28d26f536aff4980d431ef991d))
* **db:** add cron schedules migration ([05bb494](https://github.com/gorinformaticadev/Pluggor/commit/05bb494e5a7e79166a7cc86903824d673c1c1b74))
* **demo-completo:** add new demo-completo module ([376d2ab](https://github.com/gorinformaticadev/Pluggor/commit/376d2ab1f93167334a71ce4bc39c81e8a88359bd))
* **docker:** add docker setup evaluation and optimize frontend caching ([d693f67](https://github.com/gorinformaticadev/Pluggor/commit/d693f67a074b4e4eab413721c671932f0bd7a1e8))
* **docker:** add docker support for development and production ([ba76096](https://github.com/gorinformaticadev/Pluggor/commit/ba760969c46d01d118316b06a699f801c9095d31))
* **docs:** Documentação de instalação ([845892f](https://github.com/gorinformaticadev/Pluggor/commit/845892fd370d0c935a49a85cb55933c7799563c5))
* **email:** add email configuration management with database support ([c47525a](https://github.com/gorinformaticadev/Pluggor/commit/c47525a2985c5e53d1f8079ed0958762fdf1bdd3))
* **frontend:** add API and uploads proxy rewrites ([d550db9](https://github.com/gorinformaticadev/Pluggor/commit/d550db9b9063024fbbb411102a8eef9aa6a430f4))
* **frontend:** add avatar and table UI components ([e358888](https://github.com/gorinformaticadev/Pluggor/commit/e358888cc8c5e325cda5b7da1393359cb290d9bf))
* **frontend:** add security logs and configurations pages ([a0fd8c2](https://github.com/gorinformaticadev/Pluggor/commit/a0fd8c2f007654e40a19f562c21884d6e5cfd363))
* **frontend:** Adiciona proteção de rotas e aprimora o tratamento de erros ([0c98517](https://github.com/gorinformaticadev/Pluggor/commit/0c98517b8ad4857e36466392c7e4ccbe9261aa16))
* **frontend:** Adicionadas dependências do editor de texto avançado TipTap e atualizados os componentes da interface do usuário ([46cf117](https://github.com/gorinformaticadev/Pluggor/commit/46cf117cb674977e22206f231161ec01d0cbcb3d))
* **frontend:** Adicionar componente de grupo de botões de opção ([e07daa5](https://github.com/gorinformaticadev/Pluggor/commit/e07daa533e406e31c21d7723695c4bc0a400bd59))
* **frontend:** etapa 3 da inbox de notificações para SUPER_ADMIN ([e8e5204](https://github.com/gorinformaticadev/Pluggor/commit/e8e5204894c70dc1511562d3473ba6cf622d793e))
* **frontend:** evolui inbox operacional do super admin ([d1616b4](https://github.com/gorinformaticadev/Pluggor/commit/d1616b4ddebc20cfe68eacfdb8a3c8c79154ef14))
* harmoniza tema e experiencia visual das telas administrativas ([0de253f](https://github.com/gorinformaticadev/Pluggor/commit/0de253f5db58273e2648dec8f245e9d137d96534))
* Implement a distributed module installer service for managing module installation, updates, and file distribution. ([ba84543](https://github.com/gorinformaticadev/Pluggor/commit/ba84543f054c7513932d30d1ac75d87a0fefd6b7))
* Implement a Socket.IO client for real-time notifications, including connection management and event handling. ([4868230](https://github.com/gorinformaticadev/Pluggor/commit/4868230e421d16ffec3ddb0f79341ff9baeae45f))
* Implement application update service and establish multi-tenant frontend architecture. ([916ac96](https://github.com/gorinformaticadev/Pluggor/commit/916ac963fbc046dfe21dbfa72f521f776a55ccb5))
* Implement comprehensive security hardening including CSP, HTTPS redirection, and enhanced secret management. ([7aaa5e7](https://github.com/gorinformaticadev/Pluggor/commit/7aaa5e70f24b1c3e9e65de4e6ce0504b2bacd77d))
* Implement dynamic sidebar component with module registry integration, expandable UI, and user authentication features. ([1d228de](https://github.com/gorinformaticadev/Pluggor/commit/1d228de7d15d9e4c5175f5278632c02f371ddf25))
* Implement module installer service and controller for distributed module management including installation, updates, and migrations. ([303de7c](https://github.com/gorinformaticadev/Pluggor/commit/303de7c5988e91cd66f5138bfd9283c661f28c15))
* implement native and docker update runtime adapters and core execution services ([f8d5507](https://github.com/gorinformaticadev/Pluggor/commit/f8d5507a9e684c53e12d85f3c3876a343fe9471d))
* Implement secure Prisma service for tenant isolation, add backup and restore functionality, and introduce system update features with CI/CD. ([acef8f1](https://github.com/gorinformaticadev/Pluggor/commit/acef8f14ad986c18bfc83a030a069805badde040))
* implement security configuration page with dynamic settings and add installation documentation. ([1f6d513](https://github.com/gorinformaticadev/Pluggor/commit/1f6d51328c47ad9597a23cd31752281f2fef24d7))
* implement system job watchdog and cron update services with associated unit tests ([aed8528](https://github.com/gorinformaticadev/Pluggor/commit/aed852847347fa17d5ff169024e4dfca20d69ab5))
* implement system job watchdog service to monitor cron job health and alert on execution status, including session cleanup. ([ce64a86](https://github.com/gorinformaticadev/Pluggor/commit/ce64a86f4b5da6151ea6ab6c877dc508c7f74cbe))
* implement system update engine with agent runner and command execution services ([5457ac9](https://github.com/gorinformaticadev/Pluggor/commit/5457ac9cc1ab5096dbb3390e32fc673ef229f765))
* Implement system update, module management, and backup features, including new deployment scripts, database schema, and frontend pages. ([99f8c57](https://github.com/gorinformaticadev/Pluggor/commit/99f8c57e5e0da49634a455761052f58e8e66a4c3))
* implement system version tracking utility and API endpoints with frontend hooks ([ca6c49b](https://github.com/gorinformaticadev/Pluggor/commit/ca6c49b6c8f214255209d4df5a313c456d5975f8))
* Implement the WhatsApp module, including new UI components, pages, and data models. ([19b2993](https://github.com/gorinformaticadev/Pluggor/commit/19b29930f8a163dc6bffc76c235ebeb1c0a563df))
* implement update service, controller, and unit tests for system version management ([c9759ab](https://github.com/gorinformaticadev/Pluggor/commit/c9759aba797d7d587063f9a3e7b4214aa71cd35f))
* Implementação de restrições para modulos que soment eadminspodem ver. ([09eda7d](https://github.com/gorinformaticadev/Pluggor/commit/09eda7da910eee91713909e85a8b69f7d5eaa440))
* Implementar a configuração inicial da aplicação backend, incluindo o esquema Prisma, o seeding, os arquivos de ambiente e o script de instalação com proteção par anao substituir dados, ou aplicar seeds/migrates ja executados. ([6d31d34](https://github.com/gorinformaticadev/Pluggor/commit/6d31d34c6c7100eed9cbd69408ce6547d0b1d12e))
* Implementar funcionalidades de atualização do sistema, fluxos de redefinição de senha e serviços de e-mail. ([e82004a](https://github.com/gorinformaticadev/Pluggor/commit/e82004acc12905e57b66da98550c9f66d15a90b2))
* Implemente mecanismos de limitação de segurança, restrição de taxa de requisições e registro de auditoria com novas configurações de ambiente. ([51eb598](https://github.com/gorinformaticadev/Pluggor/commit/51eb5981a25b8042c6f65a55b7b3bfef8da6e84d))
* Implemente um sistema de notificações em tempo real com Socket.IO, incluindo notificações sonoras e do navegador. ([4b67425](https://github.com/gorinformaticadev/Pluggor/commit/4b674258ba388b45b38fabf8a5f9d2c1fbd5b452))
* Initialize backend project with CI/CD pipeline and Prisma configuration. ([fdb21c8](https://github.com/gorinformaticadev/Pluggor/commit/fdb21c81c92a4f27a27d66a7eb13bf9742d6b885))
* Initialize monorepo structure with new backend and frontend applications, including dynamic module loading. ([b3b7b56](https://github.com/gorinformaticadev/Pluggor/commit/b3b7b56abe5d088c633f03f3b8f0890a203294aa))
* Initialize monorepo structure with pnpm, and introduce backend notification and authentication features. ([cd4a074](https://github.com/gorinformaticadev/Pluggor/commit/cd4a074324513443624b5d1972dccc4f130252b3))
* **install:** instalador e reorganização ([e50641e](https://github.com/gorinformaticadev/Pluggor/commit/e50641eed78e2c8459909181c3000af351b70b16))
* Introduce `ModuleInstallerService` to manage module installation, updates, and file distribution from ZIP archives, including rollback. ([375fd79](https://github.com/gorinformaticadev/Pluggor/commit/375fd79bd72c993ab016f3a213fce9ac2a3bbcce))
* Introduce Dockerization for backend and frontend services, add a database migrator, and include a setup script with environment examples. ([6b5742e](https://github.com/gorinformaticadev/Pluggor/commit/6b5742eec45c968b1bb2a13272ad43abda981548))
* Introduce initial NestJS backend application with its dependencies and related debug logs. ([63fed09](https://github.com/gorinformaticadev/Pluggor/commit/63fed099ee2a830d54118fd759010051d33cf1f8))
* Introduce push notification services, system settings management, service order permissions, and a security configuration UI. ([c98d195](https://github.com/gorinformaticadev/Pluggor/commit/c98d195339b877ffb64df3f1de6b8daf7c14ae14))
* Introduza diretórios dedicados para `DOCS` e `Scripts`, realocando a documentação existente e adicionando extenso conteúdo novo e scripts utilitários. ([d81f386](https://github.com/gorinformaticadev/Pluggor/commit/d81f386d9c95b07acada40be0eff5321931e93c6))
* **layout:** centralize sidebar in root AppLayout for unified UI structure  Introduce a new AppLayout component at the app root to handle sidebar globally, removing it from the dashboard-specific layout. This promotes consistent navigation across pages and streamlines layout management by avoiding duplication. ([8670f9e](https://github.com/gorinformaticadev/Pluggor/commit/8670f9e76bdc61f8908b6b000510ade3e68a8d0c))
* **login:** identificador de CAPSLOOK e Mostrar senha ([09d4810](https://github.com/gorinformaticadev/Pluggor/commit/09d481004aef1babd2cb6449d7d0af8cc566bfed))
* **maintenance:** Implementação da funcionalidade de modo de manutenção com token de bypass e proteção global ([3e3f503](https://github.com/gorinformaticadev/Pluggor/commit/3e3f50349513df1016d30c0b94dbd5176528f79a))
* Melhora feedback de build no instalador e reconstrói desinstalador robusto ([005d446](https://github.com/gorinformaticadev/Pluggor/commit/005d446ccc574282829ddc9f06e987713f2ab1a8))
* Melhora robustez do instalador e SSL ([92291f0](https://github.com/gorinformaticadev/Pluggor/commit/92291f026e96a968543a56fc87fd9742d570d0a5))
* melhora update-acme para resolver erros de rede e 502 ([1b10132](https://github.com/gorinformaticadev/Pluggor/commit/1b10132ddabe6c70f5221120fe10b110aa77d81d))
* **module:** add backend persistence for module activation states ([be6f187](https://github.com/gorinformaticadev/Pluggor/commit/be6f1870ed9d1fa0b8fb4b3eaf463b6f5daf9ae4))
* **module:** add dynamic module status updates across components ([fd74234](https://github.com/gorinformaticadev/Pluggor/commit/fd74234650689ce59bd90feb3b371680856cb0db))
* **module:** enhance module status tracking with activation history ([dfb20ff](https://github.com/gorinformaticadev/Pluggor/commit/dfb20ff34fa1950f01d4bf6969fdf149527dac05))
* **module:** extend module registry with user menu, notifications, and taskbar support ([2b383eb](https://github.com/gorinformaticadev/Pluggor/commit/2b383eb567434ba79e25d5ddb5c7468004895e02))
* **modules:** add activate and deactivate functionality to module management ([14a0b0f](https://github.com/gorinformaticadev/Pluggor/commit/14a0b0f11ee616fc65fbd18c19558b97f1038acb))
* **modules:** add automatic module loading and dynamic menus ([68c92d6](https://github.com/gorinformaticadev/Pluggor/commit/68c92d657143a299ccbdfee2fd5dfc0c3405cd61))
* **modules:** add database versioning and update management system ([99a4d17](https://github.com/gorinformaticadev/Pluggor/commit/99a4d178a54cb536433eda5cd9d20be2ac1fdc33))
* **modules:** add duplicate request prevention for module toggles ([f7589e3](https://github.com/gorinformaticadev/Pluggor/commit/f7589e37391961b5e714510779d6cb3a2a2f5b37))
* **modules:** add tenant module management system ([7dc1415](https://github.com/gorinformaticadev/Pluggor/commit/7dc14156eae52ea1ae229c0a58375595d69c1306))
* **modules:** adicionar funcionalidade de upload e gerenciamento de módulos ZIP ([85cd656](https://github.com/gorinformaticadev/Pluggor/commit/85cd656c301ad239f6e68bf8b049a22af84578ad))
* **modules:** adicionar módulo de sistema com agendamento de notificação e configurações de cron ([fe3c824](https://github.com/gorinformaticadev/Pluggor/commit/fe3c824b8dcdc4a1b978dcf33f9a1439f74635c5))
* **modules:** Aprimorar o upload de módulos com melhoria no manuseio de arquivos e na interface do usuário ([8a8eeec](https://github.com/gorinformaticadev/Pluggor/commit/8a8eeec62600c7817a8746fedbe46731692b522b))
* **modules:** Desativar módulos por padrão para novos locatários ([9049296](https://github.com/gorinformaticadev/Pluggor/commit/9049296f6804f6d5d2045b50bf5a810c7ad1a3d5))
* **modules:** enable dynamic module loading and add dependencies ([bf22111](https://github.com/gorinformaticadev/Pluggor/commit/bf221115571339c1817960e0b84663635e9007bd))
* **modules:** enable module updates and add sistema module ([7714738](https://github.com/gorinformaticadev/Pluggor/commit/7714738e696d7d81f511eb923afba5ad353b5140))
* **modules:** enhance module management with confirmation and filtering ([d1057a1](https://github.com/gorinformaticadev/Pluggor/commit/d1057a10cef693d44ca7fad325652f1670fccb78))
* **modules:** enhance module system with slots and remove ajuda module ([4bc1358](https://github.com/gorinformaticadev/Pluggor/commit/4bc13582d44e761200fe3a0112aa19197ca4504e))
* **modules:** evita a quebra por modulo problemático ([7157099](https://github.com/gorinformaticadev/Pluggor/commit/71570992e5de23c665d0eb94b242b94d7482b40e))
* **modules:** extrair módulos compactados em diretórios ([964fb12](https://github.com/gorinformaticadev/Pluggor/commit/964fb125e81a3412b9dd1c13da9d68609c03bd02))
* **modules:** implement tenant module management service ([efbdc58](https://github.com/gorinformaticadev/Pluggor/commit/efbdc588feb0d60b987c95d91a4d3247a6e22132))
* **modules:** implementar registro de módulo híbrido com carregamento dinâmico ([e10f226](https://github.com/gorinformaticadev/Pluggor/commit/e10f22602f9f7e7d3cde5543ec14d9e06145d0ed))
* **modules:** improve migrations and seeds execution to run pendents only ([1367398](https://github.com/gorinformaticadev/Pluggor/commit/13673985689cf908490bddc3b0597b2da3b62b85))
* **modules:** integrate ordem_servico module ([658c84b](https://github.com/gorinformaticadev/Pluggor/commit/658c84b5c3fe8bf3ab021122cc8b6f7bf09da878))
* **modules:** integre o carregador de módulo dinâmico e aprimore o módulo do sistema - Documentação ([01d9489](https://github.com/gorinformaticadev/Pluggor/commit/01d9489803eca5e5f3fd2dd5764d4d6039da62d9))
* **modules:** Melhoria na instalação do módulo com integração ao banco de dados e gerenciamento de locatários ([792b5c9](https://github.com/gorinformaticadev/Pluggor/commit/792b5c990e431ec9163cc3fab42a4b146ff80cbf))
* **modulos:** suporte seguro a npmDependencies no instalador ([57f592f](https://github.com/gorinformaticadev/Pluggor/commit/57f592f8dcc88895257fa47675a0bce8cfcff964))
* Nomes de banco e usuário dinâmicos baseados no domínio ([593fe21](https://github.com/gorinformaticadev/Pluggor/commit/593fe2112a10b4040c868435655da6a479088f13))
* **notifications:** Adicinar sistema de notificação de tenants nos modulos ([c8571d9](https://github.com/gorinformaticadev/Pluggor/commit/c8571d9e7dffa5373ebc91c52ef78cd5c3a5b1bc))
* **notifications:** implement comprehensive notification management page ([35ce5ea](https://github.com/gorinformaticadev/Pluggor/commit/35ce5ead0b6b6b027cd80c4747d68a9a8ca06080))
* **notifications:** implementa etapa 2 com inbox persistente para SUPER_ADMIN ([e02d9e8](https://github.com/gorinformaticadev/Pluggor/commit/e02d9e8d3935464d48d181fe068500bc697d2d3c))
* **notifications:** improve batch delete with POST method and global badge refresh ([bb87374](https://github.com/gorinformaticadev/Pluggor/commit/bb873741129bb4b04a8d20862eec04811f1bf8bd))
* **notifications:** integrate real-time notification system with WebSockets and WhatsApp ([1cdf3df](https://github.com/gorinformaticadev/Pluggor/commit/1cdf3df66008bb37a2b1c8c438c32e715fa468fa))
* **notifications:** Sistema de notificações completos ([46a6bc9](https://github.com/gorinformaticadev/Pluggor/commit/46a6bc9b2c8021c1ecb565d09574d4c56e7fc4b7))
* oculta menu de configuracoes durante rolagem ([7c0c7f6](https://github.com/gorinformaticadev/Pluggor/commit/7c0c7f67bed5eb49bccf4680ba14e1602c778ff6))
* **ops:** add automatic operational alerts with selective push ([e09ed79](https://github.com/gorinformaticadev/Pluggor/commit/e09ed795b931ee6c2afb82163946f3b03e9e8a8d))
* **ops:** add unified diagnostics page and harden logs ([3bc90ac](https://github.com/gorinformaticadev/Pluggor/commit/3bc90ace98ded76477c1162a0c34203648bd2e91))
* **ops:** unify cron runtime with heartbeat watchdog ([edc7e19](https://github.com/gorinformaticadev/Pluggor/commit/edc7e1981b92b77eb3147244a474a698884b3a65))
* padroniza submenus flutuantes da navegacao lateral ([d8463b4](https://github.com/gorinformaticadev/Pluggor/commit/d8463b430f396b51acd20f0819afa9485c564d2f))
* read dashboard cards from installed module manifests ([1dbe3de](https://github.com/gorinformaticadev/Pluggor/commit/1dbe3ded7a2b5e993baaf35c0ac801e6632c6639))
* refina navegacao de configuracoes e administracao ([da03201](https://github.com/gorinformaticadev/Pluggor/commit/da03201c5fa95a0e0ed7f4f2b7de25e452d69895))
* restrict ports to localhost and improve setup.sh for external Nginx with SSL ([93d0a69](https://github.com/gorinformaticadev/Pluggor/commit/93d0a69fc9483276db8081424a385a2785a90214))
* **retention:** adiciona housekeeping de audit e notificacoes ([c7897a6](https://github.com/gorinformaticadev/Pluggor/commit/c7897a672244d7260f4ad086c208fc53f06693ff))
* **secure-files:** add secure file uploads module with multi-tenant isolation ([d4ac27f](https://github.com/gorinformaticadev/Pluggor/commit/d4ac27f4b6c94231464161b23217dc4a53a68958))
* **security): Recurso (segurança:** aprimore a segurança do aplicativo com validação de arquivos, armazenamento seguro de tokens e verificações de validação ([a51f42f](https://github.com/gorinformaticadev/Pluggor/commit/a51f42fff4fa8c3f6d1c592401f30c51e8ede14b))
* **security:** add email verification, enhanced 2FA, and security configurations ([427b9a2](https://github.com/gorinformaticadev/Pluggor/commit/427b9a25a5948c180572f1da8bbf956b927105a0))
* **security:** add login attempt blocking, Sentry monitoring, input sanitization, and HTTPS enforcement ([5f7829a](https://github.com/gorinformaticadev/Pluggor/commit/5f7829a7d3e96825b1cde92acaa191e553264755))
* **security:** add rate limiting for critical endpoints ([e80580c](https://github.com/gorinformaticadev/Pluggor/commit/e80580ceaeb905401c4bd6b8c64a4a1805594312))
* **security:** add rate limiting, audit logging, and security headers ([4c996fb](https://github.com/gorinformaticadev/Pluggor/commit/4c996fb8745e14a69a4f8b9c7a5fb5e34bfa4436))
* **security:** add refresh functionality for security config and clean up login UI ([fd2b722](https://github.com/gorinformaticadev/Pluggor/commit/fd2b7227bff8ee3500979d60f9d25e05f4d6d5a9))
* **security:** add two-factor authentication and advanced CSP policies ([7079255](https://github.com/gorinformaticadev/Pluggor/commit/7079255ecf899c1665a10561cf8e5f5e3d1d46a5))
* **security:** Adição de sessões de usuário e refinamento de limites de taxa ([ccf9d61](https://github.com/gorinformaticadev/Pluggor/commit/ccf9d614241be7ea9000ee532a11eaf22b599f6b))
* **security:** Adicionada expiração de sessão abrangente e atualização atômica de tokens. ([3d95315](https://github.com/gorinformaticadev/Pluggor/commit/3d95315038312ebbe7b317f6d8df9a67f43a7e3e))
* **security:** enhance authentication and security configurations ([a9c02a5](https://github.com/gorinformaticadev/Pluggor/commit/a9c02a511e0b9c706cd0a4c87fca11843234b476))
* **security:** enhance login security with configurable lock duration and 2FA management ([a8443a9](https://github.com/gorinformaticadev/Pluggor/commit/a8443a92fa59ef39f4f401562c2ad058c1755338))
* **security:** Habilitar controle dinâmico em tempo de execução para recursos essenciais ([a7f9fa8](https://github.com/gorinformaticadev/Pluggor/commit/a7f9fa8fcaa533a563d186ba05390e10c9591057))
* **security:** implement comprehensive regression and guardrails ([1a7dda5](https://github.com/gorinformaticadev/Pluggor/commit/1a7dda5437749218c4ae0151e7b9d3eee9fc4333))
* **seed:** Melhoria no bloqueio de seeds e no fluxo de trabalho de atualização ([e6357b8](https://github.com/gorinformaticadev/Pluggor/commit/e6357b84657a0c8e6b4dc6f820fc54197c584a7f))
* **seguranca:** remove critical endpoint rate limit config ([4d601c2](https://github.com/gorinformaticadev/Pluggor/commit/4d601c2aff3414b353f61fed9e27f6888da35f3e))
* Sistema de atualização e Correções de warn ([c74fafc](https://github.com/gorinformaticadev/Pluggor/commit/c74fafc8ebd8f9b428649313f3d1b6a6158b1b1f))
* **sistema:** enable multiple notification schedules ([64a7ae8](https://github.com/gorinformaticadev/Pluggor/commit/64a7ae83bcdff9a002df03e0ac4f894f38b6bd61))
* **sistema:** implement comprehensive notification sending system ([8aa9915](https://github.com/gorinformaticadev/Pluggor/commit/8aa9915a5da8cf6ce7a656f8fccd5bc22bff4a36))
* **sistema:** integrate notification sending with core system ([ae98855](https://github.com/gorinformaticadev/Pluggor/commit/ae9885567c25aa2799338cdbdaa9038879af58cd))
* **system:cron:** fetch materialized job runtime snapshots from history ([1a69e9a](https://github.com/gorinformaticadev/Pluggor/commit/1a69e9a29a52368cd6f1c4f253a8e56c1a23da9f))
* **system:jobs:** enhance materialized job status and alerts ([55055f4](https://github.com/gorinformaticadev/Pluggor/commit/55055f420eb94847156b0afa98cbb48283e065b1))
* **system:** Implementamos um gerenciamento robusto de tarefas cron e operações de backup seguras. ([7dcaa23](https://github.com/gorinformaticadev/Pluggor/commit/7dcaa232c722db855c898768e088ccf62cf9b3fc))
* **tenants:** add comprehensive tenant management with admin creation and CRUD operations ([4d04443](https://github.com/gorinformaticadev/Pluggor/commit/4d044432f8d397ac64ddc1f0e4fe40bd3c8d7955))
* **tenants:** add logo upload and management for tenants ([5a05245](https://github.com/gorinformaticadev/Pluggor/commit/5a05245854e749a0f9fc34ac4bf48742e28ca361))
* **tenants:** prevent deactivation of default tenant ([3bdac20](https://github.com/gorinformaticadev/Pluggor/commit/3bdac2074c805bc9794909bdcaaf7c72c475a85d))
* **ui:** add click-outside functionality to user menu ([1ffec7d](https://github.com/gorinformaticadev/Pluggor/commit/1ffec7dd6b9f334379b03a9c65341b9f4fe61df1))
* **ui:** add collapsible sidebar functionality  Implement a toggle button to expand or collapse the sidebar, allowing for a more flexible UI layout. The sidebar now transitions smoothly between expanded (showing full content) and collapsed (icon-only) states, improving space utilization on smaller screens. Adjusted the dashboard layout to remove fixed width, enabling dynamic sizing. ([e8823d5](https://github.com/gorinformaticadev/Pluggor/commit/e8823d5ba7b33b5e352caf5a4f5b580374ea4d5c))
* **ui:** add module management tabs and tenant modules integration ([24e0f83](https://github.com/gorinformaticadev/Pluggor/commit/24e0f834c57fee155263e4731a2e0f66e2f4bd5c))
* **ui:** add system version display in top bar ([8e6fc5e](https://github.com/gorinformaticadev/Pluggor/commit/8e6fc5e4cb8791004eefd138f7ccb907d599bb56))
* **ui:** add tenant logo display in top bar ([3ac66d9](https://github.com/gorinformaticadev/Pluggor/commit/3ac66d981c95148a4d0786dabbdfb389890b5efc))
* **ui:** add top bar component and update app layout ([d4805cf](https://github.com/gorinformaticadev/Pluggor/commit/d4805cff5e689a6946a4e6d86e0cf950d4cb3087))
* **ui:** Adicionar sistema completo de notificações com interface suspensa e integração de back-end ([193c162](https://github.com/gorinformaticadev/Pluggor/commit/193c162e7c0757b0af94429e2720ab5ff09c6b34))
* **ui:** improve notification badge to display up to 99+ unread count ([dc372c4](https://github.com/gorinformaticadev/Pluggor/commit/dc372c4cc53340e15a115618f99645d5c6c374fd))
* update tenant seeding and topbar display ([f336cb3](https://github.com/gorinformaticadev/Pluggor/commit/f336cb3a9f05f2906dce16514adc55de9bd3ce49))
* UPDATE_ENGINE_V2 ([26813ee](https://github.com/gorinformaticadev/Pluggor/commit/26813eeb53af43a333e163bb19d6f60d56ea7e5a))
* **update:** Aprimoramento do processo de atualização com recursos de observabilidade e reversão ([f616150](https://github.com/gorinformaticadev/Pluggor/commit/f616150e565f0c6339c8dce4801e9b0535bc6abf))
* **update:** implement system update functionality with git integration ([2b85961](https://github.com/gorinformaticadev/Pluggor/commit/2b8596148efe834459119785b96d330a51727157))
* **update:** integrar gitReleaseBranch na lógica de verificação de atualizações ([290d55d](https://github.com/gorinformaticadev/Pluggor/commit/290d55dc19745cc3821c1657cfd55a35cc550750))
* **users:** add role restrictions to update preferences ([c43c6ad](https://github.com/gorinformaticadev/Pluggor/commit/c43c6ada0efa41b6633841e1f61562b01ce279d3))
* **users:** add user theme preferences persistence with enum validation ([8dd446a](https://github.com/gorinformaticadev/Pluggor/commit/8dd446aacddae046ca32eaa57af7dfd4dec4b25f))
* **users:** add users module and management interface ([c7df6a8](https://github.com/gorinformaticadev/Pluggor/commit/c7df6a8a0b1c4c0fe4f731b058ad565f465de954))
* **users:** Adicionando funcionalidade de desbloqueio de usuário ([496a6f2](https://github.com/gorinformaticadev/Pluggor/commit/496a6f2e1ed2c30d00fced551b04e2aa2c52de09))
* **users:** implement profile avatar upload and display ([e81f420](https://github.com/gorinformaticadev/Pluggor/commit/e81f42007af1c4a2ec05e8de0b480eea9ccb1ba9))
* versão para release/deploy com metadados ([7526cc8](https://github.com/gorinformaticadev/Pluggor/commit/7526cc8630a27a38f448fcaf7bd8766311f7df55))


### Bug Fixes

*  camada administrativa de leitura da configuração dinâmica no backend, sem escrita, sem UI e sem migrar consumidores reais. A entrega expõe GET /system/settings/panel, protegido por JWT + SUPER_ADMIN, retornando apenas chaves whitelistadas do SettingsRegistry, com valor resolvido, origem (database, env, default), metadados para a futura UI e comportamento fail-open.  Também validei Prisma e a migração em banco real, incluindo o rename da tabela legada system_settings -> update_system_settings e o cenário de restore de backup antigo. ([dfbf3ff](https://github.com/gorinformaticadev/Pluggor/commit/dfbf3ff5936a5e18db2bcdaaac41e85d685f4849))
* add module installer controller with endpoints for module upload, installation, activation, deactivation, database updates, status, uninstallation, and configuration reloading. ([de04fd1](https://github.com/gorinformaticadev/Pluggor/commit/de04fd16e5e60e13b35303132064bdc9bc949b5f))
* Add native installation, update, and deployment scripts with PM2, systemd, and Docker support for frontend and backend. ([fca2790](https://github.com/gorinformaticadev/Pluggor/commit/fca27902c4218c8e0bf1e0c5720c7a63cef9ae9b))
* add native update shell script and frontend runtime adapter for atomic release management ([fa17b0a](https://github.com/gorinformaticadev/Pluggor/commit/fa17b0a54623dba7bacc2c8f1c021049ef127365))
* Add Next.js middleware to handle authentication, route protection, and token validation. ([ac26880](https://github.com/gorinformaticadev/Pluggor/commit/ac26880e6d6c7923ec08dca66d5102953526b6df))
* add security throttler guard for advanced rate limiting, telemetry, and custom policy enforcement. ([de48c20](https://github.com/gorinformaticadev/Pluggor/commit/de48c20d77fde4931bdc5c6f677e4186e124b872))
* add system update management page and backend service support ([ac26497](https://github.com/gorinformaticadev/Pluggor/commit/ac2649723c5856c19b60d55e2445f929a6263e70))
* allow internal module install in development ([b69adfe](https://github.com/gorinformaticadev/Pluggor/commit/b69adfe9a67bc98f73b2f82704038781aa53f06a))
* **api:** correções de referencias a API ([041117c](https://github.com/gorinformaticadev/Pluggor/commit/041117cf90ee748ab5bfc24186681a14782c61b8))
* **armazenamento:** Atualização das configurações do Docker para otimizar uploads e backups ([515507a](https://github.com/gorinformaticadev/Pluggor/commit/515507aaf611cac9e2491901f7ba20df34a14476))
* **auth:** preserve trusted device cookie on logout ([ba5008a](https://github.com/gorinformaticadev/Pluggor/commit/ba5008a11739e01ba1ff12cd121347e5ecf5bc45))
* **auth:** Valida URLs de retorno de chamada e refina redirecionamentos de autenticação V2 ([09f7179](https://github.com/gorinformaticadev/Pluggor/commit/09f71796c37f00a7dc77cffaa7dfaf574b4d0179))
* **backend:** corrige caminhos de dependências e execução do Prisma no Docker ([4e0d4ac](https://github.com/gorinformaticadev/Pluggor/commit/4e0d4acbe61d66a7c226fb10df47aad3fd0d176e))
* **backend:** corrige estrutura de diretórios e caminhos de dependências no Docker ([f96d377](https://github.com/gorinformaticadev/Pluggor/commit/f96d377f4822f6f2b017d4575a3aa2f38a043c06))
* **backend:** corrige healthcheck, entrypoint e Dockerfile do backend ([e6f52e5](https://github.com/gorinformaticadev/Pluggor/commit/e6f52e51937adb74506bce4c648710bef0d2f30b))
* **backend:** corrigir nome de método incorreto no UpdateController ([2caed20](https://github.com/gorinformaticadev/Pluggor/commit/2caed20eb0aea52a688a747f429ac4917776aa2d))
* **backend:** remoção de import inexistente ([e014c6e](https://github.com/gorinformaticadev/Pluggor/commit/e014c6e37bb255b3cb0031174357565596ba19ff))
* **backend:** remove no-explicit-any warnings ([6a15f72](https://github.com/gorinformaticadev/Pluggor/commit/6a15f722c992a9c2f8b1cfe54cc06ae356036393))
* **backend:** simplifica Dockerfile para evitar erros de build no CI/CD ([97d0e91](https://github.com/gorinformaticadev/Pluggor/commit/97d0e91101022d87e42f8ed21fc5d7d53fc62fc8))
* **backup:** Adiciona suporte para configuração de banco de dados administrativo e melhorias na recuperação de status ([c701e67](https://github.com/gorinformaticadev/Pluggor/commit/c701e67d9a82002a7c193172ea3f3bdef08feaa2))
* **backup:** Aprimoramento da funcionalidade de backup/restauração com inspeção rigorosa de uploads e tipos de objetos bloqueados ([9714773](https://github.com/gorinformaticadev/Pluggor/commit/971477327589b817122ab9c52e99531f87505ba6))
* **backup:** Aprimoramento das funcionalidades de backup e restauração com novas variáveis ​​de ambiente e melhorias na API interna ([b09dc37](https://github.com/gorinformaticadev/Pluggor/commit/b09dc3751571f2cdaec630aa42a9ea7a45c251e8))
* **backup:** Erro ao restaurar backup ([78983f2](https://github.com/gorinformaticadev/Pluggor/commit/78983f2efeb5200463f2280bafa38264b156094a))
* cc ([d594f27](https://github.com/gorinformaticadev/Pluggor/commit/d594f27fcb01f38c14cb5019bc293c253ff60781))
* cores dos campos d elogin esenha, item repetido no menu de usuário, atalho para acessar os logs ([6b3668a](https://github.com/gorinformaticadev/Pluggor/commit/6b3668ae2f2f827ad4ec9d63be3c7a2e3ee0b523))
* Cores para tema escuro ([cd166b3](https://github.com/gorinformaticadev/Pluggor/commit/cd166b307e012cff443ba53b6b1edcd608715bc5))
* correção da topbar ([2d51b7c](https://github.com/gorinformaticadev/Pluggor/commit/2d51b7c8ed13a5ee7b2875c43f1949766cae2adb))
* Correção de updates ([c0f97d3](https://github.com/gorinformaticadev/Pluggor/commit/c0f97d3e454138dd4471c2fec0dcd59f007ab16b))
* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))
* correçeos de cores ([0503f2f](https://github.com/gorinformaticadev/Pluggor/commit/0503f2f8e7969b3b23877a232e38fa2de8d415a4))
* Correções de email e tualização de sistema ([8d3af9e](https://github.com/gorinformaticadev/Pluggor/commit/8d3af9ee7057ec853d503424644d5b63b6e0f48c))
* correções de rede, vhost e roteamento para instalação Docker ([67115b7](https://github.com/gorinformaticadev/Pluggor/commit/67115b7b7d197a5a00c20f9e32ff7b3a144ea289))
* Corrige erro 502 - permissões de diretórios e migrações do Prisma ([fdd6c3d](https://github.com/gorinformaticadev/Pluggor/commit/fdd6c3dfbbabf5eb082024d640ebe75733f5b3e9))
* corrige erro 502 Bad Gateway e mapeamento de portas ([aab72c1](https://github.com/gorinformaticadev/Pluggor/commit/aab72c1606ceda8fc47905417979a33c7529d64d))
* Corrige erro de formato no docker rmi e melhora limpeza de diretório ([873f8ce](https://github.com/gorinformaticadev/Pluggor/commit/873f8ce9ba03be299cc50cbeac12021c0f89b2c2))
* corrige erro de tag inválida no Docker e variáveis de ambiente ausentes ([0764306](https://github.com/gorinformaticadev/Pluggor/commit/07643066520e83c55a7bc6ae2bcd5652b5725d66))
* corrigir build pnpm, socket.io e script de atualização ([05146d2](https://github.com/gorinformaticadev/Pluggor/commit/05146d2a9a6975f72ef216a3eb62acd4b169182f))
* corrigisdo para um sistema robusto, persistente e distribuído de gerenciamento de tarefas cron, com recursos de monitoramento (watchdog) e pulsação (heartbeat). ([ba57161](https://github.com/gorinformaticadev/Pluggor/commit/ba57161368920c68575f084d6b13192371f8d816))
* **cron:** implement database-backed execution leasing ([d41d801](https://github.com/gorinformaticadev/Pluggor/commit/d41d801dd974f62a88041db0d4959a9c43e5a5df))
* crons e agendamentos ([c78f489](https://github.com/gorinformaticadev/Pluggor/commit/c78f4895acc755d58410056924448d65bbd19147))
* **dashboard:** alinhar acoes rapidas com intents dos widgets ([138c56a](https://github.com/gorinformaticadev/Pluggor/commit/138c56a25d009625036eefeac9a1462af8f82e2c))
* **DB:** Install e migrations ([1368a9c](https://github.com/gorinformaticadev/Pluggor/commit/1368a9c92988c462d326477b94562e286c97d8ad))
* **diversos:** corrções ([65f9115](https://github.com/gorinformaticadev/Pluggor/commit/65f91154e037e6b23c4572e53d13bd0f8c095daf))
* elimina definitivamente erro de tag inválida no Docker ([55e5d61](https://github.com/gorinformaticadev/Pluggor/commit/55e5d618842450efac7199ca1ebc282456ca73a9))
* Empacotamento do frontend standalone ([2cd55fe](https://github.com/gorinformaticadev/Pluggor/commit/2cd55fe22fc9fe945ce4570667b393a305651a0e))
* endurece pipeline e lifecycle do sistema de modulos ([5b2262b](https://github.com/gorinformaticadev/Pluggor/commit/5b2262b31cc8c018e7b36920f5f2582b828a40f1))
* **env:** Atualização dos caminhos de upload nos arquivos de configuração ([0f5dc32](https://github.com/gorinformaticadev/Pluggor/commit/0f5dc32aa4d36aa14ccfe27b23f27d81c9d9b864))
* **frontend:** Correção de loop infinito ao trocar senha ([b454db5](https://github.com/gorinformaticadev/Pluggor/commit/b454db57f7c9f8cbcd350758519862034c66ce82))
* Garante injeção de variáveis de admin no comando de seed ([f99c8ab](https://github.com/gorinformaticadev/Pluggor/commit/f99c8ab5bd3365e1fc33c47893f92fc5fc4fb417))
* Habilita seeds automáticos e configura usuário admin personalizado ([3d101cc](https://github.com/gorinformaticadev/Pluggor/commit/3d101cc10ec2a7fa18347e6b69138ec464fc1dd6))
* Implement AuthContext for managing user authentication, login, logout, and two-factor authentication. ([619a330](https://github.com/gorinformaticadev/Pluggor/commit/619a3304ece05cf1493caccf31f5ace3b10930ee))
* implement PlatformConfigContext to manage and provide platform configuration with caching and error handling. ([28944fb](https://github.com/gorinformaticadev/Pluggor/commit/28944fb88bb920f46a4598c52a2ba3d415814b8f))
* Implementar um serviço de backend para gerenciamento completo de tenants, incluindo a criação de usuários administradores e a vinculação de módulos, e criar um componente TopBar para o frontend. ([314d187](https://github.com/gorinformaticadev/Pluggor/commit/314d187a5aada404a4a9bf061156e427b307ebfc))
* Implementar um sistema de monitoramento de tarefas agendadas (cron jobs) e introduzir um serviço de limpeza de tokens. ([63e1897](https://github.com/gorinformaticadev/Pluggor/commit/63e1897ba8eb9788128fee6815e0d90ec3765aa0))
* Implemente limitação de taxa de segurança dinâmica e configurável com uma nova página de configuração de front-end. ([6ea1997](https://github.com/gorinformaticadev/Pluggor/commit/6ea1997d4cf1c5909d5ff0a9ee248d1c16aea782))
* Implemente o `SecurityThrottlerGuard` para aplicar limites de taxa dinâmicos com base no status de autenticação do usuário e no ambiente. ([9512d83](https://github.com/gorinformaticadev/Pluggor/commit/9512d83e0cc795be26ec84772158e748ebef49f7))
* **instalador:** Correção na atualização de modulos já instalados ([c6377cf](https://github.com/gorinformaticadev/Pluggor/commit/c6377cf0bd254853a5b3151d3a0ef9f12f91920a))
* **install:** avoid prisma generate at runtime and setup ([2a1b375](https://github.com/gorinformaticadev/Pluggor/commit/2a1b375f885b11a32814da12a7dca35eb32251ae))
* **install:** correção de instalador ([8733cff](https://github.com/gorinformaticadev/Pluggor/commit/8733cff91a54d61f0bf39af3b9bacb0baaf8c109))
* **install:** corrigir detecção de diretório no script update.sh ([46c6214](https://github.com/gorinformaticadev/Pluggor/commit/46c6214aea5e3abd724909c08f05edc52efdcc11))
* **install:** Refatoração do script de configuração para suportar nginx-proxy e acme-companion ([7e6a461](https://github.com/gorinformaticadev/Pluggor/commit/7e6a461fe247176df1b7da1714dc2d84544aa2f0))
* **install:** run seed via ts-node to avoid prisma auto-install ([ab32d3a](https://github.com/gorinformaticadev/Pluggor/commit/ab32d3abfda1b1cb04227a1e82299b9f4c3c5a22))
* **lockfile:** align backend tsx version with pnpm lock ([0442009](https://github.com/gorinformaticadev/Pluggor/commit/044200927c6141d390f55a5499a3130082ac1be2))
* **menu de usuario:** perfil/senha não salvavam ([7df497c](https://github.com/gorinformaticadev/Pluggor/commit/7df497c1c7cac1c9f6094d76ecb55306d575627a))
* **module-registry:** Implementar a geração de itens da barra de tarefas e do menu do usuário ([826d376](https://github.com/gorinformaticadev/Pluggor/commit/826d376f229c15ee7a614f505e0dc71bdf533030))
* **modules:** Adicionar sistema de migração de módulos com controle de versão do banco de dados ([9e7aacc](https://github.com/gorinformaticadev/Pluggor/commit/9e7aacc75e1827c4b8c26b845cd7176c74a3707e))
* **modules:** correção de falta de tabela dos modulos ([306da43](https://github.com/gorinformaticadev/Pluggor/commit/306da43f475368eed6f912d77ef835b18a34b7dc))
* **modules:** Correção para modulo autonomo , ser registrado no banco pelo instalador ([e2ea32d](https://github.com/gorinformaticadev/Pluggor/commit/e2ea32d3f31ced77f3d6029e432ed6dfa6bbc361))
* **modules:** Correções de modulos ([fc3590d](https://github.com/gorinformaticadev/Pluggor/commit/fc3590db2d5682fa48713bd9bc0518f96eea3ab9))
* **modules:** correct update database endpoint and migration folder ([5c9ca12](https://github.com/gorinformaticadev/Pluggor/commit/5c9ca12f82602ee96fc361723396808a3a320a1a))
* **modules:** enable toggle functionality for tenant modules ([c9b31d5](https://github.com/gorinformaticadev/Pluggor/commit/c9b31d5b8e86d8b366444049e92d43cd7a82ab01))
* **modules:** simplify dynamic module loader and enforce strict path conventions ([7778975](https://github.com/gorinformaticadev/Pluggor/commit/777897554191cbc3de3519fe65e50a2792ea0fd6))
* **mojibake:** correção de texto quebrados com caracteres inválidos ([d21a911](https://github.com/gorinformaticadev/Pluggor/commit/d21a91184e35faeebd996fc521232b04d72720d3))
* **mojibake:** correção de texto quebrados com caracteres inválidos ([620c12a](https://github.com/gorinformaticadev/Pluggor/commit/620c12a98dc4343c2d2a566732ae73033067c144))
* **notificacoes:** simplificar sino e mover filtros para central ([bc5a8ae](https://github.com/gorinformaticadev/Pluggor/commit/bc5a8ae60f94514aaad59154deac291e0185f43e))
* **notifications:** re-enable real-time notifications with direct WebSocket authentication ([3d05808](https://github.com/gorinformaticadev/Pluggor/commit/3d05808ce913c99922b28e324064a1d5dd47f82c))
* **ops:** reduce bootstrap noise in operational alerts ([d330f77](https://github.com/gorinformaticadev/Pluggor/commit/d330f77b7b9f47da25258a53c13cbb7cf22ee19d))
* **ordens:** corrige validacao de arrays e uploads por OS no backend ([03546f3](https://github.com/gorinformaticadev/Pluggor/commit/03546f329d86ab3dc1fd4dd70e46c5d092c3f387))
* padroniza secrets Docker Hub ([fdce607](https://github.com/gorinformaticadev/Pluggor/commit/fdce607b6db11205fb63239474b96aa4026b81b1))
* permite que update-acme funcione em diretórios sem .git ([e666030](https://github.com/gorinformaticadev/Pluggor/commit/e6660304fd70b6535502601d801f4e015ed2fecf))
* **prisma:** migrate datasource URL to prisma.config.ts (Prisma 7) ([c9a4885](https://github.com/gorinformaticadev/Pluggor/commit/c9a4885356e925738376c8047d2e8e05a2aabce7))
* **pwa:** Pwa fullscreen ([03b813b](https://github.com/gorinformaticadev/Pluggor/commit/03b813bd344d688e657d13c3f0c62d8311201c22))
* Recuperação de senhas ([b2be406](https://github.com/gorinformaticadev/Pluggor/commit/b2be406183b5467c61074bbc9229483c3ba264f0))
* remoção de hasrdcoded de cores ([762b106](https://github.com/gorinformaticadev/Pluggor/commit/762b106815ceca9bfe28b35763409c0fc764e736))
* remove invalid prisma.config.js and update entrypoint ([c1d263f](https://github.com/gorinformaticadev/Pluggor/commit/c1d263f77474f86671b2d7d5ba44281c942663a6))
* remove redundant lockfiles and workspace configs from apps ([8c11851](https://github.com/gorinformaticadev/Pluggor/commit/8c118511bdf3c6c28c56d7c86fcbeec9936cbdd8))
* resolve conflito no .gitignore após merge da CI ([3065439](https://github.com/gorinformaticadev/Pluggor/commit/30654391339c1e76175a4b7b284066ff34fca9b3))
* resolve ERR_SSL_UNRECOGNIZED_NAME_ALERT ([c708434](https://github.com/gorinformaticadev/Pluggor/commit/c7084340ffb214f51f566b04a30dc88c8354f6f0))
* Resolve erro 403 e melhora extração de host no banco de dados ([aedb40b](https://github.com/gorinformaticadev/Pluggor/commit/aedb40b3b8977e912204e203356f512860f3ef16))
* resolve erro 502 Bad Gateway garantindo conectividade multi-rede ([2b1a289](https://github.com/gorinformaticadev/Pluggor/commit/2b1a289449240d395e1c960d171d18e620e1d561))
* resolve erro 502 Bad Gateway no modo Nginx Interno ([6a489fb](https://github.com/gorinformaticadev/Pluggor/commit/6a489fba90781e3dbaaffb131f12411d4650529e))
* resolve erro de pull access denied e limpa avisos do docker compose ([e290312](https://github.com/gorinformaticadev/Pluggor/commit/e2903123f754b50eeb1c3ca43df4ed454bd78eb4))
* resolve falha na emissão de certificados SSL ([07e4a2f](https://github.com/gorinformaticadev/Pluggor/commit/07e4a2ff3e5b875410da502424e597941a8e634c))
* Resolve falha no seed e melhora performance de inicialização ([a7a2638](https://github.com/gorinformaticadev/Pluggor/commit/a7a2638396e30728b69620bd34055834b7633ec2))
* **routing:** Centraliza o gerenciamento de rotas e aprimora o fluxo de autenticação v1 ([8b49207](https://github.com/gorinformaticadev/Pluggor/commit/8b4920783747469ef442362c53a11f59cf955966))
* **security-config:** Imposição de políticas de segurança dinâmicas ([47c6f71](https://github.com/gorinformaticadev/Pluggor/commit/47c6f712189c86ffee8ce20a1bdc451e30a5d413))
* **security-config:** restore web push config endpoints ([00f6fd4](https://github.com/gorinformaticadev/Pluggor/commit/00f6fd4aced95dfdfbcdd8081c618932ae699176))
* **security:** enhance input sanitization and encryption security ([04f9a09](https://github.com/gorinformaticadev/Pluggor/commit/04f9a096f84e554a63ed456ba6d69b77054c3318))
* **seed:** execute seed with ts-node-esm in install flow ([30cb39f](https://github.com/gorinformaticadev/Pluggor/commit/30cb39f9a5cf8a203784b842c40cb7d1adfb4e18))
* **seed:** load seed.ts via ts-node register require hook ([777ca92](https://github.com/gorinformaticadev/Pluggor/commit/777ca9255c14819ab36d1d6f8e3470c1d7f92582))
* **seed:** run seed via node -r ts-node/register ([8c69529](https://github.com/gorinformaticadev/Pluggor/commit/8c695296a5ca520e7f38d8d98d830437a5fef8db))
* **seed:** run ts-node from backend workspace path ([b88b51f](https://github.com/gorinformaticadev/Pluggor/commit/b88b51f68082460f6182560ea1877e368493e4ad))
* **seed:** switch install seed execution to tsx ([48cf330](https://github.com/gorinformaticadev/Pluggor/commit/48cf3306ba8008ad948fe5e063b80e7234c9a9ce))
* **segurança:** Inicializar a aplicação backend NestJS com módulos principais, configurações de segurança, gerenciamento de segredos e integração com o Sentry. ([fa8f4b0](https://github.com/gorinformaticadev/Pluggor/commit/fa8f4b05677f228c1f8f1f0a5e009ac966e4636b))
* **segurança:** melhore a segurança com armazenamento criptografado de dados confidenciais ([aba42d2](https://github.com/gorinformaticadev/Pluggor/commit/aba42d28e79b7f2e047d37871837dd0b62f6a0ff))
* **sistema:** Introduce email configuration management with a dedicated UI and backend API, alongside new core UI components and cron job management. ([892eba7](https://github.com/gorinformaticadev/Pluggor/commit/892eba7a57883557c64765d605ae8ee0e93773b8))
* **socket:** Correção de erro de socket ([478842f](https://github.com/gorinformaticadev/Pluggor/commit/478842f41577791061a40dca4d0d0bc934d52782))
* **socket:** habilitar suporte a WebSocket/Socket.IO nos templates do Nginx e gateway ([33178ba](https://github.com/gorinformaticadev/Pluggor/commit/33178bae743630f263f77a66e82c320e6797dcee))
* **telemetry:** reduce dashboard route noise ([41cf59f](https://github.com/gorinformaticadev/Pluggor/commit/41cf59f565ad865e6a06c1069f0902c824be57ae))
* **topbar:** implementação da barra de pesquisa que não tinha função ([f48b80f](https://github.com/gorinformaticadev/Pluggor/commit/f48b80f7f742cbec06aceb38f80776b692cf4e53))
* Torna prompt do Docker Hub opcional no instalador ([3fd4b77](https://github.com/gorinformaticadev/Pluggor/commit/3fd4b77dba8283ae60f91a19a3fe0a0e438ee590))
* update pnpm-lock.yaml to match package.json dependencies ([184bb7a](https://github.com/gorinformaticadev/Pluggor/commit/184bb7a678eb17cf6945b1871635ccb5ad09e626))
* **update:** adicionar campo updateChannel ao schema e remover casts de tipo ([9e7b7ac](https://github.com/gorinformaticadev/Pluggor/commit/9e7b7ac459ab5dc8677451d12a84229f29d74f6f))
* **update:** alinhar status real do update da plataforma ([dcbce51](https://github.com/gorinformaticadev/Pluggor/commit/dcbce51b37b95d6781b19651d0051042c4989b58))
* **update:** auditar e corrigir sistema de atualizações com suporte a canais e autenticação ([fbf912a](https://github.com/gorinformaticadev/Pluggor/commit/fbf912a86e248398a7da4f28e75052937cf31f89))
* **update:** correção de update ([2b6b695](https://github.com/gorinformaticadev/Pluggor/commit/2b6b695111a8fbd215e2aff5a1451617faa94b19))
* **update:** Corrigida a funcionalidade de recuperação de configuração e aprimorado o tratamento de atualizações de configuração. ([e1342a7](https://github.com/gorinformaticadev/Pluggor/commit/e1342a70cdd199ff2832860d1344a16524f3ec26))
* **update:** flexibilizar validação de DTO e adicionar logs de erro na persistência ([31f25a4](https://github.com/gorinformaticadev/Pluggor/commit/31f25a46f94b2bba02b2eb65045fdfe5c58f7a3f))
* **update:** remover interface ExtendedUpdateSystemSettings e usar tipos do Prisma ([eb5ee4a](https://github.com/gorinformaticadev/Pluggor/commit/eb5ee4a9f5ac2efb57f32e8252145dc214a06733))
* **update:** tornar o sistema de configurações resiliente a colunas ausentes no banco ([b4c9cbc](https://github.com/gorinformaticadev/Pluggor/commit/b4c9cbc818218ce46f48f9666ffa5e9937062873))
* **update:** update native ([04861c8](https://github.com/gorinformaticadev/Pluggor/commit/04861c8ca4e422c77c286687f92dcdf479ec102d))
* **usuarios:** Correção da pagina de usuários ([db83602](https://github.com/gorinformaticadev/Pluggor/commit/db8360219fb4d8f3f80706e28c241af19d86d350))
* **warn:** correção de warn do backend ([c5415f9](https://github.com/gorinformaticadev/Pluggor/commit/c5415f93483415afc0b720b05482381945f6501c))
* **warn:** fix warn backend ([24da33e](https://github.com/gorinformaticadev/Pluggor/commit/24da33e25ef1eec982a27b31e37ff2f070b3cf5c))


### update

* **Core:** migrate ordem_servico to module-os, update sync scripts, and add UI components ([8d97dde](https://github.com/gorinformaticadev/Pluggor/commit/8d97ddeac04c3df18362d5cefffeb89ab365f46d))


* notificações ([9c973a1](https://github.com/gorinformaticadev/Pluggor/commit/9c973a12fe84729280fe719b500edf12023c01c6))
* Reordenação ([5e59174](https://github.com/gorinformaticadev/Pluggor/commit/5e59174ab7ae50b0a0c5c6185ae506d698ecbace))
* **backend:** reorganize codebase with path aliases and modular structure ([ea68481](https://github.com/gorinformaticadev/Pluggor/commit/ea684814c2ca7b5e58f40450956548292899a513))
* **backend:** upgrade Prisma to v7.2.0 with adapter support ([a19f832](https://github.com/gorinformaticadev/Pluggor/commit/a19f8329b46de332a2c48449a8d5ab5f8d4c5c33))
* **core/frontend:** migrate to new module registry system ([a9154f4](https://github.com/gorinformaticadev/Pluggor/commit/a9154f4f3960a4f788ea6a399ff3f50700ea82dc))
* **db:** switch sistema notification queries to raw SQL ([680a9d1](https://github.com/gorinformaticadev/Pluggor/commit/680a9d168d3fcd7ee613b6d9876aa75decda742c))
* **demo-completo:** update components to use next/navigation router ([495417a](https://github.com/gorinformaticadev/Pluggor/commit/495417ad42952eba965e9a63437cf89ff2d7d2e8))
* **frontend:** downgrade Next.js to 15.1.11 and adapt async params ([11a4530](https://github.com/gorinformaticadev/Pluggor/commit/11a45302b71b9030e36835771b80293c6ef54943))
* **modules:** enhance installer robustness and temporarily disable sistema module ([942526d](https://github.com/gorinformaticadev/Pluggor/commit/942526d7d287b99b557d48014e20a53c51c20648))
* **modules:** migrate to secure backend-controlled module system ([ca74d18](https://github.com/gorinformaticadev/Pluggor/commit/ca74d1840f162aeb0ec9c8604faec22df61339ff))
* **modules:** relocate sistema module to new directory structure ([6993882](https://github.com/gorinformaticadev/Pluggor/commit/699388238ba23946ef751c1eca7477eeab01955e))
* **sistema:** restructure module to external components and update UI framework ([79b238e](https://github.com/gorinformaticadev/Pluggor/commit/79b238e33448a74e653d618d6828577979874668))


### build

* **backend:** update NestJS to v11 and Sentry to v8, remove profiling ([63659a6](https://github.com/gorinformaticadev/Pluggor/commit/63659a6378f692e531ad818c45c75e14aa8dee55))
* **frontend:** migrate configs to ES modules and update Next.js ([a570753](https://github.com/gorinformaticadev/Pluggor/commit/a570753d5313a3e7d70d30ad959423a3a0b91af8))

### [0.1.117](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.116...v0.1.117) (2026-03-30)

### [0.1.116](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.115...v0.1.116) (2026-03-30)

### [0.1.115](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.114...v0.1.115) (2026-03-30)

### [0.1.114](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.113...v0.1.114) (2026-03-30)


### Features

* implement system version tracking utility and API endpoints with frontend hooks ([ca6c49b](https://github.com/gorinformaticadev/Pluggor/commit/ca6c49b6c8f214255209d4df5a313c456d5975f8))

### [0.1.113](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.112...v0.1.113) (2026-03-29)

### [0.1.112](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.111...v0.1.112) (2026-03-29)

### [0.1.111](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.110...v0.1.111) (2026-03-29)

### [0.1.110](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.109...v0.1.110) (2026-03-29)

### [0.1.109](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.108...v0.1.109) (2026-03-29)


### Bug Fixes

* Empacotamento do frontend standalone ([2cd55fe](https://github.com/gorinformaticadev/Pluggor/commit/2cd55fe22fc9fe945ce4570667b393a305651a0e))

### [0.1.108](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.107...v0.1.108) (2026-03-29)

### [0.1.107](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.106...v0.1.107) (2026-03-29)


### Bug Fixes

* add native update shell script and frontend runtime adapter for atomic release management ([fa17b0a](https://github.com/gorinformaticadev/Pluggor/commit/fa17b0a54623dba7bacc2c8f1c021049ef127365))

### [0.1.106](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.105...v0.1.106) (2026-03-29)

### [0.1.105](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.104...v0.1.105) (2026-03-29)


### Features

* implement update service, controller, and unit tests for system version management ([c9759ab](https://github.com/gorinformaticadev/Pluggor/commit/c9759aba797d7d587063f9a3e7b4214aa71cd35f))

### [0.1.104](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.103...v0.1.104) (2026-03-29)

### [0.1.103](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.102...v0.1.103) (2026-03-29)

### [0.1.102](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.101...v0.1.102) (2026-03-29)


### Bug Fixes

* add system update management page and backend service support ([ac26497](https://github.com/gorinformaticadev/Pluggor/commit/ac2649723c5856c19b60d55e2445f929a6263e70))

### [0.1.101](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.100...v0.1.101) (2026-03-29)

### [0.1.100](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.99...v0.1.100) (2026-03-29)


### Features

* implement system job watchdog and cron update services with associated unit tests ([aed8528](https://github.com/gorinformaticadev/Pluggor/commit/aed852847347fa17d5ff169024e4dfca20d69ab5))

### [0.1.99](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.98...v0.1.99) (2026-03-29)


### Features

* implement native and docker update runtime adapters and core execution services ([f8d5507](https://github.com/gorinformaticadev/Pluggor/commit/f8d5507a9e684c53e12d85f3c3876a343fe9471d))

### [0.1.98](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.97...v0.1.98) (2026-03-29)


### Features

* implement system update engine with agent runner and command execution services ([5457ac9](https://github.com/gorinformaticadev/Pluggor/commit/5457ac9cc1ab5096dbb3390e32fc673ef229f765))

### [0.1.97](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.96...v0.1.97) (2026-03-29)

### [0.1.96](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.95...v0.1.96) (2026-03-29)


### Features

* UPDATE_ENGINE_V2 ([26813ee](https://github.com/gorinformaticadev/Pluggor/commit/26813eeb53af43a333e163bb19d6f60d56ea7e5a))

### [0.1.95](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.94...v0.1.95) (2026-03-29)

### [0.1.94](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.93...v0.1.94) (2026-03-29)

### [0.1.93](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.92...v0.1.93) (2026-03-29)

### [0.1.92](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.91...v0.1.92) (2026-03-29)

### [0.1.91](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.90...v0.1.91) (2026-03-29)

### [0.1.90](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.89...v0.1.90) (2026-03-29)

### [0.1.89](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.88...v0.1.89) (2026-03-29)

### [0.1.87](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.88...v0.1.87) (2026-03-29)

### [0.1.86](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.85...v0.1.86) (2026-03-28)


### Bug Fixes

* **backend:** remove no-explicit-any warnings ([6a15f72](https://github.com/gorinformaticadev/Pluggor/commit/6a15f722c992a9c2f8b1cfe54cc06ae356036393))

### [0.1.85](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.84...v0.1.85) (2026-03-27)

### [0.1.84](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.83...v0.1.84) (2026-03-27)

### [0.1.83](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.83) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.82](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.82) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.81](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.81) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.80](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.80) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.79](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.79) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.78](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.78) (2026-03-27)


### Bug Fixes

* Correção do git ci/cD ([9ef053c](https://github.com/gorinformaticadev/Pluggor/commit/9ef053c5eeab41b72eb97d3bed480289fa4e2068))

### [0.1.81](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.80...v0.1.81) (2026-03-26)

### [0.1.80](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.79...v0.1.80) (2026-03-25)

### [0.1.79](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.78...v0.1.79) (2026-03-25)

### [0.1.78](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.77...v0.1.78) (2026-03-25)

### [0.1.77](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.76...v0.1.77) (2026-03-25)

### [0.1.76](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.75...v0.1.76) (2026-03-25)

### [0.1.75](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.74...v0.1.75) (2026-03-25)

### [0.1.74](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.73...v0.1.74) (2026-03-25)


### Bug Fixes

* Correções de email e tualização de sistema ([8d3af9e](https://github.com/gorinformaticadev/Pluggor/commit/8d3af9ee7057ec853d503424644d5b63b6e0f48c))

### [0.1.73](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.72...v0.1.73) (2026-03-25)


### Bug Fixes

* Add native installation, update, and deployment scripts with PM2, systemd, and Docker support for frontend and backend. ([fca2790](https://github.com/gorinformaticadev/Pluggor/commit/fca27902c4218c8e0bf1e0c5720c7a63cef9ae9b))

### [0.1.72](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.71...v0.1.72) (2026-03-25)


### Bug Fixes

* Recuperação de senhas ([b2be406](https://github.com/gorinformaticadev/Pluggor/commit/b2be406183b5467c61074bbc9229483c3ba264f0))

### [0.1.71](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.70...v0.1.71) (2026-03-25)


### Features

* Implementar funcionalidades de atualização do sistema, fluxos de redefinição de senha e serviços de e-mail. ([e82004a](https://github.com/gorinformaticadev/Pluggor/commit/e82004acc12905e57b66da98550c9f66d15a90b2))

### [0.1.70](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.69...v0.1.70) (2026-03-25)


### Bug Fixes

* **auth:** preserve trusted device cookie on logout ([ba5008a](https://github.com/gorinformaticadev/Pluggor/commit/ba5008a11739e01ba1ff12cd121347e5ecf5bc45))

### [0.1.69](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.68...v0.1.69) (2026-03-24)

### [0.1.68](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.67...v0.1.68) (2026-03-24)

### [0.1.67](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.66...v0.1.67) (2026-03-24)

### [0.1.66](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.64...v0.1.66) (2026-03-24)

### [0.1.65](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.64...v0.1.65) (2026-03-24)

### [0.1.63](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.64...v0.1.63) (2026-03-24)

### [0.1.62](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.61...v0.1.62) (2026-03-24)

### [0.1.61](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.60...v0.1.61) (2026-03-24)

### [0.1.60](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.59...v0.1.60) (2026-03-24)

### [0.1.59](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.58...v0.1.59) (2026-03-24)

### [0.1.58](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.57...v0.1.58) (2026-03-24)

### [0.1.57](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.56...v0.1.57) (2026-03-24)

### [0.1.56](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.55...v0.1.56) (2026-03-24)

### [0.1.54](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.55...v0.1.54) (2026-03-24)

### [0.1.53](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.52...v0.1.53) (2026-03-24)


### Bug Fixes

* **update:** tornar o sistema de configurações resiliente a colunas ausentes no banco ([b4c9cbc](https://github.com/gorinformaticadev/Pluggor/commit/b4c9cbc818218ce46f48f9666ffa5e9937062873))

### [0.1.42](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.43...v0.1.42) (2026-03-22)


### Features

* **cron:** implement materialized job execution mode ([dba883b](https://github.com/gorinformaticadev/Pluggor/commit/dba883b7ed4556ab4a95984632f129f48cf278f8))

### [0.1.41](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.42...v0.1.41) (2026-03-22)

### [0.1.40](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.39...v0.1.40) (2026-03-22)


### Features

* **users:** implement profile avatar upload and display ([e81f420](https://github.com/gorinformaticadev/Pluggor/commit/e81f42007af1c4a2ec05e8de0b480eea9ccb1ba9))

### [0.1.38](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.39...v0.1.38) (2026-03-22)


### Features

* **users:** implement profile avatar upload and display ([e81f420](https://github.com/gorinformaticadev/Pluggor/commit/e81f42007af1c4a2ec05e8de0b480eea9ccb1ba9))

### [0.1.37](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.36...v0.1.37) (2026-03-18)


### Bug Fixes

* Implementar um sistema de monitoramento de tarefas agendadas (cron jobs) e introduzir um serviço de limpeza de tokens. ([63e1897](https://github.com/gorinformaticadev/Pluggor/commit/63e1897ba8eb9788128fee6815e0d90ec3765aa0))

### [0.1.36](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.35...v0.1.36) (2026-03-18)


### Bug Fixes

* Add Next.js middleware to handle authentication, route protection, and token validation. ([ac26880](https://github.com/gorinformaticadev/Pluggor/commit/ac26880e6d6c7923ec08dca66d5102953526b6df))
* corrigisdo para um sistema robusto, persistente e distribuído de gerenciamento de tarefas cron, com recursos de monitoramento (watchdog) e pulsação (heartbeat). ([ba57161](https://github.com/gorinformaticadev/Pluggor/commit/ba57161368920c68575f084d6b13192371f8d816))
* Implement AuthContext for managing user authentication, login, logout, and two-factor authentication. ([619a330](https://github.com/gorinformaticadev/Pluggor/commit/619a3304ece05cf1493caccf31f5ace3b10930ee))

### [0.1.35](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.34...v0.1.35) (2026-03-18)


### Bug Fixes

* **frontend:** Correção de loop infinito ao trocar senha ([b454db5](https://github.com/gorinformaticadev/Pluggor/commit/b454db57f7c9f8cbcd350758519862034c66ce82))

### [0.1.34](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.32...v0.1.34) (2026-03-18)

### [0.1.33](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.32...v0.1.33) (2026-03-18)

### [0.1.32](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.31...v0.1.32) (2026-03-18)

### [0.0.3](https://github.com/gorinformaticadev/Pluggor/compare/v0.1.30...v0.0.3) (2026-03-18)


### Features

* **auth:** Implementação de autenticação robusta baseada em cookies e inscrição em 2FA ([89bc7dd](https://github.com/gorinformaticadev/Pluggor/commit/89bc7dd4a3aa366e59106127a200ea130f40a057))

### [1.2.2](https://github.com/gorinformaticadev/Pluggor/compare/v1.2.1...v1.2.2) (2026-02-21)


### Bug Fixes

* **DB:** correção de falhas se migrate ja existe ([5566a56](https://github.com/gorinformaticadev/Pluggor/commit/5566a566a5a3e056401d127a0c00b25d35a5a4f2))
* **front:** correções ([359b42b](https://github.com/gorinformaticadev/Pluggor/commit/359b42bc0526f6aa0468752caca410182d22d762))
* **install:** correções ([c191388](https://github.com/gorinformaticadev/Pluggor/commit/c19138831d6267aaee8b91756637fb10c6f09b13))

### [1.2.1](https://github.com/gorinformaticadev/Pluggor/compare/v1.2.0...v1.2.1) (2026-02-20)


### Bug Fixes

* **backend:** corrige estrutura de diretórios e caminhos de dependências no Docker ([f96d377](https://github.com/gorinformaticadev/Pluggor/commit/f96d377f4822f6f2b017d4575a3aa2f38a043c06))

## [1.2.0](https://github.com/gorinformaticadev/Pluggor/compare/v1.1.0...v1.2.0) (2026-02-20)


### Features

* **docs:** Documentação de instalação ([845892f](https://github.com/gorinformaticadev/Pluggor/commit/845892fd370d0c935a49a85cb55933c7799563c5))


### Bug Fixes

* **backend:** corrige caminhos de dependências e execução do Prisma no Docker ([4e0d4ac](https://github.com/gorinformaticadev/Pluggor/commit/4e0d4acbe61d66a7c226fb10df47aad3fd0d176e))
* **backend:** corrige healthcheck, entrypoint e Dockerfile do backend ([e6f52e5](https://github.com/gorinformaticadev/Pluggor/commit/e6f52e51937adb74506bce4c648710bef0d2f30b))
* **backend:** simplifica Dockerfile para evitar erros de build no CI/CD ([97d0e91](https://github.com/gorinformaticadev/Pluggor/commit/97d0e91101022d87e42f8ed21fc5d7d53fc62fc8))
* **install:** correção de instalador ([8733cff](https://github.com/gorinformaticadev/Pluggor/commit/8733cff91a54d61f0bf39af3b9bacb0baaf8c109))

## [1.1.0](https://github.com/gorinformaticadev/Pluggor/compare/v3.3.0...v1.1.0) (2026-02-17)


### Features

* Add Nginx configuration templates for Docker and external deployments, an installation script, backend package setup, and documentation assets. ([f1ad514](https://github.com/gorinformaticadev/Pluggor/commit/f1ad514e2ed195f7c254335ef5334142fbe5d397))
* Implement application update service and establish multi-tenant frontend architecture. ([916ac96](https://github.com/gorinformaticadev/Pluggor/commit/916ac963fbc046dfe21dbfa72f521f776a55ccb5))
* Initialize monorepo structure with new backend and frontend applications, including dynamic module loading. ([b3b7b56](https://github.com/gorinformaticadev/Pluggor/commit/b3b7b56abe5d088c633f03f3b8f0890a203294aa))
* Introduza diretórios dedicados para `DOCS` e `Scripts`, realocando a documentação existente e adicionando extenso conteúdo novo e scripts utilitários. ([d81f386](https://github.com/gorinformaticadev/Pluggor/commit/d81f386d9c95b07acada40be0eff5321931e93c6))


### Bug Fixes

* **api:** correções de referencias a API ([041117c](https://github.com/gorinformaticadev/Pluggor/commit/041117cf90ee748ab5bfc24186681a14782c61b8))
* corrigir build pnpm, socket.io e script de atualização ([05146d2](https://github.com/gorinformaticadev/Pluggor/commit/05146d2a9a6975f72ef216a3eb62acd4b169182f))

### [3.4.1](https://github.com/gorinformaticadev/Pluggor/compare/v3.4.0...v3.4.1) (2026-02-17)

## [3.4.0](https://github.com/gorinformaticadev/Pluggor/compare/v3.3.0...v3.4.0) (2026-02-17)


### Features

* Add Nginx configuration templates for Docker and external deployments, an installation script, backend package setup, and documentation assets. ([f1ad514](https://github.com/gorinformaticadev/Pluggor/commit/f1ad514e2ed195f7c254335ef5334142fbe5d397))
* Implement application update service and establish multi-tenant frontend architecture. ([916ac96](https://github.com/gorinformaticadev/Pluggor/commit/916ac963fbc046dfe21dbfa72f521f776a55ccb5))
* Initialize monorepo structure with new backend and frontend applications, including dynamic module loading. ([b3b7b56](https://github.com/gorinformaticadev/Pluggor/commit/b3b7b56abe5d088c633f03f3b8f0890a203294aa))
* Introduza diretórios dedicados para `DOCS` e `Scripts`, realocando a documentação existente e adicionando extenso conteúdo novo e scripts utilitários. ([d81f386](https://github.com/gorinformaticadev/Pluggor/commit/d81f386d9c95b07acada40be0eff5321931e93c6))


### Bug Fixes

* **api:** correções de referencias a API ([041117c](https://github.com/gorinformaticadev/Pluggor/commit/041117cf90ee748ab5bfc24186681a14782c61b8))
* corrigir build pnpm, socket.io e script de atualização ([05146d2](https://github.com/gorinformaticadev/Pluggor/commit/05146d2a9a6975f72ef216a3eb62acd4b169182f))
