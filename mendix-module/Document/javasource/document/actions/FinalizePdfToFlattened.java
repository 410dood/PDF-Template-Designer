package document.actions;

import com.mendix.core.Core;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.UserAction;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;

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

        try {
            acroForm.refreshAppearances();
        } catch (Exception ignored) {
            // Continue and let PDFBox flatten existing appearances.
        }

        acroForm.flatten();
        doc.getDocumentCatalog().setAcroForm(null);
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
