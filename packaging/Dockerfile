FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
WORKDIR /app

# Runtime libraries used by the verified Linux/musl gateway.
RUN apk add --no-cache musl libgcc ca-certificates zlib
COPY main docker-entrypoint.sh ./
COPY licenses/ /app/licenses/

ENV APP_PORT=8080 APP_HOST=0.0.0.0 LOG_LEVEL=info LOG_STYLE=json APP_DIR=/app/data
RUN mkdir -p /app/data/logs && \
    adduser -D -s /bin/sh appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:0 /app/data && \
    chmod -R g=rwX /app/data && \
    chmod +x /app/docker-entrypoint.sh
USER 1000:0
VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${APP_PORT}/health || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/main"]
