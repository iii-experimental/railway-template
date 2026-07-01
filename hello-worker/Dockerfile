FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./
# node:20-slim ships a non-root `node` user (uid 1000). Drop root for runtime.
USER node
CMD ["node", "index.mjs"]
