import TsMultiForm from '../components/TsMultiForm';

/**
 * Modern equivalent of `FORMS\bom.scx`. In VFP that file inherits
 * `multiform`, sets two cursors (vbom_h / vbom_l) and binds the grids.
 *
 * The line below is the strict analog: instantiate `TsMultiForm` with
 * `schemaName="bom"`. The schema describes both master and detail; the
 * backend handles the transactional save against bom_h + bom_l, then
 * re-runs the selection procs to refresh computed columns.
 */
export default function BomPage() {
  return <TsMultiForm schemaName="bom" apiBase="/api/bom" />;
}
