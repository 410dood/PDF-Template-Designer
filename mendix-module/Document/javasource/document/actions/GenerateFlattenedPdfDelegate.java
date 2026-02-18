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
import java.util.Base64;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
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
 * Runtime path is always flattened overlay output:
 * 1) flatten existing AcroForm fields when present
 * 2) render template fields from DataJson onto the document
 *
 * Uses PDFBox (Apache 2.0) and Jackson (Apache 2.0). Add both JARs to userlib.
 */
public class GenerateFlattenedPdfDelegate extends UserAction<byte[]> {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter DEFAULT_DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US);
    private static final DateTimeFormatter DEFAULT_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.US);
    private static final DateTimeFormatter DEFAULT_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm", Locale.US);

    private final IMendixObject basePdf;
    private final IMendixObject outputFileDocument;
    private final String templateJson;
    private final String dataJson;

    public GenerateFlattenedPdfDelegate(IContext context, IMendixObject basePdf, String templateJson, String dataJson) {
        this(context, basePdf, templateJson, dataJson, null);
    }

    public GenerateFlattenedPdfDelegate(
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

        byte[] baseBytes;
        try (java.io.InputStream sourceStream = Core.getFileDocumentContent(getContext(), basePdf)) {
            if (sourceStream == null) {
                throw new IllegalArgumentException("Base PDF file stream is empty.");
            }
            baseBytes = readAllBytes(sourceStream);
        }
        if (baseBytes == null || baseBytes.length == 0) {
            throw new IllegalArgumentException("Base PDF file is empty.");
        }

        TemplateDefinition template = TemplateDefinition.fromJson(templateJson);
        Map<String, Object> data = TemplateDefinition.parseDataJson(dataJson);
        boolean hasTemplateFields = template != null && template.fields != null && !template.fields.isEmpty();

        byte[] outputBytes;
        try (PDDocument doc = openPdfOrImage(baseBytes)) {
            flattenExistingAcroForm(doc);
            if (hasTemplateFields) {
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
                renderField(doc, cs, field, data, x, y, w, h);
            }
        }
    }

    private static void applyAcroFormFields(PDDocument doc, List<TemplateField> fields, Map<String, Object> data) throws Exception {
        PDAcroForm acroForm = getOrCreateAcroForm(doc);
        Set<String> usedNames = new HashSet<>();
        boolean hasSignatureField = false;
        List<PDField> fieldsForAppearanceRefresh = new ArrayList<>();
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
            String normalizedType = normalizeFieldType(field.type);
            Object signatureRawValue = "signature".equals(normalizedType) ? getSignatureValue(data, field.key) : null;
            String baseName = normalizeFieldName(field.key);
            String fieldName = nextUniqueFieldName(baseName, usedNames);
            PDField acroField = createAcroField(doc, acroForm, field, fieldName, page, x, y, w, h, signatureRawValue);
            if (acroField == null) {
                continue;
            }

            if (field.required) {
                acroField.setRequired(true);
            }

            acroForm.getFields().add(acroField);
            applyAcroFieldValue(acroField, field, data);
            if ("signature".equals(normalizedType)) {
                hasSignatureField = true;
            } else {
                fieldsForAppearanceRefresh.add(acroField);
            }
        }

        if (hasSignatureField) {
            acroForm.setSignaturesExist(true);
            // Hint to PDF readers to apply incremental updates for signing.
            acroForm.setAppendOnly(true);
        }
        refreshAcroFormAppearances(acroForm, fieldsForAppearanceRefresh);
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
        // Generate concrete appearance streams so values render as field values (not hint-like placeholders).
        acroForm.setNeedAppearances(false);
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
        float h,
        Object signatureRawValue
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
            drawSignaturePlaceholder(doc, page, x, y, w, h, templateField.label, signatureRawValue);
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

    private static void drawSignaturePlaceholder(
        PDDocument doc,
        PDPage page,
        float x,
        float y,
        float w,
        float h,
        String label,
        Object signatureRawValue
    ) throws Exception {
        String placeholder = (label == null || label.trim().isEmpty()) ? "Sign here" : label.trim();
        try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            boolean hasDrawnSignature = drawSignatureImage(cs, doc, signatureRawValue, x, y, w, h);
            if (!hasDrawnSignature) {
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA_OBLIQUE, 9f);
                cs.newLineAtOffset(x + 4f, y + Math.max(4f, h / 2f - 3f));
                cs.showText(normalizePdfText(placeholder));
                cs.endText();
            }
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

    private static boolean flattenExistingAcroForm(PDDocument doc) throws Exception {
        if (doc == null || doc.getDocumentCatalog() == null) {
            return false;
        }

        PDAcroForm acroForm = doc.getDocumentCatalog().getAcroForm();
        if (acroForm == null) {
            return false;
        }

        List<PDField> fieldsForAppearanceRefresh = new ArrayList<>();
        for (PDField field : acroForm.getFieldTree()) {
            if (field == null || field instanceof PDSignatureField) {
                continue;
            }
            fieldsForAppearanceRefresh.add(field);
        }

        if (!fieldsForAppearanceRefresh.isEmpty()) {
            for (PDField field : fieldsForAppearanceRefresh) {
                field.getCOSObject().removeItem(COSName.DV);
                if (!(field instanceof PDTerminalField)) {
                    continue;
                }
                clearWidgetContentAreas(doc, (PDTerminalField) field);
                for (PDAnnotationWidget widget : ((PDTerminalField) field).getWidgets()) {
                    if (widget != null && widget.getCOSObject() != null) {
                        widget.getCOSObject().removeItem(COSName.AP);
                    }
                }
            }

            refreshAcroFormAppearances(acroForm, fieldsForAppearanceRefresh);
        }

        acroForm.flatten();
        doc.getDocumentCatalog().setAcroForm(null);
        return true;
    }

    private static void clearWidgetContentAreas(PDDocument doc, PDTerminalField terminalField) {
        if (doc == null || terminalField == null || terminalField.getWidgets() == null) {
            return;
        }

        for (PDAnnotationWidget widget : terminalField.getWidgets()) {
            if (widget == null || widget.getRectangle() == null) {
                continue;
            }

            PDPage page = widget.getPage();
            if (page == null) {
                continue;
            }

            PDRectangle rect = widget.getRectangle();
            float inset = 1f;
            float clearX = rect.getLowerLeftX() + inset;
            float clearY = rect.getLowerLeftY() + inset;
            float clearW = Math.max(0f, rect.getWidth() - inset * 2f);
            float clearH = Math.max(0f, rect.getHeight() - inset * 2f);
            if (clearW <= 0f || clearH <= 0f) {
                continue;
            }

            try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
                cs.saveGraphicsState();
                cs.setNonStrokingColor(255, 255, 255);
                cs.addRect(clearX, clearY, clearW, clearH);
                cs.fill();
                cs.restoreGraphicsState();
            } catch (Exception ignored) {
                // Do not block flattening if a widget/page cannot be cleared in a specific runtime.
            }
        }
    }

    private static void refreshAcroFormAppearances(PDAcroForm acroForm, List<PDField> fieldsForAppearanceRefresh) {
        if (acroForm == null) {
            return;
        }
        acroForm.setNeedAppearances(false);
        try {
            if (fieldsForAppearanceRefresh != null && !fieldsForAppearanceRefresh.isEmpty()) {
                try {
                    // PDFBox 2.0.x overload that lets us skip signature fields.
                    java.lang.reflect.Method refreshSubset = PDAcroForm.class.getMethod("refreshAppearances", List.class);
                    refreshSubset.invoke(acroForm, fieldsForAppearanceRefresh);
                    return;
                } catch (NoSuchMethodException ignored) {
                    // Fallback to full refresh below.
                }
            }
            acroForm.refreshAppearances();
        } catch (Exception ignored) {
            // Do not block generation if appearance refresh fails in a specific reader/runtime.
        }
    }

    private static byte[] readAllBytes(java.io.InputStream inputStream) throws Exception {
        try (ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            byte[] chunk = new byte[8192];
            int read;
            while ((read = inputStream.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            return buffer.toByteArray();
        }
    }

    @Override
    public String toString() {
        return "GenerateFlattenedPdf";
    }

    private static void renderField(PDDocument doc, PDPageContentStream cs, TemplateField field, Map<String, Object> data, float x, float y, float w, float h)
        throws Exception {
        String normalizedType = normalizeFieldType(field.type);
        String value = getFormattedFieldValue(field, data);
        String labelText = resolveLabelText(field);
        float fontSize = field.fontSize > 0 ? field.fontSize : 10;

        if ("checkbox".equals(normalizedType)) {
            clearFieldContentArea(cs, x, y, w, h);
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
            clearFieldContentArea(cs, x, y, w, h);
            cs.addRect(x, y, w, h);
            cs.stroke();
            if (field.showLabel && !labelText.isEmpty()) {
                drawLabelText(cs, labelText, x, y + h + 2, Math.max(8, fontSize - 1));
            }
            boolean hasDrawnSignature = drawSignatureImage(cs, doc, getSignatureValue(data, field.key), x, y, w, h);
            if (!hasDrawnSignature) {
                cs.beginText();
                cs.setFont(PDType1Font.HELVETICA_OBLIQUE, Math.max(8, fontSize));
                cs.newLineAtOffset(x + 4, y + h / 2);
                cs.showText("Signature");
                cs.endText();
            }
            return;
        }

        if (field.showLabel && !labelText.isEmpty()) {
            value = normalizePdfText(labelText + ": " + value);
        }

        clearFieldContentArea(cs, x, y, w, h);
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

    private static void clearFieldContentArea(PDPageContentStream cs, float x, float y, float w, float h) throws Exception {
        float inset = 1f;
        float clearX = x + inset;
        float clearY = y + inset;
        float clearW = Math.max(0f, w - inset * 2f);
        float clearH = Math.max(0f, h - inset * 2f);
        if (clearW <= 0f || clearH <= 0f) {
            return;
        }
        cs.saveGraphicsState();
        cs.setNonStrokingColor(255, 255, 255);
        cs.addRect(clearX, clearY, clearW, clearH);
        cs.fill();
        cs.restoreGraphicsState();
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

    private static Object getSignatureValue(Map<String, Object> data, String key) {
        Object direct = getValue(data, key);
        if (!isBlankValue(extractStringFromUnknown(direct))) {
            return direct;
        }

        Object fallback = getValue(data, "__signature");
        if (!isBlankValue(extractStringFromUnknown(fallback))) {
            return fallback;
        }
        Object anySignatureLike = findAnySignatureLikeValue(data);
        if (anySignatureLike != null) {
            return anySignatureLike;
        }
        return direct;
    }

    private static Object findAnySignatureLikeValue(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (entry == null) {
                continue;
            }
            String normalized = normalizeSignatureImageDataUrl(extractStringFromUnknown(entry.getValue()));
            if (!normalized.isEmpty()) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static String getFormattedFieldValue(TemplateField field, Map<String, Object> data) {
        if (field == null) {
            return "";
        }
        Object rawValue = getValue(data, field.key);
        if (rawValue == null || (isComputedFieldKey(field.key) && isBlankValue(rawValue))) {
            String computedValue = resolveComputedFieldValue(field);
            if (computedValue != null) {
                return computedValue;
            }
            if (rawValue == null) {
                return "";
            }
        }

        if ("date".equals(normalizeFieldType(field.type))) {
            return formatDateLikeValue(rawValue, field.format);
        }
        return normalizePdfText(String.valueOf(rawValue));
    }

    private static boolean drawSignatureImage(PDPageContentStream cs, PDDocument doc, Object rawValue, float x, float y, float w, float h)
        throws Exception {
        PDImageXObject imageXObject = toSignatureImage(doc, rawValue);
        if (imageXObject == null) {
            return false;
        }

        float availableW = Math.max(0f, w - 4f);
        float availableH = Math.max(0f, h - 4f);
        if (availableW <= 0f || availableH <= 0f) {
            return false;
        }

        float imageW = Math.max(1f, imageXObject.getWidth());
        float imageH = Math.max(1f, imageXObject.getHeight());
        float scale = Math.min(availableW / imageW, availableH / imageH);
        float drawW = imageW * scale;
        float drawH = imageH * scale;
        float drawX = x + (w - drawW) / 2f;
        float drawY = y + (h - drawH) / 2f;
        cs.drawImage(imageXObject, drawX, drawY, drawW, drawH);
        return true;
    }

    private static PDImageXObject toSignatureImage(PDDocument doc, Object rawValue) {
        if (doc == null || rawValue == null) {
            return null;
        }
        String text = normalizeSignatureImageDataUrl(extractStringFromUnknown(rawValue));
        if (text.isEmpty()) {
            return null;
        }

        byte[] bytes = decodeSignatureBytes(text);
        if (bytes == null || bytes.length == 0) {
            return null;
        }

        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                return null;
            }
            return LosslessFactory.createFromImage(doc, image);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static byte[] decodeSignatureBytes(String text) {
        if (text == null) {
            return null;
        }
        String payload = text.trim();
        if (payload.isEmpty()) {
            return null;
        }

        if (payload.regionMatches(true, 0, "data:", 0, 5)) {
            int commaIndex = payload.indexOf(',');
            if (commaIndex < 0) {
                return null;
            }
            String metadata = payload.substring(5, commaIndex).toLowerCase(Locale.ROOT);
            if (!metadata.contains(";base64")) {
                return null;
            }
            payload = payload.substring(commaIndex + 1);
        }

        payload = payload.replaceAll("\\s+", "");
        if (payload.isEmpty()) {
            return null;
        }

        if (payload.contains("%")) {
            payload = URLDecoder.decode(payload, StandardCharsets.UTF_8.name()).replaceAll("\\s+", "");
        }

        try {
            return Base64.getMimeDecoder().decode(payload);
        } catch (IllegalArgumentException ignored) {
            try {
                return Base64.getUrlDecoder().decode(payload);
            } catch (IllegalArgumentException ignoredAgain) {
                return null;
            }
        }
    }

    private static String extractStringFromUnknown(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String) {
            return (String) value;
        }
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            String[] candidateKeys = new String[] { "value", "dataUrl", "imageData", "signature", "result", "data" };
            for (String key : candidateKeys) {
                if (!map.containsKey(key)) {
                    continue;
                }
                String extracted = extractStringFromUnknown(map.get(key));
                if (!isBlankValue(extracted)) {
                    return extracted;
                }
            }
            return null;
        }
        return String.valueOf(value);
    }

    private static String normalizeSignatureImageDataUrl(String value) {
        if (value == null) {
            return "";
        }

        String normalized = value.trim().replaceAll("^['\"]+|['\"]+$", "");
        if (normalized.isEmpty()) {
            return "";
        }

        if (normalized.regionMatches(true, 0, "data:image/", 0, "data:image/".length())) {
            return normalized;
        }

        if (normalized.matches("(?i)^image/\\w+;base64,.*$")) {
            return "data:" + normalized;
        }

        int commaIndex = normalized.indexOf(',');
        String candidateBase64 = commaIndex >= 0 && normalized.substring(0, commaIndex).toLowerCase(Locale.ROOT).contains("base64")
            ? normalized.substring(commaIndex + 1)
            : normalized;
        String compactBase64 = candidateBase64.replaceAll("\\s+", "");
        if (compactBase64.matches("^[A-Za-z0-9+/=_-]+$")) {
            return "data:image/png;base64," + compactBase64;
        }
        return "";
    }

    private static boolean isBlankValue(Object value) {
        if (value == null) {
            return true;
        }
        if (value instanceof String) {
            return ((String) value).trim().isEmpty();
        }
        return false;
    }

    private static boolean isComputedFieldKey(String key) {
        if (key == null) {
            return false;
        }
        String normalizedKey = key.trim().toLowerCase(Locale.ROOT);
        if (normalizedKey.isEmpty()) {
            return false;
        }
        return "__currentdate".equals(normalizedKey)
            || "__today".equals(normalizedKey)
            || "__currenttime".equals(normalizedKey)
            || "__nowtime".equals(normalizedKey)
            || "__currentdatetime".equals(normalizedKey)
            || "__now".equals(normalizedKey);
    }

    private static String resolveComputedFieldValue(TemplateField field) {
        if (field == null || field.key == null) {
            return null;
        }
        String normalizedKey = field.key.trim().toLowerCase(Locale.ROOT);
        if (normalizedKey.isEmpty()) {
            return null;
        }

        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        if ("__currentdate".equals(normalizedKey) || "__today".equals(normalizedKey)) {
            LocalDate currentDate = LocalDate.now(zone);
            return formatDateLikeValue(currentDate, field.format);
        }
        if ("__currenttime".equals(normalizedKey) || "__nowtime".equals(normalizedKey)) {
            java.time.LocalTime currentTime = java.time.LocalTime.now(zone);
            DateTimeFormatter formatter = resolveTimeFormatter(field.format);
            return normalizePdfText(formatter.format(currentTime));
        }
        if ("__currentdatetime".equals(normalizedKey) || "__now".equals(normalizedKey)) {
            LocalDateTime currentDateTime = LocalDateTime.now(zone);
            DateTimeFormatter formatter = resolveDateTimeFormatter(field.format);
            return normalizePdfText(formatter.format(currentDateTime));
        }
        return null;
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

    private static DateTimeFormatter resolveTimeFormatter(String configuredPattern) {
        if (configuredPattern == null || configuredPattern.trim().isEmpty()) {
            return DEFAULT_TIME_FORMATTER;
        }
        try {
            return DateTimeFormatter.ofPattern(configuredPattern.trim(), Locale.US);
        } catch (IllegalArgumentException ignored) {
            return DEFAULT_TIME_FORMATTER;
        }
    }

    private static DateTimeFormatter resolveDateTimeFormatter(String configuredPattern) {
        if (configuredPattern == null || configuredPattern.trim().isEmpty()) {
            return DEFAULT_DATE_TIME_FORMATTER;
        }
        try {
            return DateTimeFormatter.ofPattern(configuredPattern.trim(), Locale.US);
        } catch (IllegalArgumentException ignored) {
            return DEFAULT_DATE_TIME_FORMATTER;
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

