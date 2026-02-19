## PdfTemplateDesigner module blueprint

**Terminology mapping**
- `FormConfiguration` = template/config object (previously `PdfTemplateDefinition`).
- `ClientDocument` = per-workflow/per-client document instance.

**Recommended domain model (overlay + Data JSON source of truth)**
- `PdfTemplate` (specialization of `System.FileDocument`): stores the base/background PDF uploaded by admin.
- `FormConfiguration`:
  - `Name` (String)
  - `TemplateJson` (LongString)
  - `IsActive` (Boolean)
  - `Version` (Integer)
  - `CreatedDate`/`CreatedBy` (audit)
  - Association `FormConfiguration_PdfTemplate` (optional Reference to `PdfTemplate`; not needed when `FormConfiguration` itself is a `System.FileDocument` specialization)
- `ClientDocument` (specialization of `System.FileDocument`, or companion object with FileDocument association):
  - `DataJson` (LongString, required for Viewer persistence)
  - `TemplateJsonSnapshot` (LongString, recommended)
  - `Status` (Enum: `Draft`, `GeneratedEditable`, `InReview`, `Signed`, `Finalized`)
  - `FinalizedDate`/`FinalizedBy` (audit)
  - Association `ClientDocument_FormConfiguration` (Reference to `FormConfiguration`)
  - Association `ClientDocument_<BusinessObject>` (Reference, your business link)

**Configuration workflow (admin)**
1. Admin uploads base PDF to `FormConfiguration` (`FormConfiguration_PdfTemplate`).
2. Admin opens page with `PdfTemplateDesigner` in `Designer` mode.
3. Bind `Template JSON` to `FormConfiguration.TemplateJson` and save.
   - Preferred: bind `Base PDF datasource` to a datasource returning the base FileDocument.
   - If `FormConfiguration` is a `System.FileDocument` specialization, you can leave datasource empty and the widget will use the context object file as the base PDF.
4. Activate/version `FormConfiguration`.

**Runtime workflow (end user, overlay mode)**
1. `ACT_ClientDocument_Create`
   - Inputs: `<BusinessObject>`, active `FormConfiguration`.
   - Create `ClientDocument`.
   - Build initial `DataJson` from business data and store on `ClientDocument.DataJson`.
   - Copy `TemplateJsonSnapshot = FormConfiguration.TemplateJson` (recommended immutable snapshot).
   - Set `Status = GeneratedEditable`.
2. `ACT_ClientDocument_OpenViewer`
   - Input: `ClientDocument`.
   - Open Viewer page with widget configured:
     - `View mode = Viewer`
     - `Template JSON` bound to `ClientDocument.TemplateJsonSnapshot` (or `FormConfiguration.TemplateJson` if no snapshot)
     - `Data JSON` bound to `ClientDocument.DataJson`
     - `Base PDF datasource` bound to the base template file
   - User edits/signs in overlay controls; widget auto-syncs to `ClientDocument.DataJson`.
   - Viewer values are hydrated from `DataJson` only (missing keys render as empty/unchecked); there is no fallback read from native PDF form field values.
   - Set `Status = InReview` while editing.
3. `ACT_ClientDocument_FinalizeFromDataJson`
   - Input: `ClientDocument`.
   - Validate `DataJson` and required fields.
   - Call `GenerateFlattenedPdf(basePdf, templateJsonSnapshot, dataJson, clientDocumentOutputFile)`.
   - Ensure template output mode for final generation is `flattened`.
   - Set `Status = Finalized`, set `FinalizedDate/FinalizedBy`, commit.

**Guardrails**
- Keep `DataJson` on `ClientDocument` only; never on `FormConfiguration`.
- Treat `FormConfiguration` as design-time only; treat `ClientDocument` as runtime instance only.
- Regenerate final PDFs from pristine base PDF + template snapshot + current `DataJson`.
- Do not regenerate from an already finalized PDF as a base.
- Preferred path is overlay + `DataJson`.

**Template JSON (definition)**
The designer widget produces a **template definition JSON** that describes field positions on the PDF.
```json
{
  "basePdf": { "fileId": "<mendix guid optional>" },
  "fields": [
    {
      "key": "clientName",
      "label": "Client name",
      "variablesSampleData": "{ClientFirstName} {ClientLastName}",
      "showLabel": true,
      "type": "text",
      "page": 0,
      "x": 100,
      "y": 200,
      "w": 250,
      "h": 18,
      "fontSize": 10,
      "align": "left",
      "required": true,
      "format": "MM/dd/yyyy"
    }
  ],
  "meta": {
    "units": "pt",
    "createdWith": "pdftemplatedesigner",
    "outputMode": "flattened"
  }
}
```
**Field mapping notes**
- `page` is **0-based** (page 0 = first page).
- `x`, `y`, `w`, `h` are **PDF points** (1/72 inch), **top-left origin**.
- `type` values: `text`, `checkbox`, `date`, `signature`, `multiVariableText`, `select`, `radio`, `image`.
- `align` values: `left`, `center`, `right`.
- Optional `format` (for `date` type): Java date format pattern used in generation, default `MM/dd/yyyy`.
- Optional `showLabel` (Boolean, default `true`): renders label text in flattened output.
- Optional `labelOrientation` (`horizontal`|`vertical`, default `horizontal`): controls label placement in flattened output.
- Optional `optionsOrientation` (`horizontal`|`vertical`, default `vertical` for `radio`): controls radio option layout in Viewer.
- Optional `options` (String array): option list for `select`/`radio`.
- Optional `imageDataUrl` (String): static base64 image used by `image` fields when no key-bound image value is available.
- Optional `variablesSampleData` (String): for `multiVariableText`, supports `{key}` token replacement from `DataJson` (including computed keys like `{__currentDate}`).

**Template JSON output mode**
For the recommended `pdfme`-style runtime workflow, always generate flattened output from `TemplateJson + DataJson`.

**Fixed key options JSON (widget config)**
If you set widget property `Field key source = Dropdown from JSON`, you can paste this in `Field key options JSON`:
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
The optional `type` value is displayed in the key dropdown and auto-maps widget field types for:
- `Boolean` -> `checkbox`
- `Enumeration` -> `select`
- `Date` -> `date`
- `DateTime`/`Time` -> `text`
- `Image`/`Photo`/`Picture` -> `image`
- `Signature` -> `signature`

Built-in key options are included in dropdown key-source modes (`datasource`/`json`):
- `__currentDate` (`__today` alias)
- `__currentTime` (`__nowTime` alias)
- `__currentDateTime` (`__now` alias)
- `__signature` (signature placeholder)

**Widget property highlights**
- Category `Palette fields` provides per-tool show/hide booleans so app developers can disable specific palette tools (for example hide `Barcode` or `QR code`).
- Field property `labelOrientation` controls label placement (`horizontal` inline or `vertical` stacked).
- For `radio`, `optionsOrientation` controls whether options render vertically or horizontally in Viewer mode.
- If a `date` field uses computed keys (`__currentDate`, `__currentTime`, `__currentDateTime`), Viewer mode renders the resolved value as static text to avoid browser date-input parsing/clipping artifacts.

**Data JSON (values)**
The Java action expects a **data JSON** object where keys match template field `key` values.
```json
{
  "clientName": "Jane Smith",
  "clientDOB": "1986-04-12",
  "acceptTerms": true,
  "signerName": "Jane Smith"
}
```
**Data mapping notes**
- Values are simple scalars (string/number/boolean). Strings are rendered for `text`, `date`, `signature`.
- `select`/`radio` values should be the selected option string.
- `checkbox` accepts boolean-like values such as `true/false`, `1/0`, `yes/no`, `on/off`, `checked/unchecked`, `y/n`, and numeric values.
- `date` supports ISO strings like `2022-11-07T05:00:00.000Z` and can be formatted with field `format` (for example `MM/dd/yyyy`).
- If a key is missing, the field is left blank.
- Flattened `signature` fields render image data from `DataJson` when the value is a base64 image string (for example `data:image/png;base64,...`).
- Flattened `image` fields render a key-bound base64 image from `DataJson` when present; otherwise they fall back to template `imageDataUrl`.
- Reserved computed keys (when not present in `dataJson`):
  - `__currentDate` (alias `__today`) -> current server date.
  - `__currentTime` (alias `__nowTime`) -> current server time.
  - `__currentDateTime` (alias `__now`) -> current server date/time.
- Reserved computed keys also resolve when the key exists but contains blank text.
- In widget dropdown key-source modes (`datasource`/`json`), these computed keys are always available in Palette + Key dropdown.
  - `format` is optional and controls rendering (examples: `MM/dd/yyyy`, `HH:mm`, `MM/dd/yyyy hh:mm a`).
- In widget `View mode = Viewer`, bind widget property `Data JSON` to a LongString attribute to persist end-user edits/signatures from the overlay.

**End-to-end example**
1. Template JSON field keys: `clientName`, `clientDOB`, `acceptTerms`, `signerName`.
2. `ClientDocument.DataJson` stores those keys per workflow instance.
3. Finalization calls `GenerateFlattenedPdf(basePdf, templateJsonSnapshot, dataJson, outputFileDocument)` with `outputMode = flattened`.

**Pages**
- Form Configuration Admin page
  - Data view on `FormConfiguration`
  - Place the `PdfTemplateDesigner` widget
  - Use widget `View mode = Designer` for template configuration.
  - Include a toolbar with Save and Activate actions
- Form Configuration List page
  - Data grid on `FormConfiguration`
  - Columns: Name, Version, IsActive, CreatedDate
  - Buttons: New, Duplicate version, Deactivate/Activate
- Client Document Viewer page
  - Data view on `ClientDocument`
  - Use widget `View mode = Viewer`
  - Bind:
    - `Template JSON` -> `ClientDocument.TemplateJsonSnapshot` (or active `FormConfiguration.TemplateJson`)
    - `Data JSON` -> `ClientDocument.DataJson`
    - `Base PDF datasource` -> active/snapshotted base template file
  - Save action commits `ClientDocument` and progresses `Status`.

**Versioning basics**
- When duplicating a form configuration, copy `TemplateJson`, set `Version = previous + 1`, and set `IsActive = false` by default.
- Keep exactly one active configuration per template name with a simple validation microflow.
- Snapshot `TemplateJson` onto each `ClientDocument` at creation time to avoid drift.

**Java action**
- See `mendix-module/Document/javasource/document/actions/GenerateFlattenedPdf.java`.
- See `mendix-module/Document/javasource/document/actions/FinalizePdfToFlattened.java`.
- Recommended action signature:
  - Input: `basePdf` (`System.FileDocument`)
  - Input: `templateJson` (`String`)
  - Input: `dataJson` (`String`)
  - Input (optional): `outputFileDocument` (`System.FileDocument`, any specialization)
  - Return: `String`/`Boolean`/`Nothing` or `Binary` based on your module preference. Current implementation still returns `byte[]` and also writes to `outputFileDocument` when provided.
- The action can treat the base FileDocument as either:
  - a normal PDF, or
  - a scanned image file (`png`/`jpg`/`jpeg`) which is converted to a single-page PDF before rendering fields.
- Preferred architecture: overlay Viewer + `ClientDocument.DataJson` source of truth + flattened final output.
- Runtime generator should always flatten existing native PDF form content first (if any), then render template overlays from `DataJson`.
- For final non-editable output after user edits/signs in Viewer overlay, use the stored `ClientDocument.DataJson` in your microflow and call `GenerateFlattenedPdf`, then archive the result.
- `FinalizePdfToFlattened` only flattens values already present inside the PDF file itself.
- `FinalizePdfToFlattened` is not required for the overlay + `DataJson` architecture.
- Flattening now refreshes non-signature appearances and clears stale widget/default appearances first, which avoids light placeholder/ghost text in finalized output.
- Flatten/render paths also clear field content areas before writing values, so rerunning generation on already-edited documents does not stack old light placeholder text under new values.
- Use Mendix **Managed Dependencies** (recommended), not manual `userlib` copy.
- In module settings for `PdfTemplateDesigner`, add Java dependencies:
  - `org.apache.pdfbox:pdfbox:2.0.35`
  - `com.fasterxml.jackson.core:jackson-databind:2.17.2`
- Run **App > Synchronize dependencies** in Studio Pro.
- Verify generated jars in `vendorlib` (including transitive `jackson-core` and `jackson-annotations`).
