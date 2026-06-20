import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ProForm, ProTable, EditableProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Card, Popconfirm, Space, Tabs, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { api, fetchLookup } from '../api';
import type { FieldDef, MasterDetailSchema, Row } from '../types';
import {
  TsBaseShell, useTsbase,
  type TsBaseFormProps, type TsbaseHandle,
} from './tsbase';
import { FieldInput } from './FieldInput';

export interface TsMultiFormProps extends TsBaseFormProps {
  onBeforeSave?: (header: Row, lines: Row[], t: TsbaseHandle) =>
    { header: Row; lines: Row[] } | Promise<{ header: Row; lines: Row[] }>;
  onAfterSave?:  (header: Row, lines: Row[], t: TsbaseHandle) => void | Promise<void>;
}

export default function TsMultiForm(props: TsMultiFormProps) {
  const { schema, error, handle } = useTsbase<MasterDetailSchema>(props.schemaName);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'list' | 'card'>('list');
  const [openId, setOpenId] = useState<string | null>(null);

  // 清单页：当前选中的父记录
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<Row[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const reload = () => setReloadKey(k => k + 1);

  const selectMaster = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await api.get<{ header: Row; lines: Row[] }>(`${props.apiBase}/${id}`);
      setDetailLines(res?.lines ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const openCard = (id: string) => {
    setOpenId(id);
    if (id !== '__new__') setSelectedId(id);
    setActiveTab('card');
  };

  const handleTabChange = (k: string) => {
    if (k === 'card' && selectedId) {
      setOpenId(selectedId);
    }
    setActiveTab(k as 'list' | 'card');
  };

  return (
    <TsBaseShell schema={schema} error={error} canView={handle.canView}>
      {schema && (
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'list',
              label: '清单',
              children: (
                <MasterDetailList
                  schema={schema}
                  handle={handle}
                  apiBase={props.apiBase}
                  reloadKey={reloadKey}
                  reload={reload}
                  selectedId={selectedId}
                  detailLines={detailLines}
                  detailLoading={detailLoading}
                  onSelectMaster={selectMaster}
                  onOpenCard={openCard}
                  extraToolbar={props.extraToolbar}
                  rowExtraActions={props.rowExtraActions}
                  onBeforeDelete={props.onBeforeDelete}
                  onAfterDelete={props.onAfterDelete}
                />
              ),
            },
            {
              key: 'card',
              label: '卡片',
              children: openId ? (
                <DetailEditor
                  key={openId}
                  schema={schema}
                  handle={handle}
                  apiBase={props.apiBase}
                  recordId={openId === '__new__' ? null : openId}
                  hooks={props}
                  onDone={() => {
                    // 保存后刷新清单，并更新下方子列表（若选中的就是本条）
                    reload();
                    if (openId !== '__new__') selectMaster(openId);
                    setOpenId(null);
                    setActiveTab('list');
                  }}
                  onBack={() => setActiveTab('list')}
                />
              ) : (
                <div style={{ padding: 48, color: '#999', textAlign: 'center' }}>
                  请从清单中选择记录或点击「新增」
                </div>
              ),
            },
          ]}
        />
      )}
    </TsBaseShell>
  );
}

// ─── 清单页：父列表 + 子列表 ───────────────────────────────────────────────────

function MasterDetailList({
  schema, handle, apiBase, reloadKey, reload,
  selectedId, detailLines, detailLoading,
  onSelectMaster, onOpenCard,
  extraToolbar, rowExtraActions, onBeforeDelete, onAfterDelete,
}: {
  schema: MasterDetailSchema;
  handle: TsbaseHandle;
  apiBase: string;
  reloadKey: number;
  reload: () => void;
  selectedId: string | null;
  detailLines: Row[];
  detailLoading: boolean;
  onSelectMaster: (id: string) => void;
  onOpenCard: (id: string) => void;
  extraToolbar?: TsBaseFormProps['extraToolbar'];
  rowExtraActions?: TsBaseFormProps['rowExtraActions'];
  onBeforeDelete?: TsBaseFormProps['onBeforeDelete'];
  onAfterDelete?: TsBaseFormProps['onAfterDelete'];
}) {
  const pk = schema.master.primaryKey;
  const masterFields = schema.master.fields.filter(
    f => !(f.computed && f.name === pk),
  );

  const masterCols: ProColumns<Row>[] = [
    ...masterFields.map((f): ProColumns<Row> => ({
      title: f.label, dataIndex: f.name, width: f.width, ellipsis: true,
      valueType: f.type === 'datetime' ? 'dateTime' : f.type === 'number' ? 'digit' : undefined,
      hideInSearch: !['string', 'enum', 'lookup'].includes(f.type),
    })),
    {
      title: '操作', valueType: 'option', width: 160, fixed: 'right',
      render: (_, row) => [
        <a key="edit" onClick={() => onOpenCard(String(row[pk]))}>明细 / 修改</a>,
        handle.canEdit && (
          <Popconfirm key="del" title="确认删除?" onConfirm={async () => {
            if (onBeforeDelete && !(await onBeforeDelete(row, handle))) return;
            await api.delete(`${apiBase}/${row[pk]}`);
            handle.audit('delete', String(row[pk]));
            await onAfterDelete?.(row, handle);
            message.success('已删除');
            reload();
          }}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        ),
        rowExtraActions?.(row, handle),
      ],
    },
  ];

  const detailCols: ProColumns<Row>[] = schema.detail.fields.map(f => ({
    title: f.label, dataIndex: f.name, width: f.width, ellipsis: true,
    valueType: f.type === 'datetime' ? 'dateTime' : f.type === 'number' ? 'digit' : undefined,
  }));

  const masterTable = (
    <ProTable<Row>
      key={reloadKey}
      columns={masterCols}
      rowKey={pk}
      headerTitle={handle.title}
      search={{ labelWidth: 'auto' }}
      pagination={{ pageSize: 15 }}
      rowClassName={(row) =>
        String(row[pk]) === selectedId ? 'ant-table-row-selected' : ''
      }
      onRow={(row) => ({
        onClick: () => onSelectMaster(String(row[pk])),
        style: { cursor: 'pointer' },
      })}
      request={async (params) => {
        const q = (params[pk] || (params as any).keyword || '') as string;
        const rows = await api.get<Row[]>(`${apiBase}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        return { data: rows, success: true };
      }}
      toolBarRender={() => [
        extraToolbar,
        handle.canEdit && (
          <Button key="new" type="primary" icon={<PlusOutlined />}
                  onClick={() => onOpenCard('__new__')}>
            新增
          </Button>
        ),
      ]}
      scroll={{ x: 'max-content' }}
    />
  );

  const detailTable = (
    <ProTable<Row>
      dataSource={detailLines}
      loading={detailLoading}
      columns={detailCols}
      rowKey={(r, i) => String(r[schema.detail.primaryKey[1] ?? schema.detail.primaryKey[0]] ?? i)}
      headerTitle={selectedId ? `明细 — ${selectedId}` : '明细（点击上方记录查看）'}
      search={false}
      pagination={false}
      toolBarRender={false}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: selectedId ? '无明细记录' : '请先点击上方父记录' }}
    />
  );

  return <ResizableSplit top={masterTable} bottom={detailTable} />;
}

// ─── 卡片页：主表卡片 + 明细列表 ───────────────────────────────────────────────

function DetailEditor({
  schema, handle, apiBase, recordId, hooks, onDone, onBack,
}: {
  schema: MasterDetailSchema;
  handle: TsbaseHandle;
  apiBase: string;
  recordId: string | null;
  hooks: TsMultiFormProps;
  onDone: () => void;
  onBack: () => void;
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

  if (!headerInit) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>加载中…</div>
  );

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
      submitter={{
        render: (_, doms) => (
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回清单</Button>
            {doms}
          </Space>
        ),
      }}
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
        await hooks.onAfterSave?.(
          refreshed?.header ?? merged.header,
          refreshed?.lines ?? merged.lines,
          handle,
        );
        message.success('保存成功');
        onDone();
        return true;
      }}
    >
      {/* 主表卡片 */}
      <Card
        size="small"
        title={recordId ? `${handle.title} — ${recordId}` : `新增 ${handle.title}`}
        style={{ marginBottom: 16 }}
      >
        <Space wrap>
          {schema.master.fields.map(f => (
            <FieldInput key={f.name} field={f}
                        disabled={f.readOnly || (!!recordId && f.primary)} />
          ))}
        </Space>
      </Card>

      {/* 明细列表 */}
      <Card size="small" title="明细">
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
                <a key="edit"
                   onClick={() => action?.startEditable(row[srnoCol] as React.Key)}>编辑</a>,
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

// ─── 可拖拽上下分栏 ────────────────────────────────────────────────────────────

function ResizableSplit({
  top, bottom, defaultTopHeight = 420,
}: {
  top: ReactNode;
  bottom: ReactNode;
  defaultTopHeight?: number;
}) {
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientY - startY.current;
      setTopHeight(Math.max(160, startH.current + delta));
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ height: topHeight, overflow: 'auto', flexShrink: 0 }}>
        {top}
      </div>
      {/* 拖拽把手 */}
      <div
        style={{
          height: 8,
          background: '#f5f5f5',
          borderTop: '1px solid #e0e0e0',
          borderBottom: '1px solid #e0e0e0',
          cursor: 'row-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseDown={(e) => {
          dragging.current = true;
          startY.current = e.clientY;
          startH.current = topHeight;
          e.preventDefault();
        }}
      >
        <div style={{
          width: 48, height: 3, borderRadius: 2,
          background: '#bbb',
        }} />
      </div>
      <div style={{ overflow: 'auto' }}>
        {bottom}
      </div>
    </div>
  );
}
