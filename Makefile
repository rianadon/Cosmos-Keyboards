.PHONY : build keycaps keycaps-simple keyholes switches venv optimize docs keyboards ci ci-setup vite-build
build: target/openscad target/proto/manuform.ts target/proto/lightcycle.ts target/proto/cuttleform.ts target/editorDeclarations.d.ts

NODE = node  --loader ./src/model_gen/loader.js

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

keycaps: target/KeyV2
	$(NODE) src/model_gen/keycaps.ts
keycaps-simple: target/KeyV2
	$(NODE) src/model_gen/keycaps-simple.ts
keyholes:
	$(NODE) src/model_gen/keyholes.ts
parts:
	$(NODE) src/model_gen/parts.ts
optimize:
	$(NODE) src/compress-media.ts
keyboards:
	$(NODE) src/model_gen/keyboards.ts

venv:
	if test ! -d venv; then python3 -m venv venv; source venv/bin/activate && pip install mkdocs-material[imaging]==9.4.14 mkdocs-awesome-pages-plugin==2.9.2 mkdocs-rss-plugin==1.9.0; fi
docs: venv
	source venv/bin/activate && MKDOCS_BUILD=1 mkdocs build && cp -r target/mkdocs/* build/

# CI Specific tasks
ci-setup:
	mkdir -p target
vite-build:
	npm run build
ci: ci-setup build keycaps-simple keycaps parts optimize keyboards vite-build docs
