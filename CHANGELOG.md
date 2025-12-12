# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
