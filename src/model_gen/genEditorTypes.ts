import { writeFileSync } from 'fs'
import * as tsMorph from 'ts-morph'
import { typeFootprint } from './typeFootprint'

const project = new tsMorph.Project()
project.addSourceFilesAtPaths('src/lib/**/*.ts')
project.addSourceFilesAtPaths('target/*.ts')
const source = project.getSourceFileOrThrow('src/lib/worker/config.ts')
const source2 = project.getSourceFileOrThrow('src/lib/worker/modeling/transformation-ext.ts')
const source3 = project.getSourceFileOrThrow('target/cosmosStructs.ts')

const overrides = {
  'ETrsf': 'Trsf',
  'CuttleKey': 'Key',
  'Keycap': 'Keycap',
}

const mirror = source2.getFunctionOrThrow('mirror')
const mirrorDeclaration = [
  mirror.getLeadingCommentRanges().map(c => c.getText()).join(''),
  'declare const mirror = ' + typeFootprint(mirror, overrides),
].join('\n')

const unibody = source2.getFunctionOrThrow('unibody')
const unibodyDeclaration = [
  unibody.getLeadingCommentRanges().map(c => c.getText()).join(''),
  'declare const unibody = ' + typeFootprint(unibody, overrides),
].join('\n')

const declarations = [
  'declare type Keycap = ' + typeFootprint(
    source.getInterfaceOrThrow('Keycap'),
    overrides,
  ),
  'declare type Key = ' + typeFootprint(
    source3.getTypeAliasOrThrow('CuttleKey'),
    overrides,
  ),
  'declare type Options = ' + typeFootprint(
    source.getTypeAliasOrThrow('Cuttleform'),
    overrides,
    ['keys'],
  ),
  'declare class Trsf ' + typeFootprint(
    source2.getClassOrThrow('ETrsf'),
    overrides,
    ['evaluate', 'insertBeforeLast', 'toString', 'rotated', 'translated', 'mirrored', 'transformedBy', 'apply', 'applied', 'history'],
  ),
  mirrorDeclaration,
  unibodyDeclaration,
].join('\n')

writeFileSync('target/editorDeclarations.d.ts', declarations)
