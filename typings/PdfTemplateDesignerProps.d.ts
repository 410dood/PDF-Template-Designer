/**
 * This file was generated from PdfTemplateDesigner.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, DynamicValue, EditableValue, ListValue, ListAttributeValue, ReferenceValue } from "mendix";
import { Big } from "big.js";

export interface DataSourceType {
    templateJsonAttr: EditableValue<string>;
    basePdfOptionsSource?: ListValue;
    basePdfAssociation: ReferenceValue;
    onChangeAction?: ActionValue;
    onSaveAction?: ActionValue;
}

export type FieldKeySourceModeEnum = "manual" | "datasource" | "json";

export interface DataSourcePreviewType {
    templateJsonAttr: string;
    basePdfOptionsSource: {} | { caption: string } | { type: string } | null;
    basePdfAssociation: string;
    onChangeAction: {} | null;
    onSaveAction: {} | null;
}

export interface PdfTemplateDesignerContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    dataSource: DataSourceType[];
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource?: ListValue;
    fieldKeyOptionAttribute?: ListAttributeValue<string | Big>;
    fieldKeyOptionsJson: string;
    pdfJsWorkerUrl?: DynamicValue<string>;
    pdfJsScriptUrl?: DynamicValue<string>;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    showFieldProperties: boolean;
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
    dataSource: DataSourcePreviewType[];
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource: {} | { caption: string } | { type: string } | null;
    fieldKeyOptionAttribute: string;
    fieldKeyOptionsJson: string;
    pdfJsWorkerUrl: string;
    pdfJsScriptUrl: string;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    showFieldProperties: boolean;
}
