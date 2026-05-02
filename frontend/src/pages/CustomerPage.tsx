import TsMainForm from '../components/TsMainForm';

/**
 * Modern equivalent of `FORMS\customer.scx`. In VFP that file inherits
 * `tsmainform` and binds the data env to `vcustomer` (which calls
 * `Customer_selection`). The line below is the strict analog.
 */
export default function CustomerPage() {
  return <TsMainForm schemaName="customer" apiBase="/api/customer" />;
}
