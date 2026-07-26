# Build from monorepo root: docker build -f packages/web/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
RUN npm install
RUN npm run build -w web

FROM nginx:alpine AS runner
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
