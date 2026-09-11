FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY data ./data

RUN npm run build && npm prune --omit=dev

ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 49152

CMD ["node", "dist/index.js"]
