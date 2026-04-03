FROM heroiclabs/nakama-pluginbuilder:3.22.0 AS builder

WORKDIR /backend
COPY modules/ modules/
RUN cd modules && go mod tidy && go build --trimpath -buildmode=plugin -o backend.so

FROM heroiclabs/nakama:3.22.0

COPY --from=builder /backend/backend.so /nakama/data/modules/

CMD ["/nakama/nakama", \
"--name", "nakama", \
"--database.address", "${DATABASE_URL}", \
"--database.driver", "postgres", \
"--logger.level", "DEBUG", \
"--session.token_expiry_sec", "7200", \
"--session.encryption_key", "supersecretkey", \
"--socket.server_port", "${PORT}"]