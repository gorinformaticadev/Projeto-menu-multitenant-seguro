#!/bin/bash
# uninstall-multitenant.sh — remoção limpa e segura do seu stack

set -e

PROJECT="projeto-menu-multitenant-seguro"

echo "==============================="
echo "DESINSTALAÇÃO MULTITENANT"
echo "==============================="
echo "⚠️  Isso removerá APENAS recursos deste projeto."
echo "Outros containers (Ticketz, nginx-proxy etc.) NÃO serão tocados."
echo ""

read -p "Tem certeza? (digite: SIM) " CONFIRM
if [ "$CONFIRM" != "SIM" ]; then
  echo "Abortado."
  exit 1
fi

# 1) Parar e remover containers do projeto
echo "➡️  Parando e removendo containers do projeto..."

docker stop \
  multitenant-frontend-prod \
  multitenant-backend-prod \
  multitenant-db-prod \
  multitenant-redis-prod 2>/dev/null || true

docker rm \
  multitenant-frontend-prod \
  multitenant-backend-prod \
  multitenant-db-prod \
  multitenant-redis-prod \
  multitenant-migrator 2>/dev/null || true

# 2) Remover volumes APENAS deste projeto
echo "➡️  Removendo volumes DO PROJETO (dados serão apagados)..."

docker volume rm \
  ${PROJECT}_postgres_data_prod \
  ${PROJECT}_redis_data_prod \
  ${PROJECT}_uploads 2>/dev/null || true

# 3) Remover imagens locais do build
echo "➡️  Removendo imagens locais geradas pelo projeto..."

docker rmi \
  projeto-menu-multitenant-seguro-frontend \
  projeto-menu-multitenant-seguro-backend 2>/dev/null || true

# 4) Limpar arquivos gerados
echo "➡️  Limpando arquivos locais gerados..."

rm -f docker-compose.prod.yml
rm -f nginx-*.conf 2>/dev/null || true

# 5) NGINX — rollback seguro (se existir)
if command -v nginx >/dev/null 2>&1; then
  echo "➡️  Tentando remover config específica do domínio..."

  for f in /etc/nginx/sites-enabled/*.conf; do
    if grep -q "multitenant-backend-prod" "$f" 2>/dev/null; then
      echo "   - Removendo $f"
      sudo rm -f "$f"
    fi
  done

  sudo nginx -t && sudo systemctl reload nginx || true
else
  echo "➡️  Nginx não instalado no host — nada a fazer."
fi

echo "✅ DESINSTALAÇÃO CONCLUÍDA."
echo "Você pode reinstalar do zero quando quiser."
