/**
 * This file was generated from PdfTemplateDesigner.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, DynamicValue, EditableValue, ListValue, ListAttributeValue } from "mendix";
import { Big } from "big.js";

export interface DataSourceType {
    templateJsonAttr: EditableValue<string>;
    dataJsonAttr?: EditableValue<string>;
    fieldKeySchemaJsonAttr?: EditableValue<string>;
    basePdfSource?: ListValue;
    onChangeAction?: ActionValue;
    onSaveAction?: ActionValue;
}

export type FieldKeySourceModeEnum = "manual" | "datasource" | "json";

export type ViewModeEnum = "designer" | "viewer";

export interface DataSourcePreviewType {
    templateJsonAttr: string;
    dataJsonAttr: string;
    fieldKeySchemaJsonAttr: string;
    basePdfSource: {} | { caption: string } | { type: string } | null;
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
    pdfJsWorkerUrl?: DynamicValue<string>;
    pdfJsScriptUrl?: DynamicValue<string>;
    sigWebScriptUrl?: DynamicValue<string>;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    showFieldProperties: boolean;
    showPaletteSection: boolean;
    showFieldsSection: boolean;
    showPagesSection: boolean;
    showPaletteToolText: boolean;
    showPaletteToolMultiVariableText: boolean;
    showPaletteToolSignature: boolean;
    showPaletteToolTable: boolean;
    showPaletteToolLine: boolean;
    showPaletteToolBox: boolean;
    showPaletteToolCircle: boolean;
    showPaletteToolImage: boolean;
    showPaletteToolLink: boolean;
    showPaletteToolSignaturePad: boolean;
    showPaletteToolQr: boolean;
    showPaletteToolDate: boolean;
    showPaletteToolTime: boolean;
    showPaletteToolSelect: boolean;
    showPaletteToolCheckbox: boolean;
    showPaletteToolRadio: boolean;
    showPaletteToolBarcode: boolean;
    showPaletteToolBarcodeWide: boolean;
    showPropertyKey: boolean;
    showPropertyLabel: boolean;
    showPropertyShowLabel: boolean;
    showPropertyType: boolean;
    showPropertyPage: boolean;
    showPropertyPosition: boolean;
    showPropertySize: boolean;
    showPropertyFontSize: boolean;
    showPropertyAlignment: boolean;
    showPropertyRequired: boolean;
    showPropertyDuplicateAction: boolean;
    showPropertyDeleteAction: boolean;
    saveButtonText: string;
    viewMode: ViewModeEnum;
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
    pdfJsWorkerUrl: string;
    pdfJsScriptUrl: string;
    sigWebScriptUrl: string;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    showFieldProperties: boolean;
    showPaletteSection: boolean;
    showFieldsSection: boolean;
    showPagesSection: boolean;
    showPaletteToolText: boolean;
    showPaletteToolMultiVariableText: boolean;
    showPaletteToolSignature: boolean;
    showPaletteToolTable: boolean;
    showPaletteToolLine: boolean;
    showPaletteToolBox: boolean;
    showPaletteToolCircle: boolean;
    showPaletteToolImage: boolean;
    showPaletteToolLink: boolean;
    showPaletteToolSignaturePad: boolean;
    showPaletteToolQr: boolean;
    showPaletteToolDate: boolean;
    showPaletteToolTime: boolean;
    showPaletteToolSelect: boolean;
    showPaletteToolCheckbox: boolean;
    showPaletteToolRadio: boolean;
    showPaletteToolBarcode: boolean;
    showPaletteToolBarcodeWide: boolean;
    showPropertyKey: boolean;
    showPropertyLabel: boolean;
    showPropertyShowLabel: boolean;
    showPropertyType: boolean;
    showPropertyPage: boolean;
    showPropertyPosition: boolean;
    showPropertySize: boolean;
    showPropertyFontSize: boolean;
    showPropertyAlignment: boolean;
    showPropertyRequired: boolean;
    showPropertyDuplicateAction: boolean;
    showPropertyDeleteAction: boolean;
    saveButtonText: string;
    viewMode: ViewModeEnum;
}
