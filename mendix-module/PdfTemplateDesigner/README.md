## PdfTemplateDesigner module blueprint

**Domain model**
- `PdfTemplate` (specialization of `FileDocument`): stores the base/background PDF.
- `PdfTemplateDefinition`:
  - `Name` (String)
  - `TemplateJson` (LongString)
  - `IsActive` (Boolean)
  - `Version` (Integer)
  - `CreatedDate`/`CreatedBy` (standard audit)
- Association `PdfTemplateDefinition_PdfTemplate` (1-1, Reference to `PdfTemplate`)
- `PdfGeneratedDocument` (specialization of `FileDocument`):
  - Association `PdfGeneratedDocument_TemplateDefinition` (Reference to `PdfTemplateDefinition`)
  - Association `PdfGeneratedDocument_<BusinessObject>` (Reference, placeholder)
  - `GeneratedDate`/`GeneratedBy` (audit)

**Microflows**
1. `ACT_Template_SaveJson`
   - Inputs: `PdfTemplateDefinition`
   - Steps: validate JSON if needed, set `TemplateJson`, optionally increment `Version`, commit.
2. `ACT_Template_Preview` (optional)
   - Inputs: `PdfTemplateDefinition`
   - Steps: build sample `dataJson`, call `GenerateFlattenedPdf`, return or store a preview `FileDocument`.
3. `ACT_Document_GenerateFinal`
   - Inputs: `<BusinessObject>`, `PdfTemplateDefinition`
   - Steps:
     - Build `dataJson` from the business object (e.g., with a microflow or export mapping).
     - Call `GenerateFlattenedPdf(basePdf, templateJson, dataJson)`.
     - Create `PdfGeneratedDocument`, store bytes, set associations, commit.

**Template JSON (definition)**
The designer widget produces a **template definition JSON** that describes field positions on the PDF.
```json
{
  "basePdf": { "fileId": "<mendix guid optional>" },
  "fields": [
    {
      "key": "clientName",
      "label": "Client name",
      "type": "text",
      "page": 0,
      "x": 100,
      "y": 200,
      "w": 250,
      "h": 18,
      "fontSize": 10,
      "align": "left",
      "required": true
    }
  ],
  "meta": { "units": "pt", "createdWith": "pdftemplatedesigner" }
}
```
**Field mapping notes**
- `page` is **0-based** (page 0 = first page).
- `x`, `y`, `w`, `h` are **PDF points** (1/72 inch), **top-left origin**.
- `type` values: `text`, `checkbox`, `date`, `signature`.
- `align` values: `left`, `center`, `right`.

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
The optional `type` value is displayed in the dropdown and auto-maps widget field types for:
- `Boolean` -> `checkbox`
- `Date`/`DateTime`/`Time` -> `date`
- `Signature` -> `signature`

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
- `checkbox` expects boolean-like values (`true`/`false`); any truthy string (e.g., `"true"`) can be normalized in Java.
- If a key is missing, the field is left blank.

**End-to-end example**
1. Template JSON field keys: `clientName`, `clientDOB`, `acceptTerms`, `signerName`.
2. `dataJson` supplies those keys for the business object at generation time.
3. `GenerateFlattenedPdf` writes values directly onto the base PDF and flattens the result.

**Pages**
- Template Admin page
  - Data view on `PdfTemplateDefinition`
  - Place the `PdfTemplateDesigner` widget
  - Include a toolbar with Save and Activate actions
- Template List page
  - Data grid on `PdfTemplateDefinition`
  - Columns: Name, Version, IsActive, CreatedDate
  - Buttons: New, Duplicate version, Deactivate/Activate

**Versioning basics**
- When duplicating a template definition, copy `TemplateJson`, set `Version = previous + 1`, and set `IsActive = false` by default.
- Keep exactly one active definition per template name with a simple validation microflow.

**Java action**
- See `javasource/PdfTemplateDesigner/actions/GenerateFlattenedPdf.java`.
- Use Mendix **Managed Dependencies** (recommended), not manual `userlib` copy.
- In module settings for `PdfTemplateDesigner`, add Java dependencies:
  - `org.apache.pdfbox:pdfbox:2.0.35`
  - `com.fasterxml.jackson.core:jackson-databind:2.17.2`
- Run **App > Synchronize dependencies** in Studio Pro.
- Verify generated jars in `vendorlib` (including transitive `jackson-core` and `jackson-annotations`).
