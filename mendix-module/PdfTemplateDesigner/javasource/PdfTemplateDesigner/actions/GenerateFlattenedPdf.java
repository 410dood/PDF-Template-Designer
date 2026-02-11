package PdfTemplateDesigner.actions;

import com.mendix.core.Core;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.UserAction;

import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Generate a flattened PDF by drawing values onto the base PDF.
 * Uses PDFBox (Apache 2.0) and Jackson (Apache 2.0). Add both JARs to userlib.
 */
public class GenerateFlattenedPdf extends UserAction<byte[]> {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final IMendixObject basePdf;
    private final String templateJson;
    private final String dataJson;

    public GenerateFlattenedPdf(IContext context, IMendixObject basePdf, String templateJson, String dataJson) {
        super(context);
        this.basePdf = basePdf;
        this.templateJson = templateJson;
        this.dataJson = dataJson;
    }

    @Override
    public byte[] executeAction() throws Exception {
        if (basePdf == null) {
            return new byte[0];
        }

        byte[] baseBytes = Core.getFileDocumentContent(getContext(), basePdf);
        TemplateDefinition template = TemplateDefinition.fromJson(templateJson);
        Map<String, Object> data = TemplateDefinition.parseDataJson(dataJson);

        if (template == null || template.fields == null || template.fields.isEmpty()) {
            return baseBytes;
        }

        try (PDDocument doc = PDDocument.load(baseBytes)) {
            for (TemplateField field : template.fields) {
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
                float x = field.x;
                float yTop = field.y;
                float w = field.w;
                float h = field.h;
                // Template uses top-left origin. PDF uses bottom-left origin.
                float y = pageHeight - yTop - h;

                try (PDPageContentStream cs = new PDPageContentStream(doc, page, AppendMode.APPEND, true, true)) {
                    renderField(cs, field, data, x, y, w, h);
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Override
    public String toString() {
        return "GenerateFlattenedPdf";
    }

    private static void renderField(PDPageContentStream cs, TemplateField field, Map<String, Object> data, float x, float y, float w, float h)
        throws Exception {
        String value = data != null && field.key != null ? String.valueOf(data.getOrDefault(field.key, "")) : "";
        float fontSize = field.fontSize > 0 ? field.fontSize : 10;

        if ("checkbox".equals(field.type)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            if (isTruthy(data, field.key)) {
                cs.moveTo(x + 2, y + 2);
                cs.lineTo(x + w - 2, y + h - 2);
                cs.moveTo(x + 2, y + h - 2);
                cs.lineTo(x + w - 2, y + 2);
                cs.stroke();
            }
            return;
        }

        if ("signature".equals(field.type)) {
            cs.addRect(x, y, w, h);
            cs.stroke();
            cs.beginText();
            cs.setFont(PDType1Font.HELVETICA_OBLIQUE, Math.max(8, fontSize));
            cs.newLineAtOffset(x + 4, y + h / 2);
            cs.showText("Signature");
            cs.endText();
            return;
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

    private static boolean isTruthy(Map<String, Object> data, String key) {
        if (data == null || key == null) {
            return false;
        }
        Object value = data.get(key);
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value == null) {
            return false;
        }
        String text = String.valueOf(value).trim();
        return "true".equalsIgnoreCase(text) || "1".equals(text) || "yes".equalsIgnoreCase(text);
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
                return new TemplateDefinition();
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
                return Collections.emptyMap();
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TemplateField {
        public String key;
        public String type;
        public int page;
        public float x;
        public float y;
        public float w;
        public float h;
        public float fontSize;
        public String align;
    }
}
