/** Credits to  Rinat Zaripov
 * https://gist.github.com/zaripych/963fa6584524e5b446b70548dbabbf65
 *
 * This file helps export Typescript defintions to strings
 */
import type { Node, Signature, Symbol, Type } from 'ts-morph'
import tsMorph from 'ts-morph'

export function typeFootprint(a: Node, overrides?: Record<string, string>, excludes?: string[]) {
  const t = a.getType()
  const text = footprintOfType({ type: t, node: a, overrides, excludes })
  return text
}

function isPrimitive(type: Type) {
  if (type.isString()) return true
  if (type.isStringLiteral()) return true
  if (type.isUndefined()) return true
  if (type.isNull()) return true
  if (type.isUnknown()) return true
  if (type.isAny()) return true
  if (type.isNumber()) return true
  if (type.isNumberLiteral()) return true
  if (type.isBoolean()) return true
  if (type.isBooleanLiteral()) return true
  if (intrinsicNameOf(type) === 'void') {
    // isVoid
    return true
  }
  return false
}

function isPromise(type: Type) {
  const symbol = type.getSymbol()
  if (!type.isObject() || !symbol) {
    return false
  }
  const args = type.getTypeArguments()
  return symbol.getName() === 'Promise' && args.length === 1
}

function isSimpleSignature(type: Type) {
  if (!type.isObject()) {
    return false
  }
  const sigs = type.getCallSignatures()
  const props = type.getProperties()
  const args = type.getTypeArguments()
  const indexType = type.getNumberIndexType()
  const stringType = type.getStringIndexType()
  return (
    sigs.length === 1
    && props.length === 0
    && args.length === 0
    && !indexType
    && !stringType
  )
}

function intrinsicNameOf(type: Type) {
  return (type.compilerType as unknown as { intrinsicName: string }).intrinsicName
}

type FormatFlags =
  | false // <- to be able to pass down conditional flags
  | 'remove-undefined-from-intersections'

function footprintOfType(params: {
  type: Type
  node: Node
  overrides?: Record<string, string>
  excludes?: string[]
  flags?: FormatFlags[]
  callStackLevel?: number
}): string {
  const { type, node, overrides, excludes = [], flags = [], callStackLevel = 0 } = params

  if (callStackLevel > 9) {
    // too deep?
    return "'...'"
  }

  const next = (nextType: Type, nextFlags: FormatFlags[] = []) => {
    return footprintOfType({
      type: nextType,
      node,
      overrides,
      flags: nextFlags,
      callStackLevel: callStackLevel + 1,
    })
  }

  const indent = (text: string, lvl: number = 1) => text.replace(/^/gm, ' '.repeat(lvl * 2))

  const defaultFormat = () => {
    return type.getText(node, tsMorph.TypeFormatFlags.UseSingleQuotesForStringLiteralType)
  }

  const symbol = type.getAliasSymbol()
  const name = symbol?.getName() ?? type.getText(undefined, tsMorph.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope)
  if (overrides && name && callStackLevel > 0) {
    if (overrides[name]) return overrides[name]
  }

  if (isPrimitive(type)) return defaultFormat()

  if (type.isArray()) {
    const subType = type.getArrayElementTypeOrThrow()
    return `${next(subType)}[]`
  }

  if (type.isTuple()) {
    const types = type.getTupleElements()
    return [
      '[\n',
      indent(types.map((type) => next(type)).join(',\n')),
      '\n]',
    ].join('')
  }

  if (type.isObject() && isPromise(type)) {
    const first = type.getTypeArguments()[0]
    if (!first) {
      throw new Error('This should not have happened')
    }
    if (isPrimitive(first)) {
      return `Promise<${next(first)}>`
    } else {
      return `Promise<\n${indent(next(first))}\n>`
    }
  }

  if (type.isObject() && isSimpleSignature(type)) {
    return signatures(type.getCallSignatures(), 'type', next)
  }

  if (type.isObject()) {
    const props = type.getProperties().filter(p => !excludes.includes(p.getName()))
    const sigs = type.getCallSignatures()
    const numIndex = type.getNumberIndexType()
    const stringIndex = type.getStringIndexType()
    if (
      props.length === 0
      && sigs.length === 0
      && !numIndex
      && !stringIndex
    ) {
      return '{}'
    }
    const sigsText = signatures(sigs, 'declaration', next)
    const propsText = properties(props, node, next)
    const numIndexText = numIndex && `[index: number]: ${next(numIndex)};`
    const stringIndexText = stringIndex && `[index: string]: ${next(stringIndex)};`
    return [
      '{\n',
      numIndexText && indent(numIndexText),
      stringIndexText && indent(stringIndexText),
      sigs.length > 0 && indent(sigsText),
      props.length > 0 && indent(propsText),
      '\n}',
    ]
      .filter(Boolean)
      .join('')
  }

  if (type.isUnion()) {
    return type
      .getUnionTypes()
      .filter((type) => {
        if (flags.includes('remove-undefined-from-intersections')) {
          return !type.isUndefined()
        }
        return true
      })
      .map((type) => next(type))
      .join(' | ')
  }

  if (type.isIntersection()) {
    return type
      .getIntersectionTypes()
      .map((type) => next(type))
      .join(' & ')
  }

  // when you encounter this, consider changing the function
  return 'TODO'
}

function properties(
  props: Symbol[],
  node: Node,
  next: (type: Type, flags: FormatFlags[]) => string,
) {
  return props.map((value) => property(value, node, next)).join('\n')
}

function property(
  prop: Symbol,
  node: Node,
  next: (type: Type, flags: FormatFlags[]) => string,
): string {
  const type = prop.getTypeAtLocation(node)
  const sigs = type.getCallSignatures()
  const firstSig = sigs?.[0]
  let comments = prop.getValueDeclaration()?.getLeadingCommentRanges().map(c => c.getText()).join('') || ''
  if (comments) comments = comments.replace(/\n( )+/g, '\n ') + '\n'
  if (
    isSimpleSignature(type)
    && !prop.hasFlags(tsMorph.SymbolFlags.Optional)
    && firstSig
  ) {
    return comments + signature(firstSig, 'declaration', next, prop.getName()) + ';'
  } else if (sigs.length) {
    return comments + sigs.map(s => signature(s, 'declaration', next, prop.getName()) + ';').join('\n')
  }
  const isOptional = prop.hasFlags(tsMorph.SymbolFlags.Optional)
  return [
    comments,
    prop.getName(),
    isOptional ? '?' : '',
    ': ',
    next(type, [isOptional && 'remove-undefined-from-intersections']),
    ';',
  ].join('')
}

function signatures(
  sigs: Signature[],
  variant: 'type' | 'declaration',
  next: (type: Type, flags: FormatFlags[]) => string,
) {
  return sigs.map((sig) => signature(sig, variant, next)).join('\n')
}

function signature(
  sig: Signature,
  variant: 'type' | 'declaration',
  next: (type: Type, flags: FormatFlags[]) => string,
  methodName?: string,
): string {
  const name = sig.getDeclaration().getSymbol()?.getName()
  const nameToUse = methodName ?? (['__type', '__call'].includes(name ?? '') ? '' : name)
  const params = sig.getParameters()
  return [
    variant === 'declaration' ? nameToUse : '',
    '(',
    params
      .map((param) => {
        const text = param.getDeclarations()[0].getText()
        const isOptional = text.split(':')[0].includes('?') || text.includes('=')
        return [
          param.getName(),
          (isOptional || param.hasFlags(tsMorph.SymbolFlags.Optional)) ? '?' : '',
          ': ',
          param
            .getDeclarations()
            .map((decl) => next(decl.getType(), []))
            .join(','),
        ].join('')
      })
      .join(', '),
    ')',
    variant === 'declaration' ? ': ' : ' => ',
    next(sig.getReturnType(), []),
  ].join('')
}
