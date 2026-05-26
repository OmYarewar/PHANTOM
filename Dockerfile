FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY server/ ./server/
COPY frontend/ ./frontend/
COPY vite.config.js ./

EXPOSE 3000

CMD ["node", "server/index.js"]
