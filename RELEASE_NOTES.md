# Release Notes

## 0.1.9 - 2026-02-20

### Highlights
- Hardened Java flattening for date/time formats so `date` fields with time-only (`HH:mm`) or datetime patterns no longer fail formatting.
- Synchronized signature/image payload extraction behavior across generation paths to reduce runtime inconsistencies.

### Technical Changes
- Updated `Document.GenerateFlattenedPdf` date/time parsing and formatter handling for:
  - date-only patterns
  - time-only patterns
  - datetime patterns
- Updated `Document.GenerateFlattenedPdfDelegate` with matching parser/formatter logic to keep behavior aligned.

## Initial Release

### Highlights
- Added Mendix pluggable widget: `PdfTemplateDesigner`.
- Implemented PDF.js script/worker URL configuration with text-template support.
- Added drag/drop, click-to-place, page thumbnails, quick page jump, alignment guides, and snap-to-grid.
- Added field editor with text/checkbox/date/signature support and JSON persistence.
- Added undo/redo, duplicate, delete, and keyboard nudging behavior.

### New Configuration Options
- `Show shortcut hints` (Behavior): show/hide shortcut help text.
- `Enable keyboard shortcuts` (Behavior): enable/disable keyboard shortcuts.
- `On change` (Actions): trigger a microflow/nanoflow when template JSON changes.
- `On save` (Actions): trigger a microflow/nanoflow from Save JSON.

### Module Assets
- Included Mendix module guidance and Java action stub for flattened PDF generation.
