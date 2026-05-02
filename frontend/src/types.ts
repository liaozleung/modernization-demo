export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'enum'
  | 'datetime'
  | 'lookup';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  width?: number;
  required?: boolean;
  readOnly?: boolean;
  primary?: boolean;
  computed?: boolean;
  options?: string[];
  lookupTable?: string;
  lookupKey?: string;
  lookupLabel?: string;
}

export interface MasterSchema {
  kind: 'master';
  table: string;
  title: string;
  primaryKey: string;
  permission?: string;
  fields: FieldDef[];
}

export interface MasterDetailSchema {
  kind: 'master-detail';
  title: string;
  permission?: string;
  master: {
    table: string;
    primaryKey: string;
    fields: FieldDef[];
  };
  detail: {
    table: string;
    primaryKey: string[];
    foreignKey: Record<string, string>;
    fields: FieldDef[];
  };
}

export type Row = Record<string, unknown>;
