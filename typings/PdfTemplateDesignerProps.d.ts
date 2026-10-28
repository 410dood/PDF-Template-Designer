/**
 * This file was generated from PdfTemplateDesigner.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { CSSProperties } from "react";
import { ActionValue, DynamicValue, EditableValue, ListValue, ListAttributeValue, WebIcon } from "mendix";
import { Big } from "big.js";

export interface DataSourceType {
    templateJsonAttr: EditableValue<string>;
    basePdfSource?: ListValue;
    dataJsonAttr?: EditableValue<string>;
    fieldKeySchemaJsonAttr?: EditableValue<string>;
    onChangeAction?: ActionValue;
    onSaveAction?: ActionValue;
    tokenContextJsonAttr?: EditableValue<string>;
}

export type ViewModeEnum = "designer" | "viewer" | "readOnly";

export type FieldKeySourceModeEnum = "manual" | "datasource" | "json";

export type SaveButtonRenderModeEnum = "button" | "link";

export type SaveButtonStyleEnum = "default" | "primary" | "success" | "info" | "warning" | "danger" | "link";

export type CustomActionButton1RenderModeEnum = "button" | "link";

export type CustomActionButton1StyleEnum = "default" | "primary" | "success" | "info" | "warning" | "danger" | "link";

export type CustomActionButton2RenderModeEnum = "button" | "link";

export type CustomActionButton2StyleEnum = "default" | "primary" | "success" | "info" | "warning" | "danger" | "link";

export type CustomActionButton3RenderModeEnum = "button" | "link";

export type CustomActionButton3StyleEnum = "default" | "primary" | "success" | "info" | "warning" | "danger" | "link";

export type PageLayoutEnum = "continuous" | "single";

export interface DataSourcePreviewType {
    templateJsonAttr: string;
    basePdfSource: {} | { caption: string } | { type: string } | null;
    dataJsonAttr: string;
    fieldKeySchemaJsonAttr: string;
    onChangeAction: {} | null;
    onSaveAction: {} | null;
    tokenContextJsonAttr: string;
}

export interface PdfTemplateDesignerContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    dataSource: DataSourceType[];
    tokenCatalogSource?: ListValue;
    tokenCatalogKeyAttr?: ListAttributeValue<string>;
    tokenCatalogLabelAttr?: ListAttributeValue<string>;
    tokenCatalogKindAttr?: ListAttributeValue<string>;
    tokenCatalogSampleAttr?: ListAttributeValue<string>;
    paletteTokenKeys: string;
    viewMode: ViewModeEnum;
    showPagesSection: boolean;
    showPaletteSection: boolean;
    showFieldsSection: boolean;
    showFieldProperties: boolean;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource?: ListValue;
    fieldKeyOptionAttribute?: ListAttributeValue<string | Big>;
    showPrintButton: boolean;
    showImportTemplateButton: boolean;
    showReplacePdfButton: boolean;
    showHeaderCheckbox: boolean;
    headerCheckboxAttribute?: EditableValue<boolean>;
    headerCheckboxLabel: string;
    headerCheckboxShowLabel: boolean;
    headerCheckboxVisible?: DynamicValue<boolean>;
    headerCheckboxEditable?: DynamicValue<boolean>;
    headerCheckboxOnChangeAction?: ActionValue;
    showSaveButton: boolean;
    saveButtonText: string;
    saveButtonTooltip: string;
    saveButtonIcon?: DynamicValue<WebIcon>;
    saveButtonRenderMode: SaveButtonRenderModeEnum;
    saveButtonStyle: SaveButtonStyleEnum;
    saveButtonTabIndex: number;
    saveButtonVisible?: DynamicValue<boolean>;
    saveButtonEnabled: boolean;
    saveButtonAction?: ActionValue;
    showCustomActionButton1: boolean;
    customActionButton1Text: string;
    customActionButton1Tooltip: string;
    customActionButton1Icon?: DynamicValue<WebIcon>;
    customActionButton1RenderMode: CustomActionButton1RenderModeEnum;
    customActionButton1Style: CustomActionButton1StyleEnum;
    customActionButton1TabIndex: number;
    customActionButton1Visible?: DynamicValue<boolean>;
    customActionButton1Enabled: boolean;
    customActionButton1Action?: ActionValue;
    showCustomActionButton2: boolean;
    customActionButton2Text: string;
    customActionButton2Tooltip: string;
    customActionButton2Icon?: DynamicValue<WebIcon>;
    customActionButton2RenderMode: CustomActionButton2RenderModeEnum;
    customActionButton2Style: CustomActionButton2StyleEnum;
    customActionButton2TabIndex: number;
    customActionButton2Visible?: DynamicValue<boolean>;
    customActionButton2Enabled: boolean;
    customActionButton2Action?: ActionValue;
    showCustomActionButton3: boolean;
    customActionButton3Text: string;
    customActionButton3Tooltip: string;
    customActionButton3Icon?: DynamicValue<WebIcon>;
    customActionButton3RenderMode: CustomActionButton3RenderModeEnum;
    customActionButton3Style: CustomActionButton3StyleEnum;
    customActionButton3TabIndex: number;
    customActionButton3Visible?: DynamicValue<boolean>;
    customActionButton3Enabled: boolean;
    customActionButton3Action?: ActionValue;
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
    pdfJsWorkerUrl?: DynamicValue<string>;
    pdfJsScriptUrl?: DynamicValue<string>;
    sigWebScriptUrl?: DynamicValue<string>;
    pageLayout: PageLayoutEnum;
    requiredHighlight?: DynamicValue<boolean>;
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
    tokenCatalogSource: {} | { caption: string } | { type: string } | null;
    tokenCatalogKeyAttr: string;
    tokenCatalogLabelAttr: string;
    tokenCatalogKindAttr: string;
    tokenCatalogSampleAttr: string;
    paletteTokenKeys: string;
    viewMode: ViewModeEnum;
    showPagesSection: boolean;
    showPaletteSection: boolean;
    showFieldsSection: boolean;
    showFieldProperties: boolean;
    showShortcutHints: boolean;
    enableKeyboardShortcuts: boolean;
    fieldKeySourceMode: FieldKeySourceModeEnum;
    fieldKeyOptionsSource: {} | { caption: string } | { type: string } | null;
    fieldKeyOptionAttribute: string;
    showPrintButton: boolean;
    showImportTemplateButton: boolean;
    showReplacePdfButton: boolean;
    showHeaderCheckbox: boolean;
    headerCheckboxAttribute: string;
    headerCheckboxLabel: string;
    headerCheckboxShowLabel: boolean;
    headerCheckboxVisible: string;
    headerCheckboxEditable: string;
    headerCheckboxOnChangeAction: {} | null;
    showSaveButton: boolean;
    saveButtonText: string;
    saveButtonTooltip: string;
    saveButtonIcon: { type: "glyph"; iconClass: string; } | { type: "image"; imageUrl: string; iconUrl: string; } | { type: "icon"; iconClass: string; } | undefined;
    saveButtonRenderMode: SaveButtonRenderModeEnum;
    saveButtonStyle: SaveButtonStyleEnum;
    saveButtonTabIndex: number | null;
    saveButtonVisible: string;
    saveButtonEnabled: boolean;
    saveButtonAction: {} | null;
    showCustomActionButton1: boolean;
    customActionButton1Text: string;
    customActionButton1Tooltip: string;
    customActionButton1Icon: { type: "glyph"; iconClass: string; } | { type: "image"; imageUrl: string; iconUrl: string; } | { type: "icon"; iconClass: string; } | undefined;
    customActionButton1RenderMode: CustomActionButton1RenderModeEnum;
    customActionButton1Style: CustomActionButton1StyleEnum;
    customActionButton1TabIndex: number | null;
    customActionButton1Visible: string;
    customActionButton1Enabled: boolean;
    customActionButton1Action: {} | null;
    showCustomActionButton2: boolean;
    customActionButton2Text: string;
    customActionButton2Tooltip: string;
    customActionButton2Icon: { type: "glyph"; iconClass: string; } | { type: "image"; imageUrl: string; iconUrl: string; } | { type: "icon"; iconClass: string; } | undefined;
    customActionButton2RenderMode: CustomActionButton2RenderModeEnum;
    customActionButton2Style: CustomActionButton2StyleEnum;
    customActionButton2TabIndex: number | null;
    customActionButton2Visible: string;
    customActionButton2Enabled: boolean;
    customActionButton2Action: {} | null;
    showCustomActionButton3: boolean;
    customActionButton3Text: string;
    customActionButton3Tooltip: string;
    customActionButton3Icon: { type: "glyph"; iconClass: string; } | { type: "image"; imageUrl: string; iconUrl: string; } | { type: "icon"; iconClass: string; } | undefined;
    customActionButton3RenderMode: CustomActionButton3RenderModeEnum;
    customActionButton3Style: CustomActionButton3StyleEnum;
    customActionButton3TabIndex: number | null;
    customActionButton3Visible: string;
    customActionButton3Enabled: boolean;
    customActionButton3Action: {} | null;
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
    pdfJsWorkerUrl: string;
    pdfJsScriptUrl: string;
    sigWebScriptUrl: string;
    pageLayout: PageLayoutEnum;
    requiredHighlight: string;
}
