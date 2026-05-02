import TsMainForm from '../components/TsMainForm';

/**
 * Modern equivalent of `FORMS\part.scx`. In VFP that file inherits
 * `tsmainform`, sets the data env to `part_v1`, and adds nothing else.
 *
 * The line below is the strict analog: instantiate the `TsMainForm`
 * subclass with `schemaName="part"`. No JSX/CSS/business code needed.
 *
 * For the rare case where you need to override save/delete behavior,
 * pass the optional `onBeforeSave` / `onAfterSave` / `extraToolbar` props
 * — those map 1:1 to overriding methods in a VFP subclass of tsmainform.
 */
export default function PartPage() {
  return <TsMainForm schemaName="part" apiBase="/api/part" />;
}
