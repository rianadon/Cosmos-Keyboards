.PHONY : all build test keycaps keycaps-simple keyholes switches
build: target/proto/manuform.ts target/proto/lightcycle.ts target/proto/cuttleform.ts target/editorDeclarations.d.ts

NODE = node --experimental-specifier-resolution=node --loader ts-node/esm/transpile-only

test:
	$(MAKE) -C test

all: build test

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
