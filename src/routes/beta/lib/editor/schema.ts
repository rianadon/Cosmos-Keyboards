import { Cuttleform } from '$target/proto/cuttleform'
import { Lightcycle } from '$target/proto/lightcycle'
import { Manuform } from '$target/proto/manuform'
import { ScalarType } from '@protobuf-ts/runtime'

type FieldType = 'float' | 'int' | 'string' | 'angle' | 'decimal' | 'float' | 'object' | 'bool'

export interface FieldSchema {
  var: string
  name: string
  type: FieldType
  help?: string
  min?: number
  max?: number
  special?: boolean
  basic?: boolean
  options?: {
    name: string
    value: string
  }[]
  nOptions?: {
    name: string
    n: number
    group?: string
  }[]
  icon?: string
  pro?: boolean
  tuple?: string
  fields: FieldSchema[]
  plusminus?: boolean
  mm?: boolean
  wr?: boolean
}

export type Schema = FieldSchema[]

interface FieldInfo {
  T: (() => { fields: FieldInfo[] }) | number
  name: string
  jsonName: string
  options: Record<string, any>
}

function fieldToSchema(ns: string, field: FieldInfo): FieldSchema {
  if (!field.options) return { var: field.jsonName, name: '', type: 'string', fields: [] }

  let ft = (typeof field.T === 'function') ? 'object' : {
    [ScalarType.FLOAT]: 'float',
    [ScalarType.INT32]: 'int',
    [ScalarType.SINT32]: 'int',
    [ScalarType.BOOL]: 'bool',
  }[field.T] as FieldType
  if (field.options[ns + '.angle']) ft = 'angle'
  if (field.options[ns + '.decimal']) ft = 'decimal'

  const schema: FieldSchema = {
    var: field.jsonName,
    name: field.options[ns + '.name'],
    type: ft,
    help: field.options[ns + '.help'],
    min: field.options[ns + '.min'],
    max: field.options[ns + '.max'],
    options: field.options[ns + '.dropdown'],
    special: field.options[ns + '.special'],
    basic: field.options[ns + '.basic'],
    plusminus: field.options[ns + '.plusminus'],
    mm: field.options[ns + '.mm'],
    wr: field.options[ns + '.wr'],
    nOptions: field.options[ns + '.ndropdown'],
    icon: field.options[ns + '.icon'],
    pro: field.options[ns + '.pro'],
    tuple: field.options[ns + '.tuple'],
    fields: [],
  }
  if (typeof field.T === 'function' && field.T().fields) {
    schema.fields = fieldsToSchema(ns, field.T().fields)
  }
  return schema
}

function fieldsToSchema(ns: string, fields: readonly any[]) {
  return fields.map(f => fieldToSchema(ns, f))
}

export const ManuformSchema = fieldsToSchema('dactyl', Manuform.fields)

export const LightcycleSchema = fieldsToSchema('dactyl', Lightcycle.fields)

export const CuttleformSchema = fieldsToSchema('dactyl', Cuttleform.fields)
