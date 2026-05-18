FROM node:24-alpine3.22
WORKDIR /app
COPY otp-gateway/package*.json ./
RUN npm ci --omit=dev
COPY otp-gateway/src/ ./src/
COPY manifests/ /manifests/
EXPOSE 4014
CMD ["node", "src/server.js"]
