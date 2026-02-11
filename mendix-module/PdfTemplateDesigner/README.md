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
