package document.actions;

import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import com.mendix.systemwideinterfaces.core.UserAction;

/**
 * Backward-compatible wrapper.
 * Keeps the legacy delegate Java action signature but routes execution
 * through GenerateFlattenedPdf so behavior lives in one implementation.
 */
public class GenerateFlattenedPdfDelegate extends UserAction<byte[]> {
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
        return new GenerateFlattenedPdf(getContext(), basePdf, templateJson, dataJson, outputFileDocument).executeAction();
    }

    @Override
    public String toString() {
        return "GenerateFlattenedPdf";
    }
}
