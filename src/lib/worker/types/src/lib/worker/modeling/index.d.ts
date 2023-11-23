import type { TopoDS_Vertex } from '$assets/replicad_single'
import { type AnyShape, Compound, Face, Solid } from 'replicad'
import type Trsf from './transformation'
export declare function getOC(): OpenCascadeInstance
export declare function combine(objs: (AnyShape | null | undefined)[]): Compound
export declare function makeTriangle(a: Trsf, b: Trsf, c: Trsf): Face
export declare function makeQuad(a: Trsf, b: Trsf, c: Trsf, d: Trsf): Face
export declare function makePolygon(pts: TopoDS_Vertex[]): Face
export declare function buildSewnSolid(polygons: Face[]): Solid
export declare function buildFixedSolid(polygons: Face[]): Solid
export declare function buildSolid(polygons: Face[]): Solid
