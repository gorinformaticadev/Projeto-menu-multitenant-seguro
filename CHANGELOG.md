# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.1.0](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/compare/v2.0.0...v3.1.0) (2026-02-11)


### ⚠ BREAKING CHANGES

* **backup:** none

### Features

* Add CI/CD workflow for automated testing and Docker image builds, and document service order status improvements for service orders. ([800c1d9](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/800c1d9827cc7106269a2fdaab7c9f11e446301f))
* Add Dockerfiles for frontend and backend, integrate a CI/CD pipeline, and adjust the backend service working directory in docker-compose. ([2b5346e](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/2b5346eb98dc0a35cf62b8df6e9c51f2e7697a04))
* add table UI component with its sub-components for structured data display. ([240471d](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/240471dad7db2695682c140d46b80de0c1a8c5a1))
* **backup:** add backup and restore functionality ([d3b3d71](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/d3b3d710e71e403e13659475d6ecb63b01695c97))
* **backup:** add delete backup functionality ([b8fe083](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/b8fe08398d77baf1d81f656321bcd5b5612832aa))
* Implement dynamic sidebar component with module registry integration, expandable UI, and user authentication features. ([1d228de](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/1d228de7d15d9e4c5175f5278632c02f371ddf25))
* Implement module installer service and controller for distributed module management including installation, updates, and migrations. ([303de7c](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/303de7c5988e91cd66f5138bfd9283c661f28c15))
* Implement the WhatsApp module, including new UI components, pages, and data models. ([19b2993](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/19b29930f8a163dc6bffc76c235ebeb1c0a563df))
* Implementação de restrições para modulos que soment eadminspodem ver. ([09eda7d](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/09eda7da910eee91713909e85a8b69f7d5eaa440))
* Initialize monorepo structure with pnpm, and introduce backend notification and authentication features. ([cd4a074](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/cd4a074324513443624b5d1972dccc4f130252b3))
* **install:** instalador e reorganização ([e50641e](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/e50641eed78e2c8459909181c3000af351b70b16))
* **modules:** improve migrations and seeds execution to run pendents only ([1367398](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/13673985689cf908490bddc3b0597b2da3b62b85))
* **modules:** integrate ordem_servico module ([658c84b](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/658c84b5c3fe8bf3ab021122cc8b6f7bf09da878))
* restrict ports to localhost and improve setup.sh for external Nginx with SSL ([93d0a69](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/93d0a69fc9483276db8081424a385a2785a90214))
* **security:** add rate limiting for critical endpoints ([e80580c](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/e80580ceaeb905401c4bd6b8c64a4a1805594312))
* **users:** add role restrictions to update preferences ([c43c6ad](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c43c6ada0efa41b6633841e1f61562b01ce279d3))


### Bug Fixes

* implement PlatformConfigContext to manage and provide platform configuration with caching and error handling. ([28944fb](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/28944fb88bb920f46a4598c52a2ba3d415814b8f))
* **install:** avoid prisma generate at runtime and setup ([2a1b375](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/2a1b375f885b11a32814da12a7dca35eb32251ae))
* **install:** run seed via ts-node to avoid prisma auto-install ([ab32d3a](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/ab32d3abfda1b1cb04227a1e82299b9f4c3c5a22))
* **lockfile:** align backend tsx version with pnpm lock ([0442009](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/044200927c6141d390f55a5499a3130082ac1be2))
* **notifications:** re-enable real-time notifications with direct WebSocket authentication ([3d05808](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/3d05808ce913c99922b28e324064a1d5dd47f82c))
* remove invalid prisma.config.js and update entrypoint ([c1d263f](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c1d263f77474f86671b2d7d5ba44281c942663a6))
* remove redundant lockfiles and workspace configs from apps ([8c11851](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/8c118511bdf3c6c28c56d7c86fcbeec9936cbdd8))
* **seed:** execute seed with ts-node-esm in install flow ([30cb39f](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/30cb39f9a5cf8a203784b842c40cb7d1adfb4e18))
* **seed:** load seed.ts via ts-node register require hook ([777ca92](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/777ca9255c14819ab36d1d6f8e3470c1d7f92582))
* **seed:** run seed via node -r ts-node/register ([8c69529](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/8c695296a5ca520e7f38d8d98d830437a5fef8db))
* **seed:** run ts-node from backend workspace path ([b88b51f](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/b88b51f68082460f6182560ea1877e368493e4ad))
* **seed:** switch install seed execution to tsx ([48cf330](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/48cf3306ba8008ad948fe5e063b80e7234c9a9ce))
* update pnpm-lock.yaml to match package.json dependencies ([184bb7a](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/184bb7a678eb17cf6945b1871635ccb5ad09e626))
