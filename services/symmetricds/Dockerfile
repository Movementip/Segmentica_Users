FROM eclipse-temurin:21-jre-jammy

WORKDIR /opt/symmetricds

RUN apt-get update \
    && apt-get install -y --no-install-recommends iproute2 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system symmetricds \
    && useradd --system --gid symmetricds --home-dir /opt/symmetricds symmetricds

COPY server/ /opt/symmetricds/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh /opt/symmetricds/bin/* \
    && mkdir -p /opt/symmetricds/logs /opt/symmetricds/tmp \
    && chown -R symmetricds:symmetricds /opt/symmetricds

USER symmetricds

EXPOSE 31415

ENTRYPOINT ["docker-entrypoint.sh"]
