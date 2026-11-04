FROM node:22-slim
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends zip ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*
