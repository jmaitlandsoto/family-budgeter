# Build from the repo root: docker build -f apps/server/Dockerfile -t family-budgeter-server .
# (npm workspaces means the lockfile lives at the repo root, not in apps/server)

FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src
RUN npm run build --workspace=@family-budgeter/server

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace=@family-budgeter/server
COPY --from=build /repo/apps/server/dist apps/server/dist

EXPOSE 8080
CMD ["node", "apps/server/dist/server.js"]
