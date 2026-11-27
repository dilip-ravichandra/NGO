# Website + API in one small image. No npm packages to install.
#   docker build -t gigf-web:1.0 .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8081

# Only what the site needs is copied by name, so .env files and internal documents can never end up in the image.
COPY *.html robots.txt sitemap.xml dev-server.js ./
COPY api ./api
COPY css ./css
COPY js ./js
COPY assets ./assets

USER node
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8081/healthz || exit 1
CMD ["node", "dev-server.js"]
