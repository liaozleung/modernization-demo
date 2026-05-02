import { useState } from 'react';
import { ModalForm } from '@ant-design/pro-components';
import { Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { MasterSchema, Row } from '../types';
import {
  TsBaseList, TsBaseShell, useTsbase,
  type TsBaseFormProps, type TsbaseHandle,
} from './tsbase';
import { FieldInput } from './FieldInput';

/**
 * `TsMainForm` — modern equivalent of VFP `tsmainform` (libs/tsbase.vcx).
 * Subclass of `tsbase` for **single-record (1对1) CRUD screens** like
 * part.scx / customer.scx / colour.scx / category.scx / ...
 *
 * Inherits from tsbase via composition: useTsbase() + <TsBaseShell> +
 * <TsBaseList>. The only thing this file adds is the **per-row edit modal**.
 */
export interface TsMainFormProps extends TsBaseFormProps {
  /** Equivalent of overriding `BeforeSave` in a VFP subclass. */
  onBeforeSave?: (row: Row, mode: 'create' | 'update', t: TsbaseHandle) => Row | Promise<Row>;
  /** Equivalent of overriding `AfterSave`. */
  onAfterSave?:  (row: Row, mode: 'create' | 'update', t: TsbaseHandle) => void | Promise<void>;
}

export default function TsMainForm(props: TsMainFormProps) {
  const { schema, error, handle } = useTsbase<MasterSchema>(props.schemaName);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(k => k + 1);

  return (
    <TsBaseShell schema={schema} error={error} canView={handle.canView}>
      {schema && (
        <TsBaseList
          handle={handle}
          primaryKey={schema.primaryKey}
          fields={schema.fields}
          requestUrl={props.apiBase}
          reloadKey={reloadKey}
          reload={reload}
          newButton={
            <SaveModal mode="create" schema={schema} apiBase={props.apiBase}
                       handle={handle} hooks={props} onDone={reload} />
          }
          editAction={(row) => (
            <SaveModal mode="update" schema={schema} initial={row} apiBase={props.apiBase}
                       handle={handle} hooks={props} onDone={reload} />
          )}
          extraToolbar={props.extraToolbar}
          rowExtraActions={props.rowExtraActions}
          onBeforeDelete={props.onBeforeDelete}
          onAfterDelete={props.onAfterDelete}
        />
      )}
    </TsBaseShell>
  );
}

function SaveModal({
  schema, mode, initial, apiBase, handle, hooks, onDone,
}: {
  schema: MasterSchema;
  mode: 'create' | 'update';
  initial?: Row;
  apiBase: string;
  handle: TsbaseHandle;
  hooks: TsMainFormProps;
  onDone: () => void;
}) {
  const trigger = mode === 'create'
    ? <Button type="primary" icon={<PlusOutlined />}>新增</Button>
    : <a>修改</a>;

  return (
    <ModalForm
      title={mode === 'create' ? `新增 ${handle.title}` : `修改 ${handle.title}`}
      trigger={trigger}
      initialValues={initial}
      modalProps={{ destroyOnClose: true, width: 720 }}
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
      <Space direction="vertical" style={{ width: '100%' }}>
        {schema.fields.map(f => (
          <FieldInput key={f.name} field={f}
                      disabled={f.readOnly || (mode === 'update' && f.primary)} />
        ))}
      </Space>
    </ModalForm>
  );
}
