package document.actions;

import com.mendix.core.Core;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.UserAction;

import java.io.ByteArrayOutputStream;
import java.io.ByteArrayInputStream;
import java.awt.image.BufferedImage;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.imageio.ImageIO;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDBorderStyleDictionary;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDCheckBox;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDSignatureField;
import org.apache.pdfbox.pdmodel.interactive.form.PDTerminalField;
import org.apache.pdfbox.pdmodel.interactive.form.PDTextField;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Generate output PDF from template JSON and data JSON.
 * Supports:
 *  - flattened mode: draws values directly on the page
 *  - acroform mode: creates interactive AcroForm fields
 *
 * Uses PDFBox (Apache 2.0) and Jackson (Apache 2.0). Add both JARs to userlib.
 */
public class GenerateFlattenedPdf extends UserAction<byte[]> {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter DEFAULT_DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US);

    private final IMendixObject basePdf;
    private final IMendixObject outputFileDocument;
    private final String templateJson;
    private final String dataJson;

    public GenerateFlattenedPdf(IContext context, IMendixObject basePdf, String templateJson, String dataJson) {
        this(context, basePdf, templateJson, dataJson, null);
    }

    public GenerateFlattenedPdf(
        IContext context,
        IMendixObject basePdf,
        String templateJson,
        String dataJson,
        IMendixObject outputFileDocument
    ) {
        super(context);
        this.basePdf = basePdf;
        this.templateJson = templateJson;
        this.dataJson = dataJson;
        this.outputFileDocument = outputFileDocument;
    }

    @Override
    public byte[] executeAction() throws Exception {
        if (basePdf == null) {
            return new byte[0];
        }

        byte[] baseBytes = Core.getFileDocumentContent(getContext(), basePdf);
        if (baseBytes == null || baseBytes.length == 0) {
            throw new IllegalArgumentException("Base PDF file is empty.");
        }

        TemplateDefinition template = TemplateDefinition.fromJson(templateJson);
        Map<String, Object> data = TemplateDefinition.parseDataJson(dataJson);

        if (template == null || template.fields == null || template.fields.isEmpty()) {
            storeOutputToTargetIfConfigured(baseBytes);
            return baseBytes;
        }

        byte[] outputBytes;
        try (PDDocument doc = openPdfOrImage(baseBytes)) {
            if ("acroform".equals(template.getOutputMode(data))) {
                validateAcroFormConfiguration(doc, template.fields);
                applyAcroFormFields(doc, template.fields, data);
            } else {
                renderFlattenedFields(doc, template.fields, data);
            }

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                doc.save(out);
                outputBytes = out.toByteArray();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PDF from template JSON: " + e.getMessage(), e);
        }

        storeOutputToTargetIfConfigured(outputBytes);
        return outputBytes;
    }

    private static void renderFlattenedFields(PDDocument doc, List<TemplateField> fields, Map<String, Object> data) throws Exception {
        for (TemplateField field : fields) {
            if (field == null) {
                continue;
            }

            int pageIndex = Math.max(0, field.page);
            if (pageIndex >= doc.getNumberOfPages()) {
                continue;
            }

            PDPage page = doc.getPage(pageIndex);
            PDRectangle box = page.getMediaBox();
            float pageHeight = box.getHeight();
            float x = Math.max(0, field.x);
            float yTop = Math.max(0, field.y);
            float w = Math.max(4, field.w);
            float h = Math.max(4, field.h);
            // Template uses top-left origin. PDF uses bottom-left origin.
            float y = pageHeight - yTop - h;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
                renderField(cs, field, data, x, y, w, h);
            }
        }
    }

    private static void applyAcroFormFields(PDDocument doc, List<TemplateField> fields, Map<String, Object> data) throws Exception {
        PDAcroForm acroForm = getOrCreateAcroForm(doc);
        Set<String> usedNames = new HashSet<>();
        boolean hasSignatureField = false;
        for (PDField existingField : acroForm.getFieldTree()) {
            if (existingField != null && existingField.getFullyQualifiedName() != null) {
                usedNames.add(existingField.getFullyQualifiedName());
            }
        }

        for (TemplateField field : fields) {
            if (field == null) {
                continue;
            }

            int pageIndex = Math.max(0, field.page);
            if (pageIndex >= doc.getNumberOfPages()) {
                continue;
            }

            PDPage page = doc.getPage(pageIndex);
            PDRectangle box = page.getMediaBox();
            float pageHeight = box.getHeight();
            float x = Math.max(0, field.x);
            float yTop = Math.max(0, field.y);
            float w = Math.max(4, field.w);
            float h = Math.max(4, field.h);
            float y = pageHeight - yTop - h;

            drawAcroFieldLabel(doc, page, field, x, y, w, h);
            String baseName = normalizeFieldName(field.key);
            String fieldName = nextUniqueFieldName(baseName, usedNames);
            PDField acroField = createAcroField(doc, acroForm, field, fieldName, page, x, y, w, h);
            if (acroField == null) {
                continue;
            }

            if (field.required) {
                acroField.setRequired(true);
            }

            acroForm.getFields().add(acroField);
            applyAcroFieldValue(acroField, field, data);
            if ("signature".equals(normalizeFieldType(field.type))) {
                hasSignatureField = true;
            }
        }

        if (hasSignatureField) {
            acroForm.setSignaturesExist(true);
            // Hint to PDF readers to apply incremental updates for signing.
            acroForm.setAppendOnly(true);
        }
        try {
            acroForm.refreshAppearances();
        } catch (Exception ignored) {
            // Some readers generate appearances themselves; do not fail generation on refresh issues.
        }
    }

    private static PDAcroForm getOrCreateAcroForm(PDDocument doc) {
        PDAcroForm acroForm = doc.getDocumentCatalog().getAcroForm();
        if (acroForm == null) {
            acroForm = new PDAcroForm(doc);
            doc.getDocumentCatalog().setAcroForm(acroForm);
        }

        PDResources resources = acroForm.getDefaultResources();
        if (resources == null) {
            resources = new PDResources();
            acroForm.setDefaultResources(resources);
        }
        resources.put(COSName.getPDFName("Helv"), PDType1Font.HELVETICA);
        if (acroForm.getDefaultAppearance() == null || acroForm.getDefaultAppearance().trim().isEmpty()) {
            acroForm.setDefaultAppearance("/Helv 10 Tf 0 g");
        }
        acroForm.setNeedAppearances(true);
        return acroForm;
    }

    private static PDField createAcroField(
        PDDocument doc,
        PDAcroForm acroForm,
        TemplateField templateField,
        String fieldName,
        PDPage page,
        float x,
        float y,
        float w,
        float h
    ) throws Exception {
        String normalizedType = normalizeFieldType(templateField.type);
        if (normalizedType == null) {
            throw new IllegalArgumentException("Unsupported acroform field type: " + String.valueOf(templateField.type));
        }
        PDTerminalField terminalField;
        if ("checkbox".equals(normalizedType)) {
            PDCheckBox checkBox = new PDCheckBox(acroForm);
            checkBox.setPartialName(fieldName);
            checkBox.setReadOnly(false);
            terminalField = checkBox;
        } else if ("signature".equals(normalizedType)) {
            PDSignatureField signatureField = new PDSignatureField(acroForm);
            signatureField.setPartialName(fieldName);
            signatureField.setReadOnly(false);
            terminalField = signatureField;
        } else {
            PDTextField textField = new PDTextField(acroForm);
            textField.setPartialName(fieldName);
            textField.setReadOnly(false);
            textField.setQ(alignmentToQ(templateField.align));
            float fontSize = templateField.fontSize > 0 ? templateField.fontSize : 10f;
            textField.setDefaultAppearance(String.format(Locale.ROOT, "/Helv %.2f Tf 0 g", fontSize));
            terminalField = textField;
        }

        PDAnnotationWidget widget;
        if (terminalField.getWidgets().isEmpty()) {
            widget = new PDAnnotationWidget();
            widget.setParent(terminalField);
            terminalField.getWidgets().add(widget);
        } else {
            widget = terminalField.getWidgets().get(0);
        }
        configureWidget(widget, page, x, y, w, h);
        if ("signature".equals(normalizedType)) {
            drawSignaturePlaceholder(doc, page, x, y, w, h, templateField.label);
        }
        return terminalField;
    }

    private static void configureWidget(PDAnnotationWidget widget, PDPage page, float x, float y, float w, float h) throws Exception {
        widget.setRectangle(new PDRectangle(x, y, w, h));
        widget.setPage(page);
        widget.setPrinted(true);
        PDBorderStyleDictionary border = new PDBorderStyleDictionary();
        border.setWidth(1f);
        widget.setBorderStyle(border);
        if (!page.getAnnotations().contains(widget)) {
            page.getAnnotations().add(widget);
        }
    }

    private static void drawSignaturePlaceholder(PDDocument doc, PDPage page, float x, float y, float w, float h, String label) throws Exception {
        String placeholder = (label == null || label.trim().isEmpty()) ? "Sign here" : label.trim();
        try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            cs.beginText();
            cs.setFont(PDType1Font.HELVETICA_OBLIQUE, 9f);
            cs.newLineAtOffset(x + 4f, y + Math.max(4f, h / 2f - 3f));
            cs.showText(normalizePdfText(placeholder));
            cs.endText();
        }
    }

    private static void drawAcroFieldLabel(PDDocument doc, PDPage page, TemplateField field, float x, float y, float w, float h)
        throws Exception {
        if (field == null || !field.showLabel) {
            return;
        }

        String labelText = resolveLabelText(field);
        if (labelText.isEmpty()) {
            return;
        }

        String normalizedType = normalizeFieldType(field.type);
        if ("signature".equals(normalizedType)) {
            // Signature label is already rendered as placeholder inside the signature box.
            return;
        }

        float fontSize = Math.max(8f, field.fontSize > 0 ? field.fontSize : 10f);
        float labelX = x;
        float labelY = y + h + 2f;
        if ("checkbox".equals(normalizedType)) {
            labelX = x + w + 4f;
            labelY = y + Math.max(1f, (h - fontSize) / 2f);
        }

        try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
            drawLabelText(cs, labelText, labelX, labelY, fontSize);
        }
    }

    private static void applyAcroFieldValue(PDField acroField, TemplateField templateField, Map<String, Object> data) throws Exception {
        if (acroField == null || templateField == null) {
            return;
        }

        String normalizedType = normalizeFieldType(templateField.type);
        if ("signature".equals(normalizedType)) {
            return;
        }

        if ("checkbox".equals(normalizedType) && acroField instanceof PDCheckBox) {
            PDCheckBox checkBox = (PDCheckBox) acroField;
            if (isTruthy(getValue(data, templateField.key))) {
                checkBox.check();
            } else {
                checkBox.unCheck();
            }
            return;
        }

        if (acroField instanceof PDTextField) {
            ((PDTextField) acroField).setValue(getFormattedFieldValue(templateField, data));
        }
    }

    private static int alignmentToQ(String align) {
        if (align == null) {
            return 0;
        }
        String normalized = align.trim().toLowerCase(Locale.ROOT);
        if ("center".equals(normalized)) {
            return 1;
        }
        if ("right".equals(normalized)) {
            return 2;
        }
        return 0;
    }

    private static String normalizeFieldName(String key) {
        String source = key == null ? "" : key.trim();
        if (source.isEmpty()) {
            return "field";
        }
        String normalized = source.replaceAll("[^A-Za-z0-9_\\-.]", "_");
        return normalized.isEmpty() ? "field" : normalized;
    }

    private static String nextUniqueFieldName(String baseName, Set<String> usedNames) {
        String candidate = baseName;
        int suffix = 1;
        while (usedNames.contains(candidate)) {
            suffix += 1;
            candidate = baseName + "_" + suffix;
        }
        usedNames.add(candidate);
        return candidate;
    }

    private static PDDocument openPdfOrImage(byte[] sourceBytes) throws Exception {
        try {
            return PDDocument.load(sourceBytes);
        } catch (Exception pdfError) {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(sourceBytes));
            if (image == null) {
                throw pdfError;
            }

            PDDocument doc = new PDDocument();
            PDRectangle rect = new PDRectangle(image.getWidth(), image.getHeight());
            PDPage page = new PDPage(rect);
            doc.addPage(page);

            PDImageXObject imageXObject = LosslessFactory.createFromImage(doc, image);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.drawImage(imageXObject, 0, 0, rect.getWidth(), rect.getHeight());
            }
            return doc;
        }
    }

    @Override
    public String toString() {
        return "GenerateFlattenedPdf";
    }

    private static void renderField(PDPageContentStream cs, TemplateField field, Map<String, Object> data, float x, float y, float w, float h)
        throws Exception {
        String normalizedType = normalizeFieldType(field.type);
        String value = getFormattedFieldValue(field, data);
        String labelText = resolveLabelText(field);
        float fontSize = field.fontSize > 0 ? field.fontSize : 10;

        if ("checkbox".equals(normalizedType)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            if (isTruthy(getValue(data, field.key))) {
                cs.moveTo(x + 2, y + 2);
                cs.lineTo(x + w - 2, y + h - 2);
                cs.moveTo(x + 2, y + h - 2);
                cs.lineTo(x + w - 2, y + 2);
                cs.stroke();
            }
            if (field.showLabel && !labelText.isEmpty()) {
                drawLabelText(cs, labelText, x + w + 4, y + Math.max(1, (h - fontSize) / 2f), Math.max(8, fontSize));
            }
            return;
        }

        if ("signature".equals(normalizedType)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            if (field.showLabel && !labelText.isEmpty()) {
                drawLabelText(cs, labelText, x, y + h + 2, Math.max(8, fontSize - 1));
            }
            cs.beginText();
            cs.setFont(PDType1Font.HELVETICA_OBLIQUE, Math.max(8, fontSize));
            cs.newLineAtOffset(x + 4, y + h / 2);
            cs.showText("Signature");
            cs.endText();
            return;
        }

        if (field.showLabel && !labelText.isEmpty()) {
            value = normalizePdfText(labelText + ": " + value);
        }

        cs.beginText();
        cs.setFont(PDType1Font.HELVETICA, fontSize);
        float textWidth = PDType1Font.HELVETICA.getStringWidth(value) / 1000f * fontSize;
        float textX = x + 2;
        if ("center".equals(field.align)) {
            textX = x + (w - textWidth) / 2f;
        } else if ("right".equals(field.align)) {
            textX = x + w - textWidth - 2;
        }
        float textY = y + (h - fontSize) / 2f;
        cs.newLineAtOffset(textX, textY);
        cs.showText(value);
        cs.endText();
    }

    private static String resolveLabelText(TemplateField field) {
        if (field == null) {
            return "";
        }
        String label = field.label == null ? "" : field.label.trim();
        if (!label.isEmpty()) {
            return normalizePdfText(label);
        }
        return normalizePdfText(field.key == null ? "" : field.key.trim());
    }

    private static void drawLabelText(PDPageContentStream cs, String text, float x, float y, float fontSize) throws Exception {
        if (text == null || text.trim().isEmpty()) {
            return;
        }
        cs.beginText();
        cs.setFont(PDType1Font.HELVETICA, fontSize);
        cs.newLineAtOffset(x, y);
        cs.showText(normalizePdfText(text));
        cs.endText();
    }

    private static Object getValue(Map<String, Object> data, String key) {
        if (data == null || key == null || key.trim().isEmpty()) {
            return null;
        }
        return data.get(key);
    }

    private static String getFormattedFieldValue(TemplateField field, Map<String, Object> data) {
        if (field == null) {
            return "";
        }
        Object rawValue = getValue(data, field.key);
        if (rawValue == null) {
            return "";
        }

        if ("date".equals(normalizeFieldType(field.type))) {
            return formatDateLikeValue(rawValue, field.format);
        }
        return normalizePdfText(String.valueOf(rawValue));
    }

    private static String normalizePdfText(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value.replace("\r", " ").replace("\n", " ");
    }

    private static boolean isTruthy(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof Number) {
            return Math.abs(((Number) value).doubleValue()) > 0.0000001d;
        }

        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        if ("true".equals(normalized) || "1".equals(normalized) || "yes".equals(normalized) || "y".equals(normalized)) {
            return true;
        }
        if ("on".equals(normalized) || "checked".equals(normalized) || "x".equals(normalized)) {
            return true;
        }
        if ("false".equals(normalized) || "0".equals(normalized) || "no".equals(normalized) || "n".equals(normalized)) {
            return false;
        }
        if ("off".equals(normalized) || "unchecked".equals(normalized)) {
            return false;
        }
        try {
            return Math.abs(Double.parseDouble(normalized)) > 0.0000001d;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private static String formatDateLikeValue(Object value, String configuredPattern) {
        LocalDate parsedDate = tryParseDate(value);
        if (parsedDate == null) {
            return normalizePdfText(String.valueOf(value));
        }
        DateTimeFormatter formatter = resolveDateFormatter(configuredPattern);
        return formatter.format(parsedDate);
    }

    private static LocalDate tryParseDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate) {
            return (LocalDate) value;
        }
        if (value instanceof java.util.Date) {
            return Instant.ofEpochMilli(((java.util.Date) value).getTime()).atZone(ZoneOffset.UTC).toLocalDate();
        }
        if (value instanceof Number) {
            return Instant.ofEpochMilli(((Number) value).longValue()).atZone(ZoneOffset.UTC).toLocalDate();
        }

        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }

        try {
            return LocalDate.parse(text, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toLocalDate();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return Instant.parse(text).atZone(ZoneOffset.UTC).toLocalDate();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalDate();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }

        if (text.matches("^-?\\d{10,17}$")) {
            try {
                long epoch = Long.parseLong(text);
                if (text.length() == 10) {
                    epoch = epoch * 1000L;
                }
                return Instant.ofEpochMilli(epoch).atZone(ZoneOffset.UTC).toLocalDate();
            } catch (NumberFormatException ignored) {
                // Fall through.
            }
        }

        return null;
    }

    private static DateTimeFormatter resolveDateFormatter(String configuredPattern) {
        if (configuredPattern == null || configuredPattern.trim().isEmpty()) {
            return DEFAULT_DATE_FORMATTER;
        }
        try {
            return DateTimeFormatter.ofPattern(configuredPattern.trim(), Locale.US);
        } catch (IllegalArgumentException ignored) {
            return DEFAULT_DATE_FORMATTER;
        }
    }

    private static void validateAcroFormConfiguration(PDDocument doc, List<TemplateField> fields) {
        List<String> errors = new ArrayList<>();
        int pageCount = doc == null ? 0 : doc.getNumberOfPages();

        for (int i = 0; i < fields.size(); i++) {
            TemplateField field = fields.get(i);
            if (field == null) {
                errors.add("fields[" + i + "] is null");
                continue;
            }

            String normalizedType = normalizeFieldType(field.type);
            if (normalizedType == null) {
                errors.add("fields[" + i + "].type '" + String.valueOf(field.type) + "' is not supported for acroform");
            }

            if (field.key == null || field.key.trim().isEmpty()) {
                errors.add("fields[" + i + "].key is required for acroform mode");
            }

            if (field.page < 0 || field.page >= pageCount) {
                errors.add("fields[" + i + "].page must be between 0 and " + Math.max(pageCount - 1, 0));
            }

            if (field.w <= 0 || field.h <= 0) {
                errors.add("fields[" + i + "] must have positive width and height");
            }

            if (("text".equals(normalizedType) || "date".equals(normalizedType)) && !isValidAlign(field.align)) {
                errors.add("fields[" + i + "].align must be left, center, or right");
            }
        }

        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("AcroForm validation failed: " + String.join("; ", errors));
        }
    }

    private static boolean isValidAlign(String align) {
        if (align == null || align.trim().isEmpty()) {
            return true;
        }
        String normalized = align.trim().toLowerCase(Locale.ROOT);
        return "left".equals(normalized) || "center".equals(normalized) || "right".equals(normalized);
    }

    private static String normalizeFieldType(String type) {
        if (type == null || type.trim().isEmpty()) {
            return "text";
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        if ("text".equals(normalized) || "checkbox".equals(normalized) || "date".equals(normalized) || "signature".equals(normalized)) {
            return normalized;
        }
        return null;
    }

    private void storeOutputToTargetIfConfigured(byte[] outputBytes) throws Exception {
        if (outputFileDocument == null) {
            return;
        }
        try (ByteArrayInputStream stream = new ByteArrayInputStream(outputBytes == null ? new byte[0] : outputBytes)) {
            Core.storeFileDocumentContent(getContext(), outputFileDocument, stream);
        } catch (Exception e) {
            throw new IllegalArgumentException(
                "Failed to write generated PDF to outputFileDocument. Ensure it is a specialization of System.FileDocument.",
                e
            );
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TemplateDefinition {
        public List<TemplateField> fields;
        public TemplateMeta meta;
        public String outputMode;
        public String outputPdfMode;

        public static TemplateDefinition fromJson(String json) {
            if (json == null || json.trim().isEmpty()) {
                return new TemplateDefinition();
            }
            try {
                return MAPPER.readValue(json, TemplateDefinition.class);
            } catch (Exception e) {
                throw new IllegalArgumentException("templateJson is invalid JSON.", e);
            }
        }

        @SuppressWarnings("unchecked")
        public static Map<String, Object> parseDataJson(String json) {
            if (json == null || json.trim().isEmpty()) {
                return Collections.emptyMap();
            }
            try {
                return MAPPER.readValue(json, Map.class);
            } catch (Exception e) {
                throw new IllegalArgumentException("dataJson is invalid JSON object.", e);
            }
        }

        public String getOutputMode(Map<String, Object> data) {
            String fromMeta = normalizeMode(meta == null ? null : meta.outputMode);
            if (fromMeta != null) {
                return fromMeta;
            }

            String fromTopLevel = normalizeMode(outputMode);
            if (fromTopLevel != null) {
                return fromTopLevel;
            }

            String fromTopLevelLegacy = normalizeMode(outputPdfMode);
            if (fromTopLevelLegacy != null) {
                return fromTopLevelLegacy;
            }

            if (data != null) {
                String fromData = normalizeMode(String.valueOf(data.getOrDefault("_outputMode", "")));
                if (fromData != null) {
                    return fromData;
                }
            }
            return "flattened";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TemplateMeta {
        public String outputMode;
    }

    private static String normalizeMode(String mode) {
        if (mode == null) {
            return null;
        }
        String normalized = mode.trim().toLowerCase(Locale.ROOT);
        if ("acroform".equals(normalized)) {
            return "acroform";
        }
        if ("flattened".equals(normalized)) {
            return "flattened";
        }
        return null;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TemplateField {
        public String key;
        public String label;
        public boolean showLabel = true;
        public String type;
        public String format;
        public int page;
        public float x;
        public float y;
        public float w;
        public float h;
        public float fontSize;
        public String align;
        public boolean required;
    }
}
