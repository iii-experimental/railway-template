# iii engine clean base image for Railway.
#
# Contains the iii engine and the iii-worker daemon, and no add-on workers.
# You choose what runs by declaring workers in config.yaml. Binary workers are
# fetched from the registry on first boot. To pin a version and skip the
# cold-start download, extend this image with `RUN iii worker add <name>`.
FROM debian:bookworm-slim

# curl, ca-certificates, and jq are used by the installer. libssl3 and libcap2
# are engine runtime dependencies. No worker-specific packages are installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates jq libssl3 libcap2 \
    && rm -rf /var/lib/apt/lists/*

# Installs iii (engine) and iii-worker (the daemon that runs add-on workers).
RUN curl -fsSL https://install.iii.dev/iii/main/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app
COPY config.yaml /app/config.yaml

# 49134 engine WS, 3111 HTTP, 3112 stream. Add 9464 to scrape Prometheus metrics.
EXPOSE 49134 3111 3112

CMD ["iii", "--config", "/app/config.yaml"]
