import { useEffect, useMemo, useState } from 'react';
import {
  ProTable, ProForm, ProFormText, ProFormDigit, ProFormSelect, ProFormDatePicker,
  EditableProTable, ProFormTextArea,
} from '@ant-design/pro-components';
import type { ProColumns, EditableFormInstance } from '@ant-design/pro-components';
import { Button, Card, Drawer, Popconfirm, Space, message } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { api, fetchLookup, fetchSchema } from '../api';
import type { FieldDef, MasterDetailSchema, Row } from '../types';

/**
 * Generic 1对多 master/detail form. Equivalent of the VFP "1对多表单库" base class.
 * Subclassing means: pass a different schema. The save button posts the entire
 * aggregate (header + lines) as one transactional payload.
 */
export interface MasterDetailFormProps {
  schemaName: string;
  apiBase: string;                                     // e.g. "/api/bom"
  beforeSave?: (header: Row, lines: Row[]) => { header: Row; lines: Row[] } | Promise<{ header: Row; lines: Row[] }>;
}

export default function MasterDetailForm(props: MasterDetailFormProps) {
  const [schema, setSchema] = useState<MasterDetailSchema | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => { fetchSchema<MasterDetailSchema>(props.schemaName).then(setSchema); }, [props.schemaName]);

  if (!schema) return <div>加载 schema 中…</div>;

  const headerCols: ProColumns<Row>[] = [
    ...schema.master.fields
      .filter(f => !f.computed || f.name !== schema.master.primaryKey)
      .map((f): ProColumns<Row> => ({
        title: f.label, dataIndex: f.name, width: f.width, ellipsis: true,
        valueType: f.type === 'datetime' ? 'dateTime' : f.type === 'number' ? 'digit' : undefined,
        hideInSearch: !['string','enum','lookup'].includes(f.type),
      })),
    {
      title: '操作', valueType: 'option', width: 160, fixed: 'right',
      render: (_, row) => [
        <a key="edit" onClick={() => setOpenId(String(row[schema.master.primaryKey]))}>明细 / 修改</a>,
        <Popconfirm key="del" title="确认删除?" onConfirm={async () => {
          await api.delete(`${props.apiBase}/${row[schema.master.primaryKey]}`);
          message.success('已删除');
          setReloadKey(k => k+1);
        }}>
          <a style={{ color: '#cf1322' }}>删除</a>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<Row>
        key={reloadKey}
        columns={headerCols}
        rowKey={schema.master.primaryKey}
        headerTitle={schema.title}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const q = (params[schema.master.primaryKey] || (params as any).keyword || '') as string;
          const rows = await api.get<Row[]>(`${props.apiBase}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          return { data: rows, success: true };
        }}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => setOpenId('__new__')}>新增</Button>,
        ]}
        scroll={{ x: 'max-content' }}
      />
      <Drawer
        title={openId === '__new__' ? `新建 ${schema.title}` : `编辑 ${schema.title} — ${openId ?? ''}`}
        width={1100}
        open={!!openId}
        onClose={() => setOpenId(null)}
        destroyOnClose
      >
        {openId && (
          <DetailEditor
            schema={schema}
            apiBase={props.apiBase}
            recordId={openId === '__new__' ? null : openId}
            beforeSave={props.beforeSave}
            onDone={() => { setOpenId(null); setReloadKey(k => k+1); }}
          />
        )}
      </Drawer>
    </>
  );
}

function DetailEditor({
  schema, apiBase, recordId, beforeSave, onDone,
}: {
  schema: MasterDetailSchema;
  apiBase: string;
  recordId: string | null;
  beforeSave?: MasterDetailFormProps['beforeSave'];
  onDone: () => void;
}) {
  const [headerInit, setHeaderInit] = useState<Row | null>(recordId ? null : {});
  const [lines, setLines] = useState<Row[]>([]);
  const [editKeys, setEditKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (!recordId) return;
    api.get<{ header: Row; lines: Row[] }>(`${apiBase}/${recordId}`).then(({ header, lines }) => {
      setHeaderInit(header);
      setLines(lines);
    });
  }, [apiBase, recordId]);

  if (!headerInit) return <div>加载中…</div>;

  const detailCols: ProColumns<Row>[] = schema.detail.fields.map(f => ({
    title: f.label,
    dataIndex: f.name,
    width: f.width,
    valueType: f.type === 'number' ? 'digit'
             : f.type === 'datetime' ? 'dateTime'
             : f.type === 'lookup' ? 'select' : undefined,
    fieldProps: f.type === 'lookup' ? {
      showSearch: true,
      filterOption: false,
    } : undefined,
    request: f.type === 'lookup' ? async () => {
      const rows = await fetchLookup(f.lookupTable!);
      return rows.map(r => ({ value: r.value, label: `${r.value} — ${r.label}` }));
    } : undefined,
    formItemProps: { rules: f.required ? [{ required: true, message: '必填' }] : undefined },
  }));

  return (
    <ProForm
      initialValues={headerInit}
      onFinish={async (header) => {
        const payload = beforeSave ? await beforeSave(header, lines) : { header, lines };
        const id = (recordId ?? payload.header[schema.master.primaryKey]) as string;
        if (!id) { message.error('请先填写主键'); return false; }
        await api.put(`${apiBase}/${id}`, payload);
        message.success('保存成功');
        onDone();
        return true;
      }}
    >
      <Card title="主表" size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          {schema.master.fields.map(f => (
            <HeaderField key={f.name} field={f} isCreate={!recordId} />
          ))}
        </Space>
      </Card>
      <Card title="明细" size="small">
        <EditableProTable<Row>
          rowKey="bl_srno"
          value={lines}
          onChange={(rows) => setLines(rows as Row[])}
          recordCreatorProps={{
            position: 'bottom',
            record: () => ({ bl_srno: (lines.length + 1), bl_qty: 1, bl_rate: 0 }) as Row,
          }}
          columns={[
            ...detailCols,
            {
              title: '操作', valueType: 'option', width: 100, fixed: 'right',
              render: (_, row, _i, action) => [
                <a key="edit" onClick={() => action?.startEditable(row.bl_srno as React.Key)}>编辑</a>,
                <a key="del" style={{ color: '#cf1322' }}
                   onClick={() => setLines(lines.filter(l => l.bl_srno !== row.bl_srno))}>删除</a>,
              ],
            },
          ]}
          editable={{
            type: 'multiple',
            editableKeys: editKeys,
            onChange: setEditKeys,
            actionRender: (_row, _cfg, dom) => [dom.save, dom.cancel],
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </ProForm>
  );
}

function HeaderField({ field, isCreate }: { field: FieldDef; isCreate: boolean }) {
  const disabled = field.readOnly || (!isCreate && field.primary);
  const common = { name: field.name, label: field.label, disabled,
                   rules: field.required ? [{ required: true }] : undefined,
                   width: 'md' as const };
  switch (field.type) {
    case 'text':     return <ProFormTextArea {...common} fieldProps={{ rows: 2 }} />;
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
