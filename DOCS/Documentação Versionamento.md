# 📘 Documentação Completa de Versionamento com Commitizen, Commitlint, Husky e Standard-Version

Esta documentação explica **como padronizar commits**, **gerar tags automaticamente**, e **criar changelogs** usando:

* **Commitizen**
* **cz-conventional-changelog**
* **Commitlint**
* **Husky**
* **Standard-Version**

Inclui passo a passo, comandos e boas práticas.

---

# ✅ 1. Instalar as dependências necessárias

Execute no terminal:

```sh
npm install --save-dev commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional husky standard-version
```

---

# ✅ 2. Estrutura do package.json

Seu `package.json` deve ficar assim:

```json
{
  "name": "menu-multitenant",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.13.2"
  },
  "scripts": {
    "release": "standard-version"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.2.0",
    "@commitlint/config-conventional": "^20.2.0",
    "commitizen": "^4.3.1",
    "cz-conventional-changelog": "^3.3.0",
    "husky": "^9.1.7",
    "standard-version": "^9.5.0"
  },
  "config": {
    "commitizen": {
      "path": "./node_modules/cz-conventional-changelog"
    }
  }
}
```

---

# ✅ 3. Configurar o Husky

Inicialize o Husky:

```sh
npx husky install
```

Adicione o hook para validar commits:

```sh
npx husky add .husky/commit-msg "npx commitlint --edit $1"
```

Isso garante que **todo commit está no padrão**.

---

# ✅ 4. Configurar o Commitlint

Crie um arquivo **commitlint.config.js**:

```js
module.exports = {
  extends: ['@commitlint/config-conventional']
};
```

Isso obriga commits a seguirem os padrões como:

* `feat:`
* `fix:`
* `docs:`
* `refactor:`
* `chore:`

---

# ✅ 5. Usando o Commitizen para realizar commits padronizados

Ao invés de usar `git commit -m`, use:

```sh
npx cz
```

Ou configure um script opcional:

```json
"scripts": {
  "commit": "cz",
  "release": "standard-version"
}
```

E rode:

```sh
npm run commit
```

O Commitizen abrirá perguntas como:

* Tipo de commit (`feat`, `fix`, etc.)
* Descrição
* Escopo
* Mensagem longa opcional

---

# ✅ 6. Criando tags automaticamente com Standard-Version

Após ter commits padronizados, execute:

```sh
npm run release
```

Ele irá automaticamente:

✔ Ler os commits (`feat`, `fix`, `BREAKING CHANGE`)
✔ Gerar ou atualizar o arquivo **CHANGELOG.md**
✔ Atualizar o campo **version** do package.json
✔ Criar um commit automático de release
✔ Criar uma **tag Git** no formato `vX.Y.Z`

Exemplo:

```
$ npm run release
✔ tagging release v1.1.0
✔ Generating CHANGELOG.md
✔ Committing changes
```

Depois basta enviar:

```sh
git push --follow-tags
```

---

# ✅ 7. Fluxo completo recomendado

1. Desenvolveu algo → adicione arquivos

   ```sh
   git add .
   ```

2. Realize o commit seguindo padrão:

   ```sh
   npx cz
   ```

3. Gere release e tag automaticamente:

   ```sh
   npm run release
   ```

4. Envie tudo para o repositório:

   ```sh
   git push --follow-tags
   ```

---

# 🎯 Resultado Final

Com este setup você terá:

* Commits padronizados
* Hooks obrigatórios de validação
* Tags automáticas
* Controle total de versão
* Changelog gerado automaticamente

Se quiser, posso gerar também:

* Workflow do GitHub Actions para releases automáticos
* Guia visual em PDF
* Instalação completa via script `.sh`

Só pedir!
