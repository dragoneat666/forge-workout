FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json .
RUN npm install

COPY public/ public/
COPY src/ src/

RUN npm run build

# Final stage - serve from backend's static file serving
FROM node:20-alpine

WORKDIR /app/frontend

COPY --from=builder /app/build ./build
