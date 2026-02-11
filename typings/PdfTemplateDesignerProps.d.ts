/**
 * This file was generated from PdfTemplateDesigner.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { DynamicValue, ListValue, ListActionValue, ListAttributeValue, ListReferenceValue } from "mendix";

export interface PdfTemplateDesignerContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    dataSource: ListValue;
    templateJsonAttr: ListAttributeValue<string>;
    basePdfOptionsSource?: ListValue;
    basePdfAssociation: ListReferenceValue;
    pdfJsWorkerUrl?: DynamicValue<string>;
    pdfJsScriptUrl?: DynamicValue<string>;
    showShortcutHints?: boolean;
    enableKeyboardShortcuts?: boolean;
    onChangeAction?: ListActionValue;
    onSaveAction?: ListActionValue;
}

export interface PdfTemplateDesignerPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    dataSource: {} | { caption: string } | { type: string } | null;
    templateJsonAttr: string;
    basePdfOptionsSource: {} | { caption: string } | { type: string } | null;
    basePdfAssociation: string;
    pdfJsWorkerUrl: string;
    pdfJsScriptUrl: string;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    onChangeAction: {} | null;
    onSaveAction: {} | null;
}
