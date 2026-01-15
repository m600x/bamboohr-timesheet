FROM node:20-alpine


RUN apk add --no-cache \
chromium \
nss \
freetype \
harfbuzz \
ca-certificates \
ttf-freefont \
oath-toolkit-oathtool

ENV PUPPETEER_SKIP_DOWNLOAD=true \
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./

RUN npm install

WORKDIR /app

CMD ["node", "api-server.js"]