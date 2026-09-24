FROM alpine:3.23.5@sha256:fd791d74b68913cbb027c6546007b3f0d3bc45125f797758156952bc2d6daf40
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
