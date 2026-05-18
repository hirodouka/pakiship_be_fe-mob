FROM node:24-alpine3.22
WORKDIR /app
COPY email-gateway/package*.json ./
RUN npm ci --omit=dev
COPY email-gateway/src/ ./src/
COPY manifests/ /manifests/
EXPOSE 4012
CMD ["node", "src/server.js"]
