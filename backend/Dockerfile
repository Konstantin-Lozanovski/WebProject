FROM node:22-alpine

WORKDIR /app

# The package files are copied first, so Docker reuses the installed
# packages on the next build when only the source code changed
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5000

CMD ["npm", "start"]
