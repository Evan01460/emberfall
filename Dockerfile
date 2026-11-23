# Emberfall online server — one container serves the game page and the WebSocket world (the global, always-on server).
#   docker build -t emberfall . && docker run -d -p 8080:8080 -v emberfall-data:/data emberfall
# Put it behind HTTPS (Fly.io / Render / Railway / a reverse proxy) and share the URL: everyone who opens it and picks
# "Public world" is in the same persistent world. Add --build-arg GLOBAL_WS=wss://your.host/ws to also bake the address into the build.
FROM node:22-alpine AS build
ARG GLOBAL_WS=""
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY assets ./assets
COPY index.html style.css build.mjs ./
RUN EMBERFALL_GLOBAL_WS="$GLOBAL_WS" node build.mjs

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY host ./host
COPY --from=build /app/dist/emberfall.html ./dist/emberfall.html
ENV PORT=8080 DATA_DIR=/data
VOLUME /data
EXPOSE 8080
CMD ["node", "host/server.mjs"]
