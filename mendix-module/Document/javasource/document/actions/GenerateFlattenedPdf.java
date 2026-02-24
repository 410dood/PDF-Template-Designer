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
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDSignatureField;
import org.apache.pdfbox.pdmodel.interactive.form.PDTerminalField;

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
public class GenerateFlattenedPdf extends UserAction<byte[]> {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter DEFAULT_DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy", Locale.US);
    private static final DateTimeFormatter DEFAULT_TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.US);
    private static final DateTimeFormatter DEFAULT_DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy HH:mm", Locale.US);
    private static final Pattern MULTI_VARIABLE_TOKEN_PATTERN = Pattern.compile("\\{\\s*([^{}]+?)\\s*\\}");
    private static final float FIELD_TEXT_HORIZONTAL_PADDING = 2f;
    private static final float FIELD_TEXT_VERTICAL_PADDING = 2f;
    private static final float FIELD_TEXT_LINE_HEIGHT_MULTIPLIER = 1.2f;

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
        String labelText = resolveLabelText(field);
        float fontSize = field.fontSize > 0 ? field.fontSize : 10;
        String staticTemplateImage = resolveTemplateStaticImageValue(field);
        if (!"image".equals(normalizedType) && !staticTemplateImage.isEmpty()) {
            // Backward compatibility: render as image when static template image exists,
            // even if type was saved with an older/mismatched value.
            normalizedType = "image";
        }

        if ("checkbox".equals(normalizedType)) {
            if (shouldClearFieldContentArea(field)) {
                clearFieldContentArea(cs, field, x, y, w, h);
            }
            int[] textColor = resolveTextColorRgb(field);
            cs.setStrokingColor(textColor[0], textColor[1], textColor[2]);
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
                if (isVerticalLabelOrientation(field)) {
                    drawLabelText(cs, labelText, x, y + h + 2, Math.max(8, fontSize - 1), textColor);
                } else {
                    drawLabelText(cs, labelText, x + w + 4, y + Math.max(1, (h - fontSize) / 2f), Math.max(8, fontSize), textColor);
                }
            }
            return;
        }

        if ("signature".equals(normalizedType)) {
            if (shouldClearFieldContentArea(field)) {
                clearFieldContentArea(cs, field, x, y, w, h);
            }
            int[] textColor = resolveTextColorRgb(field);
            cs.setStrokingColor(textColor[0], textColor[1], textColor[2]);
            cs.addRect(x, y, w, h);
            cs.stroke();
            if (field.showLabel && !labelText.isEmpty()) {
                if (isVerticalLabelOrientation(field)) {
                    drawLabelText(cs, labelText, x, y + h + 2, Math.max(8, fontSize - 1), textColor);
                } else {
                    drawLabelText(cs, labelText, x + w + 4, y + Math.max(1, (h - fontSize) / 2f), Math.max(8, fontSize), textColor);
                }
            }
            boolean hasDrawnSignature = drawSignatureImage(cs, doc, getSignatureValue(data, field.key), x, y, w, h);
            if (!hasDrawnSignature) {
                cs.beginText();
                cs.setNonStrokingColor(textColor[0], textColor[1], textColor[2]);
                cs.setFont(PDType1Font.HELVETICA_OBLIQUE, Math.max(8, fontSize));
                cs.newLineAtOffset(x + 4, y + h / 2);
                cs.showText("Signature");
                cs.endText();
            }
            return;
        }

        if ("image".equals(normalizedType)) {
            if (shouldClearFieldContentArea(field)) {
                clearFieldContentArea(cs, field, x, y, w, h);
            }
            boolean hasDrawnImage = drawSignatureImage(cs, doc, getImageValue(data, field), x, y, w, h);
            if (!hasDrawnImage) {
                String placeholder = field.showLabel && !labelText.isEmpty() ? labelText : "Image";
                drawBoundedText(cs, placeholder, field, x, y, w, h, Math.max(8, fontSize));
            }
            return;
        }

        String value = getFormattedFieldValue(field, data);
        if (field.showLabel && !labelText.isEmpty()) {
            if (isVerticalLabelOrientation(field)) {
                drawLabelText(cs, labelText, x, y + h + 2, Math.max(8, fontSize - 1), resolveTextColorRgb(field));
            } else {
                value = normalizePdfText(labelText + ": " + value);
            }
        }

        if (shouldClearFieldContentArea(field)) {
            clearFieldContentArea(cs, field, x, y, w, h);
        }
        drawBoundedText(cs, value, field, x, y, w, h, fontSize);
    }

    private static boolean shouldClearFieldContentArea(TemplateField field) {
        return field == null || !field.transparentBackground;
    }

    private static void clearFieldContentArea(PDPageContentStream cs, TemplateField field, float x, float y, float w, float h) throws Exception {
        float inset = 1f;
        float clearX = x + inset;
        float clearY = y + inset;
        float clearW = Math.max(0f, w - inset * 2f);
        float clearH = Math.max(0f, h - inset * 2f);
        if (clearW <= 0f || clearH <= 0f) {
            return;
        }
        cs.saveGraphicsState();
        int[] backgroundColor = resolveBackgroundColorRgb(field);
        cs.setNonStrokingColor(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
        cs.addRect(clearX, clearY, clearW, clearH);
        cs.fill();
        cs.restoreGraphicsState();
    }

    private static void drawBoundedText(PDPageContentStream cs, String value, TemplateField field, float x, float y, float w, float h, float fontSize)
        throws Exception {
        String text = normalizePdfTextPreserveLineBreaks(value);
        if (text.trim().isEmpty()) {
            return;
        }

        float innerX = x + FIELD_TEXT_HORIZONTAL_PADDING;
        float innerY = y + FIELD_TEXT_VERTICAL_PADDING;
        float innerW = Math.max(0f, w - FIELD_TEXT_HORIZONTAL_PADDING * 2f);
        float innerH = Math.max(0f, h - FIELD_TEXT_VERTICAL_PADDING * 2f);
        if (innerW <= 0f || innerH <= 0f) {
            return;
        }

        List<String> wrappedLines = wrapTextToWidth(text, fontSize, innerW);
        if (wrappedLines.isEmpty()) {
            return;
        }

        float lineHeight = Math.max(fontSize, fontSize * FIELD_TEXT_LINE_HEIGHT_MULTIPLIER);
        int maxLines = Math.max(1, (int) Math.floor(innerH / lineHeight));
        if (wrappedLines.size() > maxLines) {
            wrappedLines = new ArrayList<>(wrappedLines.subList(0, maxLines));
            int lastIndex = wrappedLines.size() - 1;
            wrappedLines.set(lastIndex, truncateToWidth(wrappedLines.get(lastIndex), fontSize, innerW));
        }

        float firstBaseline = wrappedLines.size() == 1
            ? y + (h - fontSize) / 2f
            : y + h - FIELD_TEXT_VERTICAL_PADDING - fontSize;

        cs.saveGraphicsState();
        cs.addRect(innerX, innerY, innerW, innerH);
        cs.clip();
        cs.beginText();
        int[] textColor = resolveTextColorRgb(field);
        cs.setNonStrokingColor(textColor[0], textColor[1], textColor[2]);
        cs.setFont(PDType1Font.HELVETICA, fontSize);
        cs.newLineAtOffset(innerX, firstBaseline);

        for (int index = 0; index < wrappedLines.size(); index++) {
            String line = wrappedLines.get(index);
            float lineWidth = measureTextWidth(line, fontSize);
            float alignOffset = 0f;
            if ("center".equals(field.align)) {
                alignOffset = Math.max(0f, (innerW - lineWidth) / 2f);
            } else if ("right".equals(field.align)) {
                alignOffset = Math.max(0f, innerW - lineWidth);
            }
            if (alignOffset > 0f) {
                cs.newLineAtOffset(alignOffset, 0);
            }
            cs.showText(line);
            if (alignOffset > 0f) {
                cs.newLineAtOffset(-alignOffset, 0);
            }
            if (index < wrappedLines.size() - 1) {
                cs.newLineAtOffset(0, -lineHeight);
            }
        }

        cs.endText();
        cs.restoreGraphicsState();
    }

    private static int[] resolveTextColorRgb(TemplateField field) {
        return parseHexColor(field == null ? null : field.textColor, 0, 0, 0);
    }

    private static int[] resolveBackgroundColorRgb(TemplateField field) {
        return parseHexColor(field == null ? null : field.backgroundColor, 255, 255, 255);
    }

    private static int[] parseHexColor(String rawColor, int fallbackR, int fallbackG, int fallbackB) {
        String color = rawColor == null ? "" : rawColor.trim();
        if (color.isEmpty() || "transparent".equalsIgnoreCase(color)) {
            return new int[] { fallbackR, fallbackG, fallbackB };
        }
        if (color.startsWith("#")) {
            color = color.substring(1);
        }
        if (color.length() == 3) {
            color =
                String.valueOf(color.charAt(0)) +
                color.charAt(0) +
                color.charAt(1) +
                color.charAt(1) +
                color.charAt(2) +
                color.charAt(2);
        }
        if (!color.matches("(?i)[0-9a-f]{6}")) {
            return new int[] { fallbackR, fallbackG, fallbackB };
        }
        try {
            int r = Integer.parseInt(color.substring(0, 2), 16);
            int g = Integer.parseInt(color.substring(2, 4), 16);
            int b = Integer.parseInt(color.substring(4, 6), 16);
            return new int[] { r, g, b };
        } catch (Exception ignored) {
            return new int[] { fallbackR, fallbackG, fallbackB };
        }
    }

    private static List<String> wrapTextToWidth(String text, float fontSize, float maxWidth) throws Exception {
        List<String> lines = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return lines;
        }

        String[] paragraphs = text.replace("\r\n", "\n").replace('\r', '\n').split("\n", -1);
        for (String paragraph : paragraphs) {
            String normalizedParagraph = paragraph == null ? "" : paragraph.trim();
            if (normalizedParagraph.isEmpty()) {
                lines.add("");
                continue;
            }

            String[] words = normalizedParagraph.split("\\s+");
            String currentLine = "";
            for (String word : words) {
                if (word == null || word.isEmpty()) {
                    continue;
                }
                String candidate = currentLine.isEmpty() ? word : currentLine + " " + word;
                if (measureTextWidth(candidate, fontSize) <= maxWidth) {
                    currentLine = candidate;
                    continue;
                }

                if (!currentLine.isEmpty()) {
                    lines.add(currentLine);
                    currentLine = "";
                }

                if (measureTextWidth(word, fontSize) <= maxWidth) {
                    currentLine = word;
                    continue;
                }

                List<String> segments = splitTokenToWidth(word, fontSize, maxWidth);
                if (segments.isEmpty()) {
                    continue;
                }
                for (int index = 0; index < segments.size() - 1; index++) {
                    lines.add(segments.get(index));
                }
                currentLine = segments.get(segments.size() - 1);
            }

            if (!currentLine.isEmpty()) {
                lines.add(currentLine);
            }
        }

        if (lines.isEmpty()) {
            lines.add("");
        }
        return lines;
    }

    private static List<String> splitTokenToWidth(String token, float fontSize, float maxWidth) throws Exception {
        List<String> segments = new ArrayList<>();
        if (token == null || token.isEmpty()) {
            return segments;
        }

        StringBuilder current = new StringBuilder();
        for (int index = 0; index < token.length(); index++) {
            char character = token.charAt(index);
            String candidate = current.toString() + character;
            if (measureTextWidth(candidate, fontSize) <= maxWidth || current.length() == 0) {
                current.append(character);
                continue;
            }

            segments.add(current.toString());
            current.setLength(0);
            current.append(character);
        }

        if (current.length() > 0) {
            segments.add(current.toString());
        }
        return segments;
    }

    private static String truncateToWidth(String text, float fontSize, float maxWidth) throws Exception {
        if (text == null) {
            return "";
        }
        if (measureTextWidth(text, fontSize) <= maxWidth) {
            return text;
        }

        final String ellipsis = "...";
        float ellipsisWidth = measureTextWidth(ellipsis, fontSize);
        if (ellipsisWidth > maxWidth) {
            return "";
        }

        int end = text.length();
        while (end > 0) {
            String candidate = text.substring(0, end) + ellipsis;
            if (measureTextWidth(candidate, fontSize) <= maxWidth) {
                return candidate;
            }
            end--;
        }
        return ellipsis;
    }

    private static float measureTextWidth(String text, float fontSize) throws Exception {
        if (text == null || text.isEmpty()) {
            return 0f;
        }
        return PDType1Font.HELVETICA.getStringWidth(text) / 1000f * fontSize;
    }

    private static String resolveLabelText(TemplateField field) {
        if (field == null) {
            return "";
        }
        String label = field.label == null ? "" : field.label.trim();
        return label.isEmpty() ? "" : normalizePdfText(label);
    }

    private static boolean isVerticalLabelOrientation(TemplateField field) {
        if (field == null || field.labelOrientation == null) {
            return false;
        }
        return "vertical".equals(field.labelOrientation.trim().toLowerCase(Locale.ROOT));
    }

    private static void drawLabelText(PDPageContentStream cs, String text, float x, float y, float fontSize, int[] colorRgb) throws Exception {
        if (text == null || text.trim().isEmpty()) {
            return;
        }
        cs.beginText();
        int[] effectiveColor = colorRgb == null ? new int[] { 0, 0, 0 } : colorRgb;
        cs.setNonStrokingColor(effectiveColor[0], effectiveColor[1], effectiveColor[2]);
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

    private static Object getImageValue(Map<String, Object> data, TemplateField field) {
        Object direct = getValue(data, field == null ? null : field.key);
        String normalizedDirect = normalizeSignatureImageDataUrl(extractStringFromUnknown(direct));
        if (!normalizedDirect.isEmpty()) {
            return direct;
        }
        String staticImage = resolveTemplateStaticImageValue(field);
        if (!staticImage.isEmpty()) {
            return staticImage;
        }
        return direct;
    }

    private static String resolveTemplateStaticImageValue(TemplateField field) {
        if (field == null) {
            return "";
        }
        String[] candidates = new String[] { field.imageDataUrl, field.imageData, field.dataUrl, field.src };
        for (String candidate : candidates) {
            String normalized = normalizeSignatureImageDataUrl(candidate);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
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
        if ("multivariabletext".equals(normalizeFieldType(field.type))) {
            return resolveMultiVariableFieldValue(field, data);
        }
        Object rawValue = getValue(data, field.key);
        if (isLikelyImagePayload(rawValue)) {
            // Prevent raw base64/data-url image payloads from being rendered as plain text.
            return "";
        }
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

    private static String resolveMultiVariableFieldValue(TemplateField field, Map<String, Object> data) {
        if (field == null) {
            return "";
        }
        String template = field.variablesSampleData == null ? "" : field.variablesSampleData;
        if (template.trim().isEmpty()) {
            Object fallbackRaw = getValue(data, field.key);
            if (fallbackRaw == null || (isComputedFieldKey(field.key) && isBlankValue(fallbackRaw))) {
                String computed = resolveComputedFieldValue(field);
                return computed == null ? "" : computed;
            }
            return normalizePdfText(String.valueOf(fallbackRaw));
        }

        Matcher matcher = MULTI_VARIABLE_TOKEN_PATTERN.matcher(template);
        StringBuffer buffer = new StringBuffer();
        boolean matched = false;
        while (matcher.find()) {
            matched = true;
            String tokenKey = matcher.group(1) == null ? "" : matcher.group(1).trim();
            String replacement = resolveTemplateTokenValue(data, tokenKey, field.format);
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(replacement));
        }
        if (!matched) {
            return normalizePdfText(template);
        }
        matcher.appendTail(buffer);
        return normalizePdfText(buffer.toString());
    }

    private static String resolveTemplateTokenValue(Map<String, Object> data, String tokenKey, String configuredPattern) {
        if (tokenKey == null || tokenKey.trim().isEmpty()) {
            return "";
        }
        Object rawValue = getValue(data, tokenKey);
        if (isLikelyImagePayload(rawValue)) {
            return "";
        }
        if (rawValue == null || (isComputedFieldKey(tokenKey) && isBlankValue(rawValue))) {
            String computed = resolveComputedFieldValue(tokenKey, configuredPattern);
            if (computed != null) {
                return computed;
            }
        }
        if (rawValue == null) {
            return "";
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
            logSignatureDebug("Signature value could not be normalized to a data URL.");
            return null;
        }

        byte[] bytes = decodeSignatureBytes(text);
        if (bytes == null || bytes.length == 0) {
            logSignatureDebug("Signature value was normalized but base64 decode failed.");
            return null;
        }

        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null) {
                try {
                    return PDImageXObject.createFromByteArray(doc, bytes, "field-image");
                } catch (Exception ignored) {
                    logSignatureDebug("Image bytes decoded but parser returned null and direct PDFBox decode failed.");
                    return null;
                }
            }
            return LosslessFactory.createFromImage(doc, image);
        } catch (Exception ignored) {
            try {
                return PDImageXObject.createFromByteArray(doc, bytes, "field-image");
            } catch (Exception ignoredAgain) {
                logSignatureDebug("Signature image creation failed: " + ignored.getMessage());
                return null;
            }
        }
    }

    private static void logSignatureDebug(String message) {
        try {
            Core.getLogger("PdfTemplateDesigner").warn("[GenerateFlattenedPdf] " + message);
        } catch (Exception ignored) {
            // Logging should never block PDF generation.
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
            payload = URLDecoder.decode(payload, StandardCharsets.UTF_8).replaceAll("\\s+", "");
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
            String text = ((String) value).trim();
            if (text.isEmpty()) {
                return text;
            }

            // Some pipelines persist signature payload as serialized JSON text.
            if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
                try {
                    Object parsed = MAPPER.readValue(text, Object.class);
                    String extracted = extractStringFromUnknown(parsed);
                    if (!isBlankValue(extracted)) {
                        return extracted;
                    }
                } catch (Exception ignored) {
                    // Keep original text fallback.
                }
            }

            // Some payloads are JSON-escaped strings, e.g. "\"data:image/png;base64,...\""
            if (text.startsWith("\"") && text.endsWith("\"")) {
                try {
                    String unescaped = MAPPER.readValue(text, String.class);
                    if (!isBlankValue(unescaped)) {
                        return unescaped;
                    }
                } catch (Exception ignored) {
                    // Keep original text fallback.
                }
            }

            return text;
        }
        if (value instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) value;
            String[] candidateKeys = new String[] {
                "value", "dataUrl", "imageData", "signature", "signatureData", "result", "data", "base64", "src", "url", "content", "fileData", "fileContent"
            };
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

    private static boolean isLikelyImagePayload(Object value) {
        String extracted = extractStringFromUnknown(value);
        if (isBlankValue(extracted)) {
            return false;
        }
        String text = extracted.trim();
        if (text.isEmpty()) {
            return false;
        }
        if (text.regionMatches(true, 0, "data:image/", 0, "data:image/".length())) {
            return true;
        }
        if (text.matches("(?i)^image/\\w+;base64,.*$")) {
            return true;
        }
        // Heuristic for raw base64 payloads (no data URL prefix).
        String compact = text.replaceAll("\\s+", "");
        return compact.length() >= 256 && compact.matches("^[A-Za-z0-9+/=_-]+$");
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
        return resolveComputedFieldValue(field.key, field.format);
    }

    private static String resolveComputedFieldValue(String key, String configuredPattern) {
        if (key == null) {
            return null;
        }
        String normalizedKey = key.trim().toLowerCase(Locale.ROOT);
        if (normalizedKey.isEmpty()) {
            return null;
        }

        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        if ("__currentdate".equals(normalizedKey) || "__today".equals(normalizedKey)) {
            LocalDate currentDate = LocalDate.now(zone);
            return formatDateLikeValue(currentDate, configuredPattern);
        }
        if ("__currenttime".equals(normalizedKey) || "__nowtime".equals(normalizedKey)) {
            java.time.LocalTime currentTime = java.time.LocalTime.now(zone);
            DateTimeFormatter formatter = resolveTimeFormatter(configuredPattern);
            return normalizePdfText(formatter.format(currentTime));
        }
        if ("__currentdatetime".equals(normalizedKey) || "__now".equals(normalizedKey)) {
            LocalDateTime currentDateTime = LocalDateTime.now(zone);
            DateTimeFormatter formatter = resolveDateTimeFormatter(configuredPattern);
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

    private static String normalizePdfTextPreserveLineBreaks(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return value.replace("\r\n", "\n").replace('\r', '\n').replace('\t', ' ');
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
        String fallback = normalizePdfText(String.valueOf(value));
        String pattern = configuredPattern == null ? "" : configuredPattern.trim();
        if (pattern.isEmpty()) {
            pattern = "MM/dd/yyyy";
        }

        boolean hasDateTokens = patternContainsDate(pattern);
        boolean hasTimeTokens = patternContainsTime(pattern);

        if (hasDateTokens && hasTimeTokens) {
            LocalDateTime parsedDateTime = tryParseDateTime(value);
            if (parsedDateTime == null) {
                LocalDate parsedDate = tryParseDate(value);
                if (parsedDate != null) {
                    parsedDateTime = parsedDate.atStartOfDay();
                }
            }
            if (parsedDateTime == null) {
                return fallback;
            }
            DateTimeFormatter formatter = resolveDateTimeFormatter(pattern);
            try {
                return normalizePdfText(formatter.format(parsedDateTime));
            } catch (Exception ignored) {
                return fallback;
            }
        }

        if (hasTimeTokens && !hasDateTokens) {
            LocalTime parsedTime = tryParseTime(value);
            if (parsedTime == null) {
                LocalDateTime parsedDateTime = tryParseDateTime(value);
                if (parsedDateTime != null) {
                    parsedTime = parsedDateTime.toLocalTime();
                }
            }
            if (parsedTime == null) {
                return fallback;
            }
            DateTimeFormatter formatter = resolveTimeFormatter(pattern);
            try {
                return normalizePdfText(formatter.format(parsedTime));
            } catch (Exception ignored) {
                return fallback;
            }
        }

        LocalDate parsedDate = tryParseDate(value);
        if (parsedDate == null) {
            LocalDateTime parsedDateTime = tryParseDateTime(value);
            if (parsedDateTime != null) {
                parsedDate = parsedDateTime.toLocalDate();
            }
        }
        if (parsedDate == null) {
            return fallback;
        }
        DateTimeFormatter formatter = resolveDateFormatter(pattern);
        try {
            return normalizePdfText(formatter.format(parsedDate));
        } catch (Exception ignored) {
            return fallback;
        }
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
            Long epochMillis = parseEpochMillisIfNumericText(text);
            if (epochMillis != null) {
                return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
            }
        }

        return null;
    }

    private static LocalDateTime tryParseDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime) {
            return (LocalDateTime) value;
        }
        if (value instanceof LocalDate) {
            return ((LocalDate) value).atStartOfDay();
        }
        if (value instanceof java.util.Date) {
            return Instant.ofEpochMilli(((java.util.Date) value).getTime()).atZone(ZoneOffset.UTC).toLocalDateTime();
        }
        if (value instanceof Number) {
            return Instant.ofEpochMilli(((Number) value).longValue()).atZone(ZoneOffset.UTC).toLocalDateTime();
        }

        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }

        try {
            return OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return Instant.parse(text).atZone(ZoneOffset.UTC).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalDate.parse(text, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }

        if (text.matches("^-?\\d{10,17}$")) {
            Long epochMillis = parseEpochMillisIfNumericText(text);
            if (epochMillis != null) {
                return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDateTime();
            }
        }

        return null;
    }

    private static LocalTime tryParseTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalTime) {
            return (LocalTime) value;
        }
        if (value instanceof java.util.Date) {
            return Instant.ofEpochMilli(((java.util.Date) value).getTime()).atZone(ZoneOffset.UTC).toLocalTime();
        }
        if (value instanceof Number) {
            return Instant.ofEpochMilli(((Number) value).longValue()).atZone(ZoneOffset.UTC).toLocalTime();
        }

        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }

        try {
            return LocalTime.parse(text, DateTimeFormatter.ISO_LOCAL_TIME);
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toLocalTime();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return Instant.parse(text).atZone(ZoneOffset.UTC).toLocalTime();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toLocalTime();
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalTime.parse(text, DateTimeFormatter.ofPattern("HH:mm", Locale.US));
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalTime.parse(text, DateTimeFormatter.ofPattern("HH:mm:ss", Locale.US));
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalTime.parse(text, DateTimeFormatter.ofPattern("h:mm a", Locale.US));
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }
        try {
            return LocalTime.parse(text, DateTimeFormatter.ofPattern("hh:mm a", Locale.US));
        } catch (DateTimeParseException ignored) {
            // Try next format.
        }

        return null;
    }

    private static Long parseEpochMillisIfNumericText(String text) {
        if (text == null) {
            return null;
        }
        try {
            long epoch = Long.parseLong(text);
            if (text.length() == 10) {
                epoch = epoch * 1000L;
            }
            return epoch;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static boolean patternContainsDate(String pattern) {
        if (pattern == null || pattern.trim().isEmpty()) {
            return true;
        }
        String normalized = stripQuotedPatternTokens(pattern);
        return normalized.matches(".*[yYMdD].*");
    }

    private static boolean patternContainsTime(String pattern) {
        if (pattern == null || pattern.trim().isEmpty()) {
            return false;
        }
        String normalized = stripQuotedPatternTokens(pattern);
        return normalized.matches(".*[HhKkmsS].*");
    }

    private static String stripQuotedPatternTokens(String pattern) {
        StringBuilder builder = new StringBuilder();
        boolean inQuote = false;
        for (int index = 0; index < pattern.length(); index++) {
            char current = pattern.charAt(index);
            if (current == '\'') {
                inQuote = !inQuote;
                continue;
            }
            if (!inQuote) {
                builder.append(current);
            }
        }
        return builder.toString();
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

    private static String normalizeFieldType(String type) {
        if (type == null || type.trim().isEmpty()) {
            return "text";
        }
        String normalized = type.trim().toLowerCase(Locale.ROOT);
        if ("multivariabletext".equals(normalized) || "multi_variable_text".equals(normalized) || "multi-variable-text".equals(normalized)) {
            return "multivariabletext";
        }
        if ("text".equals(normalized) || "checkbox".equals(normalized) || "date".equals(normalized) || "signature".equals(normalized)
            || "select".equals(normalized) || "radio".equals(normalized) || "image".equals(normalized)) {
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

    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TemplateField {
        public String key;
        public String label;
        public String variablesSampleData;
        public List<String> options;
        public String imageDataUrl;
        // Legacy/alternate static image property names that may exist in stored template JSON.
        public String imageData;
        public String dataUrl;
        public String src;
        public String labelOrientation;
        public String optionsOrientation;
        public boolean showLabel = true;
        public boolean transparentBackground = false;
        public String textColor;
        public String backgroundColor;
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
