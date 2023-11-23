import type { Handle_TDocStd_Document, OpenCascadeInstance, STEPControl_StepModelType, XCAFDoc_ShapeTool } from '$assets/replicad_single'
import { type AnyShape, Compound, getOC, type Plane, type PlaneName, type Point } from 'replicad'
import { combine } from '.'

export class Assembly {
  private oc: OpenCascadeInstance
  private parts: { name: string; shape: AnyShape }[] = []

  constructor() {
    this.oc = getOC()
  }

  add(name: string, shape: AnyShape): void {
    this.parts.push({ name, shape })
  }

  mirror(inputPlane: Plane | PlaneName | Point, origin: Point): Assembly {
    const assembly = new Assembly()
    for (const { name, shape } of this.parts) {
      assembly.add(name, shape.mirror(inputPlane, origin))
    }
    return assembly
  }

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

  compound(): Compound {
    return combine(this.parts.map(p => p.shape))
  }

  blobSTL(opts?: { tolerance?: number; angularTolerance?: number }): Blob {
    return this.compound().blobSTL(opts)
  }

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
}
