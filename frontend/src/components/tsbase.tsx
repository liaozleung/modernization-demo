import { useEffect, useState, type ReactNode } from 'react';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Popconfirm, Result, Spin, message } from 'antd';
import { api, fetchSchema } from '../api';
import type { FieldDef, Row } from '../types';

/**
 * Modern equivalent of the VFP `tsbase` form base class. Both `TsMainForm`
 * (1对1, like part.scx) and `TsMultiForm` (1对多, like bom.scx) inherit
 * everything in this file. Every CRUD form in the new app sits on top of
 * these three primitives — same role tsbase plays in libs/tsbase.vcx:
 *
 *   useTsbase()       — common state/services (schema, perm, audit)
 *   <TsBaseShell>     — common page chrome (loading / 403 / error)
 *   <TsBaseList>      — common list pane (toolbar, table, search, delete)
 *
 * Subclasses (`TsMainForm` / `TsMultiForm`) ONLY add what's specific to their
 * form shape: a single-record edit modal, or a master/detail drawer.
 */

// =============================================================================
// 1. State / services hook
// =============================================================================

export interface TsbaseHandle {
  /** Page title from the schema. Equivalent of `THISFORM.CAPTION`. */
  title: string;
  /** Has the current user been granted view permission? Stubbed true for demo. */
  canView: boolean;
  /** Edit/delete buttons hidden when false. */
  canEdit: boolean;
  /** Drop an audit row. Equivalent of `WriteLog(THISFORM.CAPTION, action)`. */
  audit: (action: 'create' | 'update' | 'delete', subject: string, payload?: unknown) => void;
}

interface SchemaWithMeta { permission?: string; title?: string }

export function useTsbase<S extends SchemaWithMeta>(schemaName: string) {
  const [schema, setSchema] = useState<S | null>(null);
  const [error, setError]   = useState<unknown>(null);

  useEffect(() => {
    setSchema(null); setError(null);
    fetchSchema<S>(schemaName).then(setSchema, setError);
  }, [schemaName]);

  const handle: TsbaseHandle = {
    title:   schema?.title ?? schemaName,
    canView: hasPermission(schema?.permission, 'view'),
    canEdit: hasPermission(schema?.permission, 'edit'),
    audit(action, subject, payload) {
      // TODO: POST /api/audit. For demo, log to DevTools so you can see the trail.
      console.info('[audit]', new Date().toISOString(), action, subject, payload);
    },
  };

  return { schema, error, handle };
}

function hasPermission(_permKey: string | undefined, _level: 'view' | 'edit'): boolean {
  // TODO: integrate with the legacy `user_level` table — same source CHKACC reads.
  return true;
}

// =============================================================================
// 2. Page chrome
// =============================================================================

export function TsBaseShell({
  schema, error, canView, children,
}: {
  schema: unknown | null;
  error: unknown;
  canView: boolean;
  children: ReactNode;
}) {
  if (error) return <Result status="error" title="加载失败" subTitle={String(error)} />;
  if (!schema) return <div style={{ textAlign: 'center', padding: 64 }}><Spin /></div>;
  if (!canView) return <Result status="403" title="无权访问" subTitle="未配置该屏的访问权限 (CHKACC)" />;
  return <>{children}</>;
}

// =============================================================================
// 3. Common props for any subclass form (tsmainform / multiform / future)
// =============================================================================

export interface TsBaseFormProps {
  /** schema name — fetched from /api/schema/{schemaName} */
  schemaName: string;
  /** REST base, e.g. "/api/part" or "/api/bom" */
  apiBase: string;

  // ---- Override hooks shared by every subclass form. -----------------------
  // Save hooks have different signatures per form shape (1对1 row vs 1对多
  // header+lines), so they live on the subclass-specific props.
  onBeforeDelete?: (row: Row, t: TsbaseHandle) => boolean | Promise<boolean>;
  onAfterDelete?:  (row: Row, t: TsbaseHandle) => void | Promise<void>;
  extraToolbar?: ReactNode;
  rowExtraActions?: (row: Row, t: TsbaseHandle) => ReactNode;
}

// =============================================================================
// 4. Common list pane — used by both TsMainForm and TsMultiForm
// =============================================================================

export interface TsBaseListProps {
  handle: TsbaseHandle;
  /** Primary-key column to use as React key + URL segment for delete. */
  primaryKey: string;
  /** Fields to render as columns; not all need to be searchable. */
  fields: FieldDef[];
  /** REST endpoint that returns the row list. */
  requestUrl: string;
  /** Bumped externally → ProTable refetches. */
  reloadKey: number;
  /** Triggers an external refresh (used by drawer-close in TsMultiForm). */
  reload: () => void;

  /** Toolbar slot for the "create" trigger (modal trigger or drawer-open button). */
  newButton: ReactNode;
  /** Per-row "edit" trigger (modal trigger or drawer-open link). */
  editAction: (row: Row) => ReactNode;

  /** Currently selected row's primary key value — highlighted in the table. */
  selectedKey?: string;
  /** Called when the user clicks a data row. */
  onRowClick?: (row: Row) => void;

  // Inherited from TsBaseFormProps:
  onBeforeDelete?: TsBaseFormProps['onBeforeDelete'];
  onAfterDelete?:  TsBaseFormProps['onAfterDelete'];
  extraToolbar?: ReactNode;
  rowExtraActions?: TsBaseFormProps['rowExtraActions'];
}

export function TsBaseList(props: TsBaseListProps) {
  const { handle, primaryKey, fields, requestUrl, reloadKey, reload } = props;

  const columns: ProColumns<Row>[] = [
    ...fields.map((f): ProColumns<Row> => ({
      title: f.label, dataIndex: f.name, width: f.width, ellipsis: true,
      valueType: f.type === 'datetime' ? 'dateTime' : f.type === 'number' ? 'digit' : undefined,
      hideInSearch: !['string','enum','lookup'].includes(f.type),
    })),
    {
      title: '操作', valueType: 'option', width: 220, fixed: 'right',
      render: (_, row) => [
        props.editAction(row),
        handle.canEdit && (
          <Popconfirm key="del" title="确认删除?" onConfirm={async () => {
            if (props.onBeforeDelete && !(await props.onBeforeDelete(row, handle))) return;
            await api.delete(`${requestUrl}/${row[primaryKey]}`);
            handle.audit('delete', String(row[primaryKey]));
            await props.onAfterDelete?.(row, handle);
            message.success('已删除');
            reload();
          }}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        ),
        props.rowExtraActions?.(row, handle),
      ],
    },
  ];

  return (
    <ProTable<Row>
      key={reloadKey}
      columns={columns}
      rowKey={primaryKey}
      headerTitle={handle.title}
      search={{ labelWidth: 'auto' }}
      pagination={{ pageSize: 20 }}
      rowClassName={(row) =>
        String(row[primaryKey]) === props.selectedKey ? 'ant-table-row-selected' : ''
      }
      onRow={(row) => ({
        onClick: () => props.onRowClick?.(row),
        style: props.onRowClick ? { cursor: 'pointer' } : undefined,
      })}
      request={async (params) => {
        const q = (params[primaryKey] || (params as any).keyword || '') as string;
        const rows = await api.get<Row[]>(`${requestUrl}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        return { data: rows, success: true };
      }}
      toolBarRender={() => [
        props.extraToolbar,
        handle.canEdit && props.newButton,
      ]}
      scroll={{ x: 'max-content' }}
    />
  );
}
