import type { Handle_TDocStd_Document, OpenCascadeInstance, STEPControl_StepModelType, XCAFDoc_ShapeTool } from '$assets/replicad_single'
import { type AnyShape, Compound, getOC, type Plane, type PlaneName, type Point } from 'replicad'
import { blobSTL, combine } from './index'
import type Trsf from './transformation'

/** Builds named assemblies for use in STEP models. */
export class Assembly {
  private oc: OpenCascadeInstance
  private parts: { name: string; shape: AnyShape }[] = []

  constructor() {
    this.oc = getOC()
  }

  /** Add a part with the given name. */
  add(name: string, shape: AnyShape): void {
    this.parts.push({ name, shape })
  }

  /** Mirror the whole assembly. */
  mirror(inputPlane: Plane | PlaneName | Point, origin: Point): Assembly {
    const assembly = new Assembly()
    for (const { name, shape } of this.parts) {
      assembly.add(name, shape.mirror(inputPlane, origin))
    }
    return assembly
  }

  /** Return a new assembly with everything transformed. */
  transform(trsf: Trsf): Assembly {
    const assembly = new Assembly()
    for (const { name, shape } of this.parts) {
      assembly.add(name, trsf.transform(shape))
    }
    return assembly
  }

  /**
   * Return an XDE document representing the assembly.
   * XDE is the structure OpenCascade uses for storing metadata in the assembly.
   */
  XDE(): Handle_TDocStd_Document {
    const document = new this.oc.TDocStd_Document(new this.oc.TCollection_ExtendedString_1())
    const shapeTool = this.oc.XCAFDoc_DocumentTool.ShapeTool(document.Main()).get()
    for (const { name, shape } of this.parts) {
      const label = shapeTool.NewShape()
      const nameData = new this.oc.TDataStd_Name()
      nameData.Set_3(new this.oc.TCollection_ExtendedString_2(name, true))
      label.AddAttribute(new this.oc.Handle_TDF_Attribute_2(nameData), true)
      shapeTool.SetShape(label, shape.wrapped)
    }
    return new this.oc.Handle_TDocStd_Document_2(document)
  }

  /** Turn the assembly into a compound shape. */
  compound(): Compound {
    return combine(this.parts.map(p => p.shape))
  }

  /** Return an STL file of this assembly as a blob. */
  blobSTL(opts?: { tolerance?: number; angularTolerance?: number }): Blob {
    return blobSTL(this.compound(), opts)
  }

  /** Return a STEP file of this assembly as a blob. */
  blobSTEP(): Blob {
    const filename = 'blob.step'
    const writer = new this.oc.STEPCAFControl_Writer_1()

    this.oc.Interface_Static.SetIVal('write.step.schema', 5)
    const progress = new this.oc.Message_ProgressRange_1()

    writer.Transfer_1(
      this.XDE(),
      this.oc.STEPControl_StepModelType
        .STEPControl_AsIs as STEPControl_StepModelType,
      null as any,
      progress,
    )

    // Convert to a .STEP File
    const done = writer.Write(filename)
    writer.delete()
    progress.delete()

    if (done === this.oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      // Read the STEP File from the filesystem and clean up
      const file = this.oc.FS.readFile('/' + filename)
      this.oc.FS.unlink('/' + filename)

      // Return the contents of the STEP File
      const blob = new Blob([file], { type: 'application/STEP' })
      return blob
    } else {
      throw new Error('WRITE STEP FILE FAILED.')
    }
  }

  delete() {
    this.parts.forEach(p => p.shape.delete())
  }
}
