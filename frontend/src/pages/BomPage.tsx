import MasterDetailForm from '../components/MasterDetailForm';

// Drop-in equivalent of the VFP form `FORMS\bom.scx`. The full master+detail
// aggregate is sent up as one payload on save (the backend handles transactional
// "delete-all then insert-all" of detail lines — same semantics as the VFP form).
export default function BomPage() {
  return <MasterDetailForm schemaName="bom" apiBase="/api/bom" />;
}
