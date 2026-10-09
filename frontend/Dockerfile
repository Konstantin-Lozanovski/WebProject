FROM node:22-alpine

WORKDIR /app

# The package files are copied first, so Docker reuses the installed
# packages on the next build when only the source code changed
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 5173

# Serves the built app and forwards /api to the backend (see vite.config.js)
CMD ["npm", "run", "preview"]
