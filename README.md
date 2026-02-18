# PDF Template Designer (Mendix widget + module guidance)

This folder contains the `pdftemplatedesigner` pluggable widget and a Mendix module blueprint for storing template definitions and generating flattened output PDFs.

**What's included**
- `pdftemplatedesigner/` widget source (React/TypeScript)
- `mendix-module/PdfTemplateDesigner/README.md` with domain model, microflows, and page guidance
- `mendix-module/Document/javasource/document/actions/GenerateFlattenedPdf.java` Java action for template generation
- `mendix-module/Document/javasource/document/actions/FinalizePdfToFlattened.java` Java action for final flattening

**Widget setup**
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`
3. Build MPK: `npm run build` or `npm run release`

**Widget properties**
- `Template definition` (data source): point to your `FormConfiguration` context (previously `PdfTemplateDefinition`) or equivalent object.
- `Template JSON` (attribute): bind to configuration template JSON (for example `FormConfiguration.TemplateJson`).
- `Data JSON` (attribute): bind to your per-document instance attribute (for example `ClientDocument.DataJson`) so Viewer edits/signatures persist.
- `Base PDF datasource` (optional): datasource that returns the base PDF `FileDocument` object. The widget uses the first item.
- If `Base PDF datasource` is empty and the context object is a `System.FileDocument` specialization, the widget uses the context object file as the base PDF.
- `Field key source` (enumeration): `Manual text input` (default), `Dropdown from datasource`, or `Dropdown from JSON`.
- `Field key options datasource` (optional): list datasource used when `Field key source = Dropdown from datasource` (drives key palette + Key dropdown; built-in computed keys are also appended).
- `Field key option attribute` (optional): attribute from the datasource object that contains the key string.
- `Field key options JSON` (optional): JSON array used when `Field key source = Dropdown from JSON` (drives key palette + Key dropdown; built-in computed keys are also appended).
- `PDF.js worker URL` (text template, optional): explicit URL for the worker script (Advanced category).
- `PDF.js script URL` (text template, optional): explicit URL for the PDF.js core script (`pdf.min.js`) (Advanced category).
- `SigWeb script URL` (text template, optional): URL to `SigWebTablet.js` for external signature-pad capture in Viewer mode.
- `Show shortcut hints` (boolean, default `true`): show/hide the shortcuts help text in the toolbar.
- `Enable keyboard shortcuts` (boolean, default `true`): enable/disable shortcut handling in the editor.
- `Show field properties` (boolean, default `true`): show/hide the right-side field properties panel.
- `Show palette section` / `Show fields section` / `Show pages section` (booleans, default `true`): control each left sidebar section independently.
- Field property visibility toggles (booleans, default `true`): hide/show each row in the Field properties card:
  - `Key`, `Label`, `Show label toggle`, `Type`, `Page`, `Position`, `Size`, `Font size`, `Alignment`, `Required`, `Duplicate button`, `Delete button`.
- `Save button text` (string, optional): custom toolbar text for the save action button (defaults to `Save JSON`).
- `View mode` (enumeration): `Designer` (full template editor) or `Viewer` (read/fill mode with interactive overlay fields, including mouse/touch signature capture).
- `On change`: optional microflow/nanoflow executed whenever template JSON changes from editor interactions.
- `On save`: optional microflow to commit the updated TemplateJson.

**Field key options JSON examples**
```json
["ClientFullName", "ClientDateOfBirth", "ProgramName"]
```

```json
[
  { "key": "ClientFullName", "label": "Client Full Name" },
  { "key": "ClientDateOfBirth", "label": "Date of Birth" },
  { "value": "ProgramName", "label": "Program" }
]
```

```json
[
  { "key": "ClientFullName", "label": "Client Full Name", "type": "String" },
  { "key": "ClientDateOfBirth", "label": "Client Date Of Birth", "type": "DateTime" },
  { "key": "ProgramIsActive", "label": "Program Is Active", "type": "Boolean" }
]
```

When `type` is provided, the key palette and dropdown show it (for example `Client Date Of Birth (DateTime)`).
Placing/selecting an option also auto-maps widget field type for:
- `Boolean` -> `checkbox`
- `Date`/`DateTime`/`Time` -> `date`
- `Signature` -> `signature`

**Fixed key options JSON (copy/paste)**
Use this when `Field key source = Dropdown from JSON`.
```json
[
  { "key": "EnrollmentURecordId", "label": "Enrollment Record ID", "type": "String" },
  { "key": "EnrollmentStartDate", "label": "Enrollment Start Date", "type": "DateTime" },
  { "key": "EnrollmentEndDate", "label": "Enrollment End Date", "type": "DateTime" },
  { "key": "EnrollmentStatus", "label": "Enrollment Status", "type": "Enumeration" },
  { "key": "ClientFullName", "label": "Client Full Name", "type": "String" },
  { "key": "ClientDateOfBirth", "label": "Client Date Of Birth", "type": "DateTime" },
  { "key": "ProgramName", "label": "Program Name", "type": "String" },
  { "key": "ProgramCode", "label": "Program Code", "type": "String" },
  { "key": "EndEnrollmentReasonName", "label": "End Enrollment Reason", "type": "String" },
  { "key": "CountyName", "label": "County Name", "type": "String" }
]
```

**Designer UX (MVP+)**
- Manual mode (`Field key source = Manual text input`): choose a field type tool, then click/drag to place.
- Dropdown modes (`Field key source = Dropdown from datasource/json`): palette lists keys so users can drag a key directly to the page in one step.
- Dropdown modes also include built-in key options:
  - `__currentDate` (`__today` alias)
  - `__currentTime` (`__nowTime` alias)
  - `__currentDateTime` (`__now` alias)
  - `__signature` (signature placeholder)
- Base document fallback: if the linked FileDocument is an image (`.png/.jpg/.jpeg`) instead of a PDF, the widget renders it as a 1-page canvas with the same field overlay behavior.
- Page thumbnails: quick page navigation via sidebar thumbnails.
- Quick page jump: type a page number in the toolbar.
- Smart editing: alignment guides + snapping to nearby fields while moving/resizing.
- Undo/redo and keyboard shortcuts:
  - `Cmd/Ctrl+Z` undo
  - `Cmd/Ctrl+Shift+Z` or `Cmd/Ctrl+Y` redo
  - `Cmd/Ctrl+D` duplicate selected field
  - `Delete/Backspace` delete selected field
  - Arrow keys nudge (`Shift` + arrows for larger steps)

**Template JSON shape**
```json
{
  "basePdf": { "fileId": "<mendix guid or name optional>" },
  "fields": [
    {
      "key": "clientName",
      "label": "Client Name",
      "variablesSampleData": "{ClientFirstName} {ClientLastName}",
      "showLabel": true,
      "type": "text|checkbox|date|signature|multiVariableText",
      "page": 0,
      "x": 100,
      "y": 200,
      "w": 250,
      "h": 18,
      "fontSize": 10,
      "align": "left|center|right"
    }
  ],
  "meta": {
    "units": "pt",
    "createdWith": "pdftemplatedesigner",
    "outputMode": "flattened"
  }
}
```

**Computed key shortcuts**
- If a field `key` is not found in `dataJson` (or is present as blank text), the Java action also supports:
  - `__currentDate` (or `__today`)
  - `__currentTime` (or `__nowTime`)
  - `__currentDateTime` (or `__now`)
- You can control display with field `format`, for example:
  - date: `MM/dd/yyyy`
  - time: `HH:mm`
  - datetime: `MM/dd/yyyy hh:mm a`
- Flattened `signature` fields render image data from `DataJson` when the value is a base64 image string (for example `data:image/png;base64,...`).
- `multiVariableText` fields can use `variablesSampleData` with `{key}` tokens that are resolved from `DataJson` (supports computed keys like `{__currentDate}` too).

**Coordinate system**
- The widget stores `x`, `y`, `w`, `h` in PDF points (1/72 inch) using a **top-left origin**.
- The Java action converts to the PDF bottom-left origin (`pdfY = pageHeight - y - h`).

**Output mode**
- Runtime path is always flattened output from `TemplateJson + DataJson`.
- In flattened output, if a field has `"showLabel": true`, its `label` (or fallback to `key`) is also rendered.

**Viewer mode**
- When `View mode = Viewer`, the widget renders the linked document with the same canvas engine and overlays interactive controls for your template fields.
- `text` and `date` fields are editable inputs, `checkbox` fields are clickable, `signature` fields use a custom mouse/touch canvas, and `multiVariableText` fields render resolved read-only text from `variablesSampleData`.
- Signature controls include `Clear signature` and optional `Use SigWeb` (when `SigWeb script URL` is configured and a supported SigWeb capture function is available).
- With `Data JSON` bound, Viewer mode continuously syncs entered values/signatures into that attribute (overlay + `Data JSON` source of truth).
- Viewer field values are hydrated from `Data JSON` only (missing keys default to empty/unchecked); native PDF form field values are not used as fallback.
- For final output from Viewer-entered values, pass the stored `Data JSON` into your generation/finalization microflow.
- `FinalizePdfToFlattened` only flattens values that already exist inside PDF form fields; Viewer overlay values must be applied from `Data JSON` in your flow.
- When generating `flattened` output from a PDF that already has native form fields, the Java action first flattens existing field appearances to avoid ghost/placeholder overlays.
- Flatten/render paths now clear field content areas before drawing/finalizing values, which prevents stale light placeholder text when regenerating from previously edited PDFs.
- See `mendix-module/PdfTemplateDesigner/README.md` section `Runtime workflow (end user, overlay mode)` for the recommended microflow sequence.

**PDF.js worker**
- The widget loads PDF.js from `window.pdfjsLib` when present.
- Core script source precedence is: `PDF.js script URL` -> `window.pdfjsScriptSrc` -> derived from `PDF.js worker URL` -> CDN default.
- Worker source precedence is: `PDF.js worker URL` -> `window.pdfjsWorkerSrc` -> derived from script URL -> CDN default.
- For strict CSP, set both `PDF.js script URL` and `PDF.js worker URL` to same-origin URLs.
- The widget supports both `.js` and `.mjs` script URLs, keeps extensions aligned when deriving URLs, and includes an AMD fallback for Mendix runtime.
- Recommended pair: `/resources/pdf.min.js` and `/resources/pdf.worker.min.js`.

**Next steps**
- Follow `mendix-module/PdfTemplateDesigner/README.md` to create the Mendix module, microflows, and pages.
- Add PDFBox and Jackson via Mendix **Managed Dependencies** and run **App > Synchronize dependencies**.


