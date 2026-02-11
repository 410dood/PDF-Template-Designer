# PDF Template Designer (Mendix widget + module guidance)

This folder contains the `pdftemplatedesigner` pluggable widget and a Mendix module blueprint for storing template definitions and generating flattened PDFs.

**What's included**
- `pdftemplatedesigner/` widget source (React/TypeScript)
- `mendix-module/PdfTemplateDesigner/README.md` with domain model, microflows, and page guidance
- `mendix-module/PdfTemplateDesigner/javasource/.../GenerateFlattenedPdf.java` Java action stub using PDFBox

**Widget setup**
1. Install dependencies: `npm install`
2. Run locally: `npm run dev`
3. Build MPK: `npm run build` or `npm run release`

**Widget properties**
- `Template definition` (data source): point to the `PdfTemplateDefinition` context (or list with a single item).
- `Template JSON` (attribute): bind to `PdfTemplateDefinition.TemplateJson` (LongString).
- `Base PDF options` (data source): list of selectable `PdfTemplate` objects (used by Mendix association picker).
- `Base PDF association`: bind to `PdfTemplateDefinition_PdfTemplate` (Reference to `PdfTemplate` FileDocument).
- `PDF.js worker URL` (text template, optional): explicit URL for the worker script (Advanced category).
- `PDF.js script URL` (text template, optional): explicit URL for the PDF.js core script (`pdf.min.js`) (Advanced category).
- `Show shortcut hints` (boolean, default `true`): show/hide the shortcuts help text in the toolbar.
- `Enable keyboard shortcuts` (boolean, default `true`): enable/disable shortcut handling in the editor.
- `On change`: optional microflow/nanoflow executed whenever template JSON changes from editor interactions.
- `On save`: optional microflow to commit the updated TemplateJson.

**Designer UX (MVP+)**
- Click-to-place workflow: choose a palette tool, then click on the PDF to place the field.
- Palette drag/drop: drag a field type from the palette and drop onto the page.
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
  "meta": { "units": "pt", "createdWith": "pdftemplatedesigner" }
}
```

**Coordinate system**
- The widget stores `x`, `y`, `w`, `h` in PDF points (1/72 inch) using a **top-left origin**.
- The Java action converts to the PDF bottom-left origin (`pdfY = pageHeight - y - h`).

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


