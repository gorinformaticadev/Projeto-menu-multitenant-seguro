# Instalacao One-Command com Repositorio Proprio

## Visao Geral

Instalacao completa do Sistema Multitenant Seguro diretamente do repositorio GitHub oficial, eliminando a necessidade de infraestrutura adicional para hospedar o script de instalacao.

## Comando Final para Usuarios

```bash
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | sudo bash -s app.exemplo.com.br
```

## Como Funciona

1. **Usuario executa o comando acima**
2. **GitHub serve diretamente o arquivo `install.sh`** do repositorio
3. **Script baixa o codigo fonte do mesmo repositorio**
4. **Instalacao completa e realizada automaticamente**

## Estrutura no Repositorio

```
Pluggor/
├── install/                   # Scripts oficiais de instalacao
│   ├── install.sh            # Script principal
│   ├── update.sh             # Atualizacao
│   └── uninstall.sh          # Desinstalacao
├── apps/                      # Codigo fonte do sistema
│   ├── backend/              # API NestJS
│   └── frontend/             # Interface Next.js
├── docker-compose.yml         # Configuracao Docker
└── README.md                  # Documentacao principal
```

## Vantagens desta Abordagem

- **Zero infraestrutura adicional** - Usa apenas o GitHub
- **Sempre atualizado** - Script e codigo fonte no mesmo lugar
- **Facil manutencao** - Tudo versionado no Git
- **Confiavel** - GitHub como CDN confiavel
- **Transparente** - Usuario ve exatamente o que sera executado

## Fluxo de Atualizacao

1. Atualiza codigo no repositorio
2. Atualiza script `install.sh` se necessario
3. Commit e push
4. Nova instalacao ja usa versao atualizada

## Testando Localmente

### Teste direto do script:
```bash
chmod +x install.sh
sudo ./install.sh teste.local
```

### Teste simulando o curl:
```bash
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | sudo bash -s teste.exemplo.com.br
```

## Consideracoes de Seguranca

- Script vem diretamente do repositorio oficial
- Codigo fonte e o mesmo do repositorio
- Transparencia total para o usuario
- Versionamento via Git

### Recomendacoes:
```bash
# Sempre verificar o script antes de executar
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | less
```

## Troubleshooting

**"Permission denied":**
```bash
sudo !!  # Reexecuta ultimo comando com sudo
```

**"curl: (7) Failed to connect":**
```bash
ping github.com
```

**"git clone failed":**
```bash
df -h            # Verificar espaco em disco
ls -la /var/www/ # Verificar permissoes
```

## Exemplos de Uso

### Instalacao Padrao:
```bash
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | sudo bash -s meusistema.com.br
```

### Instalacao em Ambiente de Teste:
```bash
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | sudo bash -s teste.meusistema.com.br
```

### Instalacao Silenciosa:
```bash
curl -sSL https://raw.githubusercontent.com/gorinformaticadev/Pluggor/main/install.sh | sudo bash -s --silent producao.com.br
```

## Proximos Passos

Depois da instalacao:

1. **Configurar DNS** apontando para o servidor
2. **Obter certificado SSL** (Let's Encrypt)
3. **Alterar senhas padrao** em producao
4. **Configurar backup** automatico
5. **Personalizar** conforme necessidade
