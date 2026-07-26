# Build from monorepo root: docker build -f docker/web.Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared packages/shared
COPY packages/web packages/web
ARG VITE_API_URL=
ARG VITE_SITE_URL=https://kink.social
ARG VITE_PUBLIC_LAUNCH=false
ARG VITE_LEGAL_PUBLISHED=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_PUBLIC_LAUNCH=$VITE_PUBLIC_LAUNCH
ENV VITE_LEGAL_PUBLISHED=$VITE_LEGAL_PUBLISHED
RUN npm ci && npm run build -w @c2k/shared && npm run build -w web

FROM nginx:1.27-alpine
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
