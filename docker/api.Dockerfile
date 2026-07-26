# Build from monorepo root: docker build -f docker/api.Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
RUN npm ci && npm run build -w @c2k/shared && npm run build -w @c2k/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN npm ci --omit=dev -w @c2k/shared -w @c2k/api
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/api/dist ./packages/api/dist
RUN node -e "const fs=require('fs');const p='packages/shared/package.json';const j=JSON.parse(fs.readFileSync(p));j.main='./dist/index.js';j.types='./dist/index.js';j.exports={'.':'./dist/index.js','./session-token':'./dist/session-token.js'};fs.writeFileSync(p,JSON.stringify(j,null,2));"
WORKDIR /app/packages/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
