import MasterForm from '../components/MasterForm';

// Drop-in equivalent of the VFP form `FORMS\part.scx`. Custom hooks
// (beforeSave/extraToolbar) are how you would replicate "method overrides"
// of a `tsbase` subclass — leave them off for the pure-CRUD case.
export default function PartPage() {
  return <MasterForm schemaName="part" apiBase="/api/part" />;
}
