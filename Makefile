.PHONY : build keycaps keycaps-simple keycaps2 keycaps-simple2 keyholes switches venv optimize docs docs-ci keyboards ci ci-setup vite-build
build: target/proto/manuform.ts target/proto/lightcycle.ts target/proto/cuttleform.ts target/editorDeclarations.d.ts

NODE = node --import ./src/model_gen/register_loader.js

target/openscad:
	$(NODE) src/model_gen/download-openscad.ts

target/proto/manuform.ts: src/proto/manuform.proto
	npx protoc --ts_out target --proto_path src $<

target/proto/cuttleform.ts: src/proto/cuttleform.proto
	npx protoc --ts_out target --proto_path src $<

target/proto/lightcycle.ts: src/proto/lightcycle.proto
	npx protoc --ts_out target --proto_path src $<

target/editorDeclarations.d.ts: src/lib/worker/config.ts src/lib/worker/modeling/transformation-ext.ts
	$(NODE) src/model_gen/genEditorTypes.ts

target/KeyV2:
	git clone -b choc https://github.com/rianadon/KeyV2 target/KeyV2
target/PseudoProfiles:
	git clone https://github.com/rianadon/PseudoMakeMeKeyCapProfiles target/PseudoProfiles
target/PseudoProfiles/libraries: target/PseudoProfiles
	cd target/PseudoProfiles && unzip libraries.zip && mv libraries/* .

keycaps: target/KeyV2 target/PseudoProfiles/libraries
	$(NODE) src/model_gen/keycaps.ts
keycaps-simple: target/KeyV2 target/PseudoProfiles/libraries
	$(NODE) src/model_gen/keycaps-simple.ts
keycaps2: target/KeyV2 target/PseudoProfiles/libraries
	$(NODE) src/model_gen/keycaps2.ts
keycaps-simple2: target/KeyV2 target/PseudoProfiles/libraries
	$(NODE) src/model_gen/keycaps-simple2.ts
keyholes:
	$(NODE) src/model_gen/keyholes.ts
parts:
	$(NODE) src/model_gen/parts.ts
optimize:
	$(NODE) src/compress-media.ts
keyboards:
	$(NODE) src/model_gen/keyboards.ts

venv:
	if test ! -d venv; then python3 -m venv venv; . venv/bin/activate && pip install mkdocs-material[imaging]==9.4.14 mkdocs-awesome-pages-plugin==2.9.2 mkdocs-rss-plugin==1.9.0 lxml==4.9.3; fi
docs: venv
	. venv/bin/activate && mkdir -p ./build  && MKDOCS_BUILD=1 mkdocs build && cp -r target/mkdocs/* build/
docs-ci: venv
	. venv/bin/activate && mkdocs build && cp -r target/mkdocs/* .vercel/output/static/

# CI Specific tasks
ci-setup:
	mkdir -p target
vite-build:
	npm run build
ci: ci-setup build keycaps-simple2 keycaps2 parts vite-build docs-ci
