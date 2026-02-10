#!/bin/bash

# Production Deployment Script
# Usage: ./scripts/deploy-prod.sh

set -e

echo "🚀 Starting production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.prod exists
if [ ! -f ".env.prod" ]; then
    echo -e "${RED}❌ Error: .env.prod file not found!${NC}"
    echo -e "${YELLOW}📝 Copy .env.prod.example to .env.prod and configure your variables${NC}"
    exit 1
fi

# Load environment variables
set -a
source .env.prod
set +a

# Validate required variables
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY" "DOCKERHUB_USERNAME")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}❌ Error: $var is not set in .env.prod${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Pull latest images
echo "📥 Pulling latest images..."
docker compose --env-file .env.prod -f docker-compose.prod.yml pull

# Stop existing containers gracefully
echo "🛑 Stopping existing containers..."
docker compose --env-file .env.prod -f docker-compose.prod.yml down

# Start services
echo "🚀 Starting production services..."
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 30

# Check health of services
echo "🏥 Checking service health..."

# Backend health check
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
    exit 1
fi

# Frontend health check
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
    exit 1
fi

# Show status
echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📊 Service Status:"
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

echo ""
echo "🌐 Services available at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "  View logs: docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f"
echo "  Stop:      docker compose --env-file .env.prod -f docker-compose.prod.yml down"
echo "  Restart:   docker compose --env-file .env.prod -f docker-compose.prod.yml restart"