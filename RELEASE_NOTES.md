# Release Notes

## 0.2.0 - 2026-07-13

### Highlights
- **Mendix 11.12 compatibility:** fixed base-PDF loading by awaiting `mx.data.getDocumentUrl`, resolving documents that failed to render on newer runtimes.
- **Import Template** toolbar button: load an existing template JSON directly into the Designer.
- **Replace PDF** toolbar button: swap the underlying base PDF without rebuilding the template.
- Added a configurable **header checkbox** field/control.

### Maintenance
- Normalized all text files to LF line endings and added `.gitattributes` (`eol=lf`) to keep diffs clean across platforms.
- Merged the `Release-2026-02-23` line into `main`.
- Build artifacts (`dist/`) are now tracked in the repository, and the `dist/0.2.0` MPK is attached to this release.

## 0.1.13 - 2026-04-01

### Fixes
- Added viewer-only required-field validation on Save so configured required fields must be filled before a template can be saved.
- Kept Viewer and Read-only mode on a shared scrollable-document layout with a sticky toolbar for modal use.
- Eliminated Java action drift by converting `GenerateFlattenedPdfDelegate` into a thin wrapper that delegates to `GenerateFlattenedPdf`.
- Improved viewer date/time behavior:
  - time-only date formats now use a time input path
  - date+time formats now use text input to avoid browser datetime rendering inconsistencies
- Improved datasource key type mapping:
  - `DateTime`/`Time` now map to `date` field type
  - mapped date fields now receive a default format based on source datatype (`MM/dd/yyyy`, `HH:mm`, or `MM/dd/yyyy HH:mm`)
- Preserved multiline text intent in flattened output by keeping line breaks during bounded text layout.

## 0.1.10 - 2026-02-20

### Highlights
- Simplified finalization flow to a single action by removing `FinalizePdfToFlattened` from the module/docs.
- Flattened PDF renderer now honors field appearance styling (`textColor`, `backgroundColor`, and `transparentBackground`) instead of always defaulting to black text on white.

### Technical Changes
- Removed `mendix-module/Document/javasource/document/actions/FinalizePdfToFlattened.java`.
- Updated `Document.GenerateFlattenedPdf` rendering path to:
  - apply configured text color when drawing text and labels
  - apply configured background color when clearing field content areas
  - keep transparent fields unfilled when `transparentBackground = true`
- Updated READMEs to document the single-step `GenerateFlattenedPdf` finalization architecture.

## 0.1.9 - 2026-02-20

### Highlights
- Hardened Java flattening for date/time formats so `date` fields with time-only (`HH:mm`) or datetime patterns no longer fail formatting.
- Synchronized signature/image payload extraction behavior across generation paths to reduce runtime inconsistencies.

### Technical Changes
- Updated `Document.GenerateFlattenedPdf` date/time parsing and formatter handling for:
  - date-only patterns
  - time-only patterns
  - datetime patterns
- Updated `Document.GenerateFlattenedPdfDelegate` with matching parser/formatter logic to keep behavior aligned (this was before the later thin-wrapper refactor noted in Unreleased).

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
