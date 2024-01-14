# syntax=docker/dockerfile:1
FROM node:21.5

ENV SKIP_MAKE_FILES=${SKIP_MAKE_FILES}

COPY . /Cosmos-Keyboards/
WORKDIR /Cosmos-Keyboards

RUN apt-get update
RUN apt-get install -y python3.11 golang gcc libgl1-mesa-dev python3.11-venv python3-pip

ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk-amd64/

RUN python3 -m venv venv
RUN ls -la "venv/bin/"
RUN venv/bin/pip install mkdocs-material[imaging]==9.4.14 mkdocs-awesome-pages-plugin==2.9.2 mkdocs-rss-plugin==1.9.0 lxml==4.9.3

RUN mkdir -p target
RUN npm install --include=optional

RUN set -a && . ./.env && set +a && \
    if [ "$SKIP_MAKE_FILES" != "true" ]; then \
        make || true;\
        make parts || true;\
        make keycaps-simple2 || true;\
        make keycaps2 || true;\
        make keyholes || true;\
        make Keyboards || true;\
    else \
        echo "Skipping make commands..."; \
    fi

RUN mkdir -p /temp-cosmos
RUN cp -r ./* /temp-cosmos

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
