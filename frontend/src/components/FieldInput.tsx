import {
  ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormDatePicker,
} from '@ant-design/pro-components';
import { fetchLookup } from '../api';
import type { FieldDef } from '../types';

/**
 * Schema-driven field renderer. Same set of types is honored by both
 * `TsMainForm` and `TsMultiForm`, so they call this helper instead of
 * duplicating the switch statement.
 */
export function FieldInput({ field, disabled, width = 'md' }: {
  field: FieldDef;
  disabled?: boolean;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const common = {
    name: field.name,
    label: field.label,
    disabled,
    width,
    rules: field.required ? [{ required: true, message: '必填' }] : undefined,
  };
  switch (field.type) {
    case 'text':     return <ProFormTextArea {...common} fieldProps={{ rows: 3 }} />;
    case 'number':   return <ProFormDigit {...common} />;
    case 'enum':     return <ProFormSelect {...common} options={field.options?.map(v => ({ value: v, label: v }))} />;
    case 'datetime': return <ProFormDatePicker {...common} fieldProps={{ showTime: true }} />;
    case 'lookup':   return (
      <ProFormSelect
        {...common}
        showSearch
        debounceTime={250}
        request={async (kw) => {
          const rows = await fetchLookup(field.lookupTable!, kw.keyWords);
          return rows.map(r => ({ value: r.value, label: `${r.value} — ${r.label}` }));
        }}
      />
    );
    default:         return <ProFormText {...common} />;
  }
}
