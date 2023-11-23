import { readFile } from 'fs/promises'
import {
  AnonymousFunctionExpr,
  ArrayLookupExpr,
  AssertExpr,
  AssignmentNode,
  type ASTVisitor,
  BinaryOpExpr,
  BlockStmt,
  CodeFile,
  EchoExpr,
  ErrorNode,
  Expression,
  FunctionCallExpr,
  FunctionDeclarationStmt,
  GroupingExpr,
  IfElseStatement,
  IncludeStmt,
  LcEachExpr,
  LcForCExpr,
  LcForExpr,
  LcIfExpr,
  LcLetExpr,
  LetExpr,
  LiteralExpr,
  LookupExpr,
  MemberLookupExpr,
  ModuleDeclarationStmt,
  ModuleInstantiationStmt,
  NoopStmt,
  ParsingHelper,
  RangeExpr,
  ScadFile,
  Statement,
  TernaryExpr,
  TokenType,
  UnaryOpExpr,
  UseStmt,
  VectorExpr,
} from 'openscad-parser'
import { fileURLToPath } from 'url'
import type { GroupOperation, Operation } from './modeling'
import load from './openscad.wasm.js'

class MyVisitor {
  visitModuleInstantiationStmt(n: ModuleInstantiationStmt): Operation {
    if (!n.child) throw new Error('Module Instantiation statement must not be empty.')
    console.log(n.name)
    switch (n.name) {
      case 'group': {
        if (n.child instanceof BlockStmt) return this.processBlock('union', n.child)
        return { op: 'union', shapes: [] }
      }
      case 'color':
      case 'render':
      case 'union':
        return this.processBlock('union', n.child)
      case 'intersection':
        return this.processBlock('intersection', n.child)
      case 'hull':
        return this.processBlock('hull', n.child)
      case 'difference':
        return this.processBlock('difference', n.child)
      case 'multmatrix':
        return { op: 'multmatrix', matrix: this.nthArg(n.args, 0), obj: this.processBlock('union', n.child) }
      case 'cube': {
        const [x, y, z]: number[] = this.findArg(n.args, 'size')
        const center: boolean = this.findArg(n.args, 'center')
        if (center) return { op: 'cube', x, y, z }
        else return { op: 'translate', x: x / 2, y: y / 2, z: z / 2, obj: { op: 'cube', x, y, z } }
      }
      case 'cylinder': {
        const r1: number = this.findArg(n.args, 'r1')
        const r2: number = this.findArg(n.args, 'r2')
        const h: number = this.findArg(n.args, 'h')
        if (r1 != r2) throw new Error('Can only process constant-radius cylinders')
        const center: boolean = this.findArg(n.args, 'center')
        if (center) return { op: 'cylinder', r: r1, h: h, ...this.findSubdivisionArgs(n.args) }
        else return { op: 'translate', x: 0, y: 0, z: h / 2, obj: { op: 'cylinder', r: r1, h: h, ...this.findSubdivisionArgs(n.args) } }
      }
      case 'linear_extrude': {
        const height = this.findArg(n.args, 'height')
        return { op: 'linear_extrude', height, ...this.findSubdivisionArgs(n.args), obj: this.processBlock('union', n.child) }
      }
      case 'offset': {
        const r = this.findArgMaybe(n.args, 'r')
        const delta = this.findArgMaybe(n.args, 'r')
        const chamfer = this.findArgMaybe(n.args, 'r')
        return { op: 'offset', r, delta, chamfer, ...this.findSubdivisionArgs(n.args), obj: this.processBlock('union', n.child) }
      }
      case 'circle': {
        const r = this.findArg(n.args, 'r')
        return { op: 'circle', r, ...this.findSubdivisionArgs(n.args) }
      }
      case 'sphere': {
        const r = this.findArg(n.args, 'r')
        return { op: 'sphere', r, ...this.findSubdivisionArgs(n.args) }
      }
      case 'square': {
        const [x, y]: number[] = this.findArg(n.args, 'size')
        const center: boolean = this.findArg(n.args, 'center')
        if (center) return { op: 'square', x, y }
        else return { op: 'translate', x: x / 2, y: y / 2, z: 0, obj: { op: 'square', x, y } }
      }
      case 'polyhedron':
        return { op: 'polyhedron', faces: this.findArg(n.args, 'faces'), points: this.findArg(n.args, 'points') }
      default:
        throw new Error("I don't know how to process the module " + n.name)
    }
  }

  private nthArg(args: AssignmentNode[], n: number) {
    const result = args[n]
    if (!result) throw new Error(`Could not find arg at position ${n}`)
    if (!result.value) throw new Error(`Argument at postion ${n} has no value`)

    return this.processArg(result.value)
  }

  private findArg(args: AssignmentNode[], arg: string) {
    const result = args.find(a => a.name === arg)
    if (!result) throw new Error('Could not find argument with name ' + arg)
    if (!result.value) throw new Error(`Argument ${arg} has no value`)

    return this.processArg(result.value)
  }

  private findArgMaybe(args: AssignmentNode[], arg: string) {
    const result = args.find(a => a.name === arg)
    if (!result) return undefined
    if (!result.value) throw new Error(`Argument ${arg} has no value`)

    return this.processArg(result.value)
  }

  private findSubdivisionArgs(args: AssignmentNode[]) {
    const fn = this.findArg(args, '$fn')
    const fa = this.findArg(args, '$fa')
    const fs = this.findArg(args, '$fs')
    return { fn, fa, fs }
  }

  private processArg(exp: Expression): any {
    if (exp instanceof VectorExpr) return exp.children.map(e => this.processArg(e))
    if (exp instanceof UnaryOpExpr) {
      switch (exp.operation) {
        case TokenType.Minus:
          return -this.processArg(exp.right)
        default:
          throw new Error(`Cannot process operation`)
      }
    }
    if (exp instanceof LiteralExpr) return exp.value
    const props = Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, v.toString()]))
    throw new Error(`I don't know how to deal with argument ${JSON.stringify(props)}`)
  }

  private processBlock(op: GroupOperation['op'], stmt: Statement) {
    if (!(stmt instanceof BlockStmt)) throw new Error('Expected a block statement for ' + op)

    let source: GroupOperation = { op, shapes: [] }
    for (const s of stmt.children) {
      if (s instanceof NoopStmt) continue
      if (s instanceof ModuleInstantiationStmt) source.shapes.push(this.visitModuleInstantiationStmt(s))
      else throw new Error('Unknown stmt')
    }
    return source
  }

  visitNoopStmt(n: NoopStmt): Operation {
    throw new Error('Method not implemented.')
  }
  visitIfElseStatement(n: IfElseStatement): Operation {
    throw new Error('Method not implemented.')
  }
  visitErrorNode(n: ErrorNode): Operation {
    throw new Error('Method not implemented.')
  }
  visitScadFile(n: ScadFile): Operation {
    let source: Operation = { op: 'union', shapes: [] }
    for (const stmt of n.statements) {
      if (stmt instanceof ModuleInstantiationStmt) source.shapes.push(this.visitModuleInstantiationStmt(stmt))
      else throw new Error('Unknown stmt')
    }
    return source
  }
}

export async function parse(filename: string) {
  const file = await CodeFile.load(filename)
  const [ast, errorCollector] = ParsingHelper.parseFile(file)
  if (errorCollector.hasErrors()) {
    errorCollector.printErrors()
    throw new Error('Error parsing')
  }
  if (!ast) {
    throw new Error('No AST')
  }
  return new MyVisitor().visitScadFile(ast)
}

export async function parseString(code: string) {
  const [ast, errorCollector] = ParsingHelper.parseFile(new CodeFile('file.scad', code))
  if (errorCollector.hasErrors()) {
    errorCollector.printErrors()
    throw new Error('Error parsing')
  }
  if (!ast) {
    throw new Error('No AST')
  }
  return new MyVisitor().visitScadFile(ast)
}

export interface OpenSCAD extends EmscriptenModule {
  FS: {
    mkdir(path: string, mode?: number): any
    readFile(path: string, opts: { encoding: 'binary'; flags?: string | undefined }): Uint8Array
    readFile(path: string, opts: { encoding: 'utf8'; flags?: string | undefined }): string
    readFile(path: string, opts?: { flags?: string | undefined }): Uint8Array
    writeFile(path: string, data: string | ArrayBufferView, opts?: { flags?: string | undefined }): void
  }
  callMain(args: string[]): void
}
export async function loadOpenSCAD(): Promise<OpenSCAD> {
  const wasm = fileURLToPath(new URL('openscad.wasm', import.meta.url))
  const fileBuffer = await readFile(wasm)

  return new Promise((resolve) => {
    const mod = {
      noInitialRun: true,
      wasmBinary: fileBuffer.buffer,
      onRuntimeInitialized: () => resolve(mod as any),
      print: () => {},
      printErr: () => {},
    }
    load(mod)
  })
}
