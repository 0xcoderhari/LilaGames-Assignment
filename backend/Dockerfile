FROM heroiclabs/nakama-pluginbuilder:3.22.0 AS builder

ENV GO111MODULE on
ENV CGO_ENABLED 1

WORKDIR /backend
COPY modules/ modules/
RUN cd modules && go mod tidy && go build --trimpath -buildmode=plugin -o /backend/backend.so

FROM heroiclabs/nakama:3.22.0
COPY --from=builder /backend/backend.so /nakama/data/modules/
CMD ["/nakama/nakama"]
