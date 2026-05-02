import { useEffect, useState } from 'react';
import {
  ProForm, EditableProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Card, Drawer, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api, fetchLookup } from '../api';
import type { MasterDetailSchema, Row } from '../types';
import {
  TsBaseList, TsBaseShell, useTsbase,
  type TsBaseFormProps, type TsbaseHandle,
} from './tsbase';
import { FieldInput } from './FieldInput';

/**
 * `TsMultiForm` — modern equivalent of VFP `multiform` (libs/tsbase.vcx).
 * Subclass of `tsbase` for **master/detail (1对多) screens** like
 * bom.scx / sa_h.scx / po_h.scx / job.scx / ...
 *
 * Inherits from tsbase via composition: useTsbase() + <TsBaseShell> +
 * <TsBaseList>. The only thing this file adds is the **drawer with master
 * form + editable detail table**, plus the transactional save.
 */
export interface TsMultiFormProps extends TsBaseFormProps {
  /** Equivalent of overriding `BeforeSave` in a VFP subclass. */
  onBeforeSave?: (header: Row, lines: Row[], t: TsbaseHandle) =>
    { header: Row; lines: Row[] } | Promise<{ header: Row; lines: Row[] }>;
  /** Equivalent of overriding `AfterSave`. */
  onAfterSave?:  (header: Row, lines: Row[], t: TsbaseHandle) => void | Promise<void>;
}

export default function TsMultiForm(props: TsMultiFormProps) {
  const { schema, error, handle } = useTsbase<MasterDetailSchema>(props.schemaName);
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const reload = () => setReloadKey(k => k + 1);

  return (
    <TsBaseShell schema={schema} error={error} canView={handle.canView}>
      {schema && (
        <>
          <TsBaseList
            handle={handle}
            primaryKey={schema.master.primaryKey}
            fields={schema.master.fields.filter(f => !(f.computed && f.name === schema.master.primaryKey))}
            requestUrl={props.apiBase}
            reloadKey={reloadKey}
            reload={reload}
            newButton={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenId('__new__')}>
                新增
              </Button>
            }
            editAction={(row) => (
              <a onClick={() => setOpenId(String(row[schema.master.primaryKey]))}>明细 / 修改</a>
            )}
            extraToolbar={props.extraToolbar}
            rowExtraActions={props.rowExtraActions}
            onBeforeDelete={props.onBeforeDelete}
            onAfterDelete={props.onAfterDelete}
          />
          <Drawer
            title={openId === '__new__' ? `新建 ${handle.title}` : `编辑 ${handle.title} — ${openId ?? ''}`}
            width={1100}
            open={!!openId}
            onClose={() => setOpenId(null)}
            destroyOnClose
          >
            {openId && (
              <DetailEditor
                schema={schema}
                handle={handle}
                apiBase={props.apiBase}
                recordId={openId === '__new__' ? null : openId}
                hooks={props}
                onDone={() => { setOpenId(null); reload(); }}
              />
            )}
          </Drawer>
        </>
      )}
    </TsBaseShell>
  );
}

function DetailEditor({
  schema, handle, apiBase, recordId, hooks, onDone,
}: {
  schema: MasterDetailSchema;
  handle: TsbaseHandle;
  apiBase: string;
  recordId: string | null;
  hooks: TsMultiFormProps;
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

  // Convention: detail.primaryKey is [parentRef, srNoCol]; srNoCol is the
  // line-number column we use as React key + auto-increment for new rows.
  const srnoCol = schema.detail.primaryKey[1] ?? schema.detail.primaryKey[0];

  const detailCols: ProColumns<Row>[] = schema.detail.fields.map(f => ({
    title: f.label,
    dataIndex: f.name,
    width: f.width,
    valueType: f.type === 'number' ? 'digit'
             : f.type === 'datetime' ? 'dateTime'
             : f.type === 'lookup' ? 'select' : undefined,
    fieldProps: f.type === 'lookup' ? { showSearch: true, filterOption: false } : undefined,
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
        const merged = hooks.onBeforeSave
          ? await hooks.onBeforeSave(header as Row, lines, handle)
          : { header: header as Row, lines };
        const id = (recordId ?? merged.header[schema.master.primaryKey]) as string;
        if (!id) { message.error('请先填写主键'); return false; }
        const refreshed = await api.put<{ header: Row; lines: Row[] }>(
          `${apiBase}/${id}`,
          { Header: merged.header, Lines: merged.lines },
        );
        handle.audit(recordId ? 'update' : 'create', id, merged);
        await hooks.onAfterSave?.(refreshed?.header ?? merged.header, refreshed?.lines ?? merged.lines, handle);
        message.success('保存成功');
        onDone();
        return true;
      }}
    >
      <Card title="主表" size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          {schema.master.fields.map(f => (
            <FieldInput key={f.name} field={f}
                        disabled={f.readOnly || (!!recordId && f.primary)} />
          ))}
        </Space>
      </Card>
      <Card title="明细" size="small">
        <EditableProTable<Row>
          rowKey={srnoCol}
          value={lines}
          onChange={(rows) => setLines(rows as Row[])}
          recordCreatorProps={{
            position: 'bottom',
            record: () => {
              const init: Row = { [srnoCol]: lines.length + 1 };
              for (const f of schema.detail.fields) if (f.type === 'number') init[f.name] = 0;
              return init;
            },
          }}
          columns={[
            ...detailCols,
            {
              title: '操作', valueType: 'option', width: 100, fixed: 'right',
              render: (_, row, _i, action) => [
                <a key="edit" onClick={() => action?.startEditable(row[srnoCol] as React.Key)}>编辑</a>,
                <a key="del" style={{ color: '#cf1322' }}
                   onClick={() => setLines(lines.filter(l => l[srnoCol] !== row[srnoCol]))}>删除</a>,
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
