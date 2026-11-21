FROM node:20-alpine

# 仅使用 Node 内置模块，无需 npm install，镜像小且离线可构建。
WORKDIR /app

COPY server/ ./server/
COPY web/ ./web/

# 容器内数据目录；用卷挂载实现持久化。
ENV RELAY_DATA_DIR=/app/data \
    RELAY_HOST=0.0.0.0 \
    RELAY_PORT=8787
RUN mkdir -p /app/data

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.RELAY_PORT||8787)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/index.js"]
