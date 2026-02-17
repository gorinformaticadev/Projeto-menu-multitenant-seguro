# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.3.0](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/compare/v3.2.0...v3.3.0) (2026-02-16)


### Features

* create initial AppModule with core modules, guards, and middleware. ([c1943c6](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c1943c64692e30d85bf08c43839746ff222a9fbc))
* Implement a distributed module installer service for managing module installation, updates, and file distribution. ([ba84543](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/ba84543f054c7513932d30d1ac75d87a0fefd6b7))
* Implement a Socket.IO client for real-time notifications, including connection management and event handling. ([4868230](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/4868230e421d16ffec3ddb0f79341ff9baeae45f))
* Implement secure Prisma service for tenant isolation, add backup and restore functionality, and introduce system update features with CI/CD. ([acef8f1](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/acef8f14ad986c18bfc83a030a069805badde040))
* Implement system update, module management, and backup features, including new deployment scripts, database schema, and frontend pages. ([99f8c57](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/99f8c57e5e0da49634a455761052f58e8e66a4c3))
* Introduce `ModuleInstallerService` to manage module installation, updates, and file distribution from ZIP archives, including rollback. ([375fd79](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/375fd79bd72c993ab016f3a213fce9ac2a3bbcce))


### Bug Fixes

* add module installer controller with endpoints for module upload, installation, activation, deactivation, database updates, status, uninstallation, and configuration reloading. ([de04fd1](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/de04fd16e5e60e13b35303132064bdc9bc949b5f))
* **install:** corrigir detecção de diretório no script update.sh ([46c6214](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/46c6214aea5e3abd724909c08f05edc52efdcc11))
* **socket:** Correção de erro de socket ([478842f](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/478842f41577791061a40dca4d0d0bc934d52782))
* **socket:** habilitar suporte a WebSocket/Socket.IO nos templates do Nginx e gateway ([33178ba](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/33178bae743630f263f77a66e82c320e6797dcee))

## [3.2.0](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/compare/v3.1.0...v3.2.0) (2026-02-15)


### Features

* Add Dockerfile and package.json for backend containerization, introduce an ACME-compatible installation script, and enhance production database configuration. ([b28be7b](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/b28be7b6aa511dd85e81ae0c6b27d0bd11c6ffd2))
* adiciona instalador install-acme compatível com ticketz-docker-acme ([03a7e6d](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/03a7e6d3ce6705aac6ed0fb55b1f9d0c1289f8f4))
* adiciona instalador install-acme-int para Nginx interno (Docker) ([7750748](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/7750748add07025c4d8e16cd900467fbdd45f5c2))
* Adiciona relatório detalhado de credenciais ao final da instalação ([c3153d5](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c3153d54602d28bd60b24ca632372d0063250bf4))
* adiciona script update-acme para atualizações inteligentes ([b48f6bb](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/b48f6bb3a2c91c701ba5fb41d1fe9cb21510fac3))
* Melhora feedback de build no instalador e reconstrói desinstalador robusto ([005d446](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/005d446ccc574282829ddc9f06e987713f2ab1a8))
* Melhora robustez do instalador e SSL ([92291f0](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/92291f026e96a968543a56fc87fd9742d570d0a5))
* melhora update-acme para resolver erros de rede e 502 ([1b10132](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/1b10132ddabe6c70f5221120fe10b110aa77d81d))
* Nomes de banco e usuário dinâmicos baseados no domínio ([593fe21](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/593fe2112a10b4040c868435655da6a479088f13))


### Bug Fixes

* correções de rede, vhost e roteamento para instalação Docker ([67115b7](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/67115b7b7d197a5a00c20f9e32ff7b3a144ea289))
* Corrige erro 502 - permissões de diretórios e migrações do Prisma ([fdd6c3d](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/fdd6c3dfbbabf5eb082024d640ebe75733f5b3e9))
* corrige erro 502 Bad Gateway e mapeamento de portas ([aab72c1](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/aab72c1606ceda8fc47905417979a33c7529d64d))
* Corrige erro de formato no docker rmi e melhora limpeza de diretório ([873f8ce](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/873f8ce9ba03be299cc50cbeac12021c0f89b2c2))
* corrige erro de tag inválida no Docker e variáveis de ambiente ausentes ([0764306](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/07643066520e83c55a7bc6ae2bcd5652b5725d66))
* elimina definitivamente erro de tag inválida no Docker ([55e5d61](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/55e5d618842450efac7199ca1ebc282456ca73a9))
* Garante injeção de variáveis de admin no comando de seed ([f99c8ab](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/f99c8ab5bd3365e1fc33c47893f92fc5fc4fb417))
* Habilita seeds automáticos e configura usuário admin personalizado ([3d101cc](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/3d101cc10ec2a7fa18347e6b69138ec464fc1dd6))
* **install:** Refatoração do script de configuração para suportar nginx-proxy e acme-companion ([7e6a461](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/7e6a461fe247176df1b7da1714dc2d84544aa2f0))
* permite que update-acme funcione em diretórios sem .git ([e666030](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/e6660304fd70b6535502601d801f4e015ed2fecf))
* resolve ERR_SSL_UNRECOGNIZED_NAME_ALERT ([c708434](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/c7084340ffb214f51f566b04a30dc88c8354f6f0))
* Resolve erro 403 e melhora extração de host no banco de dados ([aedb40b](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/aedb40b3b8977e912204e203356f512860f3ef16))
* resolve erro 502 Bad Gateway garantindo conectividade multi-rede ([2b1a289](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/2b1a289449240d395e1c960d171d18e620e1d561))
* resolve erro 502 Bad Gateway no modo Nginx Interno ([6a489fb](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/6a489fba90781e3dbaaffb131f12411d4650529e))
* resolve erro de pull access denied e limpa avisos do docker compose ([e290312](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/e2903123f754b50eeb1c3ca43df4ed454bd78eb4))
* resolve falha na emissão de certificados SSL ([07e4a2f](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/07e4a2ff3e5b875410da502424e597941a8e634c))
* Resolve falha no seed e melhora performance de inicialização ([a7a2638](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/a7a2638396e30728b69620bd34055834b7633ec2))
* Torna prompt do Docker Hub opcional no instalador ([3fd4b77](https://github.com/gorinformaticadev/Projeto-menu-multitenant-seguro/commit/3fd4b77dba8283ae60f91a19a3fe0a0e438ee590))

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
