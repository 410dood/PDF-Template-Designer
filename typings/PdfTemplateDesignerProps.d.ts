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
    basePdfSource?: ListValue;
    dataJsonAttr?: EditableValue<string>;
    fieldKeySchemaJsonAttr?: EditableValue<string>;
    onChangeAction?: ActionValue;
    onSaveAction?: ActionValue;
}

export type ViewModeEnum = "designer" | "viewer" | "readOnly";

export type FieldKeySourceModeEnum = "manual" | "datasource" | "json";

export interface DataSourcePreviewType {
    templateJsonAttr: string;
    basePdfSource: {} | { caption: string } | { type: string } | null;
    dataJsonAttr: string;
    fieldKeySchemaJsonAttr: string;
    onChangeAction: {} | null;
    onSaveAction: {} | null;
}

export interface PdfTemplateDesignerContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    dataSource: DataSourceType[];
    viewMode: ViewModeEnum;
    pdfJsWorkerUrl?: DynamicValue<string>;
    pdfJsScriptUrl?: DynamicValue<string>;
    showCustomActionButton1: boolean;
    customActionButton1Text: string;
    customActionButton1Enabled: boolean;
    customActionButton1Action?: ActionValue;
    showCustomActionButton2: boolean;
    customActionButton2Text: string;
    customActionButton2Enabled: boolean;
    customActionButton2Action?: ActionValue;
    showCustomActionButton3: boolean;
    customActionButton3Text: string;
    customActionButton3Enabled: boolean;
    customActionButton3Action?: ActionValue;
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource?: ListValue;
    fieldKeyOptionAttribute?: ListAttributeValue<string | Big>;
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
    sigWebScriptUrl?: DynamicValue<string>;
    saveButtonText: string;
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
    viewMode: ViewModeEnum;
    pdfJsWorkerUrl: string;
    pdfJsScriptUrl: string;
    showCustomActionButton1: boolean;
    customActionButton1Text: string;
    customActionButton1Enabled: boolean;
    customActionButton1Action: {} | null;
    showCustomActionButton2: boolean;
    customActionButton2Text: string;
    customActionButton2Enabled: boolean;
    customActionButton2Action: {} | null;
    showCustomActionButton3: boolean;
    customActionButton3Text: string;
    customActionButton3Enabled: boolean;
    customActionButton3Action: {} | null;
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource: {} | { caption: string } | { type: string } | null;
    fieldKeyOptionAttribute: string;
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
    sigWebScriptUrl: string;
    saveButtonText: string;
}
