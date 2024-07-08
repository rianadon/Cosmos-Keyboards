.PHONY : build keycaps keycaps-simple keycaps2 keycaps-simple2 keyholes switches venv optimize docs docs-ci keyboards ci ci-base ci-setup vite-build quickstart npm-install dev
build: target/proto/manuform.ts target/proto/lightcycle.ts target/proto/cuttleform.ts target/proto/cosmos.ts target/editorDeclarations.d.ts target/cosmosStructs.ts

BUN := $(shell command -v bun 2> /dev/null)
ifdef BUN
  NODE = bun
  NPM = bun
  NPX = bunx
else
  NODE = node --import ./src/model_gen/register_loader.js
  NPM = npm
  NPX = npx
endif

target/openscad:
	$(NODE) src/model_gen/download-openscad.ts

target/proto/manuform.ts: src/proto/manuform.proto
	$(NPX) protoc --ts_out target --proto_path src $<

target/proto/cuttleform.ts: src/proto/cuttleform.proto
	$(NPX) protoc --ts_out target --proto_path src $<

target/proto/lightcycle.ts: src/proto/lightcycle.proto
	$(NPX) protoc --ts_out target --proto_path src $<

target/proto/cosmos.ts: src/proto/cosmos.proto
	$(NPX) protoc --ts_out target --proto_path src $<

target/editorDeclarations.d.ts: src/lib/worker/config.ts src/lib/worker/modeling/transformation-ext.ts target/cosmosStructs.ts
	$(NODE) src/model_gen/genEditorTypes.ts

target/cosmosStructs.ts: src/proto/cosmosStructs.ts src/lib/geometry/socketsParts.ts
	$(NODE) src/proto/cosmosStructs.ts

target/KeyV2:
	git clone -b choc https://github.com/rianadon/KeyV2 target/KeyV2
target/PseudoProfiles:
	git clone https://github.com/rianadon/PseudoMakeMeKeyCapProfiles target/PseudoProfiles
target/PseudoProfiles/libraries: target/PseudoProfiles
	cd target/PseudoProfiles && unzip libraries.zip && mv libraries/* .

keycaps: target/KeyV2 target/PseudoProfiles/libraries build
	$(NODE) src/model_gen/keycaps.ts
keycaps-simple: target/KeyV2 target/PseudoProfiles/libraries build
	$(NODE) src/model_gen/keycaps-simple.ts
keycaps2: target/KeyV2 target/PseudoProfiles/libraries build
	$(NODE) src/model_gen/keycaps2.ts
keycaps-simple2: target/KeyV2 target/PseudoProfiles/libraries build
	$(NODE) src/model_gen/keycaps-simple2.ts
keyholes: build
	$(NODE) src/model_gen/keyholes.ts
parts: build
	$(NODE) src/model_gen/parts.ts
parts-simple: build
	$(NODE) src/model_gen/parts-simple.ts
optimize:
	$(NODE) src/compress-media.ts
keyboards: build
	$(NODE) src/model_gen/keyboards.ts

dev:
	$(NPM) run dev

venv:
	if test ! -d venv; then python3 -m venv venv; . venv/bin/activate && pip install mkdocs-material[imaging]==9.5.17 mkdocs-awesome-pages-plugin==2.9.2 mkdocs-rss-plugin==1.9.0 lxml==4.9.3; fi
docs: venv
	. venv/bin/activate && mkdir -p ./build  && MKDOCS_BUILD=1 mkdocs build && cp -r target/mkdocs/* build/
docs-ci: venv
	. venv/bin/activate && mkdocs build && cp -r target/mkdocs/* .vercel/output/static/

# CI Specific tasks
ci-setup:
	mkdir -p target && mkdir -p docs/assets/target && mkdir -p .svelte-kit && cp src/assets/default-tsconfig.json .svelte-kit/tsconfig.json
vite-build:
	$(NPM) run build
npm-install:
	$(NPM) install --omit=optional
ci-base: build keycaps-simple2 keycaps2 parts parts-simple
ci: ci-setup ci-base vite-build docs-ci
quickstart: npm-install ci-setup ci-base
