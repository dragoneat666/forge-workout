FROM node:20-alpine

# Build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json .
RUN npm install

COPY server.js .

VOLUME ["/data"]
EXPOSE 3001

CMD ["node", "server.js"]
