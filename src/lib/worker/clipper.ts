/** Modified version of clipper.js
 *
 * I've updated the syntax to modern Typescript and removed functions I didn't need.
 *
 * Stuff removed includes Minkowski, Strictly simple mode
 * I've also changed the Point interface to use lowercase x and y
 * to be consistent with libraries like Three.js
 */

/*******************************************************************************
 *                                                                              *
 * Author    :  Angus Johnson                                                   *
 * Version   :  6.4.2                                                           *
 * Date      :  27 February 2017                                                *
 * Website   :  http://www.angusj.com                                           *
 * Copyright :  Angus Johnson 2010-2017                                         *
 *                                                                              *
 * License:                                                                     *
 * Use, modification & distribution is subject to Boost Software License Ver 1. *
 * http://www.boost.org/LICENSE_1_0.txt                                         *
 *                                                                              *
 * Attributions:                                                                *
 * The code in this library is an extension of Bala Vatti's clipping algorithm: *
 * "A generic solution to polygon clipping"                                     *
 * Communications of the ACM, Vol 35, Issue 7 (July 1992) pp 56-63.             *
 * http://portal.acm.org/citation.cfm?id=129906                                 *
 *                                                                              *
 * Computer graphics and geometric modeling: implementation and algorithms      *
 * By Max K. Agoston                                                            *
 * Springer; 1 edition (January 4, 2005)                                        *
 * http://books.google.com/books?q=vatti+clipping+agoston                       *
 *                                                                              *
 * See also:                                                                    *
 * "Polygon Offsetting by Computing Winding Numbers"                            *
 * Paper no. DETC2005-85513 pp. 565-575                                         *
 * ASME 2005 International Design Engineering Technical Conferences             *
 * and Computers and Information in Engineering Conference (IDETC/CIE2005)      *
 * September 24-28, 2005 , Long Beach, California, USA                          *
 * http://www.me.berkeley.edu/~mcmains/pubs/DAC05OffsetPolygon.pdf              *
 *                                                                              *
 *******************************************************************************/
/*******************************************************************************
 *                                                                              *
 * Author    :  Timo                                                            *
 * Version   :  6.4.2.2                                                         *
 * Date      :  8 September 2017                                                 *
 *                                                                              *
 * This is a translation of the C# Clipper library to Javascript.               *
 * Int128 struct of C# is implemented using JSBN of Tom Wu.                     *
 * Because Javascript lacks support for 64-bit integers, the space              *
 * is a little more restricted than in C# version.                              *
 *                                                                              *
 * C# version has support for coordinate space:                                 *
 * +-4611686018427387903 ( sqrt(2^127 -1)/2 )                                   *
 * while Javascript version has support for space:                              *
 * +-4503599627370495 ( sqrt(2^106 -1)/2 )                                      *
 *                                                                              *
 * Tom Wu's JSBN proved to be the fastest big integer library:                  *
 * http://jsperf.com/big-integer-library-test                                   *
 *                                                                              *
 * This class can be made simpler when (if ever) 64-bit integer support comes   *
 * or floating point Clipper is released.                                       *
 *                                                                              *
 *******************************************************************************/

'use strict'

// export const version = '6.4.2.2'

// UseLines: Enables open path clipping. Adds a very minor cost to performance.
const use_lines = false

// use_xyz: adds a Z member to IntPoint. Adds a minor cost to performance.
const use_xyz = false

type Ref<T> = { v?: T }
type Ref2<T> = { Value?: T }

export class Path extends Array<Point> {}

export class Paths extends Array<Path> {}

interface Point {
  x: number
  y: number
  z?: number
}
// Preserves the calling way of original C# Clipper
// Is essential due to compatibility, because DoublePoint is public class in original C# version
class DoublePoint implements Point {
  public x: number
  public y: number

  constructor(a: DoublePoint | IntPoint)
  constructor(a: number, b: number)
  constructor(a?: DoublePoint | IntPoint | number, b?: number) {
    this.x = 0
    this.y = 0
    // public DoublePoint(DoublePoint dp)
    // public DoublePoint(IntPoint ip)
    if (typeof a == 'number') {
      this.x = a
      this.y = b!
    } else {
      this.x = a!.x
      this.y = a!.y
    }
  }
}

class Int128 {
  static op_Equality(a: bigint, b: bigint) {
    if (a == b) return true
    return false
  }

  static Int128Mul(a: number, b: number) {
    return BigInt(a) * BigInt(b)
  }
}

export class PolyNode {
  m_Parent: PolyNode | null = null
  m_polygon = new Path()
  m_Index = 0
  m_jointype = 0
  m_endtype = 0
  m_Childs: PolyNode[] = []
  IsOpen = false

  // protected IsHoleNode() {
  //   let result = true
  //   let node = this.m_Parent
  //   while (node !== null) {
  //     result = !result
  //     node = node.m_Parent
  //   }
  //   return result
  // }

  public ChildCount() {
    return this.m_Childs.length
  }

  // Commented out since this is not used
  // public Contour() {
  //   return this.m_polygon
  // }

  public AddChild(Child: PolyNode) {
    const cnt = this.m_Childs.length
    this.m_Childs.push(Child)
    Child.m_Parent = this
    Child.m_Index = cnt
  }

  // Commented out since this is not used
  // public GetNext() {
  //   if (this.m_Childs.length > 0) {
  //     return this.m_Childs[0]
  //   } else {
  //     return this.GetNextSiblingUp()
  //   }
  // }

  public GetNextSiblingUp(): PolyNode | null {
    if (this.m_Parent === null) {
      return null
    } else if (this.m_Index === this.m_Parent.m_Childs.length - 1) {
      return this.m_Parent.GetNextSiblingUp()
    } else {
      return this.m_Parent.m_Childs[this.m_Index + 1]
    }
  }

  public Childs() {
    return this.m_Childs
  }

  // Commented out since this is not used
  // public Parent() {
  //   return this.m_Parent
  // }

  // public IsHole() {
  //   return this.IsHoleNode()
  // }
}

// PolyTree : PolyNode
/**
 * @suppress {missingProperties}
 * @constructor
 */
export class PolyTree extends PolyNode {
  public m_AllPolys: (PolyNode | null)[] = []
  public Clear() {
    for (let i = 0, ilen = this.m_AllPolys.length; i < ilen; i++) {
      this.m_AllPolys[i] = null
    }
    this.m_AllPolys.length = 0
    this.m_Childs.length = 0
  }

  // Commented out since these are not used
  // public GetFirst() {
  //   if (this.m_Childs.length > 0) {
  //     return this.m_Childs[0]
  //   } else {
  //     return null
  //   }
  // }

  // public Total() {
  //   let result = this.m_AllPolys.length
  //   // with negative offsets, ignore the hidden outer polygon ...
  //   if (result > 0 && this.m_Childs[0] !== this.m_AllPolys[0]) result--
  //   return result
  // }
}

// PolyTree & PolyNode end

// 	export function Math_Abs_Double (a)
// 	{
// 		return Math.abs(a);
// 	};
//     const Math_Abs_Int32 = Math_Abs_Double
//     const Math_Abs_Int64 = Math_Abs_Double

// 	export function Math_Max_Int32_Int32 (a, b)
// 	{
// 		return Math.max(a, b);
// 	};

function Cast_Int32(a: number) {
  return ~~a
}

function Cast_Int64(a: number) {
  if (a < -2147483648 || a > 2147483647) {
    return a < 0 ? Math.ceil(a) : Math.floor(a)
  } else return ~~a
}

function Clear(a: any[]) {
  a.length = 0
}

// MaxSteps = 64; // How many steps at maximum in arc in BuildArc() function
// export const PI = 3.141592653589793
// export const PI2 = 2 * 3.141592653589793
export class IntPoint implements Point {
  public x: number
  public y: number
  // @ts-ignore
  public z?: number

  constructor()
  constructor(x: number, y: number)
  constructor(x: number, y: number, z: number)
  constructor(point: IntPoint)
  constructor(doublePoint: DoublePoint)
  constructor(...a: [number, number] | [number, number, number] | [IntPoint] | [DoublePoint]) {
    const alen = a.length
    this.x = 0
    this.y = 0
    if (use_xyz) {
      this.z = 0
      if (alen === 3) { // public IntPoint(cInt x, cInt y, cInt z = 0)
        this.x = a[0]
        this.y = a[1]
        this.z = a[2]
      } else if (alen === 2) { // public IntPoint(cInt x, cInt y)
        this.x = a[0]
        this.y = a[1]
        this.z = 0
      } else if (alen === 1) {
        if (a[0] instanceof DoublePoint) { // public IntPoint(DoublePoint dp)
          const dp = a[0]
          this.x = Clipper.Round(dp.x)
          this.y = Clipper.Round(dp.y)
          this.z = 0
        } // public IntPoint(IntPoint pt)
        else {
          const pt = a[0]
          if (typeof (pt.z) === 'undefined') pt.z = 0
          this.x = pt.x
          this.y = pt.y
          this.z = pt.z
        }
      } // public IntPoint()
      else {
        this.x = 0
        this.y = 0
        this.z = 0
      }
    } // if (!use_xyz)
    else {
      if (alen === 2) { // public IntPoint(cInt X, cInt Y)
        this.x = a[0]
        this.y = a[1]
      } else if (alen === 1) {
        if (a[0] instanceof DoublePoint) { // public IntPoint(DoublePoint dp)
          const dp = a[0]
          this.x = Clipper.Round(dp.x)
          this.y = Clipper.Round(dp.y)
        } // public IntPoint(IntPoint pt)
        else {
          const pt = a[0]
          this.x = pt.x
          this.y = pt.y
        }
      } // public IntPoint(IntPoint pt)
      else {
        this.x = 0
        this.y = 0
      }
    }
  }

  static op_Equality(a: Point, b: Point) {
    // return a == b;
    return a.x === b.x && a.y === b.y
  }

  static op_Inequality(a: Point, b: Point) {
    // return a !== b;
    return a.x !== b.x || a.y !== b.y
  }

  // 	Equals (obj) {
  //     if (obj === null)
  //         return false;
  //     if (obj instanceof IntPoint)
  //     {
  //         const a = Cast(obj, IntPoint);
  //         return (this.X == a.X) && (this.Y == a.Y);
  //     }
  //     else
  //         return false;
  //   };
}

class IntRect {
  public left: number
  public right: number
  public top: number
  public bottom: number

  constructor(a: number, b: number, c: number, d: number)
  constructor(a: IntRect)
  constructor()
  constructor(...a: [number, number, number, number] | [IntRect]) {
    const alen = a.length
    if (alen === 4) { // function (l, t, r, b)
      this.left = a[0]
      this.top = a[1]
      this.right = a[2]
      this.bottom = a[3]
    } else if (alen === 1) { // function (ir)
      const ir = a[0]
      this.left = ir.left
      this.top = ir.top
      this.right = ir.right
      this.bottom = ir.bottom
    } // function ()
    else {
      this.left = 0
      this.top = 0
      this.right = 0
      this.bottom = 0
    }
  }
}

export enum ClipType {
  ctIntersection = 0,
  ctUnion = 1,
  ctDifference = 2,
  ctXor = 3,
}

export enum PolyType {
  ptSubject = 0,
  ptClip = 1,
}

export enum PolyFillType {
  pftEvenOdd = 0,
  pftNonZero = 1,
  pftPositive = 2,
  pftNegative = 3,
}

export enum JoinType {
  jtSquare = 0,
  jtRound = 1,
  jtMiter = 2,
}

export enum EndType {
  etOpenSquare = 0,
  etOpenRound = 1,
  etOpenButt = 2,
  etClosedLine = 3,
  etClosedPolygon = 4,
}

export enum EdgeSide {
  esLeft = 0,
  esRight = 1,
}

export enum Direction {
  dRightToLeft = 0,
  dLeftToRight = 1,
}

export class TEdge {
  Bot = new IntPoint()
  Curr = new IntPoint() // current (updated for every new scanbeam)
  Top = new IntPoint()
  Delta = new IntPoint()
  Dx = 0
  PolyTyp = PolyType.ptSubject
  Side = EdgeSide.esLeft // side only refers to current side of solution poly
  WindDelta = 0 // 1 or -1 depending on winding direction
  WindCnt = 0
  WindCnt2 = 0 // winding count of the opposite polytype
  OutIdx = 0
  Next: TEdge = null as any
  Prev: TEdge = null as any
  NextInLML: TEdge | null = null
  NextInAEL: TEdge | null = null
  PrevInAEL: TEdge | null = null
  NextInSEL: TEdge | null = null
  PrevInSEL: TEdge | null = null
}

// 	/**
// 	* @constructor
// 	*/
export class IntersectNode {
  Edge1: TEdge | null = null
  Edge2: TEdge | null = null
  Pt = new IntPoint()
}

// 	export function MyIntersectNodeSort () {};

function MyIntersectNodeSort_Compare(node1: IntersectNode, node2: IntersectNode) {
  const i = node2.Pt.y - node1.Pt.y
  if (i > 0) return 1
  else if (i < 0) return -1
  else return 0
}

export class LocalMinima {
  Y = 0
  LeftBound: TEdge | null = null
  RightBound: TEdge | null = null
  Next: LocalMinima | null = null
}

export class Scanbeam {
  Y = 0
  Next: Scanbeam | null = null
}

export class Maxima {
  X = 0
  Next: Maxima | null = null
  Prev: Maxima | null = null
}

// OutRec: contains a path in the clipping solution. Edges in the AEL will
// carry a pointer to an OutRec when they are part of the clipping solution.
export class OutRec {
  Idx = 0
  IsHole = false
  IsOpen = false
  FirstLeft: OutRec | null = null // see comments in clipper.pas
  Pts: OutPt | null = null
  BottomPt: OutPt | null = null
  PolyNode: PolyNode | null = null
}

export class OutPt {
  Idx = 0
  Pt = new IntPoint()
  Next: OutPt = null as any
  Prev: OutPt = null as any
}

export class Join {
  OutPt1: OutPt = null as any
  OutPt2: OutPt = null as any
  OffPt = new IntPoint()
}

export class ClipperBase {
  protected m_MinimaList: LocalMinima | null = null
  protected m_CurrentLM: LocalMinima | null = null
  protected m_edges = new Array()
  protected m_UseFullRange = false
  protected m_HasOpenPaths = false
  protected PreserveCollinear = false
  protected m_Scanbeam: Scanbeam | null = null
  protected m_PolyOuts: (OutRec | null)[] = null as any
  protected m_ActiveEdges: TEdge | null = null

  // Ranges are in original C# too high for Javascript (in current state 2013 september):
  // protected const double horizontal = -3.4E+38;
  // internal const cInt loRange = 0x3FFFFFFF; // = 1073741823 = sqrt(2^63 -1)/2
  // internal const cInt hiRange = 0x3FFFFFFFFFFFFFFFL; // = 4611686018427387903 = sqrt(2^127 -1)/2
  // So had to adjust them to more suitable for Javascript.
  // If JS some day supports truly 64-bit integers, then these ranges can be as in C#
  // and biginteger library can be more simpler (as then 128bit can be represented as two 64bit numbers)
  protected static horizontal = -9007199254740992 // -2^53
  protected static Skip = -2
  protected static Unassigned = -1
  protected static tolerance = 1E-20
  protected static loRange = 47453132 // sqrt(2^53 -1)/2
  protected static hiRange = 4503599627370495 // sqrt(2^106 -1)/2

  public static near_zero(val: number) {
    return (val > -ClipperBase.tolerance) && (val < ClipperBase.tolerance)
  }

  protected static IsHorizontal(e: TEdge) {
    return e.Delta.y === 0
  }

  // Commented out since this is not used
  // public PointIsVertex(pt: IntPoint, pp: OutPt) {
  //   let pp2 = pp
  //   do {
  //     if (IntPoint.op_Equality(pp2.Pt, pt)) {
  //       return true
  //     }
  //     pp2 = pp2.Next
  //   } while (pp2 !== pp)
  //   return false
  // }

  // protected PointOnLineSegment(pt: IntPoint, linePt1: IntPoint, linePt2: IntPoint, UseFullRange: boolean) {
  //   if (UseFullRange) {
  //     return ((pt.X === linePt1.X) && (pt.Y === linePt1.Y))
  //       || ((pt.X === linePt2.X) && (pt.Y === linePt2.Y))
  //       || (((pt.X > linePt1.X) === (pt.X < linePt2.X))
  //         && ((pt.Y > linePt1.Y) === (pt.Y < linePt2.Y))
  //         && (Int128.op_Equality(Int128.Int128Mul(pt.X - linePt1.X, linePt2.Y - linePt1.Y), Int128.Int128Mul(linePt2.X - linePt1.X, pt.Y - linePt1.Y))))
  //   } else {
  //     return ((pt.X === linePt1.X) && (pt.Y === linePt1.Y)) || ((pt.X === linePt2.X) && (pt.Y === linePt2.Y))
  //       || (((pt.X > linePt1.X) === (pt.X < linePt2.X)) && ((pt.Y > linePt1.Y) === (pt.Y < linePt2.Y))
  //         && ((pt.X - linePt1.X) * (linePt2.Y - linePt1.Y) === (linePt2.X - linePt1.X) * (pt.Y - linePt1.Y)))
  //   }
  // }

  // Commented out since this is not used
  // public PointOnPolygon(pt: IntPoint, pp: OutPt, UseFullRange: boolean) {
  //   let pp2 = pp
  //   while (true) {
  //     if (this.PointOnLineSegment(pt, pp2.Pt, pp2.Next.Pt, UseFullRange)) {
  //       return true
  //     }
  //     pp2 = pp2.Next
  //     if (pp2 === pp) {
  //       break
  //     }
  //   }
  //   return false
  // }

  // public SlopesEqual(...args: any[]) {
  //   return ClipperBase.SlopesEqual(...args)
  // }

  // protected static SlopesEqual(...a: any[]) {
  //   const alen = a.length
  //   let e1, e2, pt1, pt2, pt3, pt4, UseFullRange
  //   if (alen === 3) { // function (e1, e2, UseFullRange)
  //     e1 = a[0]
  //     e2 = a[1]
  //     UseFullRange = a[2]
  //     if (UseFullRange) {
  //       return Int128.op_Equality(Int128.Int128Mul(e1.Delta.Y, e2.Delta.X), Int128.Int128Mul(e1.Delta.X, e2.Delta.Y))
  //     } else {
  //       return Cast_Int64((e1.Delta.Y) * (e2.Delta.X)) === Cast_Int64((e1.Delta.X) * (e2.Delta.Y))
  //     }
  //   } else if (alen === 4) { // function (pt1, pt2, pt3, UseFullRange)
  //     pt1 = a[0]
  //     pt2 = a[1]
  //     pt3 = a[2]
  //     UseFullRange = a[3]
  //     if (UseFullRange) {
  //       return Int128.op_Equality(Int128.Int128Mul(pt1.Y - pt2.Y, pt2.X - pt3.X), Int128.Int128Mul(pt1.X - pt2.X, pt2.Y - pt3.Y))
  //     } else {
  //       return Cast_Int64((pt1.Y - pt2.Y) * (pt2.X - pt3.X)) - Cast_Int64((pt1.X - pt2.X) * (pt2.Y - pt3.Y)) === 0
  //     }
  //   } // function (pt1, pt2, pt3, pt4, UseFullRange)
  //   else {
  //     pt1 = a[0]
  //     pt2 = a[1]
  //     pt3 = a[2]
  //     pt4 = a[3]
  //     UseFullRange = a[4]
  //     if (UseFullRange) {
  //       return Int128.op_Equality(Int128.Int128Mul(pt1.Y - pt2.Y, pt3.X - pt4.X), Int128.Int128Mul(pt1.X - pt2.X, pt3.Y - pt4.Y))
  //     } else {
  //       return Cast_Int64((pt1.Y - pt2.Y) * (pt3.X - pt4.X)) - Cast_Int64((pt1.X - pt2.X) * (pt3.Y - pt4.Y)) === 0
  //     }
  //   }
  // }

  protected static SlopesEqual3(e1: TEdge, e2: TEdge, UseFullRange: boolean) {
    if (UseFullRange) {
      return Int128.op_Equality(Int128.Int128Mul(e1.Delta.y, e2.Delta.x), Int128.Int128Mul(e1.Delta.x, e2.Delta.y))
    } else {
      return Cast_Int64((e1.Delta.y) * (e2.Delta.x)) === Cast_Int64((e1.Delta.x) * (e2.Delta.y))
    }
  }

  protected static SlopesEqual4(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, UseFullRange: boolean) {
    if (UseFullRange) {
      return Int128.op_Equality(Int128.Int128Mul(pt1.y - pt2.y, pt2.x - pt3.x), Int128.Int128Mul(pt1.x - pt2.x, pt2.y - pt3.y))
    } else {
      return Cast_Int64((pt1.y - pt2.y) * (pt2.x - pt3.x)) - Cast_Int64((pt1.x - pt2.x) * (pt2.y - pt3.y)) === 0
    }
  }

  protected static SlopesEqual5(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, pt4: IntPoint, UseFullRange: boolean) {
    if (UseFullRange) {
      return Int128.op_Equality(Int128.Int128Mul(pt1.y - pt2.y, pt3.x - pt4.x), Int128.Int128Mul(pt1.x - pt2.x, pt3.y - pt4.y))
    } else {
      return Cast_Int64((pt1.y - pt2.y) * (pt3.x - pt4.x)) - Cast_Int64((pt1.x - pt2.x) * (pt3.y - pt4.y)) === 0
    }
  }

  // protected Clear() {
  //   this.DisposeLocalMinimaList()
  //   for (let i = 0, ilen = this.m_edges.length; i < ilen; ++i) {
  //     for (let j = 0, jlen = this.m_edges[i].length; j < jlen; ++j) {
  //       this.m_edges[i][j] = null
  //     }
  //     Clear(this.m_edges[i])
  //   }
  //   Clear(this.m_edges)
  //   this.m_UseFullRange = false
  //   this.m_HasOpenPaths = false
  // }

  // protected DisposeLocalMinimaList() {
  //   while (this.m_MinimaList !== null) {
  //     const tmpLm = this.m_MinimaList.Next
  //     this.m_MinimaList = null
  //     this.m_MinimaList = tmpLm
  //   }
  //   this.m_CurrentLM = null
  // }

  protected RangeTest(Pt: Point, useFullRange: Ref2<boolean>) {
    if (useFullRange.Value) {
      if (Pt.x > ClipperBase.hiRange || Pt.y > ClipperBase.hiRange || -Pt.x > ClipperBase.hiRange || -Pt.y > ClipperBase.hiRange) {
        throw new Error('Coordinate outside allowed range in RangeTest().')
      }
    } else if (Pt.x > ClipperBase.loRange || Pt.y > ClipperBase.loRange || -Pt.x > ClipperBase.loRange || -Pt.y > ClipperBase.loRange) {
      useFullRange.Value = true
      this.RangeTest(Pt, useFullRange)
    }
  }

  protected InitEdge(e: TEdge, eNext: TEdge, ePrev: TEdge, pt: Point) {
    e.Next = eNext
    e.Prev = ePrev
    // e.Curr = pt;
    e.Curr.x = pt.x
    e.Curr.y = pt.y
    if (use_xyz) e.Curr.z = (pt as any).Z
    e.OutIdx = -1
  }

  protected InitEdge2(e: TEdge, polyType: PolyType) {
    if (e.Curr.y >= e.Next.Curr.y) {
      // e.Bot = e.Curr;
      e.Bot.x = e.Curr.x
      e.Bot.y = e.Curr.y
      if (use_xyz) e.Bot.z = e.Curr.z
      // e.Top = e.Next.Curr;
      e.Top.x = e.Next.Curr.x
      e.Top.y = e.Next.Curr.y
      if (use_xyz) e.Top.z = e.Next.Curr.z
    } else {
      // e.Top = e.Curr;
      e.Top.x = e.Curr.x
      e.Top.y = e.Curr.y
      if (use_xyz) e.Top.z = e.Curr.z
      // e.Bot = e.Next.Curr;
      e.Bot.x = e.Next.Curr.x
      e.Bot.y = e.Next.Curr.y
      if (use_xyz) e.Bot.z = e.Next.Curr.z
    }
    this.SetDx(e)
    e.PolyTyp = polyType
  }

  protected FindNextLocMin(E: TEdge) {
    let E2: TEdge
    for (;;) {
      while (IntPoint.op_Inequality(E.Bot, E.Prev.Bot) || IntPoint.op_Equality(E.Curr, E.Top)) {
        E = E.Next
      }
      if (E.Dx !== ClipperBase.horizontal && E.Prev.Dx !== ClipperBase.horizontal) {
        break
      }
      while (E.Prev.Dx === ClipperBase.horizontal) {
        E = E.Prev
      }
      E2 = E
      while (E.Dx === ClipperBase.horizontal) {
        E = E.Next
      }
      if (E.Top.y === E.Prev.Bot.y) {
        continue
      }
      // ie just an intermediate horz.
      if (E2.Prev.Bot.x < E.Bot.x) {
        E = E2
      }
      break
    }
    return E
  }

  protected ProcessBound(E: TEdge, LeftBoundIsForward: boolean) {
    let EStart: TEdge
    let Result = E
    let Horz: TEdge

    if (Result.OutIdx === ClipperBase.Skip) {
      // check if there are edges beyond the skip edge in the bound and if so
      // create another LocMin and calling ProcessBound once more ...
      E = Result
      if (LeftBoundIsForward) {
        while (E.Top.y === E.Next.Bot.y) E = E.Next
        while (E !== Result && E.Dx === ClipperBase.horizontal) E = E.Prev
      } else {
        while (E.Top.y === E.Prev.Bot.y) E = E.Prev
        while (E !== Result && E.Dx === ClipperBase.horizontal) E = E.Next
      }
      if (E === Result) {
        if (LeftBoundIsForward) Result = E.Next
        else Result = E.Prev
      } else {
        // there are more edges in the bound beyond result starting with E
        if (LeftBoundIsForward) {
          E = Result.Next
        } else {
          E = Result.Prev
        }
        const locMin = new LocalMinima()
        locMin.Next = null
        locMin.Y = E.Bot.y
        locMin.LeftBound = null
        locMin.RightBound = E
        E.WindDelta = 0
        Result = this.ProcessBound(E, LeftBoundIsForward)
        this.InsertLocalMinima(locMin)
      }
      return Result
    }

    if (E.Dx === ClipperBase.horizontal) {
      // We need to be careful with open paths because this may not be a
      // true local minima (ie E may be following a skip edge).
      // Also, consecutive horz. edges may start heading left before going right.
      if (LeftBoundIsForward) EStart = E.Prev
      else EStart = E.Next

      if (EStart.Dx === ClipperBase.horizontal) { // ie an adjoining horizontal skip edge
        if (EStart.Bot.x !== E.Bot.x && EStart.Top.x !== E.Bot.x) {
          this.ReverseHorizontal(E)
        }
      } else if (EStart.Bot.x !== E.Bot.x) {
        this.ReverseHorizontal(E)
      }
    }

    EStart = E
    if (LeftBoundIsForward) {
      while (Result.Top.y === Result.Next.Bot.y && Result.Next.OutIdx !== ClipperBase.Skip) {
        Result = Result.Next
      }
      if (Result.Dx === ClipperBase.horizontal && Result.Next.OutIdx !== ClipperBase.Skip) {
        // nb: at the top of a bound, horizontals are added to the bound
        // only when the preceding edge attaches to the horizontal's left vertex
        // unless a Skip edge is encountered when that becomes the top divide
        Horz = Result
        while (Horz.Prev.Dx === ClipperBase.horizontal) {
          Horz = Horz.Prev
        }
        if (Horz.Prev.Top.x > Result.Next.Top.x) {
          Result = Horz.Prev
        }
      }
      while (E !== Result) {
        E.NextInLML = E.Next
        if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.x !== E.Prev.Top.x) {
          this.ReverseHorizontal(E)
        }
        E = E.Next
      }
      if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.x !== E.Prev.Top.x) {
        this.ReverseHorizontal(E)
      }
      Result = Result.Next
      // move to the edge just beyond current bound
    } else {
      while (Result.Top.y === Result.Prev.Bot.y && Result.Prev.OutIdx !== ClipperBase.Skip) {
        Result = Result.Prev
      }
      if (Result.Dx === ClipperBase.horizontal && Result.Prev.OutIdx !== ClipperBase.Skip) {
        Horz = Result
        while (Horz.Next.Dx === ClipperBase.horizontal) {
          Horz = Horz.Next
        }
        if (Horz.Next.Top.x === Result.Prev.Top.x || Horz.Next.Top.x > Result.Prev.Top.x) {
          Result = Horz.Next
        }
      }
      while (E !== Result) {
        E.NextInLML = E.Prev
        if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.x !== E.Next.Top.x) {
          this.ReverseHorizontal(E)
        }
        E = E.Prev
      }
      if (E.Dx === ClipperBase.horizontal && E !== EStart && E.Bot.x !== E.Next.Top.x) {
        this.ReverseHorizontal(E)
      }
      Result = Result.Prev
      // move to the edge just beyond current bound
    }

    return Result
  }

  public AddPath(pg: Point[], polyType: PolyType, Closed: boolean) {
    if (use_lines) {
      if (!Closed && polyType === PolyType.ptClip) {
        throw new Error('AddPath: Open paths must be subject.')
      }
    } else {
      if (!Closed) {
        throw new Error('AddPath: Open paths have been disabled.')
      }
    }
    let highI = pg.length - 1
    if (Closed) {
      while (highI > 0 && (IntPoint.op_Equality(pg[highI], pg[0]))) {
        ;--highI
      }
    }
    while (highI > 0 && (IntPoint.op_Equality(pg[highI], pg[highI - 1]))) {
      ;--highI
    }
    if ((Closed && highI < 2) || (!Closed && highI < 1)) {
      return false
    }
    // create a new edge array ...
    const edges: TEdge[] = new Array()
    for (let i = 0; i <= highI; i++) {
      edges.push(new TEdge())
    }
    let IsFlat = true
    // 1. Basic (first) edge initialization ...

    // edges[1].Curr = pg[1];
    edges[1].Curr.x = pg[1].x
    edges[1].Curr.y = pg[1].y
    if (use_xyz) edges[1].Curr.z = (pg[1] as any).Z

    const $1 = {
      Value: this.m_UseFullRange,
    }

    this.RangeTest(pg[0], $1)
    this.m_UseFullRange = $1.Value

    $1.Value = this.m_UseFullRange
    this.RangeTest(pg[highI], $1)
    this.m_UseFullRange = $1.Value

    this.InitEdge(edges[0], edges[1], edges[highI], pg[0])
    this.InitEdge(edges[highI], edges[0], edges[highI - 1], pg[highI])
    for (let i = highI - 1; i >= 1; --i) {
      $1.Value = this.m_UseFullRange
      this.RangeTest(pg[i], $1)
      this.m_UseFullRange = $1.Value

      this.InitEdge(edges[i], edges[i + 1], edges[i - 1], pg[i])
    }

    let eStart = edges[0]
    // 2. Remove duplicate vertices, and (when closed) collinear edges ...
    let E = eStart,
      eLoopStop = eStart
    for (;;) {
      // console.log(E.Next, eStart);
      // nb: allows matching start and end points when not Closed ...
      if (E.Curr === E.Next.Curr && (Closed || E.Next !== eStart)) {
        if (E === E.Next) {
          break
        }
        if (E === eStart) {
          eStart = E.Next
        }
        E = this.RemoveEdge(E)
        eLoopStop = E
        continue
      }
      if (E.Prev === E.Next) {
        break
      } else if (
        Closed && ClipperBase.SlopesEqual4(E.Prev.Curr, E.Curr, E.Next.Curr, this.m_UseFullRange) && (!this.PreserveCollinear || !this.Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr))
      ) {
        // Collinear edges are allowed for open paths but in closed paths
        // the default is to merge adjacent collinear edges into a single edge.
        // However, if the PreserveCollinear property is enabled, only overlapping
        // collinear edges (ie spikes) will be removed from closed paths.
        if (E === eStart) {
          eStart = E.Next
        }
        E = this.RemoveEdge(E)
        E = E.Prev
        eLoopStop = E
        continue
      }
      E = E.Next
      if ((E === eLoopStop) || (!Closed && E.Next === eStart)) break
    }
    if ((!Closed && (E === E.Next)) || (Closed && (E.Prev === E.Next))) {
      return false
    }
    if (!Closed) {
      this.m_HasOpenPaths = true
      eStart.Prev.OutIdx = ClipperBase.Skip
    }
    // 3. Do second stage of edge initialization ...
    E = eStart
    do {
      this.InitEdge2(E, polyType)
      E = E.Next
      if (IsFlat && E.Curr.y !== eStart.Curr.y) {
        IsFlat = false
      }
    } while (E !== eStart)
    // 4. Finally, add edge bounds to LocalMinima list ...
    // Totally flat paths must be handled differently when adding them
    // to LocalMinima list to avoid endless loops etc ...
    if (IsFlat) {
      if (Closed) {
        return false
      }

      E.Prev.OutIdx = ClipperBase.Skip

      const locMin = new LocalMinima()
      locMin.Next = null
      locMin.Y = E.Bot.y
      locMin.LeftBound = null
      locMin.RightBound = E
      locMin.RightBound!.Side = EdgeSide.esRight
      locMin.RightBound!.WindDelta = 0

      for (;;) {
        if (E.Bot.x !== E.Prev.Top.x) this.ReverseHorizontal(E)
        if (E.Next.OutIdx === ClipperBase.Skip) break
        E.NextInLML = E.Next
        E = E.Next
      }
      this.InsertLocalMinima(locMin)
      this.m_edges.push(edges)
      return true
    }
    this.m_edges.push(edges)
    let leftBoundIsForward: boolean
    let EMin: TEdge | null = null

    // workaround to avoid an endless loop in the while loop below when
    // open paths have matching start and end points ...
    if (IntPoint.op_Equality(E.Prev.Bot, E.Prev.Top)) {
      E = E.Next
    }

    for (;;) {
      E = this.FindNextLocMin(E)
      if (E === EMin) {
        break
      } else if (EMin === null) {
        EMin = E
      }
      // E and E.Prev now share a local minima (left aligned if horizontal).
      // Compare their slopes to find which starts which bound ...
      const locMin = new LocalMinima()
      locMin.Next = null
      locMin.Y = E.Bot.y
      if (E.Dx < E.Prev.Dx) {
        locMin.LeftBound = E.Prev
        locMin.RightBound = E
        leftBoundIsForward = false
        // Q.nextInLML = Q.prev
      } else {
        locMin.LeftBound = E
        locMin.RightBound = E.Prev
        leftBoundIsForward = true
        // Q.nextInLML = Q.next
      }
      locMin.LeftBound!.Side = EdgeSide.esLeft
      locMin.RightBound!.Side = EdgeSide.esRight
      if (!Closed) {
        locMin.LeftBound!.WindDelta = 0
      } else if (locMin.LeftBound!.Next === locMin.RightBound) {
        locMin.LeftBound!.WindDelta = -1
      } else {
        locMin.LeftBound!.WindDelta = 1
      }
      locMin.RightBound!.WindDelta = -locMin.LeftBound!.WindDelta
      E = this.ProcessBound(locMin.LeftBound!, leftBoundIsForward)
      if (E.OutIdx === ClipperBase.Skip) {
        E = this.ProcessBound(E, leftBoundIsForward)
      }
      let E2 = this.ProcessBound(locMin.RightBound!, !leftBoundIsForward)
      if (E2.OutIdx === ClipperBase.Skip) E2 = this.ProcessBound(E2, !leftBoundIsForward)
      if (locMin.LeftBound!.OutIdx === ClipperBase.Skip) {
        locMin.LeftBound = null
      } else if (locMin.RightBound!.OutIdx === ClipperBase.Skip) {
        locMin.RightBound = null
      }
      this.InsertLocalMinima(locMin)
      if (!leftBoundIsForward) {
        E = E2
      }
    }
    return true
  }

  public AddPaths(ppg: Point[][], polyType: PolyType, closed: boolean) {
    //  console.log("-------------------------------------------");
    //  console.log(JSON.stringify(ppg));
    let result = false
    for (let i = 0, ilen = ppg.length; i < ilen; ++i) {
      if (this.AddPath(ppg[i], polyType, closed)) {
        result = true
      }
    }
    return result
  }

  protected Pt2IsBetweenPt1AndPt3(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint) {
    if ((IntPoint.op_Equality(pt1, pt3)) || (IntPoint.op_Equality(pt1, pt2)) || (IntPoint.op_Equality(pt3, pt2))) {
      // if ((pt1 == pt3) || (pt1 == pt2) || (pt3 == pt2))
      return false
    } else if (pt1.x !== pt3.x) {
      return (pt2.x > pt1.x) === (pt2.x < pt3.x)
    } else {
      return (pt2.y > pt1.y) === (pt2.y < pt3.y)
    }
  }

  protected RemoveEdge(e: TEdge) {
    // removes e from double_linked_list (but without removing from memory)
    e.Prev.Next = e.Next
    e.Next.Prev = e.Prev
    const result = e.Next
    e.Prev = null as any // flag as removed (see ClipperBase.Clear)
    return result
  }

  protected SetDx(e: TEdge) {
    e.Delta.x = e.Top.x - e.Bot.x
    e.Delta.y = e.Top.y - e.Bot.y
    if (e.Delta.y === 0) e.Dx = ClipperBase.horizontal
    else e.Dx = (e.Delta.x) / (e.Delta.y)
  }

  protected InsertLocalMinima(newLm: LocalMinima) {
    if (this.m_MinimaList === null) {
      this.m_MinimaList = newLm
    } else if (newLm.Y >= this.m_MinimaList.Y) {
      newLm.Next = this.m_MinimaList
      this.m_MinimaList = newLm
    } else {
      let tmpLm = this.m_MinimaList
      while (tmpLm.Next !== null && (newLm.Y < tmpLm.Next.Y)) {
        tmpLm = tmpLm.Next
      }
      newLm.Next = tmpLm.Next
      tmpLm.Next = newLm
    }
  }

  protected PopLocalMinima(Y: number, current: Ref<LocalMinima | null>) {
    current.v = this.m_CurrentLM
    if (this.m_CurrentLM !== null && this.m_CurrentLM.Y === Y) {
      this.m_CurrentLM = this.m_CurrentLM.Next
      return true
    }
    return false
  }

  protected ReverseHorizontal(e: TEdge) {
    // swap horizontal edges' top and bottom x's so they follow the natural
    // progression of the bounds - ie so their xbots will align with the
    // adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
    let tmp = e.Top.x
    e.Top.x = e.Bot.x
    e.Bot.x = tmp
    if (use_xyz) {
      tmp = e.Top.z!
      e.Top.z = e.Bot.z
      e.Bot.z = tmp
    }
  }

  protected Reset() {
    this.m_CurrentLM = this.m_MinimaList
    if (this.m_CurrentLM === null) { // ie nothing to process
      return
    }
    // reset all edges ...
    this.m_Scanbeam = null
    let lm = this.m_MinimaList
    while (lm !== null) {
      this.InsertScanbeam(lm.Y)
      let e = lm.LeftBound
      if (e !== null) {
        // e.Curr = e.Bot;
        e.Curr.x = e.Bot.x
        e.Curr.y = e.Bot.y
        if (use_xyz) e.Curr.z = e.Bot.z
        e.OutIdx = ClipperBase.Unassigned
      }
      e = lm.RightBound
      if (e !== null) {
        // e.Curr = e.Bot;
        e.Curr.x = e.Bot.x
        e.Curr.y = e.Bot.y
        if (use_xyz) e.Curr.z = e.Bot.z
        e.OutIdx = ClipperBase.Unassigned
      }
      lm = lm.Next
    }
    this.m_ActiveEdges = null
  }

  protected InsertScanbeam(Y: number) {
    // single-linked list: sorted descending, ignoring dups.
    if (this.m_Scanbeam === null) {
      this.m_Scanbeam = new Scanbeam()
      this.m_Scanbeam.Next = null
      this.m_Scanbeam.Y = Y
    } else if (Y > this.m_Scanbeam.Y) {
      const newSb = new Scanbeam()
      newSb.Y = Y
      newSb.Next = this.m_Scanbeam
      this.m_Scanbeam = newSb
    } else {
      let sb2 = this.m_Scanbeam
      while (sb2.Next !== null && Y <= sb2.Next.Y) {
        sb2 = sb2.Next
      }
      if (Y === sb2.Y) {
        return
      } // ie ignores duplicates
      const newSb1 = new Scanbeam()
      newSb1.Y = Y
      newSb1.Next = sb2.Next
      sb2.Next = newSb1
    }
  }

  protected PopScanbeam(Y: Ref<number>) {
    if (this.m_Scanbeam === null) {
      Y.v = 0
      return false
    }
    Y.v = this.m_Scanbeam.Y
    this.m_Scanbeam = this.m_Scanbeam.Next
    return true
  }

  protected LocalMinimaPending() {
    return (this.m_CurrentLM !== null)
  }

  protected CreateOutRec() {
    const result = new OutRec()
    result.Idx = ClipperBase.Unassigned
    result.IsHole = false
    result.IsOpen = false
    result.FirstLeft = null
    result.Pts = null
    result.BottomPt = null
    result.PolyNode = null
    this.m_PolyOuts.push(result)
    result.Idx = this.m_PolyOuts.length - 1
    return result
  }

  protected DisposeOutRec(index: number) {
    let outRec = this.m_PolyOuts[index]
    outRec!.Pts = null
    outRec = null
    this.m_PolyOuts[index] = null
  }

  protected UpdateEdgeIntoAEL(e: TEdge) {
    if (e.NextInLML === null) {
      throw new Error('UpdateEdgeIntoAEL: invalid call')
    }
    const AelPrev = e.PrevInAEL
    const AelNext = e.NextInAEL
    e.NextInLML.OutIdx = e.OutIdx
    if (AelPrev !== null) {
      AelPrev.NextInAEL = e.NextInLML
    } else {
      this.m_ActiveEdges = e.NextInLML
    }
    if (AelNext !== null) {
      AelNext.PrevInAEL = e.NextInLML
    }
    e.NextInLML.Side = e.Side
    e.NextInLML.WindDelta = e.WindDelta
    e.NextInLML.WindCnt = e.WindCnt
    e.NextInLML.WindCnt2 = e.WindCnt2
    e = e.NextInLML
    e.Curr.x = e.Bot.x
    e.Curr.y = e.Bot.y
    e.PrevInAEL = AelPrev
    e.NextInAEL = AelNext
    if (!ClipperBase.IsHorizontal(e)) {
      this.InsertScanbeam(e.Top.y)
    }
    return e
  }

  protected SwapPositionsInAEL(edge1: TEdge, edge2: TEdge) {
    // check that one or other edge hasn't already been removed from AEL ...
    if (edge1.NextInAEL === edge1.PrevInAEL || edge2.NextInAEL === edge2.PrevInAEL) {
      return
    }

    if (edge1.NextInAEL === edge2) {
      const next = edge2.NextInAEL
      if (next !== null) {
        next.PrevInAEL = edge1
      }
      const prev = edge1.PrevInAEL
      if (prev !== null) {
        prev.NextInAEL = edge2
      }
      edge2.PrevInAEL = prev
      edge2.NextInAEL = edge1
      edge1.PrevInAEL = edge2
      edge1.NextInAEL = next
    } else if (edge2.NextInAEL === edge1) {
      const next1 = edge1.NextInAEL
      if (next1 !== null) {
        next1.PrevInAEL = edge2
      }
      const prev1 = edge2.PrevInAEL
      if (prev1 !== null) {
        prev1.NextInAEL = edge1
      }
      edge1.PrevInAEL = prev1
      edge1.NextInAEL = edge2
      edge2.PrevInAEL = edge1
      edge2.NextInAEL = next1
    } else {
      const next2 = edge1.NextInAEL
      const prev2 = edge1.PrevInAEL
      edge1.NextInAEL = edge2.NextInAEL
      if (edge1.NextInAEL !== null) {
        edge1.NextInAEL.PrevInAEL = edge1
      }
      edge1.PrevInAEL = edge2.PrevInAEL
      if (edge1.PrevInAEL !== null) {
        edge1.PrevInAEL.NextInAEL = edge1
      }
      edge2.NextInAEL = next2
      if (edge2.NextInAEL !== null) {
        edge2.NextInAEL.PrevInAEL = edge2
      }
      edge2.PrevInAEL = prev2
      if (edge2.PrevInAEL !== null) {
        edge2.PrevInAEL.NextInAEL = edge2
      }
    }

    if (edge1.PrevInAEL === null) {
      this.m_ActiveEdges = edge1
    } else {
      if (edge2.PrevInAEL === null) {
        this.m_ActiveEdges = edge2
      }
    }
  }

  protected DeleteFromAEL(e: TEdge) {
    const AelPrev = e.PrevInAEL
    const AelNext = e.NextInAEL
    if (AelPrev === null && AelNext === null && e !== this.m_ActiveEdges) {
      return
    } // already deleted
    if (AelPrev !== null) {
      AelPrev.NextInAEL = AelNext
    } else {
      this.m_ActiveEdges = AelNext
    }
    if (AelNext !== null) {
      AelNext.PrevInAEL = AelPrev
    }
    e.NextInAEL = null
    e.PrevInAEL = null
  }
}

// public Clipper(int InitOptions = 0)

export class Clipper extends ClipperBase {
  protected m_Scanbeam: Scanbeam | null
  protected m_Maxima: Maxima | null
  protected m_ActiveEdges: TEdge | null
  protected m_SortedEdges: TEdge | null
  protected m_IntersectList: IntersectNode[]
  protected m_IntersectNodeComparer: typeof MyIntersectNodeSort_Compare
  protected m_ExecuteLocked: boolean
  protected m_UsingPolyTree: boolean
  protected m_PolyOuts: OutRec[]
  protected m_Joins: Join[]
  protected m_GhostJoins: Join[]
  public ReverseSolution: boolean
  // protected StrictlySimple: boolean
  protected PreserveCollinear: boolean
  protected m_ClipType: ClipType
  protected m_ClipFillType: PolyFillType
  protected m_SubjFillType: PolyFillType

  protected ZFillFunction: any

  constructor(InitOptions = 0) {
    super()
    this.m_ClipType = ClipType.ctIntersection

    this.m_Scanbeam = null
    this.m_Maxima = null
    this.m_ActiveEdges = null
    this.m_SortedEdges = null
    this.m_IntersectList = new Array()
    this.m_IntersectNodeComparer = MyIntersectNodeSort_Compare
    this.m_ExecuteLocked = false
    this.m_UsingPolyTree = false
    this.m_PolyOuts = new Array()
    this.m_Joins = new Array()
    this.m_GhostJoins = new Array()
    this.ReverseSolution = (1 & InitOptions) !== 0
    // this.StrictlySimple = (2 & InitOptions) !== 0
    this.PreserveCollinear = (4 & InitOptions) !== 0
    this.m_ClipFillType = PolyFillType.pftEvenOdd
    this.m_SubjFillType = PolyFillType.pftEvenOdd
    if (use_xyz) {
      this.ZFillFunction = null // function (IntPoint vert1, IntPoint vert2, ref IntPoint intersectPt);
    }
  }

  // protected static ioReverseSolution = 1
  // protected static ioStrictlySimple = 2
  // protected static ioPreserveCollinear = 4

  // protected Clear() {
  //   if (this.m_edges.length === 0) {
  //     return
  //   }
  //   // avoids problems with ClipperBase destructor
  //   this.DisposeAllPolyPts()
  //   super.Clear()
  // }

  protected InsertMaxima(X: number) {
    // double-linked list: sorted ascending, ignoring dups.
    const newMax = new Maxima()
    newMax.X = X
    if (this.m_Maxima === null) {
      this.m_Maxima = newMax
      this.m_Maxima.Next = null
      this.m_Maxima.Prev = null
    } else if (X < this.m_Maxima.X) {
      newMax.Next = this.m_Maxima
      newMax.Prev = null
      this.m_Maxima = newMax
    } else {
      let m = this.m_Maxima
      while (m.Next !== null && X >= m.Next.X) {
        m = m.Next
      }
      if (X === m.X) {
        return
      } // ie ignores duplicates (& CG to clean up newMax)
      // insert newMax between m and m.Next ...
      newMax.Next = m.Next
      newMax.Prev = m
      if (m.Next !== null) {
        m.Next.Prev = newMax
      }
      m.Next = newMax
    }
  }

  // ************************************
  public Execute(...a: any[]): boolean {
    const alen = a.length,
      ispolytree = a[1] instanceof PolyTree
    if (alen === 4 && !ispolytree) { // function (clipType, solution, subjFillType, clipFillType)
      const clipType = a[0],
        solution = a[1],
        subjFillType = a[2],
        clipFillType = a[3]
      if (this.m_ExecuteLocked) {
        return false
      }
      if (this.m_HasOpenPaths) {
        throw new Error('Error: PolyTree struct is needed for open path clipping.')
      }
      this.m_ExecuteLocked = true
      Clear(solution)
      this.m_SubjFillType = subjFillType
      this.m_ClipFillType = clipFillType
      this.m_ClipType = clipType
      this.m_UsingPolyTree = false
      let succeeded = false
      try {
        succeeded = this.ExecuteInternal()
        // build the return polygons ...
        if (succeeded) this.BuildResult(solution)
      } finally {
        this.DisposeAllPolyPts()
        this.m_ExecuteLocked = false
      }
      return succeeded
    } else if (alen === 4 && ispolytree) { // function (clipType, polytree, subjFillType, clipFillType)
      const clipType = a[0],
        polytree = a[1],
        subjFillType = a[2],
        clipFillType = a[3]
      if (this.m_ExecuteLocked) {
        return false
      }
      this.m_ExecuteLocked = true
      this.m_SubjFillType = subjFillType
      this.m_ClipFillType = clipFillType
      this.m_ClipType = clipType
      this.m_UsingPolyTree = true
      let succeeded = false
      try {
        succeeded = this.ExecuteInternal()
        // build the return polygons ...
        if (succeeded) this.BuildResult2(polytree)
      } finally {
        this.DisposeAllPolyPts()
        this.m_ExecuteLocked = false
      }
      return succeeded
    } else if (alen === 2 && !ispolytree) { // function (clipType, solution)
      const clipType = a[0],
        solution = a[1]
      return this.Execute(clipType, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd)
    } else if (alen === 2 && ispolytree) { // function (clipType, polytree)
      const clipType = a[0],
        polytree = a[1]
      return this.Execute(clipType, polytree, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd)
    }
    return false
  }

  protected FixHoleLinkage(outRec: OutRec) {
    // skip if an outermost polygon or
    // already already points to the correct FirstLeft ...
    if (outRec.FirstLeft === null || (outRec.IsHole !== outRec.FirstLeft.IsHole && outRec.FirstLeft.Pts !== null)) {
      return
    }
    let orfl: OutRec | null = outRec.FirstLeft
    while (orfl !== null && ((orfl.IsHole === outRec.IsHole) || orfl.Pts === null)) {
      orfl = orfl.FirstLeft
    }
    outRec.FirstLeft = orfl
  }

  protected ExecuteInternal() {
    try {
      this.Reset()
      this.m_SortedEdges = null
      this.m_Maxima = null

      const botY: Ref<number> = {},
        topY: Ref<number> = {}

      if (!this.PopScanbeam(botY)) {
        return false
      }
      this.InsertLocalMinimaIntoAEL(botY.v!)
      while (this.PopScanbeam(topY) || this.LocalMinimaPending()) {
        this.ProcessHorizontals()
        this.m_GhostJoins.length = 0
        if (!this.ProcessIntersections(topY.v!)) {
          return false
        }
        this.ProcessEdgesAtTopOfScanbeam(topY.v!)
        botY.v = topY.v
        this.InsertLocalMinimaIntoAEL(botY.v!)
      }

      // fix orientations ...
      let outRec, i, ilen
      // fix orientations ...
      for (i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
        outRec = this.m_PolyOuts[i]
        if (outRec.Pts === null || outRec.IsOpen) continue
        if ((outRec.IsHole != this.ReverseSolution) == (this.Area$1(outRec) > 0)) {
          this.ReversePolyPtLinks(outRec.Pts)
        }
      }

      this.JoinCommonEdges()

      for (i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
        outRec = this.m_PolyOuts[i]
        if (outRec.Pts === null) {
          continue
        } else if (outRec.IsOpen) {
          this.FixupOutPolyline(outRec)
        } else {
          this.FixupOutPolygon(outRec)
        }
      }

      // if (this.StrictlySimple) this.DoSimplePolygons()
      return true
    } finally {
      // catch { return false; }

      this.m_Joins.length = 0
      this.m_GhostJoins.length = 0
    }
  }

  protected DisposeAllPolyPts() {
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; ++i) {
      this.DisposeOutRec(i)
    }
    Clear(this.m_PolyOuts)
  }

  protected AddJoin(Op1: OutPt, Op2: OutPt, OffPt: IntPoint) {
    const j = new Join()
    j.OutPt1 = Op1
    j.OutPt2 = Op2
    // j.OffPt = OffPt;
    j.OffPt.x = OffPt.x
    j.OffPt.y = OffPt.y
    if (use_xyz) j.OffPt.z = OffPt.z
    this.m_Joins.push(j)
  }

  protected AddGhostJoin(Op: OutPt, OffPt: Point) {
    const j = new Join()
    j.OutPt1 = Op
    // j.OffPt = OffPt;
    j.OffPt.x = OffPt.x
    j.OffPt.y = OffPt.y
    if (use_xyz) j.OffPt.z = OffPt.z
    this.m_GhostJoins.push(j)
  }

  // if (use_xyz)
  // {
  protected SetZ(pt: IntPoint, e1: TEdge, e2: TEdge) {
    if (this.ZFillFunction !== null) {
      if (pt.z !== 0 || this.ZFillFunction === null) return
      else if (IntPoint.op_Equality(pt, e1.Bot)) pt.z = e1.Bot.z
      else if (IntPoint.op_Equality(pt, e1.Top)) pt.z = e1.Top.z
      else if (IntPoint.op_Equality(pt, e2.Bot)) pt.z = e2.Bot.z
      else if (IntPoint.op_Equality(pt, e2.Top)) pt.z = e2.Top.z
      else this.ZFillFunction(e1.Bot, e1.Top, e2.Bot, e2.Top, pt)
    }
  }
  // }

  protected InsertLocalMinimaIntoAEL(botY: number) {
    const lm: Ref<LocalMinima> = {}

    let lb: TEdge | null
    let rb: TEdge | null
    while (this.PopLocalMinima(botY, lm)) {
      lb = lm.v!.LeftBound
      rb = lm.v!.RightBound

      let Op1: OutPt = null as any
      if (lb === null) {
        this.InsertEdgeIntoAEL(rb!, null)
        this.SetWindingCount(rb!)
        if (this.IsContributing(rb!)) {
          Op1 = this.AddOutPt(rb!, rb!.Bot)
        }
      } else if (rb === null) {
        this.InsertEdgeIntoAEL(lb, null)
        this.SetWindingCount(lb)
        if (this.IsContributing(lb)) {
          Op1 = this.AddOutPt(lb, lb.Bot)
        }
        this.InsertScanbeam(lb.Top.y)
      } else {
        this.InsertEdgeIntoAEL(lb, null)
        this.InsertEdgeIntoAEL(rb, lb)
        this.SetWindingCount(lb)
        rb.WindCnt = lb.WindCnt
        rb.WindCnt2 = lb.WindCnt2
        if (this.IsContributing(lb)) {
          Op1 = this.AddLocalMinPoly(lb, rb, lb.Bot)
        }
        this.InsertScanbeam(lb.Top.y)
      }
      if (rb !== null) {
        if (ClipperBase.IsHorizontal(rb)) {
          if (rb.NextInLML !== null) {
            this.InsertScanbeam(rb.NextInLML.Top.y)
          }
          this.AddEdgeToSEL(rb)
        } else {
          this.InsertScanbeam(rb.Top.y)
        }
      }
      if (lb === null || rb === null) continue
      // if output polygons share an Edge with a horizontal rb, they'll need joining later ...
      if (Op1 !== null && ClipperBase.IsHorizontal(rb) && this.m_GhostJoins.length > 0 && rb.WindDelta !== 0) {
        for (let i = 0, ilen = this.m_GhostJoins.length; i < ilen; i++) {
          // if the horizontal Rb and a 'ghost' horizontal overlap, then convert
          // the 'ghost' join to a real join ready for later ...
          const j = this.m_GhostJoins[i]

          if (this.HorzSegmentsOverlap(j.OutPt1.Pt.x, j.OffPt.x, rb.Bot.x, rb.Top.x)) {
            this.AddJoin(j.OutPt1, Op1, j.OffPt)
          }
        }
      }

      if (
        lb.OutIdx >= 0 && lb.PrevInAEL !== null
        && lb.PrevInAEL.Curr.x === lb.Bot.x
        && lb.PrevInAEL.OutIdx >= 0
        && ClipperBase.SlopesEqual5(lb.PrevInAEL.Curr, lb.PrevInAEL.Top, lb.Curr, lb.Top, this.m_UseFullRange)
        && lb.WindDelta !== 0 && lb.PrevInAEL.WindDelta !== 0
      ) {
        const Op2 = this.AddOutPt(lb.PrevInAEL, lb.Bot)
        this.AddJoin(Op1!, Op2!, lb.Top)
      }
      if (lb.NextInAEL !== rb) {
        if (
          rb.OutIdx >= 0 && rb.PrevInAEL!.OutIdx >= 0
          && ClipperBase.SlopesEqual5(rb.PrevInAEL!.Curr, rb.PrevInAEL!.Top, rb.Curr, rb.Top, this.m_UseFullRange)
          && rb.WindDelta !== 0 && rb.PrevInAEL!.WindDelta !== 0
        ) {
          const Op2 = this.AddOutPt(rb.PrevInAEL!, rb.Bot)
          this.AddJoin(Op1!, Op2!, rb.Top)
        }
        let e = lb.NextInAEL
        if (e !== null) {
          while (e !== rb) {
            // nb: For calculating winding counts etc, IntersectEdges() assumes
            // that param1 will be to the right of param2 ABOVE the intersection ...
            this.IntersectEdges(rb, e!, lb.Curr)
            // order important here
            e = e!.NextInAEL
          }
        }
      }
    }
  }

  protected InsertEdgeIntoAEL(edge: TEdge, startEdge: TEdge | null) {
    if (this.m_ActiveEdges === null) {
      edge.PrevInAEL = null
      edge.NextInAEL = null
      this.m_ActiveEdges = edge
    } else if (startEdge === null && this.E2InsertsBeforeE1(this.m_ActiveEdges, edge)) {
      edge.PrevInAEL = null
      edge.NextInAEL = this.m_ActiveEdges
      this.m_ActiveEdges.PrevInAEL = edge
      this.m_ActiveEdges = edge
    } else {
      if (startEdge === null) {
        startEdge = this.m_ActiveEdges
      }
      while (startEdge.NextInAEL !== null && !this.E2InsertsBeforeE1(startEdge.NextInAEL, edge)) {
        startEdge = startEdge.NextInAEL
      }
      edge.NextInAEL = startEdge.NextInAEL
      if (startEdge.NextInAEL !== null) {
        startEdge.NextInAEL.PrevInAEL = edge
      }
      edge.PrevInAEL = startEdge
      startEdge.NextInAEL = edge
    }
  }

  protected E2InsertsBeforeE1(e1: TEdge, e2: TEdge) {
    if (e2.Curr.x === e1.Curr.x) {
      if (e2.Top.y > e1.Top.y) {
        return e2.Top.x < Clipper.TopX(e1, e2.Top.y)
      } else {
        return e1.Top.x > Clipper.TopX(e2, e1.Top.y)
      }
    } else {
      return e2.Curr.x < e1.Curr.x
    }
  }

  protected IsEvenOddFillType(edge: TEdge) {
    if (edge.PolyTyp === PolyType.ptSubject) {
      return this.m_SubjFillType === PolyFillType.pftEvenOdd
    } else {
      return this.m_ClipFillType === PolyFillType.pftEvenOdd
    }
  }

  protected IsEvenOddAltFillType(edge: TEdge) {
    if (edge.PolyTyp === PolyType.ptSubject) {
      return this.m_ClipFillType === PolyFillType.pftEvenOdd
    } else {
      return this.m_SubjFillType === PolyFillType.pftEvenOdd
    }
  }

  protected IsContributing(edge: { PolyTyp: PolyType; WindDelta: number; WindCnt: number; WindCnt2: number }) {
    let pft, pft2
    if (edge.PolyTyp === PolyType.ptSubject) {
      pft = this.m_SubjFillType
      pft2 = this.m_ClipFillType
    } else {
      pft = this.m_ClipFillType
      pft2 = this.m_SubjFillType
    }
    switch (pft) {
      case PolyFillType.pftEvenOdd:
        if (edge.WindDelta === 0 && edge.WindCnt !== 1) {
          return false
        }
        break
      case PolyFillType.pftNonZero:
        if (Math.abs(edge.WindCnt) !== 1) {
          return false
        }
        break
      case PolyFillType.pftPositive:
        if (edge.WindCnt !== 1) {
          return false
        }
        break
      default:
        if (edge.WindCnt !== -1) {
          return false
        }
        break
    }
    switch (this.m_ClipType) {
      case ClipType.ctIntersection:
        switch (pft2) {
          case PolyFillType.pftEvenOdd:
          case PolyFillType.pftNonZero:
            return (edge.WindCnt2 !== 0)
          case PolyFillType.pftPositive:
            return (edge.WindCnt2 > 0)
          default:
            return (edge.WindCnt2 < 0)
        }
      case ClipType.ctUnion:
        switch (pft2) {
          case PolyFillType.pftEvenOdd:
          case PolyFillType.pftNonZero:
            return (edge.WindCnt2 === 0)
          case PolyFillType.pftPositive:
            return (edge.WindCnt2 <= 0)
          default:
            return (edge.WindCnt2 >= 0)
        }
      case ClipType.ctDifference:
        if (edge.PolyTyp === PolyType.ptSubject) {
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return (edge.WindCnt2 === 0)
            case PolyFillType.pftPositive:
              return (edge.WindCnt2 <= 0)
            default:
              return (edge.WindCnt2 >= 0)
          }
        } else {
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return (edge.WindCnt2 !== 0)
            case PolyFillType.pftPositive:
              return (edge.WindCnt2 > 0)
            default:
              return (edge.WindCnt2 < 0)
          }
        }
      case ClipType.ctXor:
        if (edge.WindDelta === 0) {
          switch (pft2) {
            case PolyFillType.pftEvenOdd:
            case PolyFillType.pftNonZero:
              return (edge.WindCnt2 === 0)
            case PolyFillType.pftPositive:
              return (edge.WindCnt2 <= 0)
            default:
              return (edge.WindCnt2 >= 0)
          }
        } else {
          return true
        }
    }
  }

  protected SetWindingCount(edge: TEdge) {
    let e = edge.PrevInAEL
    // find the edge of the same polytype that immediately preceeds 'edge' in AEL
    while (e !== null && ((e.PolyTyp !== edge.PolyTyp) || (e.WindDelta === 0))) {
      e = e.PrevInAEL
    }
    if (e === null) {
      const pft = edge.PolyTyp === PolyType.ptSubject ? this.m_SubjFillType : this.m_ClipFillType
      if (edge.WindDelta === 0) {
        edge.WindCnt = pft === PolyFillType.pftNegative ? -1 : 1
      } else {
        edge.WindCnt = edge.WindDelta
      }
      edge.WindCnt2 = 0
      e = this.m_ActiveEdges
      // ie get ready to calc WindCnt2
    } else if (edge.WindDelta === 0 && this.m_ClipType !== ClipType.ctUnion) {
      edge.WindCnt = 1
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      // ie get ready to calc WindCnt2
    } else if (this.IsEvenOddFillType(edge)) {
      // EvenOdd filling ...
      if (edge.WindDelta === 0) {
        // are we inside a subj polygon ...
        let Inside = true
        let e2 = e.PrevInAEL
        while (e2 !== null) {
          if (e2.PolyTyp === e.PolyTyp && e2.WindDelta !== 0) {
            Inside = !Inside
          }
          e2 = e2.PrevInAEL
        }
        edge.WindCnt = Inside ? 0 : 1
      } else {
        edge.WindCnt = edge.WindDelta
      }
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      // ie get ready to calc WindCnt2
    } else {
      // nonZero, Positive or Negative filling ...
      if (e.WindCnt * e.WindDelta < 0) {
        // prev edge is 'decreasing' WindCount (WC) toward zero
        // so we're outside the previous polygon ...
        if (Math.abs(e.WindCnt) > 1) {
          // outside prev poly but still inside another.
          // when reversing direction of prev poly use the same WC
          if (e.WindDelta * edge.WindDelta < 0) {
            edge.WindCnt = e.WindCnt
          } else {
            edge.WindCnt = e.WindCnt + edge.WindDelta
          }
        } else {
          edge.WindCnt = edge.WindDelta === 0 ? 1 : edge.WindDelta
        }
      } else {
        // prev edge is 'increasing' WindCount (WC) away from zero
        // so we're inside the previous polygon ...
        if (edge.WindDelta === 0) {
          edge.WindCnt = e.WindCnt < 0 ? e.WindCnt - 1 : e.WindCnt + 1
        } else if (e.WindDelta * edge.WindDelta < 0) {
          edge.WindCnt = e.WindCnt
        } else {
          edge.WindCnt = e.WindCnt + edge.WindDelta
        }
      }
      edge.WindCnt2 = e.WindCnt2
      e = e.NextInAEL
      // ie get ready to calc WindCnt2
    }
    // update WindCnt2 ...
    if (this.IsEvenOddAltFillType(edge)) {
      // EvenOdd filling ...
      while (e !== edge) {
        if (e!.WindDelta !== 0) {
          edge.WindCnt2 = edge.WindCnt2 === 0 ? 1 : 0
        }
        e = e!.NextInAEL
      }
    } else {
      // nonZero, Positive or Negative filling ...
      while (e !== edge) {
        edge.WindCnt2 += e!.WindDelta
        e = e!.NextInAEL
      }
    }
  }

  protected AddEdgeToSEL(edge: TEdge) {
    // SEL pointers in PEdge are use to build transient lists of horizontal edges.
    // However, since we don't need to worry about processing order, all additions
    // are made to the front of the list ...
    if (this.m_SortedEdges === null) {
      this.m_SortedEdges = edge
      edge.PrevInSEL = null
      edge.NextInSEL = null
    } else {
      edge.NextInSEL = this.m_SortedEdges
      edge.PrevInSEL = null
      this.m_SortedEdges.PrevInSEL = edge
      this.m_SortedEdges = edge
    }
  }

  protected PopEdgeFromSEL(e: Ref<TEdge>) {
    // Pop edge from front of SEL (ie SEL is a FILO list)
    e.v = this.m_SortedEdges!
    if (e.v === null) {
      return false
    }
    const oldE = e.v!
    this.m_SortedEdges = e.v!.NextInSEL
    if (this.m_SortedEdges !== null) {
      this.m_SortedEdges.PrevInSEL = null
    }
    oldE.NextInSEL = null
    oldE.PrevInSEL = null
    return true
  }

  protected CopyAELToSEL() {
    let e = this.m_ActiveEdges
    this.m_SortedEdges = e
    while (e !== null) {
      e.PrevInSEL = e.PrevInAEL
      e.NextInSEL = e.NextInAEL
      e = e.NextInAEL
    }
  }

  protected SwapPositionsInSEL(edge1: TEdge, edge2: TEdge) {
    if (edge1.NextInSEL === null && edge1.PrevInSEL === null) {
      return
    }
    if (edge2.NextInSEL === null && edge2.PrevInSEL === null) {
      return
    }
    if (edge1.NextInSEL === edge2) {
      const next = edge2.NextInSEL
      if (next !== null) {
        next.PrevInSEL = edge1
      }
      const prev = edge1.PrevInSEL
      if (prev !== null) {
        prev.NextInSEL = edge2
      }
      edge2.PrevInSEL = prev
      edge2.NextInSEL = edge1
      edge1.PrevInSEL = edge2
      edge1.NextInSEL = next
    } else if (edge2.NextInSEL === edge1) {
      const next = edge1.NextInSEL
      if (next !== null) {
        next.PrevInSEL = edge2
      }
      const prev = edge2.PrevInSEL
      if (prev !== null) {
        prev.NextInSEL = edge1
      }
      edge1.PrevInSEL = prev
      edge1.NextInSEL = edge2
      edge2.PrevInSEL = edge1
      edge2.NextInSEL = next
    } else {
      const next = edge1.NextInSEL
      const prev = edge1.PrevInSEL
      edge1.NextInSEL = edge2.NextInSEL
      if (edge1.NextInSEL !== null) {
        edge1.NextInSEL.PrevInSEL = edge1
      }
      edge1.PrevInSEL = edge2.PrevInSEL
      if (edge1.PrevInSEL !== null) {
        edge1.PrevInSEL.NextInSEL = edge1
      }
      edge2.NextInSEL = next
      if (edge2.NextInSEL !== null) {
        edge2.NextInSEL.PrevInSEL = edge2
      }
      edge2.PrevInSEL = prev
      if (edge2.PrevInSEL !== null) {
        edge2.PrevInSEL.NextInSEL = edge2
      }
    }
    if (edge1.PrevInSEL === null) {
      this.m_SortedEdges = edge1
    } else if (edge2.PrevInSEL === null) {
      this.m_SortedEdges = edge2
    }
  }

  protected AddLocalMaxPoly(e1: TEdge, e2: TEdge, pt: IntPoint) {
    this.AddOutPt(e1, pt)
    if (e2.WindDelta === 0) this.AddOutPt(e2, pt)
    if (e1.OutIdx === e2.OutIdx) {
      e1.OutIdx = -1
      e2.OutIdx = -1
    } else if (e1.OutIdx < e2.OutIdx) {
      this.AppendPolygon(e1, e2)
    } else {
      this.AppendPolygon(e2, e1)
    }
  }

  protected AddLocalMinPoly(e1: TEdge, e2: TEdge, pt: IntPoint) {
    let result
    let e, prevE
    if (ClipperBase.IsHorizontal(e2) || (e1.Dx > e2.Dx)) {
      result = this.AddOutPt(e1, pt)
      e2.OutIdx = e1.OutIdx
      e1.Side = EdgeSide.esLeft
      e2.Side = EdgeSide.esRight
      e = e1
      if (e.PrevInAEL === e2) {
        prevE = e2.PrevInAEL
      } else {
        prevE = e.PrevInAEL
      }
    } else {
      result = this.AddOutPt(e2, pt)
      e1.OutIdx = e2.OutIdx
      e1.Side = EdgeSide.esRight
      e2.Side = EdgeSide.esLeft
      e = e2
      if (e.PrevInAEL === e1) {
        prevE = e1.PrevInAEL
      } else {
        prevE = e.PrevInAEL
      }
    }

    if (prevE !== null && prevE.OutIdx >= 0 && prevE.Top.y < pt.y && e.Top.y < pt.y) {
      const xPrev = Clipper.TopX(prevE, pt.y)
      const xE = Clipper.TopX(e, pt.y)
      if ((xPrev === xE) && (e.WindDelta !== 0) && (prevE.WindDelta !== 0) && ClipperBase.SlopesEqual5(new IntPoint(xPrev, pt.y), prevE.Top, new IntPoint(xE, pt.y), e.Top, this.m_UseFullRange)) {
        const outPt = this.AddOutPt(prevE, pt)
        this.AddJoin(result, outPt, e.Top)
      }
    }
    return result
  }

  AddOutPt(e: TEdge, pt: IntPoint): OutPt {
    if (e.OutIdx < 0) {
      const outRec = this.CreateOutRec()
      outRec.IsOpen = e.WindDelta === 0
      const newOp = new OutPt()
      outRec.Pts = newOp
      newOp.Idx = outRec.Idx
      // newOp.Pt = pt;
      newOp.Pt.x = pt.x
      newOp.Pt.y = pt.y
      if (use_xyz) newOp.Pt.z = pt.z
      newOp.Next = newOp
      newOp.Prev = newOp
      if (!outRec.IsOpen) {
        this.SetHoleState(e, outRec)
      }
      e.OutIdx = outRec.Idx
      // nb: do this after SetZ !
      return newOp
    } else {
      const outRec = this.m_PolyOuts[e.OutIdx]
      // OutRec.Pts is the 'Left-most' point & OutRec.Pts.Prev is the 'Right-most'
      const op = outRec.Pts!
      const ToFront = e.Side === EdgeSide.esLeft
      if (ToFront && IntPoint.op_Equality(pt, op.Pt)) {
        return op
      } else if (!ToFront && IntPoint.op_Equality(pt, op.Prev.Pt)) {
        return op.Prev
      }
      const newOp = new OutPt()
      newOp.Idx = outRec.Idx
      // newOp.Pt = pt;
      newOp.Pt.x = pt.x
      newOp.Pt.y = pt.y
      if (use_xyz) newOp.Pt.z = pt.z
      newOp.Next = op
      newOp.Prev = op.Prev
      newOp.Prev.Next = newOp
      op.Prev = newOp
      if (ToFront) {
        outRec.Pts = newOp
      }
      return newOp
    }
  }

  GetLastOutPt(e: TEdge): OutPt {
    const outRec = this.m_PolyOuts[e.OutIdx]
    if (e.Side === EdgeSide.esLeft) {
      return outRec.Pts!
    } else {
      return outRec.Pts!.Prev!
    }
  }

  // Commented out since it is not used
  // public SwapPoints(pt1: { Value: IntPoint }, pt2: { Value: { X: number; Y: number; Z: number } }) {
  //   const tmp = new IntPoint(pt1.Value)
  //   // pt1.Value = pt2.Value;
  //   pt1.Value.X = pt2.Value.X
  //   pt1.Value.Y = pt2.Value.Y
  //   if (use_xyz) pt1.Value.Z = pt2.Value.Z
  //   // pt2.Value = tmp;
  //   pt2.Value.X = tmp.X
  //   pt2.Value.Y = tmp.Y
  //   if (use_xyz) pt2.Value.Z = tmp.Z
  // }

  protected HorzSegmentsOverlap(seg1a: number, seg1b: number, seg2a: number, seg2b: number) {
    let tmp
    if (seg1a > seg1b) {
      tmp = seg1a
      seg1a = seg1b
      seg1b = tmp
    }
    if (seg2a > seg2b) {
      tmp = seg2a
      seg2a = seg2b
      seg2b = tmp
    }
    return (seg1a < seg2b) && (seg2a < seg1b)
  }

  protected SetHoleState(e: TEdge, outRec: OutRec) {
    let e2 = e.PrevInAEL
    let eTmp: TEdge | null = null
    while (e2 !== null) {
      if (e2.OutIdx >= 0 && e2.WindDelta !== 0) {
        if (eTmp === null) {
          eTmp = e2
        } else if (eTmp.OutIdx === e2.OutIdx) {
          eTmp = null // paired
        }
      }
      e2 = e2.PrevInAEL
    }

    if (eTmp === null) {
      outRec.FirstLeft = null
      outRec.IsHole = false
    } else {
      outRec.FirstLeft = this.m_PolyOuts[eTmp.OutIdx]
      outRec.IsHole = !outRec.FirstLeft!.IsHole
    }
  }

  protected GetDx(pt1: Point, pt2: Point) {
    if (pt1.y === pt2.y) {
      return ClipperBase.horizontal
    } else {
      return (pt2.x - pt1.x) / (pt2.y - pt1.y)
    }
  }

  protected FirstIsBottomPt(btmPt1: OutPt, btmPt2: OutPt) {
    let p = btmPt1.Prev
    while ((IntPoint.op_Equality(p.Pt, btmPt1.Pt)) && (p !== btmPt1)) {
      p = p.Prev
    }
    const dx1p = Math.abs(this.GetDx(btmPt1.Pt, p.Pt))
    p = btmPt1.Next
    while ((IntPoint.op_Equality(p.Pt, btmPt1.Pt)) && (p !== btmPt1)) {
      p = p.Next
    }
    const dx1n = Math.abs(this.GetDx(btmPt1.Pt, p.Pt))
    p = btmPt2.Prev
    while ((IntPoint.op_Equality(p.Pt, btmPt2.Pt)) && (p !== btmPt2)) {
      p = p.Prev
    }
    const dx2p = Math.abs(this.GetDx(btmPt2.Pt, p.Pt))
    p = btmPt2.Next
    while ((IntPoint.op_Equality(p.Pt, btmPt2.Pt)) && (p !== btmPt2)) {
      p = p.Next
    }
    const dx2n = Math.abs(this.GetDx(btmPt2.Pt, p.Pt))

    if (Math.max(dx1p, dx1n) === Math.max(dx2p, dx2n) && Math.min(dx1p, dx1n) === Math.min(dx2p, dx2n)) {
      return this.Area(btmPt1) > 0 // if otherwise identical use orientation
    } else {
      return (dx1p >= dx2p && dx1p >= dx2n) || (dx1n >= dx2p && dx1n >= dx2n)
    }
  }

  protected GetBottomPt(pp: OutPt) {
    let dups: OutPt | null = null
    let p = pp.Next
    while (p !== pp) {
      if (p.Pt.y > pp.Pt.y) {
        pp = p
        dups = null
      } else if (p.Pt.y === pp.Pt.y && p.Pt.x <= pp.Pt.x) {
        if (p.Pt.x < pp.Pt.x) {
          dups = null
          pp = p
        } else {
          if (p.Next !== pp && p.Prev !== pp) {
            dups = p
          }
        }
      }
      p = p.Next
    }
    if (dups !== null) {
      // there appears to be at least 2 vertices at bottomPt so ...
      while (dups !== p) {
        if (!this.FirstIsBottomPt(p, dups)) {
          pp = dups
        }
        dups = dups.Next
        while (IntPoint.op_Inequality(dups.Pt, pp.Pt)) {
          dups = dups.Next
        }
      }
    }
    return pp
  }

  protected GetLowermostRec(outRec1: OutRec, outRec2: OutRec) {
    // work out which polygon fragment has the correct hole state ...
    if (outRec1.BottomPt === null) {
      outRec1.BottomPt = this.GetBottomPt(outRec1.Pts!)
    }
    if (outRec2.BottomPt === null) {
      outRec2.BottomPt = this.GetBottomPt(outRec2.Pts!)
    }
    const bPt1 = outRec1.BottomPt
    const bPt2 = outRec2.BottomPt
    if (bPt1.Pt.y > bPt2.Pt.y) {
      return outRec1
    } else if (bPt1.Pt.y < bPt2.Pt.y) {
      return outRec2
    } else if (bPt1.Pt.x < bPt2.Pt.x) {
      return outRec1
    } else if (bPt1.Pt.x > bPt2.Pt.x) {
      return outRec2
    } else if (bPt1.Next === bPt1) {
      return outRec2
    } else if (bPt2.Next === bPt2) {
      return outRec1
    } else if (this.FirstIsBottomPt(bPt1, bPt2)) {
      return outRec1
    } else {
      return outRec2
    }
  }

  protected OutRec1RightOfOutRec2(outRec1: OutRec, outRec2: OutRec) {
    do {
      // @ts-ignore
      outRec1 = outRec1.FirstLeft
      if (outRec1 === outRec2) {
        return true
      }
    } while (outRec1 !== null)
    return false
  }

  protected GetOutRec(idx: number) {
    let outrec = this.m_PolyOuts[idx]
    while (outrec !== this.m_PolyOuts[outrec.Idx]) {
      outrec = this.m_PolyOuts[outrec.Idx]
    }
    return outrec
  }

  protected AppendPolygon(e1: { OutIdx: number; Side: EdgeSide }, e2: { OutIdx: number; Side: EdgeSide }) {
    // get the start and ends of both output polygons ...
    const outRec1 = this.m_PolyOuts[e1.OutIdx]
    const outRec2 = this.m_PolyOuts[e2.OutIdx]
    let holeStateRec
    if (this.OutRec1RightOfOutRec2(outRec1, outRec2)) {
      holeStateRec = outRec2
    } else if (this.OutRec1RightOfOutRec2(outRec2, outRec1)) {
      holeStateRec = outRec1
    } else {
      holeStateRec = this.GetLowermostRec(outRec1, outRec2)
    }

    // get the start and ends of both output polygons and
    // join E2 poly onto E1 poly and delete pointers to E2 ...

    const p1_lft = outRec1.Pts!
    const p1_rt = p1_lft.Prev
    const p2_lft = outRec2.Pts!
    const p2_rt = p2_lft.Prev
    // join e2 poly onto e1 poly and delete pointers to e2 ...
    if (e1.Side === EdgeSide.esLeft) {
      if (e2.Side === EdgeSide.esLeft) {
        // z y x a b c
        this.ReversePolyPtLinks(p2_lft)
        p2_lft.Next = p1_lft
        p1_lft.Prev = p2_lft
        p1_rt.Next = p2_rt
        p2_rt.Prev = p1_rt
        outRec1.Pts = p2_rt
      } else {
        // x y z a b c
        p2_rt.Next = p1_lft
        p1_lft.Prev = p2_rt
        p2_lft.Prev = p1_rt
        p1_rt.Next = p2_lft
        outRec1.Pts = p2_lft
      }
    } else {
      if (e2.Side === EdgeSide.esRight) {
        // a b c z y x
        this.ReversePolyPtLinks(p2_lft)
        p1_rt.Next = p2_rt
        p2_rt.Prev = p1_rt
        p2_lft.Next = p1_lft
        p1_lft.Prev = p2_lft
      } else {
        // a b c x y z
        p1_rt.Next = p2_lft
        p2_lft.Prev = p1_rt
        p1_lft.Prev = p2_rt
        p2_rt.Next = p1_lft
      }
    }
    outRec1.BottomPt = null
    if (holeStateRec === outRec2) {
      if (outRec2.FirstLeft !== outRec1) {
        outRec1.FirstLeft = outRec2.FirstLeft
      }
      outRec1.IsHole = outRec2.IsHole
    }
    outRec2.Pts = null
    outRec2.BottomPt = null
    outRec2.FirstLeft = outRec1
    const OKIdx = e1.OutIdx
    const ObsoleteIdx = e2.OutIdx
    e1.OutIdx = -1
    // nb: safe because we only get here via AddLocalMaxPoly
    e2.OutIdx = -1
    let e = this.m_ActiveEdges
    while (e !== null) {
      if (e.OutIdx === ObsoleteIdx) {
        e.OutIdx = OKIdx
        e.Side = e1.Side
        break
      }
      e = e.NextInAEL
    }
    outRec2.Idx = outRec1.Idx
  }

  protected ReversePolyPtLinks(pp: OutPt) {
    if (pp === null) {
      return
    }
    let pp1
    let pp2
    pp1 = pp
    do {
      pp2 = pp1.Next
      pp1.Next = pp1.Prev
      pp1.Prev = pp2
      pp1 = pp2
    } while (pp1 !== pp)
  }

  protected static SwapSides(edge1: TEdge, edge2: TEdge) {
    const side = edge1.Side
    edge1.Side = edge2.Side
    edge2.Side = side
  }

  protected static SwapPolyIndexes(edge1: TEdge, edge2: TEdge) {
    const outIdx = edge1.OutIdx
    edge1.OutIdx = edge2.OutIdx
    edge2.OutIdx = outIdx
  }

  protected IntersectEdges(e1: TEdge, e2: TEdge, pt: IntPoint) {
    // e1 will be to the left of e2 BELOW the intersection. Therefore e1 is before
    // e2 in AEL except when e1 is being inserted at the intersection point ...
    const e1Contributing = e1.OutIdx >= 0
    const e2Contributing = e2.OutIdx >= 0

    if (use_xyz) {
      this.SetZ(pt, e1, e2)
    }

    if (use_lines) {
      // if either edge is on an OPEN path ...
      if (e1.WindDelta === 0 || e2.WindDelta === 0) {
        // ignore subject-subject open path intersections UNLESS they
        // are both open paths, AND they are both 'contributing maximas' ...
        if (e1.WindDelta === 0 && e2.WindDelta === 0) return
        // if intersecting a subj line with a subj poly ...
        else if (
          e1.PolyTyp === e2.PolyTyp
          && e1.WindDelta !== e2.WindDelta && this.m_ClipType === ClipType.ctUnion
        ) {
          if (e1.WindDelta === 0) {
            if (e2Contributing) {
              this.AddOutPt(e1, pt)
              if (e1Contributing) {
                e1.OutIdx = -1
              }
            }
          } else {
            if (e1Contributing) {
              this.AddOutPt(e2, pt)
              if (e2Contributing) {
                e2.OutIdx = -1
              }
            }
          }
        } else if (e1.PolyTyp !== e2.PolyTyp) {
          if (
            (e1.WindDelta === 0) && Math.abs(e2.WindCnt) === 1
            && (this.m_ClipType !== ClipType.ctUnion || e2.WindCnt2 === 0)
          ) {
            this.AddOutPt(e1, pt)
            if (e1Contributing) {
              e1.OutIdx = -1
            }
          } else if (
            (e2.WindDelta === 0) && (Math.abs(e1.WindCnt) === 1)
            && (this.m_ClipType !== ClipType.ctUnion || e1.WindCnt2 === 0)
          ) {
            this.AddOutPt(e2, pt)
            if (e2Contributing) {
              e2.OutIdx = -1
            }
          }
        }
        return
      }
    }
    // update winding counts...
    // assumes that e1 will be to the Right of e2 ABOVE the intersection
    if (e1.PolyTyp === e2.PolyTyp) {
      if (this.IsEvenOddFillType(e1)) {
        const oldE1WindCnt = e1.WindCnt
        e1.WindCnt = e2.WindCnt
        e2.WindCnt = oldE1WindCnt
      } else {
        if (e1.WindCnt + e2.WindDelta === 0) {
          e1.WindCnt = -e1.WindCnt
        } else {
          e1.WindCnt += e2.WindDelta
        }
        if (e2.WindCnt - e1.WindDelta === 0) {
          e2.WindCnt = -e2.WindCnt
        } else {
          e2.WindCnt -= e1.WindDelta
        }
      }
    } else {
      if (!this.IsEvenOddFillType(e2)) {
        e1.WindCnt2 += e2.WindDelta
      } else {
        e1.WindCnt2 = (e1.WindCnt2 === 0) ? 1 : 0
      }
      if (!this.IsEvenOddFillType(e1)) {
        e2.WindCnt2 -= e1.WindDelta
      } else {
        e2.WindCnt2 = (e2.WindCnt2 === 0) ? 1 : 0
      }
    }
    let e1FillType, e2FillType, e1FillType2, e2FillType2
    if (e1.PolyTyp === PolyType.ptSubject) {
      e1FillType = this.m_SubjFillType
      e1FillType2 = this.m_ClipFillType
    } else {
      e1FillType = this.m_ClipFillType
      e1FillType2 = this.m_SubjFillType
    }
    if (e2.PolyTyp === PolyType.ptSubject) {
      e2FillType = this.m_SubjFillType
      e2FillType2 = this.m_ClipFillType
    } else {
      e2FillType = this.m_ClipFillType
      e2FillType2 = this.m_SubjFillType
    }
    let e1Wc, e2Wc
    switch (e1FillType) {
      case PolyFillType.pftPositive:
        e1Wc = e1.WindCnt
        break
      case PolyFillType.pftNegative:
        e1Wc = -e1.WindCnt
        break
      default:
        e1Wc = Math.abs(e1.WindCnt)
        break
    }
    switch (e2FillType) {
      case PolyFillType.pftPositive:
        e2Wc = e2.WindCnt
        break
      case PolyFillType.pftNegative:
        e2Wc = -e2.WindCnt
        break
      default:
        e2Wc = Math.abs(e2.WindCnt)
        break
    }
    if (e1Contributing && e2Contributing) {
      if (
        (e1Wc !== 0 && e1Wc !== 1) || (e2Wc !== 0 && e2Wc !== 1)
        || (e1.PolyTyp !== e2.PolyTyp && this.m_ClipType !== ClipType.ctXor)
      ) {
        this.AddLocalMaxPoly(e1, e2, pt)
      } else {
        this.AddOutPt(e1, pt)
        this.AddOutPt(e2, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if (e1Contributing) {
      if (e2Wc === 0 || e2Wc === 1) {
        this.AddOutPt(e1, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if (e2Contributing) {
      if (e1Wc === 0 || e1Wc === 1) {
        this.AddOutPt(e2, pt)
        Clipper.SwapSides(e1, e2)
        Clipper.SwapPolyIndexes(e1, e2)
      }
    } else if ((e1Wc === 0 || e1Wc === 1) && (e2Wc === 0 || e2Wc === 1)) {
      // neither edge is currently contributing ...
      let e1Wc2, e2Wc2
      switch (e1FillType2) {
        case PolyFillType.pftPositive:
          e1Wc2 = e1.WindCnt2
          break
        case PolyFillType.pftNegative:
          e1Wc2 = -e1.WindCnt2
          break
        default:
          e1Wc2 = Math.abs(e1.WindCnt2)
          break
      }
      switch (e2FillType2) {
        case PolyFillType.pftPositive:
          e2Wc2 = e2.WindCnt2
          break
        case PolyFillType.pftNegative:
          e2Wc2 = -e2.WindCnt2
          break
        default:
          e2Wc2 = Math.abs(e2.WindCnt2)
          break
      }
      if (e1.PolyTyp !== e2.PolyTyp) {
        this.AddLocalMinPoly(e1, e2, pt)
      } else if (e1Wc === 1 && e2Wc === 1) {
        switch (this.m_ClipType) {
          case ClipType.ctIntersection:
            if (e1Wc2 > 0 && e2Wc2 > 0) {
              this.AddLocalMinPoly(e1, e2, pt)
            }
            break
          case ClipType.ctUnion:
            if (e1Wc2 <= 0 && e2Wc2 <= 0) {
              this.AddLocalMinPoly(e1, e2, pt)
            }
            break
          case ClipType.ctDifference:
            if (
              ((e1.PolyTyp === PolyType.ptClip) && (e1Wc2 > 0) && (e2Wc2 > 0))
              || ((e1.PolyTyp === PolyType.ptSubject) && (e1Wc2 <= 0) && (e2Wc2 <= 0))
            ) {
              this.AddLocalMinPoly(e1, e2, pt)
            }
            break
          case ClipType.ctXor:
            this.AddLocalMinPoly(e1, e2, pt)
            break
        }
      } else {
        Clipper.SwapSides(e1, e2)
      }
    }
  }

  // Commented out since it is not used
  // protected DeleteFromSEL(e: TEdge) {
  //   const SelPrev = e.PrevInSEL
  //   const SelNext = e.NextInSEL
  //   if (SelPrev === null && SelNext === null && (e !== this.m_SortedEdges)) {
  //     return
  //   }
  //   // already deleted
  //   if (SelPrev !== null) {
  //     SelPrev.NextInSEL = SelNext
  //   } else {
  //     this.m_SortedEdges = SelNext
  //   }
  //   if (SelNext !== null) {
  //     SelNext.PrevInSEL = SelPrev
  //   }
  //   e.NextInSEL = null
  //   e.PrevInSEL = null
  // }

  protected ProcessHorizontals() {
    const horzEdge: Ref<any> = {} // m_SortedEdges;
    while (this.PopEdgeFromSEL(horzEdge)) {
      this.ProcessHorizontal(horzEdge.v)
    }
  }

  protected GetHorzDirection(HorzEdge: TEdge, $const: { Dir: Direction; Left: number; Right: number }) {
    if (HorzEdge.Bot.x < HorzEdge.Top.x) {
      $const.Left = HorzEdge.Bot.x
      $const.Right = HorzEdge.Top.x
      $const.Dir = Direction.dLeftToRight
    } else {
      $const.Left = HorzEdge.Top.x
      $const.Right = HorzEdge.Bot.x
      $const.Dir = Direction.dRightToLeft
    }
  }

  protected ProcessHorizontal(horzEdge: TEdge) {
    let $const = {
      Dir: null,
      Left: null,
      Right: null,
    } as {
      Dir: any
      Left: any
      Right: any
    }

    this.GetHorzDirection(horzEdge, $const)
    let dir = $const.Dir
    let horzLeft = $const.Left
    let horzRight = $const.Right

    const IsOpen = horzEdge.WindDelta === 0

    let eLastHorz = horzEdge,
      eMaxPair: TEdge | null = null
    while (eLastHorz.NextInLML !== null && ClipperBase.IsHorizontal(eLastHorz.NextInLML)) {
      eLastHorz = eLastHorz.NextInLML
    }
    if (eLastHorz.NextInLML === null) {
      eMaxPair = this.GetMaximaPair(eLastHorz)
    }

    let currMax = this.m_Maxima
    if (currMax !== null) {
      // get the first maxima in range (X) ...
      if (dir === Direction.dLeftToRight) {
        while (currMax !== null && currMax.X <= horzEdge.Bot.x) {
          currMax = currMax.Next
        }
        if (currMax !== null && currMax.X >= eLastHorz.Top.x) {
          currMax = null
        }
      } else {
        while (currMax.Next !== null && currMax.Next.X < horzEdge.Bot.x) {
          currMax = currMax.Next
        }
        if (currMax.X <= eLastHorz.Top.x) {
          currMax = null
        }
      }
    }
    let op1: OutPt | null = null
    for (;;) { // loop through consec. horizontal edges
      const IsLastHorz = horzEdge === eLastHorz
      let e = this.GetNextInAEL(horzEdge, dir)
      while (e !== null) {
        // this code block inserts extra coords into horizontal edges (in output
        // polygons) whereever maxima touch these horizontal edges. This helps
        // 'simplifying' polygons (ie if the Simplify property is set).
        if (currMax !== null) {
          if (dir === Direction.dLeftToRight) {
            while (currMax !== null && currMax.X < e.Curr.x) {
              if (horzEdge.OutIdx >= 0 && !IsOpen) {
                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.y))
              }
              currMax = currMax.Next
            }
          } else {
            while (currMax !== null && currMax.X > e.Curr.x) {
              if (horzEdge.OutIdx >= 0 && !IsOpen) {
                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.y))
              }
              currMax = currMax.Prev
            }
          }
        }

        if ((dir === Direction.dLeftToRight && e.Curr.x > horzRight) || (dir === Direction.dRightToLeft && e.Curr.x < horzLeft)) {
          break
        }

        // Also break if we've got to the end of an intermediate horizontal edge ...
        // nb: Smaller Dx's are to the right of larger Dx's ABOVE the horizontal.
        if (e.Curr.x === horzEdge.Top.x && horzEdge.NextInLML !== null && e.Dx < horzEdge.NextInLML.Dx) {
          break
        }

        if (horzEdge.OutIdx >= 0 && !IsOpen) { // note: may be done multiple times
          if (use_xyz) {
            if (dir === Direction.dLeftToRight) {
              this.SetZ(e.Curr, horzEdge, e)
            } else this.SetZ(e.Curr, e, horzEdge)
          }

          op1 = this.AddOutPt(horzEdge, e.Curr)
          let eNextHorz = this.m_SortedEdges
          while (eNextHorz !== null) {
            if (eNextHorz.OutIdx >= 0 && this.HorzSegmentsOverlap(horzEdge.Bot.x, horzEdge.Top.x, eNextHorz.Bot.x, eNextHorz.Top.x)) {
              const op2 = this.GetLastOutPt(eNextHorz)
              this.AddJoin(op2, op1, eNextHorz.Top)
            }
            eNextHorz = eNextHorz.NextInSEL
          }
          this.AddGhostJoin(op1, horzEdge.Bot)
        }

        // OK, so far we're still in range of the horizontal Edge  but make sure
        // we're at the last of consec. horizontals when matching with eMaxPair
        if (e === eMaxPair && IsLastHorz) {
          if (horzEdge.OutIdx >= 0) {
            this.AddLocalMaxPoly(horzEdge, eMaxPair, horzEdge.Top)
          }
          this.DeleteFromAEL(horzEdge)
          this.DeleteFromAEL(eMaxPair)
          return
        }

        if (dir === Direction.dLeftToRight) {
          const Pt = new IntPoint(e.Curr.x, horzEdge.Curr.y)
          this.IntersectEdges(horzEdge, e, Pt)
        } else {
          const Pt = new IntPoint(e.Curr.x, horzEdge.Curr.y)
          this.IntersectEdges(e, horzEdge, Pt)
        }
        const eNext = this.GetNextInAEL(e, dir)
        this.SwapPositionsInAEL(horzEdge, e)
        e = eNext
      } // end while(e !== null)

      // Break out of loop if HorzEdge.NextInLML is not also horizontal ...
      if (horzEdge.NextInLML === null || !ClipperBase.IsHorizontal(horzEdge.NextInLML)) {
        break
      }

      horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
      if (horzEdge.OutIdx >= 0) {
        this.AddOutPt(horzEdge, horzEdge.Bot)
      }

      $const = {
        Dir: dir,
        Left: horzLeft,
        Right: horzRight,
      }

      this.GetHorzDirection(horzEdge, $const)
      dir = $const.Dir
      horzLeft = $const.Left
      horzRight = $const.Right
    } // end for (;;)

    if (horzEdge.OutIdx >= 0 && op1 === null) {
      op1 = this.GetLastOutPt(horzEdge)
      let eNextHorz = this.m_SortedEdges
      while (eNextHorz !== null) {
        if (eNextHorz.OutIdx >= 0 && this.HorzSegmentsOverlap(horzEdge.Bot.x, horzEdge.Top.x, eNextHorz.Bot.x, eNextHorz.Top.x)) {
          const op2 = this.GetLastOutPt(eNextHorz)
          this.AddJoin(op2, op1, eNextHorz.Top)
        }
        eNextHorz = eNextHorz.NextInSEL
      }
      this.AddGhostJoin(op1, horzEdge.Top)
    }

    if (horzEdge.NextInLML !== null) {
      if (horzEdge.OutIdx >= 0) {
        op1 = this.AddOutPt(horzEdge, horzEdge.Top)

        horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
        if (horzEdge.WindDelta === 0) {
          return
        }
        // nb: HorzEdge is no longer horizontal here
        const ePrev = horzEdge.PrevInAEL
        const eNext = horzEdge.NextInAEL
        if (
          ePrev !== null && ePrev.Curr.x === horzEdge.Bot.x && ePrev.Curr.y === horzEdge.Bot.y && ePrev.WindDelta === 0
          && (ePrev.OutIdx >= 0 && ePrev.Curr.y > ePrev.Top.y && ClipperBase.SlopesEqual3(horzEdge, ePrev, this.m_UseFullRange))
        ) {
          const op2 = this.AddOutPt(ePrev, horzEdge.Bot)
          this.AddJoin(op1, op2, horzEdge.Top)
        } else if (
          eNext !== null && eNext.Curr.x === horzEdge.Bot.x && eNext.Curr.y === horzEdge.Bot.y && eNext.WindDelta !== 0 && eNext.OutIdx >= 0 && eNext.Curr.y > eNext.Top.y
          && ClipperBase.SlopesEqual3(horzEdge, eNext, this.m_UseFullRange)
        ) {
          const op2 = this.AddOutPt(eNext, horzEdge.Bot)
          this.AddJoin(op1, op2, horzEdge.Top)
        }
      } else {
        horzEdge = this.UpdateEdgeIntoAEL(horzEdge)
      }
    } else {
      if (horzEdge.OutIdx >= 0) {
        this.AddOutPt(horzEdge, horzEdge.Top)
      }
      this.DeleteFromAEL(horzEdge)
    }
  }

  protected GetNextInAEL(e: TEdge, dir: Direction | null) {
    return dir === Direction.dLeftToRight ? e.NextInAEL : e.PrevInAEL
  }

  // Commented out since it is not used
  // protected IsMinima(e: TEdge | null) {
  //   return e !== null && (e.Prev.NextInLML !== e) && (e.Next.NextInLML !== e)
  // }

  protected IsMaxima(e: TEdge | null, Y: number) {
    return (e !== null && e.Top.y === Y && e.NextInLML === null)
  }

  protected IsIntermediate(e: TEdge, Y: number) {
    return (e.Top.y === Y && e.NextInLML !== null)
  }

  protected GetMaximaPair(e: TEdge) {
    if ((IntPoint.op_Equality(e.Next.Top, e.Top)) && e.Next.NextInLML === null) {
      return e.Next
    } else {
      if ((IntPoint.op_Equality(e.Prev.Top, e.Top)) && e.Prev.NextInLML === null) {
        return e.Prev
      } else {
        return null
      }
    }
  }

  protected GetMaximaPairEx(e: TEdge) {
    // as above but returns null if MaxPair isn't in AEL (unless it's horizontal)
    const result = this.GetMaximaPair(e)
    if (
      result === null || result.OutIdx === ClipperBase.Skip
      || ((result.NextInAEL === result.PrevInAEL) && !ClipperBase.IsHorizontal(result))
    ) {
      return null
    }
    return result
  }

  protected ProcessIntersections(topY: number) {
    if (this.m_ActiveEdges === null) {
      return true
    }
    try {
      this.BuildIntersectList(topY)
      if (this.m_IntersectList.length === 0) {
        return true
      }
      if (this.m_IntersectList.length === 1 || this.FixupIntersectionOrder()) {
        this.ProcessIntersectList()
      } else {
        return false
      }
    } catch ($$e2) {
      this.m_SortedEdges = null
      this.m_IntersectList.length = 0
      throw new Error('ProcessIntersections error')
    }
    this.m_SortedEdges = null
    return true
  }

  protected BuildIntersectList(topY: number) {
    if (this.m_ActiveEdges === null) {
      return
    }
    // prepare for sorting ...
    let e: TEdge | null = this.m_ActiveEdges
    // console.log(JSON.stringify(JSON.decycle( e )));
    this.m_SortedEdges = e
    while (e !== null) {
      e.PrevInSEL = e.PrevInAEL
      e.NextInSEL = e.NextInAEL
      e.Curr.x = Clipper.TopX(e, topY)
      e = e.NextInAEL
    }
    // bubblesort ...
    let isModified = true
    while (isModified && this.m_SortedEdges !== null) {
      isModified = false
      let e = this.m_SortedEdges
      while (e.NextInSEL !== null) {
        const eNext = e.NextInSEL
        let pt = new IntPoint()
        // console.log("e.Curr.X: " + e.Curr.X + " eNext.Curr.X" + eNext.Curr.X);
        if (e.Curr.x > eNext.Curr.x) {
          this.IntersectPoint(e, eNext, pt)
          if (pt.y < topY) {
            pt = new IntPoint(Clipper.TopX(e, topY), topY)
          }
          const newNode = new IntersectNode()
          newNode.Edge1 = e
          newNode.Edge2 = eNext
          // newNode.Pt = pt;
          newNode.Pt.x = pt.x
          newNode.Pt.y = pt.y
          if (use_xyz) newNode.Pt.z = pt.z
          this.m_IntersectList.push(newNode)
          this.SwapPositionsInSEL(e, eNext)
          isModified = true
        } else {
          e = eNext
        }
      }
      if (e.PrevInSEL !== null) {
        e.PrevInSEL.NextInSEL = null
      } else {
        break
      }
    }
    this.m_SortedEdges = null
  }

  protected EdgesAdjacent(inode: IntersectNode) {
    return (inode.Edge1!.NextInSEL === inode.Edge2) || (inode.Edge1!.PrevInSEL === inode.Edge2)
  }

  // Commented out since it is not used
  // protected static IntersectNodeSort(node1: { Pt: { Y: number } }, node2: { Pt: { Y: number } }) {
  //   // the following typecast is safe because the differences in Pt.Y will
  //   // be limited to the height of the scanbeam.
  //   return (node2.Pt.Y - node1.Pt.Y)
  // }

  protected FixupIntersectionOrder() {
    // pre-condition: intersections are sorted bottom-most first.
    // Now it's crucial that intersections are made only between adjacent edges,
    // so to ensure this the order of intersections may need adjusting ...
    this.m_IntersectList.sort(this.m_IntersectNodeComparer)
    this.CopyAELToSEL()
    const cnt = this.m_IntersectList.length
    for (let i = 0; i < cnt; i++) {
      if (!this.EdgesAdjacent(this.m_IntersectList[i])) {
        let j = i + 1
        while (j < cnt && !this.EdgesAdjacent(this.m_IntersectList[j])) {
          j++
        }
        if (j === cnt) {
          return false
        }
        const tmp = this.m_IntersectList[i]
        this.m_IntersectList[i] = this.m_IntersectList[j]
        this.m_IntersectList[j] = tmp
      }
      this.SwapPositionsInSEL(this.m_IntersectList[i].Edge1!, this.m_IntersectList[i].Edge2!)
    }
    return true
  }

  protected ProcessIntersectList() {
    for (let i = 0, ilen = this.m_IntersectList.length; i < ilen; i++) {
      const iNode = this.m_IntersectList[i]
      this.IntersectEdges(iNode.Edge1!, iNode.Edge2!, iNode.Pt)
      this.SwapPositionsInAEL(iNode.Edge1!, iNode.Edge2!)
    }
    this.m_IntersectList.length = 0
  }

  /*
	--------------------------------
	Round speedtest: http://jsperf.com/fastest-round
	--------------------------------
	*/

  static Round(a: number) {
    return a < 0 ? Math.ceil(a - 0.5) : Math.floor(a + 0.5)
  }

  protected static TopX(edge: TEdge, currentY: number) {
    // if (edge.Bot == edge.Curr) alert ("edge.Bot = edge.Curr");
    // if (edge.Bot == edge.Top) alert ("edge.Bot = edge.Top");
    if (currentY === edge.Top.y) {
      return edge.Top.x
    }
    return edge.Bot.x + Clipper.Round(edge.Dx * (currentY - edge.Bot.y))
  }

  protected IntersectPoint(edge1: TEdge, edge2: TEdge, ip: IntPoint) {
    ip.x = 0
    ip.y = 0
    let b1, b2
    // nb: with very large coordinate values, it's possible for SlopesEqual() to
    // return false but for the edge.Dx value be equal due to double precision rounding.
    if (edge1.Dx === edge2.Dx) {
      ip.y = edge1.Curr.y
      ip.x = Clipper.TopX(edge1, ip.y)
      return
    }
    if (edge1.Delta.x === 0) {
      ip.x = edge1.Bot.x
      if (ClipperBase.IsHorizontal(edge2)) {
        ip.y = edge2.Bot.y
      } else {
        b2 = edge2.Bot.y - (edge2.Bot.x / edge2.Dx)
        ip.y = Clipper.Round(ip.x / edge2.Dx + b2)
      }
    } else if (edge2.Delta.x === 0) {
      ip.x = edge2.Bot.x
      if (ClipperBase.IsHorizontal(edge1)) {
        ip.y = edge1.Bot.y
      } else {
        b1 = edge1.Bot.y - (edge1.Bot.x / edge1.Dx)
        ip.y = Clipper.Round(ip.x / edge1.Dx + b1)
      }
    } else {
      b1 = edge1.Bot.x - edge1.Bot.y * edge1.Dx
      b2 = edge2.Bot.x - edge2.Bot.y * edge2.Dx
      const q = (b2 - b1) / (edge1.Dx - edge2.Dx)
      ip.y = Clipper.Round(q)
      if (Math.abs(edge1.Dx) < Math.abs(edge2.Dx)) {
        ip.x = Clipper.Round(edge1.Dx * q + b1)
      } else {
        ip.x = Clipper.Round(edge2.Dx * q + b2)
      }
    }
    if (ip.y < edge1.Top.y || ip.y < edge2.Top.y) {
      if (edge1.Top.y > edge2.Top.y) {
        ip.y = edge1.Top.y
        ip.x = Clipper.TopX(edge2, edge1.Top.y)
        return ip.x < edge1.Top.x
      } else {
        ip.y = edge2.Top.y
      }
      if (Math.abs(edge1.Dx) < Math.abs(edge2.Dx)) {
        ip.x = Clipper.TopX(edge1, ip.y)
      } else {
        ip.x = Clipper.TopX(edge2, ip.y)
      }
    }
    // finally, don't allow 'ip' to be BELOW curr.Y (ie bottom of scanbeam) ...
    if (ip.y > edge1.Curr.y) {
      ip.y = edge1.Curr.y
      // better to use the more vertical edge to derive X ...
      if (Math.abs(edge1.Dx) > Math.abs(edge2.Dx)) {
        ip.x = Clipper.TopX(edge2, ip.y)
      } else {
        ip.x = Clipper.TopX(edge1, ip.y)
      }
    }
  }

  protected ProcessEdgesAtTopOfScanbeam(topY: number) {
    let e = this.m_ActiveEdges

    while (e !== null) {
      // 1. process maxima, treating them as if they're 'bent' horizontal edges,
      //   but exclude maxima with horizontal edges. nb: e can't be a horizontal.
      let IsMaximaEdge = this.IsMaxima(e, topY)
      if (IsMaximaEdge) {
        const eMaxPair = this.GetMaximaPairEx(e)
        IsMaximaEdge = eMaxPair === null || !ClipperBase.IsHorizontal(eMaxPair)
      }
      if (IsMaximaEdge) {
        // if (this.StrictlySimple) {
        //   this.InsertMaxima(e.Top.X)
        // }
        const ePrev = e.PrevInAEL
        this.DoMaxima(e)
        if (ePrev === null) {
          e = this.m_ActiveEdges
        } else {
          e = ePrev.NextInAEL
        }
      } else {
        // 2. promote horizontal edges, otherwise update Curr.X and Curr.Y ...
        if (this.IsIntermediate(e, topY) && ClipperBase.IsHorizontal(e.NextInLML!)) {
          e = this.UpdateEdgeIntoAEL(e)
          if (e.OutIdx >= 0) {
            this.AddOutPt(e, e.Bot)
          }
          this.AddEdgeToSEL(e)
        } else {
          e.Curr.x = Clipper.TopX(e, topY)
          e.Curr.y = topY
        }

        if (use_xyz) {
          if (e.Top.y === topY) e.Curr.z = e.Top.z
          else if (e.Bot.y === topY) e.Curr.z = e.Bot.z
          else e.Curr.z = 0
        }

        // When StrictlySimple and 'e' is being touched by another edge, then
        // make sure both edges have a vertex here ...
        // if (this.StrictlySimple) {
        //   const ePrev = e.PrevInAEL
        //   if (
        //     (e.OutIdx >= 0) && (e.WindDelta !== 0) && ePrev !== null
        //     && (ePrev.OutIdx >= 0) && (ePrev.Curr.X === e.Curr.X)
        //     && (ePrev.WindDelta !== 0)
        //   ) {
        //     const ip = new IntPoint(e.Curr)

        //     if (use_xyz) {
        //       this.SetZ(ip, ePrev, e)
        //     }

        //     const op = this.AddOutPt(ePrev, ip)
        //     const op2 = this.AddOutPt(e, ip)
        //     this.AddJoin(op, op2, ip) // StrictlySimple (type-3) join
        //   }
        // }
        e = e.NextInAEL
      }
    }
    // 3. Process horizontals at the Top of the scanbeam ...
    this.ProcessHorizontals()
    this.m_Maxima = null
    // 4. Promote intermediate vertices ...
    e = this.m_ActiveEdges
    while (e !== null) {
      if (this.IsIntermediate(e, topY)) {
        let op: OutPt | null = null
        if (e.OutIdx >= 0) {
          op = this.AddOutPt(e, e.Top)
        }
        e = this.UpdateEdgeIntoAEL(e)
        // if output polygons share an edge, they'll need joining later ...
        const ePrev = e.PrevInAEL
        const eNext = e.NextInAEL

        if (
          ePrev !== null && ePrev.Curr.x === e.Bot.x && ePrev.Curr.y === e.Bot.y && op !== null && ePrev.OutIdx >= 0 && ePrev.Curr.y === ePrev.Top.y
          && ClipperBase.SlopesEqual5(e.Curr, e.Top, ePrev.Curr, ePrev.Top, this.m_UseFullRange) && (e.WindDelta !== 0) && (ePrev.WindDelta !== 0)
        ) {
          const op2 = this.AddOutPt(ePrev, e.Bot)
          this.AddJoin(op, op2, e.Top)
        } else if (
          eNext !== null && eNext.Curr.x === e.Bot.x && eNext.Curr.y === e.Bot.y && op !== null && eNext.OutIdx >= 0 && eNext.Curr.y === eNext.Top.y
          && ClipperBase.SlopesEqual5(e.Curr, e.Top, eNext.Curr, eNext.Top, this.m_UseFullRange) && (e.WindDelta !== 0) && (eNext.WindDelta !== 0)
        ) {
          const op2 = this.AddOutPt(eNext, e.Bot)
          this.AddJoin(op, op2, e.Top)
        }
      }
      e = e.NextInAEL
    }
  }

  protected DoMaxima(e: TEdge) {
    const eMaxPair = this.GetMaximaPairEx(e)
    if (eMaxPair === null) {
      if (e.OutIdx >= 0) {
        this.AddOutPt(e, e.Top)
      }
      this.DeleteFromAEL(e)
      return
    }
    let eNext = e.NextInAEL
    while (eNext !== null && eNext !== eMaxPair) {
      this.IntersectEdges(e, eNext, e.Top)
      this.SwapPositionsInAEL(e, eNext)
      eNext = e.NextInAEL
    }
    if (e.OutIdx === -1 && eMaxPair.OutIdx === -1) {
      this.DeleteFromAEL(e)
      this.DeleteFromAEL(eMaxPair)
    } else if (e.OutIdx >= 0 && eMaxPair.OutIdx >= 0) {
      if (e.OutIdx >= 0) this.AddLocalMaxPoly(e, eMaxPair, e.Top)
      this.DeleteFromAEL(e)
      this.DeleteFromAEL(eMaxPair)
    } else if (use_lines && e.WindDelta === 0) {
      if (e.OutIdx >= 0) {
        this.AddOutPt(e, e.Top)
        e.OutIdx = ClipperBase.Unassigned
      }
      this.DeleteFromAEL(e)
      if (eMaxPair.OutIdx >= 0) {
        this.AddOutPt(eMaxPair, e.Top)
        eMaxPair.OutIdx = ClipperBase.Unassigned
      }
      this.DeleteFromAEL(eMaxPair)
    } else {
      throw new Error('DoMaxima error')
    }
  }

  // Commented out since it is not used
  // public static ReversePaths(polys: Paths) {
  //   for (let i = 0, len = polys.length; i < len; i++) {
  //     polys[i].reverse()
  //   }
  // }

  public static Orientation(poly: Path) {
    return Clipper.Area(poly) >= 0
  }

  protected PointCount(pts: OutPt) {
    if (pts === null) {
      return 0
    }
    let result = 0
    let p = pts
    do {
      result++
      p = p.Next
    } while (p !== pts)
    return result
  }

  protected BuildResult(polyg: Paths) {
    Clear(polyg)
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      const outRec = this.m_PolyOuts[i]
      if (outRec.Pts === null) {
        continue
      }
      let p = outRec.Pts.Prev
      const cnt = this.PointCount(p)
      if (cnt < 2) {
        continue
      }
      const pg = new Array(cnt)
      for (let j = 0; j < cnt; j++) {
        pg[j] = p.Pt
        p = p.Prev
      }
      polyg.push(pg)
    }
  }

  protected BuildResult2(polytree: PolyTree) {
    polytree.Clear()
    // add each output polygon/contour to polytree ...
    // polytree.m_AllPolys.set_Capacity(this.m_PolyOuts.length);
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      const outRec = this.m_PolyOuts[i]
      const cnt = this.PointCount(outRec.Pts!)
      if ((outRec.IsOpen && cnt < 2) || (!outRec.IsOpen && cnt < 3)) {
        continue
      }
      this.FixHoleLinkage(outRec)
      const pn = new PolyNode()
      polytree.m_AllPolys.push(pn)
      outRec.PolyNode = pn
      pn.m_polygon.length = cnt
      let op = outRec.Pts!.Prev
      for (let j = 0; j < cnt; j++) {
        pn.m_polygon[j] = op.Pt
        op = op.Prev
      }
    }
    // fixup PolyNode links etc ...
    // polytree.m_Childs.set_Capacity(this.m_PolyOuts.length);
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      const outRec = this.m_PolyOuts[i]
      if (outRec.PolyNode === null) {
        continue
      } else if (outRec.IsOpen) {
        outRec.PolyNode.IsOpen = true
        polytree.AddChild(outRec.PolyNode)
      } else if (outRec.FirstLeft !== null && outRec.FirstLeft.PolyNode !== null) {
        outRec.FirstLeft.PolyNode.AddChild(outRec.PolyNode)
      } else {
        polytree.AddChild(outRec.PolyNode)
      }
    }
  }

  protected FixupOutPolyline(outRec: OutRec) {
    let pp = outRec.Pts!
    let lastPP = pp.Prev
    while (pp !== lastPP) {
      pp = pp.Next
      if (IntPoint.op_Equality(pp.Pt, pp.Prev.Pt)) {
        if (pp === lastPP) {
          lastPP = pp.Prev
        }
        const tmpPP = pp.Prev
        tmpPP.Next = pp.Next
        pp.Next.Prev = tmpPP
        pp = tmpPP
      }
    }
    if (pp === pp.Prev) {
      outRec.Pts = null
    }
  }

  protected FixupOutPolygon(outRec: OutRec) {
    // FixupOutPolygon() - removes duplicate points and simplifies consecutive
    // parallel edges by removing the middle vertex.
    let lastOK: OutPt | null = null
    outRec.BottomPt = null
    let pp = outRec.Pts!
    const preserveCol = this.PreserveCollinear // || this.StrictlySimple
    for (;;) {
      if (pp.Prev === pp || pp.Prev === pp.Next) {
        outRec.Pts = null
        return
      }

      // test for duplicate points and collinear edges ...
      if (
        (IntPoint.op_Equality(pp.Pt, pp.Next.Pt)) || (IntPoint.op_Equality(pp.Pt, pp.Prev.Pt))
        || (ClipperBase.SlopesEqual4(pp.Prev.Pt, pp.Pt, pp.Next.Pt, this.m_UseFullRange) && (!preserveCol || !this.Pt2IsBetweenPt1AndPt3(pp.Prev.Pt, pp.Pt, pp.Next.Pt)))
      ) {
        lastOK = null
        pp.Prev.Next = pp.Next
        pp.Next.Prev = pp.Prev
        pp = pp.Prev
      } else if (pp === lastOK) {
        break
      } else {
        if (lastOK === null) {
          lastOK = pp
        }
        pp = pp.Next
      }
    }
    outRec.Pts = pp
  }

  protected DupOutPt(outPt: OutPt, InsertAfter: boolean) {
    const result = new OutPt()
    // result.Pt = outPt.Pt;
    result.Pt.x = outPt.Pt.x
    result.Pt.y = outPt.Pt.y
    if (use_xyz) result.Pt.z = outPt.Pt.z
    result.Idx = outPt.Idx
    if (InsertAfter) {
      result.Next = outPt.Next
      result.Prev = outPt
      outPt.Next.Prev = result
      outPt.Next = result
    } else {
      result.Prev = outPt.Prev
      result.Next = outPt
      outPt.Prev.Next = result
      outPt.Prev = result
    }
    return result
  }

  protected GetOverlap(a1: number, a2: number, b1: number, b2: number, $val: { Left: number; Right: number }) {
    if (a1 < a2) {
      if (b1 < b2) {
        $val.Left = Math.max(a1, b1)
        $val.Right = Math.min(a2, b2)
      } else {
        $val.Left = Math.max(a1, b2)
        $val.Right = Math.min(a2, b1)
      }
    } else {
      if (b1 < b2) {
        $val.Left = Math.max(a2, b1)
        $val.Right = Math.min(a1, b2)
      } else {
        $val.Left = Math.max(a2, b2)
        $val.Right = Math.min(a1, b1)
      }
    }
    return $val.Left < $val.Right
  }

  protected JoinHorz(op1: OutPt, op1b: OutPt, op2: OutPt, op2b: OutPt, Pt: IntPoint, DiscardLeft: boolean) {
    const Dir1 = op1.Pt.x > op1b.Pt.x ? Direction.dRightToLeft : Direction.dLeftToRight
    const Dir2 = op2.Pt.x > op2b.Pt.x ? Direction.dRightToLeft : Direction.dLeftToRight
    if (Dir1 === Dir2) {
      return false
    }
    // When DiscardLeft, we want Op1b to be on the Left of Op1, otherwise we
    // want Op1b to be on the Right. (And likewise with Op2 and Op2b.)
    // So, to facilitate this while inserting Op1b and Op2b ...
    // when DiscardLeft, make sure we're AT or RIGHT of Pt before adding Op1b,
    // otherwise make sure we're AT or LEFT of Pt. (Likewise with Op2b.)
    if (Dir1 === Direction.dLeftToRight) {
      while (
        op1.Next.Pt.x <= Pt.x
        && op1.Next.Pt.x >= op1.Pt.x && op1.Next.Pt.y === Pt.y
      ) {
        op1 = op1.Next
      }
      if (DiscardLeft && (op1.Pt.x !== Pt.x)) {
        op1 = op1.Next
      }
      op1b = this.DupOutPt(op1, !DiscardLeft)
      if (IntPoint.op_Inequality(op1b.Pt, Pt)) {
        op1 = op1b
        // op1.Pt = Pt;
        op1.Pt.x = Pt.x
        op1.Pt.y = Pt.y
        if (use_xyz) op1.Pt.z = Pt.z
        op1b = this.DupOutPt(op1, !DiscardLeft)
      }
    } else {
      while (
        op1.Next.Pt.x >= Pt.x
        && op1.Next.Pt.x <= op1.Pt.x && op1.Next.Pt.y === Pt.y
      ) {
        op1 = op1.Next
      }
      if (!DiscardLeft && (op1.Pt.x !== Pt.x)) {
        op1 = op1.Next
      }
      op1b = this.DupOutPt(op1, DiscardLeft)
      if (IntPoint.op_Inequality(op1b.Pt, Pt)) {
        op1 = op1b
        // op1.Pt = Pt;
        op1.Pt.x = Pt.x
        op1.Pt.y = Pt.y
        if (use_xyz) op1.Pt.z = Pt.z
        op1b = this.DupOutPt(op1, DiscardLeft)
      }
    }
    if (Dir2 === Direction.dLeftToRight) {
      while (
        op2.Next.Pt.x <= Pt.x
        && op2.Next.Pt.x >= op2.Pt.x && op2.Next.Pt.y === Pt.y
      ) {
        op2 = op2.Next
      }
      if (DiscardLeft && (op2.Pt.x !== Pt.x)) {
        op2 = op2.Next
      }
      op2b = this.DupOutPt(op2, !DiscardLeft)
      if (IntPoint.op_Inequality(op2b.Pt, Pt)) {
        op2 = op2b
        // op2.Pt = Pt;
        op2.Pt.x = Pt.x
        op2.Pt.y = Pt.y
        if (use_xyz) op2.Pt.z = Pt.z
        op2b = this.DupOutPt(op2, !DiscardLeft)
      }
    } else {
      while (
        op2.Next.Pt.x >= Pt.x
        && op2.Next.Pt.x <= op2.Pt.x && op2.Next.Pt.y === Pt.y
      ) {
        op2 = op2.Next
      }
      if (!DiscardLeft && (op2.Pt.x !== Pt.x)) {
        op2 = op2.Next
      }
      op2b = this.DupOutPt(op2, DiscardLeft)
      if (IntPoint.op_Inequality(op2b.Pt, Pt)) {
        op2 = op2b
        // op2.Pt = Pt;
        op2.Pt.x = Pt.x
        op2.Pt.y = Pt.y
        if (use_xyz) op2.Pt.z = Pt.z
        op2b = this.DupOutPt(op2, DiscardLeft)
      }
    }
    if ((Dir1 === Direction.dLeftToRight) === DiscardLeft) {
      op1.Prev = op2
      op2.Next = op1
      op1b.Next = op2b
      op2b.Prev = op1b
    } else {
      op1.Next = op2
      op2.Prev = op1
      op1b.Prev = op2b
      op2b.Next = op1b
    }
    return true
  }

  protected JoinPoints(j: Join, outRec1: OutRec, outRec2: OutRec) {
    let op1 = j.OutPt1,
      op1b = new OutPt()
    let op2 = j.OutPt2,
      op2b = new OutPt()
    // There are 3 kinds of joins for output polygons ...
    // 1. Horizontal joins where Join.OutPt1 & Join.OutPt2 are vertices anywhere
    // along (horizontal) collinear edges (& Join.OffPt is on the same horizontal).
    // 2. Non-horizontal joins where Join.OutPt1 & Join.OutPt2 are at the same
    // location at the Bottom of the overlapping segment (& Join.OffPt is above).
    // 3. StrictlySimple joins where edges touch but are not collinear and where
    // Join.OutPt1, Join.OutPt2 & Join.OffPt all share the same point.
    const isHorizontal = j.OutPt1.Pt.y === j.OffPt.y
    if (isHorizontal && (IntPoint.op_Equality(j.OffPt, j.OutPt1.Pt)) && (IntPoint.op_Equality(j.OffPt, j.OutPt2.Pt))) {
      // Strictly Simple join ...
      if (outRec1 !== outRec2) return false

      op1b = j.OutPt1.Next
      while (op1b !== op1 && (IntPoint.op_Equality(op1b.Pt, j.OffPt))) {
        op1b = op1b.Next
      }
      const reverse1 = op1b.Pt.y > j.OffPt.y
      op2b = j.OutPt2.Next
      while (op2b !== op2 && (IntPoint.op_Equality(op2b.Pt, j.OffPt))) {
        op2b = op2b.Next
      }
      const reverse2 = op2b.Pt.y > j.OffPt.y
      if (reverse1 === reverse2) {
        return false
      }
      if (reverse1) {
        op1b = this.DupOutPt(op1, false)
        op2b = this.DupOutPt(op2, true)
        op1.Prev = op2
        op2.Next = op1
        op1b.Next = op2b
        op2b.Prev = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      } else {
        op1b = this.DupOutPt(op1, true)
        op2b = this.DupOutPt(op2, false)
        op1.Next = op2
        op2.Prev = op1
        op1b.Prev = op2b
        op2b.Next = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      }
    } else if (isHorizontal) {
      // treat horizontal joins differently to non-horizontal joins since with
      // them we're not yet sure where the overlapping is. OutPt1.Pt & OutPt2.Pt
      // may be anywhere along the horizontal edge.
      op1b = op1
      while (op1.Prev.Pt.y === op1.Pt.y && op1.Prev !== op1b && op1.Prev !== op2) {
        op1 = op1.Prev
      }
      while (op1b.Next.Pt.y === op1b.Pt.y && op1b.Next !== op1 && op1b.Next !== op2) {
        op1b = op1b.Next
      }
      if (op1b.Next === op1 || op1b.Next === op2) {
        return false
      }
      // a flat 'polygon'
      op2b = op2
      while (op2.Prev.Pt.y === op2.Pt.y && op2.Prev !== op2b && op2.Prev !== op1b) {
        op2 = op2.Prev
      }
      while (op2b.Next.Pt.y === op2b.Pt.y && op2b.Next !== op2 && op2b.Next !== op1) {
        op2b = op2b.Next
      }
      if (op2b.Next === op2 || op2b.Next === op1) {
        return false
      }
      // a flat 'polygon'
      // Op1 -. Op1b & Op2 -. Op2b are the extremites of the horizontal edges

      const $val = {
        Left: null as any,
        Right: null as any,
      }

      if (!this.GetOverlap(op1.Pt.x, op1b.Pt.x, op2.Pt.x, op2b.Pt.x, $val)) {
        return false
      }
      const Left = $val.Left
      const Right = $val.Right

      // DiscardLeftSide: when overlapping edges are joined, a spike will created
      // which needs to be cleaned up. However, we don't want Op1 or Op2 caught up
      // on the discard Side as either may still be needed for other joins ...
      const Pt = new IntPoint()
      let DiscardLeftSide
      if (op1.Pt.x >= Left && op1.Pt.x <= Right) {
        // Pt = op1.Pt;
        Pt.x = op1.Pt.x
        Pt.y = op1.Pt.y
        if (use_xyz) Pt.z = op1.Pt.z
        DiscardLeftSide = op1.Pt.x > op1b.Pt.x
      } else if (op2.Pt.x >= Left && op2.Pt.x <= Right) {
        // Pt = op2.Pt;
        Pt.x = op2.Pt.x
        Pt.y = op2.Pt.y
        if (use_xyz) Pt.z = op2.Pt.z
        DiscardLeftSide = op2.Pt.x > op2b.Pt.x
      } else if (op1b.Pt.x >= Left && op1b.Pt.x <= Right) {
        // Pt = op1b.Pt;
        Pt.x = op1b.Pt.x
        Pt.y = op1b.Pt.y
        if (use_xyz) Pt.z = op1b.Pt.z
        DiscardLeftSide = op1b.Pt.x > op1.Pt.x
      } else {
        // Pt = op2b.Pt;
        Pt.x = op2b.Pt.x
        Pt.y = op2b.Pt.y
        if (use_xyz) Pt.z = op2b.Pt.z
        DiscardLeftSide = op2b.Pt.x > op2.Pt.x
      }
      j.OutPt1 = op1
      j.OutPt2 = op2
      return this.JoinHorz(op1, op1b, op2, op2b, Pt, DiscardLeftSide)
    } else {
      // nb: For non-horizontal joins ...
      //    1. Jr.OutPt1.Pt.Y == Jr.OutPt2.Pt.Y
      //    2. Jr.OutPt1.Pt > Jr.OffPt.Y
      // make sure the polygons are correctly oriented ...
      op1b = op1.Next
      while ((IntPoint.op_Equality(op1b.Pt, op1.Pt)) && (op1b !== op1)) {
        op1b = op1b.Next
      }
      const Reverse1 = (op1b.Pt.y > op1.Pt.y) || !ClipperBase.SlopesEqual4(op1.Pt, op1b.Pt, j.OffPt, this.m_UseFullRange)
      if (Reverse1) {
        op1b = op1.Prev
        while ((IntPoint.op_Equality(op1b.Pt, op1.Pt)) && (op1b !== op1)) {
          op1b = op1b.Prev
        }

        if ((op1b.Pt.y > op1.Pt.y) || !ClipperBase.SlopesEqual4(op1.Pt, op1b.Pt, j.OffPt, this.m_UseFullRange)) {
          return false
        }
      }
      op2b = op2.Next
      while ((IntPoint.op_Equality(op2b.Pt, op2.Pt)) && (op2b !== op2)) {
        op2b = op2b.Next
      }

      const Reverse2 = (op2b.Pt.y > op2.Pt.y) || !ClipperBase.SlopesEqual4(op2.Pt, op2b.Pt, j.OffPt, this.m_UseFullRange)
      if (Reverse2) {
        op2b = op2.Prev
        while ((IntPoint.op_Equality(op2b.Pt, op2.Pt)) && (op2b !== op2)) {
          op2b = op2b.Prev
        }

        if ((op2b.Pt.y > op2.Pt.y) || !ClipperBase.SlopesEqual4(op2.Pt, op2b.Pt, j.OffPt, this.m_UseFullRange)) {
          return false
        }
      }
      if (
        (op1b === op1) || (op2b === op2) || (op1b === op2b)
        || ((outRec1 === outRec2) && (Reverse1 === Reverse2))
      ) {
        return false
      }
      if (Reverse1) {
        op1b = this.DupOutPt(op1, false)
        op2b = this.DupOutPt(op2, true)
        op1.Prev = op2
        op2.Next = op1
        op1b.Next = op2b
        op2b.Prev = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      } else {
        op1b = this.DupOutPt(op1, true)
        op2b = this.DupOutPt(op2, false)
        op1.Next = op2
        op2.Prev = op1
        op1b.Prev = op2b
        op2b.Next = op1b
        j.OutPt1 = op1
        j.OutPt2 = op1b
        return true
      }
    }
  }

  public static GetBounds(paths: Paths) {
    let i = 0,
      cnt = paths.length
    while (i < cnt && paths[i].length === 0) i++
    if (i === cnt) return new IntRect(0, 0, 0, 0)
    const result = new IntRect()
    result.left = paths[i][0].x
    result.right = result.left
    result.top = paths[i][0].y
    result.bottom = result.top
    for (; i < cnt; i++) {
      for (let j = 0, jlen = paths[i].length; j < jlen; j++) {
        if (paths[i][j].x < result.left) result.left = paths[i][j].x
        else if (paths[i][j].x > result.right) result.right = paths[i][j].x
        if (paths[i][j].y < result.top) result.top = paths[i][j].y
        else if (paths[i][j].y > result.bottom) result.bottom = paths[i][j].y
      }
    }
    return result
  }

  // Commented out since it is not used
  // protected GetBounds2(ops: OutPt) {
  //   const opStart = ops
  //   const result = new IntRect()
  //   result.left = ops.Pt.X
  //   result.right = ops.Pt.X
  //   result.top = ops.Pt.Y
  //   result.bottom = ops.Pt.Y
  //   ops = ops.Next
  //   while (ops !== opStart) {
  //     if (ops.Pt.X < result.left) {
  //       result.left = ops.Pt.X
  //     }
  //     if (ops.Pt.X > result.right) {
  //       result.right = ops.Pt.X
  //     }
  //     if (ops.Pt.Y < result.top) {
  //       result.top = ops.Pt.Y
  //     }
  //     if (ops.Pt.Y > result.bottom) {
  //       result.bottom = ops.Pt.Y
  //     }
  //     ops = ops.Next
  //   }
  //   return result
  // }

  // Commented out since it is not used
  // public static PointInPolygon(pt: { Y: number; X: number }, path: Path) {
  //   // returns 0 if false, +1 if true, -1 if pt ON polygon boundary
  //   // See "The Point in Polygon Problem for Arbitrary Polygons" by Hormann & Agathos
  //   // http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.5498&rep=rep1&type=pdf
  //   let result = 0,
  //     cnt = path.length
  //   if (cnt < 3) {
  //     return 0
  //   }
  //   let ip = path[0]
  //   for (let i = 1; i <= cnt; ++i) {
  //     const ipNext = i === cnt ? path[0] : path[i]
  //     if (ipNext.Y === pt.Y) {
  //       if ((ipNext.X === pt.X) || (ip.Y === pt.Y && ((ipNext.X > pt.X) === (ip.X < pt.X)))) {
  //         return -1
  //       }
  //     }
  //     if ((ip.Y < pt.Y) !== (ipNext.Y < pt.Y)) {
  //       if (ip.X >= pt.X) {
  //         if (ipNext.X > pt.X) {
  //           result = 1 - result
  //         } else {
  //           const d = (ip.X - pt.X) * (ipNext.Y - pt.Y) - (ipNext.X - pt.X) * (ip.Y - pt.Y)
  //           if (d === 0) {
  //             return -1
  //           } else if ((d > 0) === (ipNext.Y > ip.Y)) {
  //             result = 1 - result
  //           }
  //         }
  //       } else {
  //         if (ipNext.X > pt.X) {
  //           const d = (ip.X - pt.X) * (ipNext.Y - pt.Y) - (ipNext.X - pt.X) * (ip.Y - pt.Y)
  //           if (d === 0) {
  //             return -1
  //           } else if ((d > 0) === (ipNext.Y > ip.Y)) {
  //             result = 1 - result
  //           }
  //         }
  //       }
  //     }
  //     ip = ipNext
  //   }
  //   return result
  // }

  protected PointInPolygon(pt: IntPoint, op: OutPt) {
    // returns 0 if false, +1 if true, -1 if pt ON polygon boundary
    let result = 0
    const startOp = op
    const ptx = pt.x,
      pty = pt.y
    let poly0x = op.Pt.x,
      poly0y = op.Pt.y
    do {
      op = op.Next
      const poly1x = op.Pt.x,
        poly1y = op.Pt.y
      if (poly1y === pty) {
        if ((poly1x === ptx) || (poly0y === pty && ((poly1x > ptx) === (poly0x < ptx)))) {
          return -1
        }
      }
      if ((poly0y < pty) !== (poly1y < pty)) {
        if (poly0x >= ptx) {
          if (poly1x > ptx) {
            result = 1 - result
          } else {
            const d = (poly0x - ptx) * (poly1y - pty) - (poly1x - ptx) * (poly0y - pty)
            if (d === 0) {
              return -1
            }
            if ((d > 0) === (poly1y > poly0y)) {
              result = 1 - result
            }
          }
        } else {
          if (poly1x > ptx) {
            const d = (poly0x - ptx) * (poly1y - pty) - (poly1x - ptx) * (poly0y - pty)
            if (d === 0) {
              return -1
            }
            if ((d > 0) === (poly1y > poly0y)) {
              result = 1 - result
            }
          }
        }
      }
      poly0x = poly1x
      poly0y = poly1y
    } while (startOp !== op)

    return result
  }

  protected Poly2ContainsPoly1(outPt1: OutPt, outPt2: OutPt) {
    let op = outPt1
    do {
      // nb: PointInPolygon returns 0 if false, +1 if true, -1 if pt on polygon
      const res = this.PointInPolygon(op.Pt, outPt2)
      if (res >= 0) {
        return res > 0
      }
      op = op.Next
    } while (op !== outPt1)
    return true
  }

  protected FixupFirstLefts1(OldOutRec: OutRec, NewOutRec: OutRec) {
    let outRec, firstLeft
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      outRec = this.m_PolyOuts[i]
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (outRec.Pts !== null && firstLeft === OldOutRec) {
        if (this.Poly2ContainsPoly1(outRec.Pts, NewOutRec.Pts!)) {
          outRec.FirstLeft = NewOutRec
        }
      }
    }
  }

  protected FixupFirstLefts2(innerOutRec: OutRec, outerOutRec: OutRec) {
    // A polygon has split into two such that one is now the inner of the other.
    // It's possible that these polygons now wrap around other polygons, so check
    // every polygon that's also contained by OuterOutRec's FirstLeft container
    // (including nil) to see if they've become inner to the new inner polygon ...
    const orfl = outerOutRec.FirstLeft
    let outRec, firstLeft
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      outRec = this.m_PolyOuts[i]
      if (outRec.Pts === null || outRec === outerOutRec || outRec === innerOutRec) {
        continue
      }
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (firstLeft !== orfl && firstLeft !== innerOutRec && firstLeft !== outerOutRec) {
        continue
      }
      if (this.Poly2ContainsPoly1(outRec.Pts, innerOutRec.Pts!)) {
        outRec.FirstLeft = innerOutRec
      } else if (this.Poly2ContainsPoly1(outRec.Pts, outerOutRec.Pts!)) {
        outRec.FirstLeft = outerOutRec
      } else if (outRec.FirstLeft === innerOutRec || outRec.FirstLeft === outerOutRec) {
        outRec.FirstLeft = orfl
      }
    }
  }

  protected FixupFirstLefts3(OldOutRec: OutRec, NewOutRec: OutRec) {
    // same as FixupFirstLefts1 but doesn't call Poly2ContainsPoly1()
    let outRec
    let firstLeft
    for (let i = 0, ilen = this.m_PolyOuts.length; i < ilen; i++) {
      outRec = this.m_PolyOuts[i]
      firstLeft = Clipper.ParseFirstLeft(outRec.FirstLeft)
      if (outRec.Pts !== null && firstLeft === OldOutRec) {
        outRec.FirstLeft = NewOutRec
      }
    }
  }

  protected static ParseFirstLeft(FirstLeft: OutRec | null) {
    while (FirstLeft !== null && FirstLeft.Pts === null) {
      FirstLeft = FirstLeft.FirstLeft
    }
    return FirstLeft
  }

  protected JoinCommonEdges() {
    for (let i = 0, ilen = this.m_Joins.length; i < ilen; i++) {
      const join = this.m_Joins[i]
      const outRec1 = this.GetOutRec(join.OutPt1.Idx)
      let outRec2 = this.GetOutRec(join.OutPt2.Idx)
      if (outRec1.Pts === null || outRec2.Pts === null) {
        continue
      }

      if (outRec1.IsOpen || outRec2.IsOpen) {
        continue
      }

      // get the polygon fragment with the correct hole state (FirstLeft)
      // before calling JoinPoints() ...
      let holeStateRec
      if (outRec1 === outRec2) {
        holeStateRec = outRec1
      } else if (this.OutRec1RightOfOutRec2(outRec1, outRec2)) {
        holeStateRec = outRec2
      } else if (this.OutRec1RightOfOutRec2(outRec2, outRec1)) {
        holeStateRec = outRec1
      } else {
        holeStateRec = this.GetLowermostRec(outRec1, outRec2)
      }

      if (!this.JoinPoints(join, outRec1, outRec2)) continue

      if (outRec1 === outRec2) {
        // instead of joining two polygons, we've just created a new one by
        // splitting one polygon into two.
        outRec1.Pts = join.OutPt1
        outRec1.BottomPt = null
        outRec2 = this.CreateOutRec()
        outRec2.Pts = join.OutPt2
        // update all OutRec2.Pts Idx's ...
        this.UpdateOutPtIdxs(outRec2)

        if (this.Poly2ContainsPoly1(outRec2.Pts!, outRec1.Pts!)) {
          // outRec1 contains outRec2 ...
          outRec2.IsHole = !outRec1.IsHole
          outRec2.FirstLeft = outRec1
          if (this.m_UsingPolyTree) {
            this.FixupFirstLefts2(outRec2, outRec1)
          }
          if ((outRec2.IsHole != this.ReverseSolution) == (this.Area$1(outRec2) > 0)) {
            this.ReversePolyPtLinks(outRec2.Pts!)
          }
        } else if (this.Poly2ContainsPoly1(outRec1.Pts!, outRec2.Pts!)) {
          // outRec2 contains outRec1 ...
          outRec2.IsHole = outRec1.IsHole
          outRec1.IsHole = !outRec2.IsHole
          outRec2.FirstLeft = outRec1.FirstLeft
          outRec1.FirstLeft = outRec2
          if (this.m_UsingPolyTree) {
            this.FixupFirstLefts2(outRec1, outRec2)
          }

          if ((outRec1.IsHole != this.ReverseSolution) == (this.Area$1(outRec1) > 0)) {
            this.ReversePolyPtLinks(outRec1.Pts!)
          }
        } else {
          // the 2 polygons are completely separate ...
          outRec2.IsHole = outRec1.IsHole
          outRec2.FirstLeft = outRec1.FirstLeft
          // fixup FirstLeft pointers that may need reassigning to OutRec2
          if (this.m_UsingPolyTree) {
            this.FixupFirstLefts1(outRec1, outRec2)
          }
        }
      } else {
        // joined 2 polygons together ...
        outRec2.Pts = null
        outRec2.BottomPt = null
        outRec2.Idx = outRec1.Idx
        outRec1.IsHole = holeStateRec.IsHole
        if (holeStateRec === outRec2) {
          outRec1.FirstLeft = outRec2.FirstLeft
        }
        outRec2.FirstLeft = outRec1
        // fixup FirstLeft pointers that may need reassigning to OutRec1
        if (this.m_UsingPolyTree) {
          this.FixupFirstLefts3(outRec2, outRec1)
        }
      }
    }
  }

  protected UpdateOutPtIdxs(outrec: OutRec) {
    let op = outrec.Pts!
    do {
      op.Idx = outrec.Idx
      op = op.Prev
    } while (op !== outrec.Pts)
  }

  // protected DoSimplePolygons() {
  //   let i = 0
  //   while (i < this.m_PolyOuts.length) {
  //     const outrec = this.m_PolyOuts[i++]
  //     let op = outrec.Pts
  //     if (op === null || outrec.IsOpen) {
  //       continue
  //     }
  //     do // for each Pt in Polygon until duplicate found do ...
  //     {
  //       let op2: OutPt = op.Next
  //       while (op2 !== outrec.Pts) {
  //         if ((IntPoint.op_Equality(op.Pt, op2.Pt)) && op2.Next !== op && op2.Prev !== op) {
  //           // split the polygon into two ...
  //           const op3 = op.Prev
  //           const op4 = op2.Prev
  //           op.Prev = op4
  //           op4.Next = op
  //           op2.Prev = op3
  //           op3.Next = op2
  //           outrec.Pts = op
  //           const outrec2 = this.CreateOutRec()
  //           outrec2.Pts = op2
  //           this.UpdateOutPtIdxs(outrec2)
  //           if (this.Poly2ContainsPoly1(outrec2.Pts!, outrec.Pts)) {
  //             // OutRec2 is contained by OutRec1 ...
  //             outrec2.IsHole = !outrec.IsHole
  //             outrec2.FirstLeft = outrec
  //             if (this.m_UsingPolyTree) this.FixupFirstLefts2(outrec2, outrec)
  //           } else if (this.Poly2ContainsPoly1(outrec.Pts, outrec2.Pts!)) {
  //             // OutRec1 is contained by OutRec2 ...
  //             outrec2.IsHole = outrec.IsHole
  //             outrec.IsHole = !outrec2.IsHole
  //             outrec2.FirstLeft = outrec.FirstLeft
  //             outrec.FirstLeft = outrec2
  //             if (this.m_UsingPolyTree) this.FixupFirstLefts2(outrec, outrec2)
  //           } else {
  //             // the 2 polygons are separate ...
  //             outrec2.IsHole = outrec.IsHole
  //             outrec2.FirstLeft = outrec.FirstLeft
  //             if (this.m_UsingPolyTree) this.FixupFirstLefts1(outrec, outrec2)
  //           }
  //           op2 = op
  //           // ie get ready for the next iteration
  //         }
  //         op2 = op2.Next
  //       }
  //       op = op.Next
  //     } while (op !== outrec.Pts)
  //   }
  // }

  protected static Area(poly: Path) {
    if (!Array.isArray(poly)) {
      return 0
    }
    const cnt = poly.length
    if (cnt < 3) {
      return 0
    }
    let a = 0
    for (let i = 0, j = cnt - 1; i < cnt; ++i) {
      a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y)
      j = i
    }
    return -a * 0.5
  }

  protected Area(op: OutPt | null) {
    const opFirst = op
    if (op === null) return 0
    let a = 0
    do {
      a = a + (op.Prev.Pt.x + op.Pt.x) * (op.Prev.Pt.y - op.Pt.y)
      op = op.Next
    } while (op !== opFirst) // && typeof op !== 'undefined');
    return a * 0.5
  }

  protected Area$1(outRec: OutRec) {
    return this.Area(outRec.Pts)
  }

  // Commented out since these are no used
  // protected static SimplifyPolygon(poly: Path, fillType: PolyFillType) {
  //   const result = new Array()
  //   const c = new Clipper(0)
  //   c.StrictlySimple = true
  //   c.AddPath(poly, PolyType.ptSubject, true)
  //   c.Execute(ClipType.ctUnion, result, fillType, fillType)
  //   return result
  // }

  // protected static SimplifyPolygons(polys: Paths, fillType: PolyFillType) {
  //   if (typeof fillType === 'undefined') fillType = PolyFillType.pftEvenOdd
  //   const result = new Array()
  //   const c = new Clipper(0)
  //   c.StrictlySimple = true
  //   c.AddPaths(polys, PolyType.ptSubject, true)
  //   c.Execute(ClipType.ctUnion, result, fillType, fillType)
  //   return result
  // }

  // protected static DistanceSqrd(pt1: IntPoint, pt2: IntPoint) {
  //   const dx = pt1.X - pt2.X
  //   const dy = pt1.Y - pt2.Y
  //   return (dx * dx + dy * dy)
  // }

  // protected static DistanceFromLineSqrd(pt: IntPoint, ln1: IntPoint, ln2: IntPoint) {
  //   // The equation of a line in general form (Ax + By + C = 0)
  //   // given 2 points (x¹,y¹) & (x²,y²) is ...
  //   // (y¹ - y²)x + (x² - x¹)y + (y² - y¹)x¹ - (x² - x¹)y¹ = 0
  //   // A = (y¹ - y²); B = (x² - x¹); C = (y² - y¹)x¹ - (x² - x¹)y¹
  //   // perpendicular distance of point (x³,y³) = (Ax³ + By³ + C)/Sqrt(A² + B²)
  //   // see http://en.wikipedia.org/wiki/Perpendicular_distance
  //   const A = ln1.Y - ln2.Y
  //   const B = ln2.X - ln1.X
  //   let C = A * ln1.X + B * ln1.Y
  //   C = A * pt.X + B * pt.Y - C
  //   return (C * C) / (A * A + B * B)
  // }

  // protected static SlopesNearCollinear(pt1: IntPoint, pt2: IntPoint, pt3: IntPoint, distSqrd: number) {
  //   // this function is more accurate when the point that's GEOMETRICALLY
  //   // between the other 2 points is the one that's tested for distance.
  //   // nb: with 'spikes', either pt1 or pt3 is geometrically between the other pts
  //   if (Math.abs(pt1.X - pt2.X) > Math.abs(pt1.Y - pt2.Y)) {
  //     if ((pt1.X > pt2.X) === (pt1.X < pt3.X)) {
  //       return Clipper.DistanceFromLineSqrd(pt1, pt2, pt3) < distSqrd
  //     } else if ((pt2.X > pt1.X) === (pt2.X < pt3.X)) {
  //       return Clipper.DistanceFromLineSqrd(pt2, pt1, pt3) < distSqrd
  //     } else {
  //       return Clipper.DistanceFromLineSqrd(pt3, pt1, pt2) < distSqrd
  //     }
  //   } else {
  //     if ((pt1.Y > pt2.Y) === (pt1.Y < pt3.Y)) {
  //       return Clipper.DistanceFromLineSqrd(pt1, pt2, pt3) < distSqrd
  //     } else if ((pt2.Y > pt1.Y) === (pt2.Y < pt3.Y)) {
  //       return Clipper.DistanceFromLineSqrd(pt2, pt1, pt3) < distSqrd
  //     } else {
  //       return Clipper.DistanceFromLineSqrd(pt3, pt1, pt2) < distSqrd
  //     }
  //   }
  // }

  // protected static PointsAreClose(pt1: IntPoint, pt2: IntPoint, distSqrd: number) {
  //   const dx = pt1.X - pt2.X
  //   const dy = pt1.Y - pt2.Y
  //   return ((dx * dx) + (dy * dy) <= distSqrd)
  // }

  // protected static ExcludeOp(op: OutPt) {
  //   const result = op.Prev
  //   result.Next = op.Next
  //   op.Next.Prev = result
  //   result.Idx = 0
  //   return result
  // }

  // Commented out since these are not used
  // protected static CleanPolygon(path: Path, distance: number) {
  //   if (typeof distance === 'undefined') distance = 1.415
  //   // distance = proximity in units/pixels below which vertices will be stripped.
  //   // Default ~= sqrt(2) so when adjacent vertices or semi-adjacent vertices have
  //   // both x & y coords within 1 unit, then the second vertex will be stripped.
  //   let cnt = path.length
  //   if (cnt === 0) {
  //     return new Array()
  //   }
  //   let outPts = new Array(cnt)
  //   for (let i = 0; i < cnt; ++i) {
  //     outPts[i] = new OutPt()
  //   }
  //   for (let i = 0; i < cnt; ++i) {
  //     outPts[i].Pt = path[i]
  //     outPts[i].Next = outPts[(i + 1) % cnt]
  //     outPts[i].Next.Prev = outPts[i]
  //     outPts[i].Idx = 0
  //   }
  //   const distSqrd = distance * distance
  //   let op = outPts[0]
  //   while (op.Idx === 0 && op.Next !== op.Prev) {
  //     if (Clipper.PointsAreClose(op.Pt, op.Prev.Pt, distSqrd)) {
  //       op = Clipper.ExcludeOp(op)
  //       cnt--
  //     } else if (Clipper.PointsAreClose(op.Prev.Pt, op.Next.Pt, distSqrd)) {
  //       Clipper.ExcludeOp(op.Next)
  //       op = Clipper.ExcludeOp(op)
  //       cnt -= 2
  //     } else if (Clipper.SlopesNearCollinear(op.Prev.Pt, op.Pt, op.Next.Pt, distSqrd)) {
  //       op = Clipper.ExcludeOp(op)
  //       cnt--
  //     } else {
  //       op.Idx = 1
  //       op = op.Next
  //     }
  //   }
  //   if (cnt < 3) {
  //     cnt = 0
  //   }
  //   const result = new Array(cnt)
  //   for (let i = 0; i < cnt; ++i) {
  //     result[i] = new IntPoint(op.Pt)
  //     op = op.Next
  //   }
  //   outPts = null as any
  //   return result
  // }

  // public static CleanPolygons(polys: Paths, distance: number) {
  //   const result = new Array(polys.length)
  //   for (let i = 0, ilen = polys.length; i < ilen; i++) {
  //     result[i] = Clipper.CleanPolygon(polys[i], distance)
  //   }
  //   return result
  // }

  // Commented out since this is not used
  // protected static Minkowski(pattern: Path, path: Path, IsSum: boolean, IsClosed: boolean) {
  //   const delta = IsClosed ? 1 : 0
  //   const polyCnt = pattern.length
  //   const pathCnt = path.length
  //   const result = new Array()
  //   if (IsSum) {
  //     for (let i = 0; i < pathCnt; i++) {
  //       const p = new Array(polyCnt)
  //       for (let j = 0, jlen = pattern.length, ip = pattern[j]; j < jlen; j++, ip = pattern[j]) {
  //         p[j] = new IntPoint(path[i].X + ip.X, path[i].Y + ip.Y)
  //       }
  //       result.push(p)
  //     }
  //   } else {
  //     for (let i = 0; i < pathCnt; i++) {
  //       const p = new Array(polyCnt)
  //       for (let j = 0, jlen = pattern.length, ip = pattern[j]; j < jlen; j++, ip = pattern[j]) {
  //         p[j] = new IntPoint(path[i].X - ip.X, path[i].Y - ip.Y)
  //       }
  //       result.push(p)
  //     }
  //   }
  //   const quads = new Array()
  //   for (let i = 0; i < pathCnt - 1 + delta; i++) {
  //     for (let j = 0; j < polyCnt; j++) {
  //       const quad = new Array()
  //       quad.push(result[i % pathCnt][j % polyCnt])
  //       quad.push(result[(i + 1) % pathCnt][j % polyCnt])
  //       quad.push(result[(i + 1) % pathCnt][(j + 1) % polyCnt])
  //       quad.push(result[i % pathCnt][(j + 1) % polyCnt])
  //       if (!Clipper.Orientation(quad)) {
  //         quad.reverse()
  //       }
  //       quads.push(quad)
  //     }
  //   }
  //   return quads
  // }

  // Commented out since this is not used
  // protected static MinkowskiSum(pattern: Path, path_or_paths: Path | Paths, pathIsClosed: boolean) {
  //   if (!(path_or_paths[0] instanceof Array)) {
  //     const path = path_or_paths as Path
  //     const paths = Clipper.Minkowski(pattern, path, true, pathIsClosed)
  //     const c = new Clipper()
  //     c.AddPaths(paths, PolyType.ptSubject, true)
  //     c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
  //     return paths
  //   } else {
  //     const paths = path_or_paths as Paths
  //     const solution = new Paths()
  //     const c = new Clipper()
  //     for (let i = 0; i < paths.length; ++i) {
  //       const tmp = Clipper.Minkowski(pattern, paths[i], true, pathIsClosed)
  //       c.AddPaths(tmp, PolyType.ptSubject, true)
  //       if (pathIsClosed) {
  //         const path = Clipper.TranslatePath(paths[i], pattern[0])
  //         c.AddPath(path, PolyType.ptClip, true)
  //       }
  //     }
  //     c.Execute(ClipType.ctUnion, solution, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
  //     return solution
  //   }
  // }

  // protected static TranslatePath(path: Path, delta: Point) {
  //   const outPath = new Path()
  //   for (let i = 0; i < path.length; i++) {
  //     outPath.push(new IntPoint(path[i].X + delta.X, path[i].Y + delta.Y))
  //   }
  //   return outPath
  // }

  // protected static MinkowskiDiff(poly1: Path, poly2: Path) {
  //   const paths = Clipper.Minkowski(poly1, poly2, false, true)
  //   const c = new Clipper()
  //   c.AddPaths(paths, PolyType.ptSubject, true)
  //   c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
  //   return paths
  // }

  // protected static PolyTreeToPaths(polytree: PolyTree) {
  //   const result = new Array()
  //   // result.set_Capacity(polytree.get_Total());
  //   Clipper.AddPolyNodeToPaths(polytree, Clipper.NodeType.ntAny, result)
  //   return result
  // }

  protected static AddPolyNodeToPaths(polynode: PolyNode, nt: number, paths: Paths) {
    let match = true
    switch (nt) {
      case Clipper.NodeType.ntOpen:
        return
      case Clipper.NodeType.ntClosed:
        match = !polynode.IsOpen
        break
      default:
        break
    }
    if (polynode.m_polygon.length > 0 && match) {
      paths.push(polynode.m_polygon)
    }
    for (let $i3 = 0, $t3 = polynode.Childs(), $l3 = $t3.length, pn = $t3[$i3]; $i3 < $l3; $i3++, pn = $t3[$i3]) {
      Clipper.AddPolyNodeToPaths(pn, nt, paths)
    }
  }

  // protected static OpenPathsFromPolyTree(polytree: { ChildCount: () => any; Childs: () => PolyNode[] }) {
  //   const result = new Paths()
  //   // result.set_Capacity(polytree.ChildCount());
  //   for (let i = 0, ilen = polytree.ChildCount(); i < ilen; i++) {
  //     if (polytree.Childs()[i].IsOpen) {
  //       result.push(polytree.Childs()[i].m_polygon)
  //     }
  //   }
  //   return result
  // }

  // protected static ClosedPathsFromPolyTree(polytree: PolyTree) {
  //   const result = new Paths()
  //   // result.set_Capacity(polytree.Total());
  //   Clipper.AddPolyNodeToPaths(polytree, Clipper.NodeType.ntClosed, result)
  //   return result
  // }

  static NodeType = {
    ntAny: 0,
    ntOpen: 1,
    ntClosed: 2,
  }
}

export class ClipperOffset {
  private m_destPolys: Paths
  private m_srcPoly: Path
  private m_destPoly: Path
  private m_normals: DoublePoint[]
  private m_delta: number
  private m_sinA: number
  private m_sin: number
  private m_cos: number
  private m_miterLim: number
  private m_StepsPerRad: number
  private m_lowest: IntPoint
  private m_polyNodes: PolyNode
  private MiterLimit: number
  private ArcTolerance: number

  constructor(miterLimit = 2, arcTolerance = ClipperOffset.def_arc_tolerance) {
    this.m_destPolys = new Paths()
    this.m_srcPoly = new Path()
    this.m_destPoly = new Path()
    this.m_normals = new Array()
    this.m_delta = 0
    this.m_sinA = 0
    this.m_sin = 0
    this.m_cos = 0
    this.m_miterLim = 0
    this.m_StepsPerRad = 0
    this.m_lowest = new IntPoint()
    this.m_polyNodes = new PolyNode()
    this.MiterLimit = miterLimit
    this.ArcTolerance = arcTolerance
    this.m_lowest.x = -1
  }

  static two_pi = 6.28318530717959
  static def_arc_tolerance = 0.25

  // Commented out since this is not used
  // protected Clear() {
  //   Clear(this.m_polyNodes.Childs())
  //   this.m_lowest.X = -1
  // }

  public AddPath(path: Path, joinType: JoinType, endType: EndType) {
    let highI = path.length - 1
    if (highI < 0) {
      return
    }
    const newNode = new PolyNode()
    newNode.m_jointype = joinType
    newNode.m_endtype = endType
    // strip duplicate points from path and also get index to the lowest point ...
    if (endType === EndType.etClosedLine || endType === EndType.etClosedPolygon) {
      while (highI > 0 && IntPoint.op_Equality(path[0], path[highI])) {
        highI--
      }
    }
    // newNode.m_polygon.set_Capacity(highI + 1);
    newNode.m_polygon.push(path[0])
    let j = 0,
      k = 0
    for (let i = 1; i <= highI; i++) {
      if (IntPoint.op_Inequality(newNode.m_polygon[j], path[i])) {
        j++
        newNode.m_polygon.push(path[i])
        if (path[i].y > newNode.m_polygon[k].y || (path[i].y === newNode.m_polygon[k].y && path[i].x < newNode.m_polygon[k].x)) {
          k = j
        }
      }
    }
    if (endType === EndType.etClosedPolygon && j < 2) return

    this.m_polyNodes.AddChild(newNode)
    // if this path's lowest pt is lower than all the others then update m_lowest
    if (endType !== EndType.etClosedPolygon) {
      return
    }
    if (this.m_lowest.x < 0) {
      this.m_lowest = new IntPoint(this.m_polyNodes.ChildCount() - 1, k)
    } else {
      const ip = this.m_polyNodes.Childs()[this.m_lowest.x].m_polygon[this.m_lowest.y]
      if (newNode.m_polygon[k].y > ip.y || (newNode.m_polygon[k].y === ip.y && newNode.m_polygon[k].x < ip.x)) {
        this.m_lowest = new IntPoint(this.m_polyNodes.ChildCount() - 1, k)
      }
    }
  }

  public AddPaths(paths: Paths, joinType: JoinType, endType: EndType) {
    for (let i = 0, ilen = paths.length; i < ilen; i++) {
      this.AddPath(paths[i], joinType, endType)
    }
  }

  protected FixOrientations() {
    // fixup orientations of all closed paths if the orientation of the
    // closed path with the lowermost vertex is wrong ...
    if (this.m_lowest.x >= 0 && !Clipper.Orientation(this.m_polyNodes.Childs()[this.m_lowest.x].m_polygon)) {
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (node.m_endtype === EndType.etClosedPolygon || (node.m_endtype === EndType.etClosedLine && Clipper.Orientation(node.m_polygon))) {
          node.m_polygon.reverse()
        }
      }
    } else {
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (node.m_endtype === EndType.etClosedLine && !Clipper.Orientation(node.m_polygon)) {
          node.m_polygon.reverse()
        }
      }
    }
  }

  protected static GetUnitNormal(pt1: DoublePoint, pt2: DoublePoint) {
    let dx = pt2.x - pt1.x
    let dy = pt2.y - pt1.y
    if ((dx === 0) && (dy === 0)) {
      return new DoublePoint(0, 0)
    }
    const f = 1 / Math.sqrt(dx * dx + dy * dy)
    dx *= f
    dy *= f
    return new DoublePoint(dy, -dx)
  }

  protected DoOffset(delta: number) {
    this.m_destPolys = new Array()
    this.m_delta = delta
    // if Zero offset, just copy any CLOSED polygons to m_p and return ...
    if (ClipperBase.near_zero(delta)) {
      // this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount);
      for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
        const node = this.m_polyNodes.Childs()[i]
        if (node.m_endtype === EndType.etClosedPolygon) {
          this.m_destPolys.push(node.m_polygon)
        }
      }
      return
    }
    // see offset_triginometry3.svg in the documentation folder ...
    if (this.MiterLimit > 2) {
      this.m_miterLim = 2 / (this.MiterLimit * this.MiterLimit)
    } else {
      this.m_miterLim = 0.5
    }
    let y
    if (this.ArcTolerance <= 0) {
      y = ClipperOffset.def_arc_tolerance
    } else if (this.ArcTolerance > Math.abs(delta) * ClipperOffset.def_arc_tolerance) {
      y = Math.abs(delta) * ClipperOffset.def_arc_tolerance
    } else {
      y = this.ArcTolerance
    }
    // see offset_triginometry2.svg in the documentation folder ...
    const steps = 3.14159265358979 / Math.acos(1 - y / Math.abs(delta))
    this.m_sin = Math.sin(ClipperOffset.two_pi / steps)
    this.m_cos = Math.cos(ClipperOffset.two_pi / steps)
    this.m_StepsPerRad = steps / ClipperOffset.two_pi
    if (delta < 0) {
      this.m_sin = -this.m_sin
    }
    // this.m_destPolys.set_Capacity(this.m_polyNodes.ChildCount * 2);
    for (let i = 0; i < this.m_polyNodes.ChildCount(); i++) {
      const node = this.m_polyNodes.Childs()[i]
      this.m_srcPoly = node.m_polygon
      const len = this.m_srcPoly.length
      if (len === 0 || (delta <= 0 && (len < 3 || node.m_endtype !== EndType.etClosedPolygon))) {
        continue
      }
      this.m_destPoly = new Array()
      if (len === 1) {
        if (node.m_jointype === JoinType.jtRound) {
          let X = 1,
            Y = 0
          for (let j = 1; j <= steps; j++) {
            this.m_destPoly.push(new IntPoint(Clipper.Round(this.m_srcPoly[0].x + X * delta), Clipper.Round(this.m_srcPoly[0].y + Y * delta)))
            const X2 = X
            X = X * this.m_cos - this.m_sin * Y
            Y = X2 * this.m_sin + Y * this.m_cos
          }
        } else {
          let X = -1,
            Y = -1
          for (let j = 0; j < 4; ++j) {
            this.m_destPoly.push(new IntPoint(Clipper.Round(this.m_srcPoly[0].x + X * delta), Clipper.Round(this.m_srcPoly[0].y + Y * delta)))
            if (X < 0) {
              X = 1
            } else if (Y < 0) {
              Y = 1
            } else {
              X = -1
            }
          }
        }
        this.m_destPolys.push(this.m_destPoly)
        continue
      }
      // build m_normals ...
      this.m_normals.length = 0
      // this.m_normals.set_Capacity(len);
      for (let j = 0; j < len - 1; j++) {
        this.m_normals.push(ClipperOffset.GetUnitNormal(this.m_srcPoly[j], this.m_srcPoly[j + 1]))
      }
      if (node.m_endtype === EndType.etClosedLine || node.m_endtype === EndType.etClosedPolygon) {
        this.m_normals.push(ClipperOffset.GetUnitNormal(this.m_srcPoly[len - 1], this.m_srcPoly[0]))
      } else {
        this.m_normals.push(new DoublePoint(this.m_normals[len - 2]))
      }
      if (node.m_endtype === EndType.etClosedPolygon) {
        let k = len - 1
        for (let j = 0; j < len; j++) {
          k = this.OffsetPoint(j, k, node.m_jointype)
        }
        this.m_destPolys.push(this.m_destPoly)
      } else if (node.m_endtype === EndType.etClosedLine) {
        let k = len - 1
        for (let j = 0; j < len; j++) {
          k = this.OffsetPoint(j, k, node.m_jointype)
        }
        this.m_destPolys.push(this.m_destPoly)
        this.m_destPoly = new Array()
        // re-build m_normals ...
        const n = this.m_normals[len - 1]
        for (let j = len - 1; j > 0; j--) {
          this.m_normals[j] = new DoublePoint(-this.m_normals[j - 1].x, -this.m_normals[j - 1].y)
        }
        this.m_normals[0] = new DoublePoint(-n.x, -n.y)
        k = 0
        for (let j = len - 1; j >= 0; j--) {
          k = this.OffsetPoint(j, k, node.m_jointype)
        }
        this.m_destPolys.push(this.m_destPoly)
      } else {
        let k = 0
        for (let j = 1; j < len - 1; ++j) {
          k = this.OffsetPoint(j, k, node.m_jointype)
        }
        let pt1
        if (node.m_endtype === EndType.etOpenButt) {
          const j = len - 1
          pt1 = new IntPoint(Clipper.Round(this.m_srcPoly[j].x + this.m_normals[j].x * delta), Clipper.Round(this.m_srcPoly[j].y + this.m_normals[j].y * delta))
          this.m_destPoly.push(pt1)
          pt1 = new IntPoint(Clipper.Round(this.m_srcPoly[j].x - this.m_normals[j].x * delta), Clipper.Round(this.m_srcPoly[j].y - this.m_normals[j].y * delta))
          this.m_destPoly.push(pt1)
        } else {
          const j = len - 1
          k = len - 2
          this.m_sinA = 0
          this.m_normals[j] = new DoublePoint(-this.m_normals[j].x, -this.m_normals[j].y)
          if (node.m_endtype === EndType.etOpenSquare) {
            this.DoSquare(j, k)
          } else {
            this.DoRound(j, k)
          }
        }
        // re-build m_normals ...
        for (let j = len - 1; j > 0; j--) {
          this.m_normals[j] = new DoublePoint(-this.m_normals[j - 1].x, -this.m_normals[j - 1].y)
        }
        this.m_normals[0] = new DoublePoint(-this.m_normals[1].x, -this.m_normals[1].y)
        k = len - 1
        for (let j = k - 1; j > 0; --j) {
          k = this.OffsetPoint(j, k, node.m_jointype)
        }
        if (node.m_endtype === EndType.etOpenButt) {
          pt1 = new IntPoint(Clipper.Round(this.m_srcPoly[0].x - this.m_normals[0].x * delta), Clipper.Round(this.m_srcPoly[0].y - this.m_normals[0].y * delta))
          this.m_destPoly.push(pt1)
          pt1 = new IntPoint(Clipper.Round(this.m_srcPoly[0].x + this.m_normals[0].x * delta), Clipper.Round(this.m_srcPoly[0].y + this.m_normals[0].y * delta))
          this.m_destPoly.push(pt1)
        } else {
          k = 1
          this.m_sinA = 0
          if (node.m_endtype === EndType.etOpenSquare) {
            this.DoSquare(0, 1)
          } else {
            this.DoRound(0, 1)
          }
        }
        this.m_destPolys.push(this.m_destPoly)
      }
    }
  }

  public Execute(...a: any[]) {
    const ispolytree = a[0] instanceof PolyTree
    if (!ispolytree) { // function (solution, delta)
      const solution = a[0],
        delta = a[1]
      Clear(solution)
      this.FixOrientations()
      this.DoOffset(delta)
      // now clean up 'corners' ...
      const clpr = new Clipper(0)
      clpr.AddPaths(this.m_destPolys, PolyType.ptSubject, true)
      if (delta > 0) {
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftPositive, PolyFillType.pftPositive)
      } else {
        const r = Clipper.GetBounds(this.m_destPolys)
        const outer = new Path()
        outer.push(new IntPoint(r.left - 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.top - 10))
        outer.push(new IntPoint(r.left - 10, r.top - 10))
        clpr.AddPath(outer, PolyType.ptSubject, true)
        clpr.ReverseSolution = true
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative)
        if (solution.length > 0) {
          solution.splice(0, 1)
        }
      }
      // console.log(JSON.stringify(solution));
    } // function (polytree, delta)
    else {
      const solution = a[0],
        delta = a[1]
      solution.Clear()
      this.FixOrientations()
      this.DoOffset(delta)
      // now clean up 'corners' ...
      const clpr = new Clipper(0)
      clpr.AddPaths(this.m_destPolys, PolyType.ptSubject, true)
      if (delta > 0) {
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftPositive, PolyFillType.pftPositive)
      } else {
        const r = Clipper.GetBounds(this.m_destPolys)
        const outer = new Path()
        outer.push(new IntPoint(r.left - 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.bottom + 10))
        outer.push(new IntPoint(r.right + 10, r.top - 10))
        outer.push(new IntPoint(r.left - 10, r.top - 10))
        clpr.AddPath(outer, PolyType.ptSubject, true)
        clpr.ReverseSolution = true
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative)
        // remove the outer PolyNode rectangle ...
        if (solution.ChildCount() === 1 && solution.Childs()[0].ChildCount() > 0) {
          const outerNode = solution.Childs()[0]
          // solution.Childs.set_Capacity(outerNode.ChildCount);
          solution.Childs()[0] = outerNode.Childs()[0]
          solution.Childs()[0].m_Parent = solution
          for (let i = 1; i < outerNode.ChildCount(); i++) {
            solution.AddChild(outerNode.Childs()[i])
          }
        } else {
          solution.Clear()
        }
      }
    }
  }

  protected OffsetPoint(j: number, k: number, jointype: JoinType) {
    // cross product ...
    this.m_sinA = this.m_normals[k].x * this.m_normals[j].y - this.m_normals[j].x * this.m_normals[k].y

    if (Math.abs(this.m_sinA * this.m_delta) < 1.0) {
      // dot product ...
      const cosA = this.m_normals[k].x * this.m_normals[j].x + this.m_normals[j].y * this.m_normals[k].y
      if (cosA > 0) { // angle ==> 0 degrees
        this.m_destPoly.push(new IntPoint(Clipper.Round(this.m_srcPoly[j].x + this.m_normals[k].x * this.m_delta), Clipper.Round(this.m_srcPoly[j].y + this.m_normals[k].y * this.m_delta)))
        return k
      }
      // else angle ==> 180 degrees
    } else if (this.m_sinA > 1) {
      this.m_sinA = 1.0
    } else if (this.m_sinA < -1) {
      this.m_sinA = -1.0
    }
    if (this.m_sinA * this.m_delta < 0) {
      this.m_destPoly.push(new IntPoint(Clipper.Round(this.m_srcPoly[j].x + this.m_normals[k].x * this.m_delta), Clipper.Round(this.m_srcPoly[j].y + this.m_normals[k].y * this.m_delta)))
      this.m_destPoly.push(new IntPoint(this.m_srcPoly[j]))
      this.m_destPoly.push(new IntPoint(Clipper.Round(this.m_srcPoly[j].x + this.m_normals[j].x * this.m_delta), Clipper.Round(this.m_srcPoly[j].y + this.m_normals[j].y * this.m_delta)))
    } else {
      switch (jointype) {
        case JoinType.jtMiter: {
          const r = 1 + (this.m_normals[j].x * this.m_normals[k].x + this.m_normals[j].y * this.m_normals[k].y)
          if (r >= this.m_miterLim) {
            this.DoMiter(j, k, r)
          } else {
            this.DoSquare(j, k)
          }
          break
        }
        case JoinType.jtSquare:
          this.DoSquare(j, k)
          break
        case JoinType.jtRound:
          this.DoRound(j, k)
          break
      }
    }
    k = j
    return k
  }

  protected DoSquare(j: number, k: number) {
    const dx = Math.tan(Math.atan2(this.m_sinA, this.m_normals[k].x * this.m_normals[j].x + this.m_normals[k].y * this.m_normals[j].y) / 4)
    this.m_destPoly.push(
      new IntPoint(
        Clipper.Round(this.m_srcPoly[j].x + this.m_delta * (this.m_normals[k].x - this.m_normals[k].y * dx)),
        Clipper.Round(this.m_srcPoly[j].y + this.m_delta * (this.m_normals[k].y + this.m_normals[k].x * dx)),
      ),
    )
    this.m_destPoly.push(
      new IntPoint(
        Clipper.Round(this.m_srcPoly[j].x + this.m_delta * (this.m_normals[j].x + this.m_normals[j].y * dx)),
        Clipper.Round(this.m_srcPoly[j].y + this.m_delta * (this.m_normals[j].y - this.m_normals[j].x * dx)),
      ),
    )
  }

  protected DoMiter(j: number, k: number, r: number) {
    const q = this.m_delta / r
    this.m_destPoly.push(
      new IntPoint(
        Clipper.Round(this.m_srcPoly[j].x + (this.m_normals[k].x + this.m_normals[j].x) * q),
        Clipper.Round(this.m_srcPoly[j].y + (this.m_normals[k].y + this.m_normals[j].y) * q),
      ),
    )
  }

  protected DoRound(j: number, k: number) {
    const a = Math.atan2(this.m_sinA, this.m_normals[k].x * this.m_normals[j].x + this.m_normals[k].y * this.m_normals[j].y)

    const steps = Math.max(Cast_Int32(Clipper.Round(this.m_StepsPerRad * Math.abs(a))), 1)

    let X = this.m_normals[k].x,
      Y = this.m_normals[k].y,
      X2
    for (let i = 0; i < steps; ++i) {
      this.m_destPoly.push(
        new IntPoint(
          Clipper.Round(this.m_srcPoly[j].x + X * this.m_delta),
          Clipper.Round(this.m_srcPoly[j].y + Y * this.m_delta),
        ),
      )
      X2 = X
      X = X * this.m_cos - this.m_sin * Y
      Y = X2 * this.m_sin + Y * this.m_cos
    }
    this.m_destPoly.push(
      new IntPoint(
        Clipper.Round(this.m_srcPoly[j].x + this.m_normals[j].x * this.m_delta),
        Clipper.Round(this.m_srcPoly[j].y + this.m_normals[j].y * this.m_delta),
      ),
    )
  }
}
