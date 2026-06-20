import { useState } from 'react';
import { ProForm } from '@ant-design/pro-components';
import { Button, Card, Space, Tabs, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { MasterSchema, Row } from '../types';
import {
  TsBaseList, TsBaseShell, useTsbase,
  type TsBaseFormProps, type TsbaseHandle,
} from './tsbase';
import { FieldInput } from './FieldInput';

export interface TsMainFormProps extends TsBaseFormProps {
  onBeforeSave?: (row: Row, mode: 'create' | 'update', t: TsbaseHandle) => Row | Promise<Row>;
  onAfterSave?:  (row: Row, mode: 'create' | 'update', t: TsbaseHandle) => void | Promise<void>;
}

export default function TsMainForm(props: TsMainFormProps) {
  const { schema, error, handle } = useTsbase<MasterSchema>(props.schemaName);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'list' | 'card'>('list');
  const [cardMode, setCardMode] = useState<'create' | 'update'>('create');
  const [cardRow, setCardRow] = useState<Row | undefined>(undefined);
  const [selectedRow, setSelectedRow] = useState<Row | undefined>(undefined);

  const reload = () => setReloadKey(k => k + 1);

  const openCard = (mode: 'create' | 'update', row?: Row) => {
    setCardMode(mode);
    setCardRow(row);
    if (row) setSelectedRow(row);
    setActiveTab('card');
  };

  const handleTabChange = (k: string) => {
    if (k === 'card' && selectedRow) {
      setCardMode('update');
      setCardRow(selectedRow);
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
                <TsBaseList
                  handle={handle}
                  primaryKey={schema.primaryKey}
                  fields={schema.fields}
                  requestUrl={props.apiBase}
                  reloadKey={reloadKey}
                  reload={reload}
                  selectedKey={selectedRow ? String(selectedRow[schema.primaryKey]) : undefined}
                  onRowClick={(row) => setSelectedRow(row)}
                  newButton={
                    <Button type="primary" icon={<PlusOutlined />}
                            onClick={() => { setSelectedRow(undefined); openCard('create'); }}>
                      新增
                    </Button>
                  }
                  editAction={(row) => (
                    <a onClick={() => openCard('update', row)}>修改</a>
                  )}
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
              children: (
                <CardView
                  key={cardMode === 'create' ? '__new__' : String(cardRow?.[schema.primaryKey] ?? '')}
                  schema={schema}
                  mode={cardMode}
                  initial={cardRow}
                  apiBase={props.apiBase}
                  handle={handle}
                  hooks={props}
                  onDone={() => { reload(); setActiveTab('list'); }}
                  onBack={() => setActiveTab('list')}
                />
              ),
            },
          ]}
        />
      )}
    </TsBaseShell>
  );
}

function CardView({
  schema, mode, initial, apiBase, handle, hooks, onDone, onBack,
}: {
  schema: MasterSchema;
  mode: 'create' | 'update';
  initial?: Row;
  apiBase: string;
  handle: TsbaseHandle;
  hooks: TsMainFormProps;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <ProForm
      initialValues={initial}
      submitter={{
        render: (_, doms) => (
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回清单</Button>
            {doms}
          </Space>
        ),
      }}
      onFinish={async (values) => {
        const payload = hooks.onBeforeSave
          ? await hooks.onBeforeSave(values as Row, mode, handle)
          : (values as Row);
        const saved = mode === 'create'
          ? await api.post<Row>(apiBase, payload)
          : await api.put<Row>(`${apiBase}/${initial![schema.primaryKey]}`, payload);
        handle.audit(mode, String(payload[schema.primaryKey] ?? ''), payload);
        await hooks.onAfterSave?.(saved ?? payload, mode, handle);
        message.success('保存成功');
        onDone();
        return true;
      }}
    >
      <Card size="small" title={mode === 'create' ? `新增 ${handle.title}` : `${handle.title} — ${initial?.[schema.primaryKey] ?? ''}`}>
        <Space wrap>
          {schema.fields.map(f => (
            <FieldInput key={f.name} field={f}
                        disabled={f.readOnly || (mode === 'update' && f.primary)} />
          ))}
        </Space>
      </Card>
    </ProForm>
  );
}
