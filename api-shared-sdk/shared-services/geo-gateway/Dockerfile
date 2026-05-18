FROM node:24-alpine3.22
WORKDIR /app
COPY geo-gateway/package*.json ./
RUN npm ci --omit=dev
COPY geo-gateway/src/ ./src/
COPY manifests/ /manifests/
ENV PORT=4015
EXPOSE 4015
CMD ["node", "src/server.js"]
