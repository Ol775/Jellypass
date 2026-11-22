FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx esbuild selfhost/server.ts --define:__VERSION__="\"$(node -p "require('./package.json').version")\"" --bundle --platform=node --format=esm --target=node24 \
    --loader:.sql=text --outfile=dist/server.mjs --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

FROM node:26-alpine
LABEL org.opencontainers.image.source="https://github.com/Ol775/Jellypass" org.opencontainers.image.description="Jellypass: a members portal for a private Jellyfin library" org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production DATA_DIR=/data MIGRATIONS_DIR=/app/migrations
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=build /app/dist/server.mjs ./server.mjs
COPY migrations ./migrations
COPY CHANGELOG.md ./CHANGELOG.md
RUN mkdir /data && chown node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';const u='127.0.0.1:8787/health';fetch('https://'+u).catch(()=>fetch('http://'+u)).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
