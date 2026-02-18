package document.actions;

import com.mendix.core.Core;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.UserAction;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPageContentStream.AppendMode;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDSignatureField;
import org.apache.pdfbox.pdmodel.interactive.form.PDTerminalField;

/**
 * Finalize an editable PDF by flattening all AcroForm fields.
 * This makes the document non-editable.
 */
public class FinalizePdfToFlattened extends UserAction<byte[]> {
    private final IMendixObject inputPdf;
    private final IMendixObject outputFileDocument;

    public FinalizePdfToFlattened(IContext context, IMendixObject inputPdf) {
        this(context, inputPdf, null);
    }

    public FinalizePdfToFlattened(IContext context, IMendixObject inputPdf, IMendixObject outputFileDocument) {
        super(context);
        this.inputPdf = inputPdf;
        this.outputFileDocument = outputFileDocument;
    }

    @Override
    public byte[] executeAction() throws Exception {
        if (inputPdf == null) {
            return new byte[0];
        }

        byte[] inputBytes;
        try (java.io.InputStream sourceStream = Core.getFileDocumentContent(getContext(), inputPdf)) {
            if (sourceStream == null) {
                throw new IllegalArgumentException("Input PDF stream is empty.");
            }
            inputBytes = readAllBytes(sourceStream);
        }
        if (inputBytes == null || inputBytes.length == 0) {
            throw new IllegalArgumentException("Input PDF is empty.");
        }

        byte[] outputBytes;
        try (PDDocument doc = PDDocument.load(inputBytes)) {
            flattenAcroFormIfPresent(doc);
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                doc.save(out);
                outputBytes = out.toByteArray();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to finalize PDF: " + e.getMessage(), e);
        }

        if (outputFileDocument != null) {
            try (java.io.ByteArrayInputStream stream = new java.io.ByteArrayInputStream(outputBytes == null ? new byte[0] : outputBytes)) {
                Core.storeFileDocumentContent(getContext(), outputFileDocument, stream);
            }
        }
        return outputBytes;
    }

    private static void flattenAcroFormIfPresent(PDDocument doc) throws Exception {
        if (doc == null || doc.getDocumentCatalog() == null) {
            return;
        }

        PDAcroForm acroForm = doc.getDocumentCatalog().getAcroForm();
        if (acroForm == null) {
            return;
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
            // Do not block flattening if appearance refresh fails in a specific runtime.
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
        return "FinalizePdfToFlattened";
    }
}
