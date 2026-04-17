# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install --include=dev
COPY frontend/ ./
RUN npm run build

# Stage 2: Production backend
FROM node:22-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server.js ./
COPY routes/ ./routes/
COPY lib/ ./lib/
COPY --from=frontend-build /build/dist ./public
EXPOSE 3001
CMD ["node", "server.js"]
