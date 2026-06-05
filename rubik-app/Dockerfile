FROM rust:latest AS build
WORKDIR /build

COPY . .
RUN cargo build

FROM ubuntu:24.04
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /build/target/debug/app ./main
COPY --from=build /build/static ./static
COPY --from=build /build/rubik.yaml .

CMD ["./main"]
