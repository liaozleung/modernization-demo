import { useEffect, useState, type ReactNode } from 'react';
import {
  ProTable, ProForm, ProFormText, ProFormDigit, ProFormTextArea,
  ProFormSelect, ProFormDatePicker, ModalForm,
} from '@ant-design/pro-components';
import { Button, Popconfirm, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { api, fetchLookup, fetchSchema } from '../api';
import type { FieldDef, MasterSchema, Row } from '../types';

/**
 * Generic 1对1 master form. Equivalent of the VFP `tsbase` "1对1表单库" base class —
 * subclassing means: pass a different schema (and optionally hooks). All
 * toolbar / save / delete / list behavior comes from this component.
 */
export interface MasterFormProps {
  schemaName: string;
  apiBase: string;                      // e.g. "/api/part"
  /** Hooks — the "method overrides" of the modern equivalent */
  beforeSave?: (row: Row, mode: 'create' | 'update') => Row | Promise<Row>;
  extraToolbar?: ReactNode;
  rowExtraActions?: (row: Row) => ReactNode;
}

export default function MasterForm(props: MasterFormProps) {
  const [schema, setSchema] = useState<MasterSchema | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { fetchSchema<MasterSchema>(props.schemaName).then(setSchema); }, [props.schemaName]);

  if (!schema) return <div>加载 schema 中…</div>;

  const columns: ProColumns<Row>[] = [
    ...schema.fields.map((f): ProColumns<Row> => ({
      title: f.label, dataIndex: f.name, width: f.width, ellipsis: true,
      valueType: f.type === 'datetime' ? 'dateTime' : f.type === 'number' ? 'digit' : undefined,
      hideInSearch: !['string','enum'].includes(f.type),
    })),
    {
      title: '操作', valueType: 'option', width: 160, fixed: 'right',
      render: (_, row) => [
        <FormModal key="edit" mode="update" schema={schema} initial={row} apiBase={props.apiBase}
                   beforeSave={props.beforeSave} onDone={() => setReloadKey(k => k+1)} />,
        <Popconfirm key="del" title="确认删除?" onConfirm={async () => {
          await api.delete(`${props.apiBase}/${row[schema.primaryKey]}`);
          message.success('已删除');
          setReloadKey(k => k+1);
        }}>
          <a style={{ color: '#cf1322' }}>删除</a>
        </Popconfirm>,
        props.rowExtraActions?.(row),
      ],
    },
  ];

  return (
    <ProTable<Row>
      key={reloadKey}
      columns={columns}
      rowKey={schema.primaryKey}
      headerTitle={schema.title}
      search={{ labelWidth: 'auto' }}
      pagination={{ pageSize: 20 }}
      request={async (params) => {
        const q = (params.pt_no || params.pt_desc || (params as any).keyword || '') as string;
        const rows = await api.get<Row[]>(`${props.apiBase}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        return { data: rows, success: true };
      }}
      toolBarRender={() => [
        props.extraToolbar,
        <FormModal key="new" mode="create" schema={schema} apiBase={props.apiBase}
                   beforeSave={props.beforeSave} onDone={() => setReloadKey(k => k+1)} />,
      ]}
      scroll={{ x: 'max-content' }}
    />
  );
}

function FormModal({
  schema, mode, initial, apiBase, beforeSave, onDone,
}: {
  schema: MasterSchema; mode: 'create' | 'update';
  initial?: Row; apiBase: string;
  beforeSave?: MasterFormProps['beforeSave'];
  onDone: () => void;
}) {
  const trigger = mode === 'create'
    ? <Button type="primary" icon={<PlusOutlined />}>新增</Button>
    : <a>修改</a>;

  return (
    <ModalForm
      title={mode === 'create' ? `新增 ${schema.title}` : `修改 ${schema.title}`}
      trigger={trigger}
      initialValues={initial}
      modalProps={{ destroyOnClose: true, width: 720 }}
      onFinish={async (values) => {
        const payload = beforeSave ? await beforeSave(values, mode) : values;
        if (mode === 'create') await api.post(apiBase, payload);
        else await api.put(`${apiBase}/${initial![schema.primaryKey]}`, payload);
        message.success('保存成功');
        onDone();
        return true;
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {schema.fields.map(f => (
          <FieldInput key={f.name} field={f} disabled={f.readOnly || (mode === 'update' && f.primary)} />
        ))}
      </Space>
    </ModalForm>
  );
}

export function FieldInput({ field, disabled }: { field: FieldDef; disabled?: boolean }) {
  const common = { name: field.name, label: field.label, disabled, rules: field.required ? [{ required: true }] : undefined };
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
