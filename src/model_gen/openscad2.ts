/**
 * Updated version of OpenSCAD parser.
 *
 * This code uses the OpenSCAD web asssembly binary to compile OpenSCAD code
 * into CSG format (this is very fast). The CSG format is like OpenSCAD but
 * with a subset of commmands (no variables, for loops, etc).
 *
 * The Manifold-3D library is then used to execute the operations CSG file.
 * Manifold is much faster than the WASM builds of OpenSCAD. This transformation
 * is done using the openscad-parser package to parse the CSG file.
 */

import { notNull } from '$lib/worker/util'
import { readdirSync, readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import type { CrossSection, Manifold, ManifoldToplevel, Mat4, Polygons, Vec2, Vec3 } from 'manifold-3d'
import loadMF from 'manifold-3d'
import * as parser from 'openscad-parser'
import { join, resolve } from 'path'
import { BufferAttribute, BufferGeometry, Vector2 } from 'three'
import { fileURLToPath } from 'url'
import load from '../assets/openscad.wasm.js'

let mf: ManifoldToplevel

type Shape = Manifold | CrossSection | Polygons | null

function union(shapes: Shape[]) {
  const filtered = notNull(shapes)
  if (!filtered.length) return null
  return filtered.reduce((a, b) => {
    if (a instanceof mf.Manifold && b instanceof mf.Manifold) return a.add(b)
    if (a instanceof mf.CrossSection && b instanceof mf.CrossSection) return a.add(b)
    throw new Error('Incompatible types')
  })
}

function intersection(shapes: Shape[]) {
  const filtered = notNull(shapes)
  return filtered.reduce((a, b) => {
    if (a instanceof mf.Manifold && b instanceof mf.Manifold) return a.intersect(b)
    if (a instanceof mf.CrossSection && b instanceof mf.CrossSection) return a.intersect(b)
    throw new Error('Incompatible types')
  })
}

function difference(shapes: Shape[]) {
  const filtered = notNull(shapes)
  return filtered.reduce((a, b) => {
    if (a instanceof mf.Manifold && b instanceof mf.Manifold) return a.subtract(b)
    if (a instanceof mf.CrossSection && b instanceof mf.CrossSection) return a.subtract(b)
    throw new Error('Incompatible types')
  })
}

function hull(shapes: Shape[]) {
  // @ts-ignore
  return mf.Manifold.hull(notNull(shapes))
}

function ensureCCW(p: Vec2[]) {
  const ba = new Vector2(p[0][0] - p[1][0], p[0][1] - p[1][1])
  const bc = new Vector2(p[2][0] - p[1][0], p[2][1] - p[1][1])
  if (ba.cross(bc) > 0) p.reverse()
  return p
}

class MyVisitor {
  visitModuleInstantiationStmt(n: parser.ModuleInstantiationStmt): Shape {
    if (!n.child) throw new Error('Module Instantiation statement must not be empty.')
    switch (n.name) {
      case 'group': {
        if (n.child instanceof parser.BlockStmt) return this.processBlock(union, n.child)
        return null
      }
      case 'color':
      case 'render':
      case 'union':
        return this.processBlock(union, n.child)
      case 'intersection':
        return this.processBlock(intersection, n.child)
      case 'hull':
        return this.processBlock(hull, n.child)
      case 'difference':
        return this.processBlock(difference, n.child)
      case 'multmatrix': {
        const operands = this.processBlock(union, n.child)
        if (!operands) return null
        const matrix: number[][] = this.nthArg(n.args, 0)
        const transpose = matrix[0].map((_col, i) => matrix.map(row => row[i]))
        if (!(operands instanceof mf.Manifold || operands instanceof mf.Manifold)) {
          throw new Error('multmatrix expects CrossSection or Manifold')
        }
        for (let i = 0; i < 4; i++) {
          return operands!.transform(transpose.flat() as Mat4)
        }
      }
      case 'cube': {
        const size: Vec3 = this.findArg(n.args, 'size')
        const center: boolean = this.findArg(n.args, 'center')
        return mf.Manifold.cube(size, center)
      }
      case 'cylinder': {
        const r1: number = this.findArg(n.args, 'r1')
        const r2: number = this.findArg(n.args, 'r2')
        const h: number = this.findArg(n.args, 'h')
        const fn = this.getFragmentsFromR([r1, r2], n.args)
        const center: boolean = this.findArg(n.args, 'center')
        return mf.Manifold.cylinder(h, r1, r2, fn, center)
      }
      case 'linear_extrude': {
        const children = this.processBlock(union, n.child)
        const height = this.findArg(n.args, 'height')
        const slices = this.findArgMaybe(n.args, 'slices')
        const twist = this.findArgMaybe(n.args, 'twist')
        const scale = this.findArgMaybe(n.args, 'scale')
        const center = this.findArgMaybe(n.args, 'center')
        if (!children) throw new Error('Expceted children to be non-null')
        if (children instanceof mf.Manifold) throw new Error('Canot work with manifolds')
        return mf.Manifold.extrude(children, height, slices, twist, scale, center)
      }
      case 'offset': {
        const r = this.findArgMaybe(n.args, 'r')
        const delta = this.findArgMaybe(n.args, 'delta')
        const chamfer = this.findArgMaybe(n.args, 'chamfer')

        const op = this.processBlock(union, n.child)
        if (!(op instanceof mf.CrossSection)) throw new Error('Not a cross section')
        if (r) return op.offset(r, 'Round', undefined, this.getFragmentsFromR(r, n.args))
        if (delta && chamfer) return op.offset(delta, 'Miter')
        if (delta && !chamfer) return op.offset(delta, 'Square')
      }
      case 'circle': {
        const r = this.findRadius(n.args)
        const fn = this.getFragmentsFromR(r, n.args)
        return mf.CrossSection.circle(r, fn)
      }
      case 'sphere': {
        const r = this.findRadius(n.args)
        const fn = this.getFragmentsFromR(r, n.args)
        return mf.Manifold.sphere(r, fn)
      }
      case 'square': {
        const size: Vec2 = this.findArg(n.args, 'size')
        const center: boolean = this.findArg(n.args, 'center')
        return mf.CrossSection.square(size, center)
      }
      // case 'polyhedron':
      // return { op: 'polyhedron', faces: this.findArg(n.args, 'faces'), points: this.findArg(n.args, 'points') }
      case 'resize': {
        // Derived from OpenSCAD operation
        const op = this.processBlock(union, n.child)
        const newSize = this.nthArg(n.args, 0)
        const auto = this.findArgMaybe(n.args, 'auto')
        if (!(op instanceof mf.Manifold)) throw new Error('Expected manifold')
        const bbox = op.boundingBox()

        let maxdim = 0
        for (let i = 1; i < 3; i++) if (newSize[i] > newSize[maxdim]) maxdim = i

        // Default scale (scale with 1 if the new size is 0)
        const scale: Vec3 = [1, 1, 1]
        for (let i = 0; i < 3; i++) if (newSize[i] > 0) scale[i] = newSize[i] / (bbox.max[i] - bbox.min[i])

        let autoScale = scale[maxdim]
        const newScale: Vec3 = [1, 1, 1]
        for (let i = 0; i < 3; i++) newScale[i] = !auto[i] || (newSize[i] > 0) ? scale[i] : autoScale

        return op.scale(newScale)
      }
      case 'projection': {
        let op = this.processBlock(union, n.child)
        const cut = this.findArgMaybe(n.args, 'cut')
        if (!(op instanceof mf.Manifold)) throw new Error('Expected manifold')
        if (cut) {
          op = op.trimByPlane([0, 0, 1], -0.01).trimByPlane([0, 0, -1], -0.01)
        }
        const vertices: Vec2[] = []
        op.warp(v => vertices.push([v[0], v[1]]))
        const tris = mf.triangulate(vertices) as number[][]
        return tris.map(v => ensureCCW(v.map(i => vertices[i])))
      }
      default:
        throw new Error("I don't know how to process the module " + n.name)
    }
  }

  private nthArg(args: parser.AssignmentNode[], n: number) {
    const result = args[n]
    if (!result) throw new Error(`Could not find arg at position ${n}`)
    if (!result.value) throw new Error(`Argument at postion ${n} has no value`)

    return this.processArg(result.value)
  }

  private findArg(args: parser.AssignmentNode[], arg: string) {
    const result = args.find(a => a.name === arg)
    if (!result) throw new Error('Could not find argument with name ' + arg)
    if (!result.value) throw new Error(`Argument ${arg} has no value`)

    return this.processArg(result.value)
  }

  private findArgMaybe(args: parser.AssignmentNode[], arg: string) {
    const result = args.find(a => a.name === arg)
    if (!result) return undefined
    if (!result.value) throw new Error(`Argument ${arg} has no value`)

    return this.processArg(result.value)
  }

  private findRadius(args: parser.AssignmentNode[]) {
    const r = args.find(a => a.name === 'r')
    const d = args.find(a => a.name === 'd')
    if (r) return this.findArg(args, 'r')
    if (d) return this.findArg(args, 'd') / 2
    throw new Error('Neither radius nor diameter found in arguments')
  }

  private getFragmentsFromR(r: number | number[], args: parser.AssignmentNode[]) {
    // Derived from OpenSCAD codebase
    const fn = this.findArgMaybe(args, '$fn')
    const fs = this.findArgMaybe(args, '$fs')
    const fa = this.findArgMaybe(args, '$fa')
    const radius = (typeof r === 'number') ? r : Math.max(...r)
    if (radius < 1e-6) return 3
    if (fn > 0) return Math.max(fn, 3)
    return Math.ceil(Math.max(Math.min(360.0 / fa, radius * 2 * Math.PI / fs), 5))
  }

  private processArg(exp: parser.Expression): any {
    if (exp instanceof parser.VectorExpr) return exp.children.map(e => this.processArg(e))
    if (exp instanceof parser.UnaryOpExpr) {
      switch (exp.operation) {
        case parser.TokenType.Minus:
          return -this.processArg(exp.right)
        default:
          throw new Error(`Cannot process operation`)
      }
    }
    if (exp instanceof parser.LiteralExpr) return exp.value
    const props = Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, v.toString()]))
    throw new Error(`I don't know how to deal with argument ${JSON.stringify(props)}`)
  }

  private processBlock(fn: (s: Shape[]) => Shape, stmt: parser.Statement): Shape {
    if (!(stmt instanceof parser.BlockStmt)) throw new Error('Expected a block')
    const shapes: Shape[] = []
    for (const s of stmt.children) {
      if (s instanceof parser.NoopStmt) continue
      if (s instanceof parser.ModuleInstantiationStmt) shapes.push(this.visitModuleInstantiationStmt(s))
      else throw new Error('Unknown stmt')
    }
    return fn(shapes)
  }

  visitScadFile(n: parser.ScadFile): BufferGeometry {
    const shapes: Shape[] = []
    for (const stmt of n.statements) {
      if (stmt instanceof parser.ModuleInstantiationStmt) shapes.push(this.visitModuleInstantiationStmt(stmt))
      else throw new Error('Unknown stmt')
    }
    const result = union(shapes)
    if (!(result instanceof mf.Manifold)) throw new Error('Expected a Manifold')
    const mesh = result.getMesh()
    let geometry = new BufferGeometry()
    geometry.attributes['position'] = new BufferAttribute(mesh.vertProperties, 3)
    geometry.setIndex(new BufferAttribute(mesh.triVerts, 1))
    geometry = geometry.toNonIndexed()
    geometry.computeVertexNormals()
    return geometry
  }
}

export async function parse(filename: string) {
  const file = await parser.CodeFile.load(filename)
  const [ast, errorCollector] = parser.ParsingHelper.parseFile(file)
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
  const [ast, errorCollector] = parser.ParsingHelper.parseFile(new parser.CodeFile('file.scad', code))
  if (errorCollector.hasErrors()) {
    errorCollector.printErrors()
    throw new Error('Error parsing')
  }
  if (!ast) {
    throw new Error('No AST')
  }
  return new MyVisitor().visitScadFile(ast)
}

export interface OpenSCAD {
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
  const wasm = fileURLToPath(new URL('../assets/openscad.wasm', import.meta.url))
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

export async function loadManifold(): Promise<void> {
  mf = await loadMF()
  mf.setup()
}

/** Copy a directory of scad files to the OpenSCAD filesystem */
export function copyToFS(openscad: OpenSCAD, local: string, dir: string) {
  openscad.FS.mkdir(dir)
  const dirents = readdirSync(local, { withFileTypes: true })
  for (const dirent of dirents) {
    const loc = resolve(local, dirent.name)
    const dr = join(dir, dirent.name)
    if (dirent.isDirectory() && !dirent.name.endsWith('git')) {
      copyToFS(openscad, loc, dr)
    } else if (dirent.name.endsWith('.scad')) {
      const contents = readFileSync(loc, { encoding: 'utf8' })
      openscad.FS.writeFile(dr, contents)
    }
  }
}
