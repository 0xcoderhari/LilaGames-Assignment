# ---------- builder ----------
FROM heroiclabs/nakama-pluginbuilder:3.22.0 AS builder

WORKDIR /backend
COPY modules/ modules/
RUN cd modules && go mod tidy && go build --trimpath -buildmode=plugin -o backend.so

# ---------- runtime ----------
FROM heroiclabs/nakama:3.22.0

COPY --from=builder /backend/backend.so /nakama/data/modules/

CMD ["/bin/sh", "-ec", "/nakama/nakama migrate up --database.address=$DATABASE_URL && exec /nakama/nakama --name nakama --database.address=$DATABASE_URL --logger.level=DEBUG --session.token_expiry_sec=7200 --session.encryption_key=supersecretkey --socket.server_port=$PORT"]