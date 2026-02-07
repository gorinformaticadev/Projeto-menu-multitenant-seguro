#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Build Test: Frontend Only (Production Mode) ===${NC}"
echo "Building strictly the frontend service to diagnose TypeScript errors."
echo "Running on: $(uname -a)"
echo "--------------------------------------------------------"

# 1. Check needed commands
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}Erro: Docker não encontrado.${NC}"
    exit 1
fi

# 2. Setup build config
echo "Generating focused docker-compose config..."
cat > docker-compose.frontend-test.yml <<EOF
version: '3.8'

services:
  frontend-build-test:
    build:
      context: .
      dockerfile: ./apps/frontend/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: http://localhost:3001
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    deploy:
      resources:
        limits:
          memory: 4G
EOF

# 3. Build It
echo "Starting frontend build..."
echo "Command: docker compose -f docker-compose.frontend-test.yml build --no-cache frontend-build-test"

# Try 'docker compose' first (v2), fallback to 'docker-compose' (v1)
if docker compose version >/dev/null 2>&1; then
    CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    CMD="docker-compose"
else
    echo -e "${RED}Erro: Nem 'docker compose' nem 'docker-compose' encontrados.${NC}"
    exit 1
fi

if $CMD -f docker-compose.frontend-test.yml build --progress=plain --no-cache frontend-build-test; then
    echo -e "${GREEN}✅ SUCCESS: Frontend built successfully!${NC}"
    echo "TypeScript errors are resolved."
    rm docker-compose.frontend-test.yml
    exit 0
else
    echo -e "${RED}❌ ERROR: Frontend build failed.${NC}"
    echo "Check error logs above."
    # Don't delete config for debug
    exit 1
fi
