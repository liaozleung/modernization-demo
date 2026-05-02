import TsMultiForm from '../components/TsMultiForm';

/**
 * Modern equivalent of `FORMS\so.scx`. In VFP that file inherits `multiform`
 * and binds two cursors (vso_h / vso_l) backed by `So_h_selection` and
 * `So_l_selection`. The line below is the strict analog.
 */
export default function SoPage() {
  return <TsMultiForm schemaName="so" apiBase="/api/so" />;
}
