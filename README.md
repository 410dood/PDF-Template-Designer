# PDF Template Designer (Mendix widget + module guidance)

This folder contains the `pdftemplatedesigner` pluggable widget and a Mendix module blueprint for storing template definitions and generating output PDFs (flattened content or AcroForm fields).

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
- `Template definition` (data source): point to the `PdfTemplateDefinition` context (or list with a single item).
- `Template JSON` (attribute): bind to `PdfTemplateDefinition.TemplateJson` (LongString).
- `Base PDF options` (data source): list of selectable `PdfTemplate` objects (used by Mendix association picker).
- `Base PDF association`: bind to `PdfTemplateDefinition_PdfTemplate` (Reference to `PdfTemplate` FileDocument).
- `Field key source` (enumeration): `Manual text input` (default), `Dropdown from datasource`, or `Dropdown from JSON`.
- `Field key options datasource` (optional): list datasource used when `Field key source = Dropdown from datasource`.
- `Field key option attribute` (optional): attribute from the datasource object that contains the key string.
- `Field key options JSON` (optional): JSON array used when `Field key source = Dropdown from JSON`.
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
- `Output PDF mode` (enumeration): `Flattened content` (default) or `AcroForm fields`.
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

When `type` is provided, the dropdown shows it (for example `Client Date Of Birth (DateTime)`).
Selecting an option also auto-maps widget field type for:
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
- Click-to-place workflow: choose a palette tool, then click on the PDF to place the field.
- Palette drag/drop: drag a field type from the palette and drop onto the page.
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
      "showLabel": true,
      "type": "text|checkbox|date|signature",
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
    "outputMode": "flattened|acroform"
  }
}
```

**Computed key shortcuts**
- If a field `key` is not found in `dataJson`, the Java action also supports:
  - `__currentDate` (or `__today`)
  - `__currentTime` (or `__nowTime`)
  - `__currentDateTime` (or `__now`)
- You can control display with field `format`, for example:
  - date: `MM/dd/yyyy`
  - time: `HH:mm`
  - datetime: `MM/dd/yyyy hh:mm a`

**Coordinate system**
- The widget stores `x`, `y`, `w`, `h` in PDF points (1/72 inch) using a **top-left origin**.
- The Java action converts to the PDF bottom-left origin (`pdfY = pageHeight - y - h`).

**Output modes**
- `flattened`: Java action draws final text/marks directly on the page content.
  - If a field has `"showLabel": true`, its `label` (or fallback to `key`) is also rendered.
- `acroform`: Java action creates interactive form fields (`text`, `date`, `checkbox`, `signature`) using the same template coordinates.

**Viewer mode**
- When `View mode = Viewer`, the widget renders the linked document with the same canvas engine and overlays interactive controls for your template fields.
- `text` and `date` fields are editable inputs, `checkbox` fields are clickable, and `signature` fields use a custom mouse/touch canvas.
- Signature controls include `Clear signature` and optional `Use SigWeb` (when `SigWeb script URL` is configured and a supported SigWeb capture function is available).

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


