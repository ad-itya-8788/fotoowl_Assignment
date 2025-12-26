FROM node:18-alpine

WORKDIR /app

COPY import-service/package*.json ./
RUN npm install

COPY import-service/ .
COPY frontend/ ../frontend

EXPOSE 3000

CMD ["node", "index.js"]
