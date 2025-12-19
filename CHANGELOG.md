# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.4.0](https://github.com/gorinformatica/menu-multitenant/compare/v0.3.0...v0.4.0) (2025-12-19)


### ⚠ BREAKING CHANGES

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

### Features

* add core and modules directories with readiness documentation ([72c87b8](https://github.com/gorinformatica/menu-multitenant/commit/72c87b844f5772da9973935f75ddcbac367425e2))
* **config:** Melhorar a página de visão geral das configurações com novas seções e estatísticas ([89c3442](https://github.com/gorinformatica/menu-multitenant/commit/89c34427072ae2a23da9c20406ab95c7a8edc91e))
* **demo-completo:** add new demo-completo module ([376d2ab](https://github.com/gorinformatica/menu-multitenant/commit/376d2ab1f93167334a71ce4bc39c81e8a88359bd))
* **module:** add backend persistence for module activation states ([be6f187](https://github.com/gorinformatica/menu-multitenant/commit/be6f1870ed9d1fa0b8fb4b3eaf463b6f5daf9ae4))
* **module:** add dynamic module status updates across components ([fd74234](https://github.com/gorinformatica/menu-multitenant/commit/fd74234650689ce59bd90feb3b371680856cb0db))
* **module:** enhance module status tracking with activation history ([dfb20ff](https://github.com/gorinformatica/menu-multitenant/commit/dfb20ff34fa1950f01d4bf6969fdf149527dac05))
* **module:** extend module registry with user menu, notifications, and taskbar support ([2b383eb](https://github.com/gorinformatica/menu-multitenant/commit/2b383eb567434ba79e25d5ddb5c7468004895e02))
* **modules:** add activate and deactivate functionality to module management ([14a0b0f](https://github.com/gorinformatica/menu-multitenant/commit/14a0b0f11ee616fc65fbd18c19558b97f1038acb))
* **modules:** add automatic module loading and dynamic menus ([68c92d6](https://github.com/gorinformatica/menu-multitenant/commit/68c92d657143a299ccbdfee2fd5dfc0c3405cd61))
* **modules:** add database versioning and update management system ([99a4d17](https://github.com/gorinformatica/menu-multitenant/commit/99a4d178a54cb536433eda5cd9d20be2ac1fdc33))
* **modules:** add duplicate request prevention for module toggles ([f7589e3](https://github.com/gorinformatica/menu-multitenant/commit/f7589e37391961b5e714510779d6cb3a2a2f5b37))
* **modules:** add tenant module management system ([7dc1415](https://github.com/gorinformatica/menu-multitenant/commit/7dc14156eae52ea1ae229c0a58375595d69c1306))
* **modules:** adicionar funcionalidade de upload e gerenciamento de módulos ZIP ([85cd656](https://github.com/gorinformatica/menu-multitenant/commit/85cd656c301ad239f6e68bf8b049a22af84578ad))
* **modules:** Aprimorar o upload de módulos com melhoria no manuseio de arquivos e na interface do usuário ([8a8eeec](https://github.com/gorinformatica/menu-multitenant/commit/8a8eeec62600c7817a8746fedbe46731692b522b))
* **modules:** Desativar módulos por padrão para novos locatários ([9049296](https://github.com/gorinformatica/menu-multitenant/commit/9049296f6804f6d5d2045b50bf5a810c7ad1a3d5))
* **modules:** enable dynamic module loading and add dependencies ([bf22111](https://github.com/gorinformatica/menu-multitenant/commit/bf221115571339c1817960e0b84663635e9007bd))
* **modules:** enable module updates and add sistema module ([7714738](https://github.com/gorinformatica/menu-multitenant/commit/7714738e696d7d81f511eb923afba5ad353b5140))
* **modules:** enhance module system with slots and remove ajuda module ([4bc1358](https://github.com/gorinformatica/menu-multitenant/commit/4bc13582d44e761200fe3a0112aa19197ca4504e))
* **modules:** extrair módulos compactados em diretórios ([964fb12](https://github.com/gorinformatica/menu-multitenant/commit/964fb125e81a3412b9dd1c13da9d68609c03bd02))
* **modules:** implement tenant module management service ([efbdc58](https://github.com/gorinformatica/menu-multitenant/commit/efbdc588feb0d60b987c95d91a4d3247a6e22132))
* **modules:** Melhoria na instalação do módulo com integração ao banco de dados e gerenciamento de locatários ([792b5c9](https://github.com/gorinformatica/menu-multitenant/commit/792b5c990e431ec9163cc3fab42a4b146ff80cbf))
* **notifications:** Sistema de notificações completos ([46a6bc9](https://github.com/gorinformatica/menu-multitenant/commit/46a6bc9b2c8021c1ecb565d09574d4c56e7fc4b7))
* **secure-files:** add secure file uploads module with multi-tenant isolation ([d4ac27f](https://github.com/gorinformatica/menu-multitenant/commit/d4ac27f4b6c94231464161b23217dc4a53a68958))
* **ui:** add module management tabs and tenant modules integration ([24e0f83](https://github.com/gorinformatica/menu-multitenant/commit/24e0f834c57fee155263e4731a2e0f66e2f4bd5c))
* **ui:** Adicionar sistema completo de notificações com interface suspensa e integração de back-end ([193c162](https://github.com/gorinformatica/menu-multitenant/commit/193c162e7c0757b0af94429e2720ab5ff09c6b34))


### Bug Fixes

* **module-registry:** Implementar a geração de itens da barra de tarefas e do menu do usuário ([826d376](https://github.com/gorinformatica/menu-multitenant/commit/826d376f229c15ee7a614f505e0dc71bdf533030))
* **modules:** Adicionar sistema de migração de módulos com controle de versão do banco de dados ([9e7aacc](https://github.com/gorinformatica/menu-multitenant/commit/9e7aacc75e1827c4b8c26b845cd7176c74a3707e))
* **modules:** correct update database endpoint and migration folder ([5c9ca12](https://github.com/gorinformatica/menu-multitenant/commit/5c9ca12f82602ee96fc361723396808a3a320a1a))
* **modules:** enable toggle functionality for tenant modules ([c9b31d5](https://github.com/gorinformatica/menu-multitenant/commit/c9b31d5b8e86d8b366444049e92d43cd7a82ab01))


* Reordenação ([5e59174](https://github.com/gorinformatica/menu-multitenant/commit/5e59174ab7ae50b0a0c5c6185ae506d698ecbace))
* **backend:** reorganize codebase with path aliases and modular structure ([ea68481](https://github.com/gorinformatica/menu-multitenant/commit/ea684814c2ca7b5e58f40450956548292899a513))
* **core/frontend:** migrate to new module registry system ([a9154f4](https://github.com/gorinformatica/menu-multitenant/commit/a9154f4f3960a4f788ea6a399ff3f50700ea82dc))
* **demo-completo:** update components to use next/navigation router ([495417a](https://github.com/gorinformatica/menu-multitenant/commit/495417ad42952eba965e9a63437cf89ff2d7d2e8))
* **modules:** migrate to secure backend-controlled module system ([ca74d18](https://github.com/gorinformatica/menu-multitenant/commit/ca74d1840f162aeb0ec9c8604faec22df61339ff))
* **modules:** relocate sistema module to new directory structure ([6993882](https://github.com/gorinformatica/menu-multitenant/commit/699388238ba23946ef751c1eca7477eeab01955e))

## [0.3.0](https://github.com/gorinformatica/menu-multitenant/compare/v0.2.0...v0.3.0) (2025-12-12)


### ⚠ BREAKING CHANGES

* **security:** Encryption format changed to include auth tags; existing encrypted data remains readable via legacy support, but new encryptions use the secure GCM format.

### Features

* **docker:** add docker setup evaluation and optimize frontend caching ([d693f67](https://github.com/gorinformatica/menu-multitenant/commit/d693f67a074b4e4eab413721c671932f0bd7a1e8))
* **docker:** add docker support for development and production ([ba76096](https://github.com/gorinformatica/menu-multitenant/commit/ba760969c46d01d118316b06a699f801c9095d31))
* **security): Recurso (segurança:** aprimore a segurança do aplicativo com validação de arquivos, armazenamento seguro de tokens e verificações de validação ([a51f42f](https://github.com/gorinformatica/menu-multitenant/commit/a51f42fff4fa8c3f6d1c592401f30c51e8ede14b))


### Bug Fixes

* **security:** enhance input sanitization and encryption security ([04f9a09](https://github.com/gorinformatica/menu-multitenant/commit/04f9a096f84e554a63ed456ba6d69b77054c3318))
* **segurança:** melhore a segurança com armazenamento criptografado de dados confidenciais ([aba42d2](https://github.com/gorinformatica/menu-multitenant/commit/aba42d28e79b7f2e047d37871837dd0b62f6a0ff))
