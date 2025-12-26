FROM node:18-alpine

WORKDIR /app

COPY worker-service/package*.json ./
RUN npm install

COPY worker-service/ .

CMD ["node", "worker.js"]
