#!/bin/sh
# Forge Workout App - Update Script
# Run this whenever you download a new version
echo "🔨 Stopping current containers..."
docker compose down

echo "🧹 Removing cached images to force full rebuild..."
docker rmi workout-app-workout-app 2>/dev/null || true
docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true

echo "🏗️  Building fresh (this takes 3-5 minutes)..."
docker compose build --no-cache

echo "🚀 Starting..."
docker compose up -d

echo "✅ Done! Open http://localhost:3001"
