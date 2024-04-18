# syntax=docker/dockerfile:1
FROM node:21.5

ENV SKIP_MAKE_FILES=${SKIP_MAKE_FILES}

COPY . /Cosmos-Keyboards/
WORKDIR /Cosmos-Keyboards

RUN apt-get update
RUN apt-get install -y python3.11-full python3.11-venv python3-pip \
    libgl1-mesa-dev libglu1-mesa-dev libxi-dev libglew-dev leiningen xvfb dos2unix

RUN ln -s /usr/bin/python3.11 /usr/bin/python

RUN npm install --include=optional

RUN if [ -f ./.env ]; then set -a && . ./.env && set +a; fi && \
    if [ "$SKIP_MAKE_FILES" != "true" ]; then \
        make ci-setup ci-base keyholes venv; \
        Xvfb :99 -screen 0 1024x768x16 & export DISPLAY=:99; make keyboards; \
    else \
        echo "Skipping make commands..."; \
    fi

RUN mkdir -p /temp-cosmos
RUN cp -r ./* /temp-cosmos

COPY docker/entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
