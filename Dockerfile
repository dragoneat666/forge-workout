FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json .
RUN npm install

# Copy source — any change here busts the build cache
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

# ─────────────────────────────────────────
FROM node:20-alpine AS backend

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package.json first — changes here force fresh npm install
COPY backend/package.json .
# Force fresh install by including a build arg timestamp
ARG CACHEBUST=1
RUN npm install

COPY backend/server.js .

# Pull in the built React app
COPY --from=frontend-builder /frontend/build /app/frontend/build

VOLUME ["/data"]
EXPOSE 3001

CMD ["node", "server.js"]
