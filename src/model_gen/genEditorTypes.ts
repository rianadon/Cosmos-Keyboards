import { writeFileSync } from 'fs'
import * as tsMorph from 'ts-morph'
import { typeFootprint } from './typeFootprint'

const project = new tsMorph.Project()
project.addSourceFilesAtPaths('src/lib/**/*.ts')
const source = project.getSourceFileOrThrow('src/lib/worker/config.ts')
const source2 = project.getSourceFileOrThrow('src/lib/worker/modeling/transformation-ext.ts')

const overrides = {
  'ETrsf': 'Trsf',
  'CuttleKey': 'Key',
}

const mirror = source2.getFunctionOrThrow('mirror')
const mirrorDeclaration = [
  mirror.getLeadingCommentRanges().map(c => c.getText()).join(''),
  'declare const mirror = ' + typeFootprint(mirror, overrides),
].join('\n')

const flipKeyLabels = source2.getFunctionOrThrow('flipKeyLabels')
const flipKeyLabelsDeclaration = [
  flipKeyLabels.getLeadingCommentRanges().map(c => c.getText()).join(''),
  'declare const flipKeyLabels = ' + typeFootprint(flipKeyLabels, overrides),
].join('\n')

const declarations = [
  'declare type Key = ' + typeFootprint(
    source.getTypeAliasOrThrow('CuttleKey'),
    overrides,
  ),
  'declare type Options = ' + typeFootprint(
    source.getTypeAliasOrThrow('Cuttleform'),
    overrides,
    ['keys'],
  ),
  'declare class Trsf ' + typeFootprint(
    source.getTypeAliasOrThrow('_ETrsf'),
    overrides,
    ['evaluate', 'insertBeforeLast', 'toString', 'rotated', 'translated', 'mirrored', 'transformedBy', 'apply', 'applied', 'history'],
  ),
  mirrorDeclaration,
  flipKeyLabelsDeclaration,
].join('\n')

writeFileSync('target/editorDeclarations.d.ts', declarations)
