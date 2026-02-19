import { createElement, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";
import type { CSSProperties } from "react";
import type { ActionValue, DynamicValue, EditableValue, ListAttributeValue, ListValue } from "mendix";
import { Big } from "big.js";
import "./ui/PdfTemplateDesigner.css";

interface PdfDesignerCoreDataSourceItem {
  templateJsonAttr?: EditableValue<string>;
  dataJsonAttr?: EditableValue<string>;
  basePdfSource?: ListValue;
  onChangeAction?: ActionValue;
  onSaveAction?: ActionValue;
}

export interface PdfDesignerCoreProps {
  name: string;
  class: string;
  style?: CSSProperties;
  tabIndex?: number;
  dataSource?: PdfDesignerCoreDataSourceItem[];
  fieldKeySourceMode?: "manual" | "datasource" | "json";
  fieldKeyOptionsSource?: ListValue;
  fieldKeyOptionAttribute?: ListAttributeValue<string | Big>;
  fieldKeyOptionsJson?: string;
  pdfJsWorkerUrl?: DynamicValue<string>;
  pdfJsScriptUrl?: DynamicValue<string>;
  sigWebScriptUrl?: DynamicValue<string>;
  showShortcutHints?: boolean;
  enableKeyboardShortcuts?: boolean;
  showFieldProperties?: boolean;
  showPaletteSection?: boolean;
  showFieldsSection?: boolean;
  showPagesSection?: boolean;
  showPropertyKey?: boolean;
  showPropertyLabel?: boolean;
  showPropertyShowLabel?: boolean;
  showPropertyType?: boolean;
  showPropertyPage?: boolean;
  showPropertyPosition?: boolean;
  showPropertySize?: boolean;
  showPropertyFontSize?: boolean;
  showPropertyAlignment?: boolean;
  showPropertyRequired?: boolean;
  showPropertyDuplicateAction?: boolean;
  showPropertyDeleteAction?: boolean;
  saveButtonText?: string;
  viewMode?: "designer" | "viewer";
  showPaletteToolText?: boolean;
  showPaletteToolMultiVariableText?: boolean;
  showPaletteToolSignature?: boolean;
  showPaletteToolTable?: boolean;
  showPaletteToolLine?: boolean;
  showPaletteToolBox?: boolean;
  showPaletteToolCircle?: boolean;
  showPaletteToolImage?: boolean;
  showPaletteToolLink?: boolean;
  showPaletteToolSignaturePad?: boolean;
  showPaletteToolQr?: boolean;
  showPaletteToolDate?: boolean;
  showPaletteToolTime?: boolean;
  showPaletteToolSelect?: boolean;
  showPaletteToolCheckbox?: boolean;
  showPaletteToolRadio?: boolean;
  showPaletteToolBarcode?: boolean;
  showPaletteToolBarcodeWide?: boolean;
}

type FieldType = "text" | "checkbox" | "date" | "signature" | "multiVariableText" | "select" | "radio" | "image";
type FieldAlign = "left" | "center" | "right";
type FieldOrientation = "horizontal" | "vertical";
type FieldKeySourceMode = "manual" | "datasource" | "json";
type ViewMode = "designer" | "viewer";

interface KeyOption {
  value: string;
  label: string;
  dataType?: string;
  options?: string[];
}

interface TemplateField {
  id: string;
  key: string;
  label: string;
  variablesSampleData: string;
  format: string;
  options: string[];
  imageDataUrl: string;
  labelOrientation: FieldOrientation;
  optionsOrientation: FieldOrientation;
  showLabel: boolean;
  type: FieldType;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  align: FieldAlign;
  required: boolean;
}

type SerializedTemplateField = Omit<TemplateField, "id">;

interface TemplateDefinition {
  basePdf?: { fileId?: string };
  fields: SerializedTemplateField[];
  meta: { units: "pt"; createdWith: string; outputMode: "flattened" };
}

interface PdfjsViewport {
  width: number;
  height: number;
}

interface PdfjsRenderTask {
  promise: Promise<void>;
  cancel?: () => void;
}

interface PdfjsPageProxy {
  getViewport: (options: { scale: number }) => PdfjsViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => PdfjsRenderTask;
}

interface PdfjsDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPageProxy>;
  getFieldObjects?: () => Promise<Record<string, unknown>>;
}

interface PdfjsApi {
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfjsDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

interface LoadedImage {
  url: string;
  width: number;
  height: number;
}

interface PageSize {
  width: number;
  height: number;
}

interface DragState {
  fieldId: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startField: TemplateField;
}

interface GuideLine {
  axis: "x" | "y";
  value: number;
}

type ViewerFieldValue = string | boolean;

interface InlineSignatureCanvasProps {
  value?: string;
  width: number;
  height: number;
  onChange: (value: string) => void;
  onFocus?: () => void;
}

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 };
const SNAP_SIZE = 5;
const PDFJS_VERSION = "4.8.69";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
const PDFJS_AMD_MODULE_IDS = [
  "pdfjs-dist/build/pdf",
  "pdfjs-dist/build/pdf.mjs",
  "pdfjs-dist/legacy/build/pdf",
  "pdfjs-dist/legacy/build/pdf.mjs"
];
const HISTORY_LIMIT = 100;
const ALIGN_TOLERANCE = 4;
const PALETTE_TYPE_DRAG_TYPE = "application/x-pdf-field-type";
const SIGWEB_CAPTURE_FUNCTION_CANDIDATES = ["GetSigImageB64", "GetSigImageBase64", "GetSigImage"];
let pdfjsLoader: Promise<PdfjsApi> | null = null;
let fieldIdCounter = 0;

const FIELD_DEFAULTS: Record<FieldType, Pick<TemplateField, "w" | "h" | "fontSize" | "align">> = {
  text: { w: 180, h: 22, fontSize: 10, align: "left" },
  checkbox: { w: 16, h: 16, fontSize: 10, align: "center" },
  date: { w: 120, h: 20, fontSize: 10, align: "left" },
  signature: { w: 200, h: 30, fontSize: 10, align: "left" },
  multiVariableText: { w: 220, h: 28, fontSize: 10, align: "left" },
  select: { w: 160, h: 24, fontSize: 10, align: "left" },
  radio: { w: 160, h: 36, fontSize: 10, align: "left" },
  image: { w: 140, h: 90, fontSize: 10, align: "center" }
};
const DATE_FIELD_FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "MM/dd/yyyy", label: "MM/dd/yyyy (Date)" },
  { value: "HH:mm", label: "HH:mm (24h Time)" },
  { value: "MM/dd/yyyy HH:mm", label: "MM/dd/yyyy HH:mm (24h DateTime)" },
  { value: "MM/dd/yyyy hh:mm a", label: "MM/dd/yyyy hh:mm a (12h DateTime)" }
];
const DEFAULT_DATE_FIELD_FORMAT = DATE_FIELD_FORMAT_OPTIONS[0].value;
const BUILTIN_COMPUTED_KEY_OPTIONS: KeyOption[] = [
  { value: "__currentDate", label: "__currentDate (alias __today)", dataType: "Date" },
  { value: "__currentTime", label: "__currentTime (alias __nowTime)", dataType: "Time" },
  { value: "__currentDateTime", label: "__currentDateTime (alias __now)", dataType: "DateTime" },
  { value: "__signature", label: "__signature (signature placeholder)", dataType: "Signature" }
];
const TOOL_RAIL_ITEMS: Array<{
  id: string;
  glyph: string;
  tooltip: string;
  label: string;
  type: FieldType;
  keyBase?: string;
  seedLabel?: string;
  format?: string;
  w?: number;
  h?: number;
  align?: FieldAlign;
  showLabel?: boolean;
}> = [
  { id: "text", type: "text", glyph: "T", tooltip: "Text field", label: "Text field", keyBase: "text" },
  {
    id: "multiVariableText",
    type: "multiVariableText",
    glyph: "MVT",
    tooltip: "Multi-variable text",
    label: "Multi-variable text",
    keyBase: "multiVariableText",
    seedLabel: "Multi-variable text",
    w: 220,
    h: 28
  },
  { id: "signature", type: "signature", glyph: "SIG", tooltip: "Signature field", label: "Signature field", keyBase: "signature" },
  { id: "table", type: "text", glyph: "TB", tooltip: "Table", label: "Table", keyBase: "table", seedLabel: "Table", w: 220, h: 28 },
  { id: "line", type: "text", glyph: "LN", tooltip: "Line", label: "Line", keyBase: "line", seedLabel: "Line", w: 180, h: 12 },
  { id: "box", type: "text", glyph: "BOX", tooltip: "Rectangle", label: "Rectangle", keyBase: "box", seedLabel: "Rectangle", w: 140, h: 80 },
  { id: "circle", type: "text", glyph: "O", tooltip: "Circle", label: "Circle", keyBase: "circle", seedLabel: "Circle", w: 64, h: 64, align: "center" },
  { id: "image", type: "image", glyph: "IMG", tooltip: "Image", label: "Image", keyBase: "image", seedLabel: "Image", w: 140, h: 90 },
  { id: "link", type: "text", glyph: "LNK", tooltip: "Link", label: "Link", keyBase: "link", seedLabel: "Link", w: 180, h: 22 },
  { id: "signaturePad", type: "signature", glyph: "SG", tooltip: "Signature pad", label: "Signature pad", keyBase: "signaturePad" },
  { id: "qr", type: "text", glyph: "QR", tooltip: "QR code", label: "QR code", keyBase: "qr", seedLabel: "QR Code", w: 86, h: 86, align: "center" },
  { id: "date", type: "date", glyph: "CAL", tooltip: "Date field", label: "Date field", keyBase: "date" },
  {
    id: "time",
    type: "date",
    glyph: "CLK",
    tooltip: "Time field",
    label: "Time field",
    keyBase: "time",
    seedLabel: "Time",
    format: "HH:mm",
    w: 120,
    h: 20
  },
  { id: "select", type: "select", glyph: "SEL", tooltip: "Select", label: "Select", keyBase: "select", seedLabel: "Select", w: 140, h: 24 },
  { id: "checkbox", type: "checkbox", glyph: "CHK", tooltip: "Checkbox", label: "Checkbox", keyBase: "checkbox" },
  { id: "radio", type: "radio", glyph: "RAD", tooltip: "Radio", label: "Radio", keyBase: "radio", seedLabel: "Radio", w: 160, h: 36 },
  { id: "barSmall", type: "text", glyph: "BAR", tooltip: "Barcode", label: "Barcode", keyBase: "barcode", seedLabel: "Barcode", w: 160, h: 24, align: "center" },
  { id: "barWide", type: "text", glyph: "BAR2", tooltip: "Wide barcode", label: "Wide barcode", keyBase: "barcodeWide", seedLabel: "Wide Barcode", w: 220, h: 24, align: "center" }
];
const TOOL_VISIBILITY_PROP_BY_ID: Record<string, keyof PdfDesignerCoreProps> = {
  text: "showPaletteToolText",
  multiVariableText: "showPaletteToolMultiVariableText",
  signature: "showPaletteToolSignature",
  table: "showPaletteToolTable",
  line: "showPaletteToolLine",
  box: "showPaletteToolBox",
  circle: "showPaletteToolCircle",
  image: "showPaletteToolImage",
  link: "showPaletteToolLink",
  signaturePad: "showPaletteToolSignaturePad",
  qr: "showPaletteToolQr",
  date: "showPaletteToolDate",
  time: "showPaletteToolTime",
  select: "showPaletteToolSelect",
  checkbox: "showPaletteToolCheckbox",
  radio: "showPaletteToolRadio",
  barSmall: "showPaletteToolBarcode",
  barWide: "showPaletteToolBarcodeWide"
};

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createFieldId(): string {
  fieldIdCounter += 1;
  return `field_${fieldIdCounter}`;
}

function isFieldType(value: unknown): value is FieldType {
  return (
    value === "text" ||
    value === "checkbox" ||
    value === "date" ||
    value === "signature" ||
    value === "multiVariableText" ||
    value === "select" ||
    value === "radio" ||
    value === "image"
  );
}

function normalizeFieldTypeInput(value: unknown): FieldType | undefined {
  if (isFieldType(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "multivariabletext" || normalized === "multi_variable_text" || normalized === "multi-variable-text") {
    return "multiVariableText";
  }
  if (
    normalized === "text" ||
    normalized === "checkbox" ||
    normalized === "date" ||
    normalized === "signature" ||
    normalized === "select" ||
    normalized === "radio" ||
    normalized === "image"
  ) {
    return normalized as FieldType;
  }
  return undefined;
}

function isAlign(value: unknown): value is FieldAlign {
  return value === "left" || value === "center" || value === "right";
}

function isFieldOrientation(value: unknown): value is FieldOrientation {
  return value === "horizontal" || value === "vertical";
}

function isFieldKeySourceMode(value: unknown): value is FieldKeySourceMode {
  return value === "manual" || value === "datasource" || value === "json";
}

function normalizeFieldFormat(type: FieldType, value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (type === "date") {
    return text || DEFAULT_DATE_FIELD_FORMAT;
  }
  return text;
}

function isViewMode(value: unknown): value is ViewMode {
  return value === "designer" || value === "viewer";
}

function normalizeStatus(value: unknown): "available" | "loading" | "unavailable" {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (text === "available") {
    return "available";
  }
  if (text === "loading") {
    return "loading";
  }
  return "unavailable";
}

function toTrimmedString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function toObjectId(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  const asRecord = value as Record<string, unknown>;
  if (asRecord && typeof asRecord === "object") {
    return toObjectId(asRecord.id);
  }
  return undefined;
}

function resolveContextObjectId(item: PdfDesignerCoreDataSourceItem | undefined): string | undefined {
  if (!item) {
    return undefined;
  }
  const record = item as unknown as Record<string, unknown>;
  const directId = toObjectId(record.id);
  if (directId) {
    return directId;
  }
  const nestedCandidates = [record.value, record.object, record.obj, record._object];
  for (const candidate of nestedCandidates) {
    const nestedId = toObjectId(candidate);
    if (nestedId) {
      return nestedId;
    }
  }
  return undefined;
}

function resolveFirstDatasourceObjectId(source?: ListValue): string | undefined {
  if (!source || normalizeStatus((source as any).status) !== "available" || !source.items || source.items.length === 0) {
    return undefined;
  }
  return toObjectId(source.items[0]);
}

function normalizeKeyOption(value: unknown): KeyOption | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const key = toTrimmedString(value);
    return key ? { value: key, label: key } : undefined;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const key = toTrimmedString(record.key ?? record.value);
  if (!key) {
    return undefined;
  }

  const label = toTrimmedString(record.label) || key;
  const dataType = toTrimmedString(record.type ?? record.dataType) || undefined;
  const options = normalizeOptionStrings(record.options ?? record.enumOptions ?? record.enumValues ?? record.values);
  return { value: key, label, dataType, options: options.length > 0 ? options : undefined };
}

function mapDataTypeToFieldType(dataType?: string): FieldType | undefined {
  if (!dataType) {
    return undefined;
  }

  const normalized = dataType.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("boolean")) {
    return "checkbox";
  }
  if (normalized.includes("enum")) {
    return "select";
  }
  if (normalized.includes("datetime") || normalized.includes("timestamp") || normalized.includes("time")) {
    return "text";
  }
  if (normalized.includes("date")) {
    return "date";
  }
  if (normalized.includes("image") || normalized.includes("photo") || normalized.includes("picture")) {
    return "image";
  }
  if (normalized.includes("signature")) {
    return "signature";
  }
  if (normalized.includes("multivariable")) {
    return "multiVariableText";
  }
  return undefined;
}

function normalizeOptionStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of value) {
    if (item === null || item === undefined) {
      continue;
    }
    let text = "";
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      text = String(item).trim();
    } else if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      text = toTrimmedString(record.label ?? record.value ?? record.key);
    }
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    options.push(text);
  }
  return options;
}

function defaultOptionsForFieldType(type: FieldType): string[] {
  if (type === "select" || type === "radio") {
    return ["option1", "option2"];
  }
  return [];
}

function defaultLabelOrientationForFieldType(_type: FieldType): FieldOrientation {
  return "horizontal";
}

function defaultOptionsOrientationForFieldType(type: FieldType): FieldOrientation {
  return type === "radio" ? "vertical" : "horizontal";
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function isEnumerationDataType(dataType?: string): boolean {
  if (!dataType) {
    return false;
  }
  return dataType.toLowerCase().includes("enum");
}

function isEnumerationKeyOption(option?: KeyOption): boolean {
  if (!option) {
    return false;
  }
  return isEnumerationDataType(option.dataType) || Boolean(option.options && option.options.length > 0);
}

function dedupeKeyOptions(options: KeyOption[]): KeyOption[] {
  const seen = new Set<string>();
  const result: KeyOption[] = [];
  for (const option of options) {
    if (!option.value || seen.has(option.value)) {
      continue;
    }
    seen.add(option.value);
    result.push(option);
  }
  return result;
}

function withComputedKeyOptions(options: KeyOption[]): KeyOption[] {
  return dedupeKeyOptions([...options, ...BUILTIN_COMPUTED_KEY_OPTIONS]);
}

function parseFieldKeyOptionsJson(text?: string): { options: KeyOption[]; error?: string } {
  if (!text || !text.trim()) {
    return { options: [] };
  }

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { options: [], error: "Field key options JSON must be an array." };
    }

    const options = dedupeKeyOptions(
      parsed
        .map(item => normalizeKeyOption(item))
        .filter((item): item is KeyOption => Boolean(item))
    );
    return { options };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { options: [], error: message };
  }
}

function normalizeField(input: any, index: number): TemplateField {
  const type: FieldType = normalizeFieldTypeInput(input?.type) || "text";
  const defaults = FIELD_DEFAULTS[type];
  const id = createFieldId();
  const key = typeof input?.key === "string" && input.key.trim().length > 0 ? input.key.trim() : `field_${index + 1}`;
  const label = typeof input?.label === "string" ? input.label : "";
  const variablesSampleData =
    typeof input?.variablesSampleData === "string"
      ? input.variablesSampleData
      : typeof input?.variableSampleData === "string"
        ? input.variableSampleData
        : "";
  const format = normalizeFieldFormat(type, input?.format);
  const options = normalizeOptionStrings(input?.options ?? input?.enumOptions ?? input?.values);
  const imageDataUrl =
    typeof input?.imageDataUrl === "string"
      ? input.imageDataUrl
      : typeof input?.imageData === "string"
        ? input.imageData
        : "";
  const labelOrientation = isFieldOrientation(input?.labelOrientation)
    ? input.labelOrientation
    : defaultLabelOrientationForFieldType(type);
  const optionsOrientation = isFieldOrientation(input?.optionsOrientation)
    ? input.optionsOrientation
    : defaultOptionsOrientationForFieldType(type);
  const showLabel = input?.showLabel !== false;
  const page = Math.max(0, Math.floor(toNumber(input?.page, 0)));
  const x = Math.max(0, toNumber(input?.x, 48));
  const y = Math.max(0, toNumber(input?.y, 48));
  const w = Math.max(8, toNumber(input?.w, defaults.w));
  const h = Math.max(8, toNumber(input?.h, defaults.h));
  const fontSize = Math.max(6, toNumber(input?.fontSize, defaults.fontSize));
  const align = isAlign(input?.align) ? input.align : defaults.align;
  const required = Boolean(input?.required);

  return {
    id,
    key,
    label,
    variablesSampleData,
    format,
    options: options.length > 0 ? options : defaultOptionsForFieldType(type),
    imageDataUrl,
    labelOrientation,
    optionsOrientation,
    showLabel,
    type,
    page,
    x,
    y,
    w,
    h,
    fontSize,
    align,
    required
  };
}

function parseTemplateJson(text?: string): { fields: TemplateField[]; error?: string } {
  if (!text || !text.trim()) {
    return { fields: [] };
  }

  try {
    const parsed = JSON.parse(text);
    const fields = Array.isArray(parsed?.fields)
      ? parsed.fields.map((field: any, index: number) => normalizeField(field, index))
      : [];
    return { fields };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { fields: [], error: message };
  }
}

function parseDataJson(text?: string): { values: Record<string, unknown>; error?: string } {
  if (!text || !text.trim()) {
    return { values: {} };
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { values: {}, error: "Data JSON must be an object." };
    }
    return { values: parsed as Record<string, unknown> };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { values: {}, error: message };
  }
}

function buildDataPayload(
  fields: TemplateField[],
  values: Record<string, ViewerFieldValue>,
  existingValues?: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...(existingValues || {}) };
  const handledKeys = new Set<string>();
  for (const field of fields) {
    if (!field.key || handledKeys.has(field.key)) {
      continue;
    }
    handledKeys.add(field.key);
    const rawValue = values[field.key];
    if (field.type === "checkbox") {
      payload[field.key] = Boolean(rawValue);
      continue;
    }
    if (field.type === "multiVariableText") {
      continue;
    }
    if (field.type === "image") {
      // Static template images are stored on the field definition, not in Data JSON.
      continue;
    }
    payload[field.key] = typeof rawValue === "string" ? rawValue : "";
  }
  return payload;
}

function buildDataJson(
  fields: TemplateField[],
  values: Record<string, ViewerFieldValue>,
  existingValues?: Record<string, unknown>
): string {
  const payload = buildDataPayload(fields, values, existingValues);
  return JSON.stringify(payload, null, 2);
}

function buildTemplateJson(fields: TemplateField[], basePdfId: string | undefined): string {
  const payload: TemplateDefinition = {
    basePdf: basePdfId ? { fileId: basePdfId } : undefined,
    fields: fields.map(field => ({
      key: field.key,
      label: field.label,
      variablesSampleData: field.variablesSampleData,
      format: field.format,
      options: normalizeOptionStrings(field.options),
      imageDataUrl: field.imageDataUrl,
      labelOrientation: field.labelOrientation,
      optionsOrientation: field.optionsOrientation,
      showLabel: field.showLabel,
      type: field.type,
      page: field.page,
      x: field.x,
      y: field.y,
      w: field.w,
      h: field.h,
      fontSize: field.fontSize,
      align: field.align,
      required: field.required
    })),
    meta: { units: "pt", createdWith: "pdftemplatedesigner", outputMode: "flattened" }
  };

  return JSON.stringify(payload, null, 2);
}


function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapValue(value: number, enabled: boolean): number {
  if (!enabled) {
    return value;
  }

  return Math.round(value / SNAP_SIZE) * SNAP_SIZE;
}

function nextFieldKey(type: FieldType, fields: TemplateField[]): string {
  const base = type === "checkbox" ? "check" : type === "multiVariableText" ? "multiVariableText" : type;
  let index = 1;
  let candidate = `${base}_${index}`;
  const keys = new Set(fields.map(field => field.key));
  while (keys.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }

  return candidate;
}

function nextPrefixedFieldKey(prefix: string, fields: TemplateField[]): string {
  const normalizedBase =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  let index = 1;
  let candidate = `${normalizedBase}_${index}`;
  const keys = new Set(fields.map(field => field.key));
  while (keys.has(candidate)) {
    index += 1;
    candidate = `${normalizedBase}_${index}`;
  }
  return candidate;
}

function cloneFields(fields: TemplateField[]): TemplateField[] {
  return fields.map(field => ({ ...field, options: [...field.options] }));
}

function areFieldsEqual(left: TemplateField[], right: TemplateField[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      a.id !== b.id ||
      a.key !== b.key ||
      a.label !== b.label ||
      a.variablesSampleData !== b.variablesSampleData ||
      a.format !== b.format ||
      a.imageDataUrl !== b.imageDataUrl ||
      a.options.length !== b.options.length ||
      a.labelOrientation !== b.labelOrientation ||
      a.optionsOrientation !== b.optionsOrientation ||
      a.showLabel !== b.showLabel ||
      a.type !== b.type ||
      a.page !== b.page ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.w !== b.w ||
      a.h !== b.h ||
      a.fontSize !== b.fontSize ||
      a.align !== b.align ||
      a.required !== b.required
    ) {
      return false;
    }
    for (let optionIndex = 0; optionIndex < a.options.length; optionIndex += 1) {
      if (a.options[optionIndex] !== b.options[optionIndex]) {
        return false;
      }
    }
  }
  return true;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "button";
}

function fieldVerticalLines(field: TemplateField): number[] {
  return [field.x, field.x + field.w / 2, field.x + field.w];
}

function fieldHorizontalLines(field: TemplateField): number[] {
  return [field.y, field.y + field.h / 2, field.y + field.h];
}

function findClosestReference(line: number, refs: number[], tolerance: number): number | undefined {
  let bestRef: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ref of refs) {
    const distance = Math.abs(line - ref);
    if (distance <= tolerance && distance < bestDistance) {
      bestDistance = distance;
      bestRef = ref;
    }
  }
  return bestRef;
}

function snapPositionToReferences(position: number, size: number, refs: number[], tolerance: number): { position: number; guide?: number } {
  const offsets = [0, size / 2, size];
  let bestDelta = Number.POSITIVE_INFINITY;
  let guide: number | undefined;

  for (const offset of offsets) {
    const line = position + offset;
    const ref = findClosestReference(line, refs, tolerance);
    if (ref === undefined) {
      continue;
    }
    const delta = ref - line;
    if (Math.abs(delta) < Math.abs(bestDelta)) {
      bestDelta = delta;
      guide = ref;
    }
  }

  if (guide === undefined) {
    return { position };
  }

  return { position: position + bestDelta, guide };
}

function loadPdfjs(scriptSrc?: string): Promise<PdfjsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF.js is not available."));
  }

  const existing = (window as any).pdfjsLib as PdfjsApi | undefined;
  if (existing) {
    return Promise.resolve(existing);
  }

  if (pdfjsLoader) {
    return pdfjsLoader;
  }

  pdfjsLoader = new Promise((resolve, reject) => {
    const resolvedScriptSrc = scriptSrc || resolveWorkerUrlValue((window as any).pdfjsScriptSrc) || PDFJS_CDN;
    const rejectWithReset = (message: string) => {
      pdfjsLoader = null;
      reject(new Error(message));
    };
    const script = document.createElement("script");
    if (isMjsScriptUrl(resolvedScriptSrc)) {
      // pdf.min.mjs must be loaded as a module script (it contains ESM exports).
      script.type = "module";
    }
    script.src = resolvedScriptSrc;
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib as PdfjsApi | undefined;
      if (!lib) {
        // In AMD environments (e.g. Mendix runtime), pdf.min.js can define
        // "pdfjs-dist/build/pdf" without setting window.pdfjsLib immediately.
        resolvePdfjsFromAmd().then(amdLib => {
          const resolved = (window as any).pdfjsLib || amdLib;
          if (!resolved) {
            rejectWithReset("PDF.js failed to initialize.");
            return;
          }
          if (!(window as any).pdfjsLib) {
            (window as any).pdfjsLib = resolved;
          }
          resolve(resolved);
        });
        return;
      }
      resolve(lib);
    };
    script.onerror = () => rejectWithReset(`Failed to load PDF.js from ${resolvedScriptSrc}.`);
    document.head.appendChild(script);
  });

  return pdfjsLoader;
}

function resolveWorkerUrlValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isMjsScriptUrl(url?: string): boolean {
  return Boolean(url && /\.mjs(?:$|[?#])/i.test(url));
}

function resolvePdfjsFromAmd(): Promise<PdfjsApi | undefined> {
  if (typeof window === "undefined") {
    return Promise.resolve(undefined);
  }
  const req = (window as any).require;
  if (typeof req !== "function") {
    return Promise.resolve(undefined);
  }

  return new Promise(resolve => {
    let settled = false;
    const finish = (value?: PdfjsApi) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    const moduleIds = Array.from(new Set(PDFJS_AMD_MODULE_IDS));
    const tryLoadModule = (index: number) => {
      if (settled) {
        return;
      }
      if (index >= moduleIds.length) {
        finish(undefined);
        return;
      }
      try {
        req(
          [moduleIds[index]],
          (module: unknown) => {
            const amdLib = ((module as any)?.default || module) as PdfjsApi | undefined;
            const version = (amdLib as any)?.version;
            if (typeof version === "string" && version !== PDFJS_VERSION) {
              console.warn(
                `Ignoring AMD PDF.js module '${moduleIds[index]}' because version '${version}' does not match expected '${PDFJS_VERSION}'.`
              );
              tryLoadModule(index + 1);
              return;
            }
            finish(amdLib);
          },
          () => tryLoadModule(index + 1)
        );
      } catch (_error) {
        tryLoadModule(index + 1);
      }
    };
    tryLoadModule(0);

    // Avoid hanging if AMD never resolves.
    setTimeout(() => finish(undefined), 2000);
  });
}

function deriveScriptUrlFromWorkerUrl(workerUrl?: string): string | undefined {
  if (!workerUrl) {
    return undefined;
  }
  const derived = workerUrl.replace(/pdf\.worker(\.min)?\.(m?js)(?=([?#]|$))/i, "pdf$1.$2");
  return derived !== workerUrl ? derived : undefined;
}

function deriveWorkerUrlFromScriptUrl(scriptUrl?: string): string | undefined {
  if (!scriptUrl) {
    return undefined;
  }
  const derived = scriptUrl.replace(/pdf(\.min)?\.(m?js)(?=([?#]|$))/i, "pdf.worker$1.$2");
  return derived !== scriptUrl ? derived : undefined;
}

function loadExternalScript(scriptSrc: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Document is not available."));
  }

  const existing = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;
  if (existing) {
    if ((existing as any).dataset?.loaded === "true") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const handleLoad = () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
        resolve();
      };
      const handleError = () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
        reject(new Error(`Failed to load script from ${scriptSrc}.`));
      };
      existing.addEventListener("load", handleLoad);
      existing.addEventListener("error", handleError);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script from ${scriptSrc}.`));
    document.head.appendChild(script);
  });
}

type SigWebCaptureFunction = (...args: unknown[]) => unknown;

function resolveSigWebCaptureFunction(globalObject: any): SigWebCaptureFunction | undefined {
  for (const functionName of SIGWEB_CAPTURE_FUNCTION_CANDIDATES) {
    const candidate = globalObject?.[functionName];
    if (typeof candidate === "function") {
      return candidate.bind(globalObject);
    }
  }
  return undefined;
}

function extractStringFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const candidateKeys = ["value", "dataUrl", "imageData", "signature", "result", "data"];
  for (const key of candidateKeys) {
    const extracted = extractStringFromUnknown(record[key]);
    if (extracted) {
      return extracted;
    }
  }
  return undefined;
}

function normalizeSignatureImageDataUrl(value: string): string | undefined {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return undefined;
  }
  if (/^data:image\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^image\/\w+;base64,/i.test(trimmed)) {
    return `data:${trimmed}`;
  }

  const commaIndex = trimmed.indexOf(",");
  const candidateBase64 = commaIndex >= 0 && /base64/i.test(trimmed.slice(0, commaIndex))
    ? trimmed.slice(commaIndex + 1)
    : trimmed;
  const normalizedBase64 = candidateBase64.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
    return `data:image/png;base64,${normalizedBase64}`;
  }
  return undefined;
}

function normalizeSignatureImageFromUnknown(value: unknown): string | undefined {
  const extracted = extractStringFromUnknown(value);
  return extracted ? normalizeSignatureImageDataUrl(extracted) : undefined;
}

function normalizeImageDataFromUnknown(value: unknown): string {
  if (typeof value === "string") {
    return normalizeSignatureImageDataUrl(value) || "";
  }
  return normalizeSignatureImageFromUnknown(value) || "";
}

function rasterizeImageDataUrlToPng(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof document === "undefined") {
    return Promise.resolve(dataUrl);
  }
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      try {
        const width = Math.max(1, image.naturalWidth || image.width || 1);
        const height = Math.max(1, image.naturalHeight || image.height || 1);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(dataUrl);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      } catch (_error) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function getSigWebPointCount(globalObject: any): number | undefined {
  const numberOfPointsFn = globalObject?.NumberOfTabletPoints;
  if (typeof numberOfPointsFn !== "function") {
    return undefined;
  }
  try {
    const value = Number(numberOfPointsFn());
    return Number.isFinite(value) ? value : undefined;
  } catch (_error) {
    return undefined;
  }
}

function callOptionalSigWebFunction(globalObject: any, functionName: string, ...args: unknown[]): void {
  const fn = globalObject?.[functionName];
  if (typeof fn !== "function") {
    return;
  }
  try {
    fn(...args);
  } catch (_error) {
    // Optional SigWeb tuning helpers vary by device/driver; ignore failures.
  }
}

function applySigWebImageDefaults(globalObject: any): void {
  callOptionalSigWebFunction(globalObject, "SetSigCompressionMode", 1);
  callOptionalSigWebFunction(globalObject, "SetImageXSize", 500);
  callOptionalSigWebFunction(globalObject, "SetImageYSize", 120);
  callOptionalSigWebFunction(globalObject, "SetImagePenWidth", 4);
}

function captureSignatureFromSigWeb(captureFunction: SigWebCaptureFunction): Promise<string | undefined> {
  const immediateResult = (() => {
    try {
      return normalizeSignatureImageFromUnknown(captureFunction());
    } catch (_error) {
      return undefined;
    }
  })();
  if (immediateResult) {
    return Promise.resolve(immediateResult);
  }

  return new Promise(resolve => {
    let settled = false;
    const finish = (result?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(normalizeSignatureImageFromUnknown(result));
    };

    const timeoutId = setTimeout(() => finish(undefined), 2000);
    const callback = (result: unknown) => {
      clearTimeout(timeoutId);
      finish(result);
    };

    try {
      const result = captureFunction(callback);
      if (result !== undefined) {
        clearTimeout(timeoutId);
        finish(result);
      }
    } catch (_error) {
      clearTimeout(timeoutId);
      finish(undefined);
    }
  });
}

function normalizeDateInputValue(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "";
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

function isComputedTokenKey(tokenKey: string): boolean {
  const normalized = tokenKey.trim().toLowerCase();
  return (
    normalized === "__currentdate" ||
    normalized === "__today" ||
    normalized === "__currenttime" ||
    normalized === "__nowtime" ||
    normalized === "__currentdatetime" ||
    normalized === "__now"
  );
}

function formatDateByPattern(date: Date, pattern: string): string | undefined {
  const safePattern = pattern.trim();
  if (!safePattern) {
    return undefined;
  }
  const datePart = date.toLocaleDateString("en-US");
  const time24 = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const time12 = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (safePattern === "MM/dd/yyyy") {
    return datePart;
  }
  if (safePattern === "HH:mm") {
    return time24;
  }
  if (safePattern === "MM/dd/yyyy HH:mm") {
    return `${datePart} ${time24}`;
  }
  if (safePattern === "MM/dd/yyyy hh:mm a") {
    return `${datePart} ${time12}`;
  }
  return undefined;
}

function resolveComputedTokenValue(tokenKey: string, configuredFormat?: string): string | undefined {
  const normalized = tokenKey.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const now = new Date();
  const formatted = configuredFormat ? formatDateByPattern(now, configuredFormat) : undefined;
  if (formatted) {
    return formatted;
  }
  if (normalized === "__currentdate" || normalized === "__today") {
    return now.toLocaleDateString("en-US");
  }
  if (normalized === "__currenttime" || normalized === "__nowtime") {
    return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (normalized === "__currentdatetime" || normalized === "__now") {
    return `${now.toLocaleDateString("en-US")} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  return undefined;
}

function stringifyTemplateTokenValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function resolveMultiVariableText(template: string, values: Record<string, unknown>): string {
  if (!template || !template.trim()) {
    return "";
  }
  return template.replace(/\{([^{}]+)\}/g, (_match: string, tokenName: string) => {
    const key = String(tokenName || "").trim();
    if (!key) {
      return "";
    }
    const raw = values[key];
    const text = stringifyTemplateTokenValue(raw);
    if (text.trim()) {
      return text;
    }
    const computed = resolveComputedTokenValue(key);
    return computed || "";
  });
}

function toBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Math.abs(value) > 0.0000001;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["true", "1", "yes", "y", "on", "checked", "x"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off", "unchecked"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeViewerValueFromPdfField(field: TemplateField, rawValue: unknown): ViewerFieldValue | undefined {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }
  if (field.type === "checkbox") {
    return toBooleanLike(rawValue) ?? false;
  }
  if (field.type === "signature" || field.type === "image") {
    const signatureImage = normalizeSignatureImageFromUnknown(rawValue);
    if (signatureImage) {
      return signatureImage;
    }
    return typeof rawValue === "string" ? rawValue : "";
  }
  return String(rawValue);
}

function initialViewerFieldValue(field: TemplateField, previousValue: ViewerFieldValue | undefined): ViewerFieldValue {
  if (field.type === "checkbox") {
    return typeof previousValue === "boolean" ? previousValue : false;
  }
  if (field.type === "image") {
    if (typeof previousValue === "string") {
      return previousValue;
    }
    return normalizeImageDataFromUnknown(field.imageDataUrl);
  }
  if (field.type === "select" || field.type === "radio") {
    if (typeof previousValue === "string") {
      return previousValue;
    }
    return field.options[0] || "";
  }
  if (typeof previousValue === "string") {
    return previousValue;
  }
  if (isComputedTokenKey(field.key)) {
    return resolveComputedTokenValue(field.key, field.type === "date" ? field.format : undefined) || "";
  }
  return "";
}

function InlineSignatureCanvas(props: InlineSignatureCanvasProps): ReactElement {
  const { value, width, height, onChange, onFocus } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const drawValue = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const safeWidth = Math.max(20, Math.round(width));
    const safeHeight = Math.max(20, Math.round(height));
    const ratio = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = Math.max(1, Math.round(safeWidth * ratio));
    canvas.height = Math.max(1, Math.round(safeHeight * ratio));
    canvas.style.width = `${safeWidth}px`;
    canvas.style.height = `${safeHeight}px`;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(ratio, ratio);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.lineWidth = Math.max(1.5, safeHeight * 0.05);
    context.strokeStyle = "#111827";
    context.fillStyle = "#111827";

    if (value) {
      const image = new Image();
      image.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(ratio, ratio);
        ctx.drawImage(image, 0, 0, safeWidth, safeHeight);
      };
      image.src = value;
    }
  }, [value, width, height]);

  useEffect(() => {
    drawValue();
  }, [drawValue]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const commitCurrentStroke = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    onFocus?.();
    event.preventDefault();
    event.stopPropagation();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = pointFromEvent(event);
    lastPointRef.current = point;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.arc(point.x, point.y, Math.max(1, context.lineWidth * 0.45), 0, Math.PI * 2);
    context.fill();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const lastPoint = lastPointRef.current;
    if (!canvas || !context || !lastPoint) {
      return;
    }
    event.preventDefault();
    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    event.preventDefault();
    commitCurrentStroke();
  };

  return (
    <canvas
      ref={canvasRef}
      className="pdf-template-designer__signature-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}

function loadImageFromBlob(blob: Blob): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (typeof URL === "undefined" || typeof Image === "undefined") {
      reject(new Error("Image preview is not supported in this browser."));
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width <= 0 || height <= 0) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Image has invalid dimensions."));
        return;
      }
      resolve({ url: objectUrl, width, height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image preview."));
    };
    image.src = objectUrl;
  });
}

function resolveTextTemplateValue(property: unknown, templateItem?: unknown): { value?: string; isLoading: boolean } {
  if (!property) {
    return { isLoading: false };
  }

  if (typeof property === "string") {
    return { value: resolveWorkerUrlValue(property), isLoading: false };
  }

  const dynamicProperty = property as any;
  if (typeof dynamicProperty.status === "string") {
    if (dynamicProperty.status === "loading") {
      return { isLoading: true };
    }
    if (dynamicProperty.status === "available") {
      return { value: resolveWorkerUrlValue(dynamicProperty.value), isLoading: false };
    }
    return { isLoading: false };
  }

  if (templateItem && typeof dynamicProperty.get === "function") {
    const expressionValue = dynamicProperty.get(templateItem);
    if (!expressionValue || expressionValue.status === "unavailable") {
      return { isLoading: false };
    }
    if (expressionValue.status === "loading") {
      return { isLoading: true };
    }
    return { value: resolveWorkerUrlValue(expressionValue.value), isLoading: false };
  }

  return { isLoading: false };
}

export default function PdfDesignerCore(props: PdfDesignerCoreProps): ReactElement {
  const className = ["pdf-template-designer", props.class].filter(Boolean).join(" ");
  const showShortcutHints = props.showShortcutHints !== false;
  const enableKeyboardShortcuts = props.enableKeyboardShortcuts !== false;
  const showFieldProperties = props.showFieldProperties !== false;
  const showPaletteSection = props.showPaletteSection !== false;
  const showFieldsSection = props.showFieldsSection !== false;
  const showPagesSection = props.showPagesSection !== false;
  const showPropertyKey = props.showPropertyKey !== false;
  const showPropertyLabel = props.showPropertyLabel !== false;
  const showPropertyShowLabel = props.showPropertyShowLabel !== false;
  const showPropertyType = props.showPropertyType !== false;
  const showPropertyPage = props.showPropertyPage !== false;
  const showPropertyPosition = props.showPropertyPosition !== false;
  const showPropertySize = props.showPropertySize !== false;
  const showPropertyFontSize = props.showPropertyFontSize !== false;
  const showPropertyAlignment = props.showPropertyAlignment !== false;
  const showPropertyRequired = props.showPropertyRequired !== false;
  const showPropertyDuplicateAction = props.showPropertyDuplicateAction !== false;
  const showPropertyDeleteAction = props.showPropertyDeleteAction !== false;
  const saveButtonText = (props.saveButtonText || "").trim() || "Save JSON";
  const viewMode: ViewMode = isViewMode((props as any).viewMode) ? ((props as any).viewMode as ViewMode) : "designer";
  const isViewerMode = viewMode === "viewer";
  const hasSidebarSections = showPaletteSection || showPagesSection;
  const hasRightPanelSections = showFieldProperties || showFieldsSection;
  const paletteToolVisibilityById = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const tool of TOOL_RAIL_ITEMS) {
      const propName = TOOL_VISIBILITY_PROP_BY_ID[tool.id];
      const raw = propName ? props[propName] : undefined;
      map[tool.id] = raw !== false;
    }
    return map;
  }, [props]);
  const visibleToolRailItems = useMemo(
    () => TOOL_RAIL_ITEMS.filter(tool => paletteToolVisibilityById[tool.id] !== false),
    [paletteToolVisibilityById]
  );
  const hasVisibleFieldPropertyControls =
    showPropertyKey ||
    showPropertyLabel ||
    showPropertyShowLabel ||
    showPropertyType ||
    showPropertyPage ||
    showPropertyPosition ||
    showPropertySize ||
    showPropertyFontSize ||
    showPropertyAlignment ||
    showPropertyRequired ||
    showPropertyDuplicateAction ||
    showPropertyDeleteAction;
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const activePageRenderTaskRef = useRef<PdfjsRenderTask | null>(null);
  const fieldsRef = useRef<TemplateField[]>([]);
  const selectedFieldIdRef = useRef<string | null>(null);
  const undoStackRef = useRef<TemplateField[][]>([]);
  const redoStackRef = useRef<TemplateField[][]>([]);
  const lastLoadedJsonRef = useRef<string | undefined>(undefined);
  const lastLoadedDataJsonRef = useRef<string | undefined>(undefined);
  const lastParsedDataJsonRef = useRef<Record<string, unknown>>({});
  const viewerFieldValuesDirtyRef = useRef(false);

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [placementToolId, setPlacementToolId] = useState<string | null>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<PdfjsDocumentProxy | null>(null);
  const [imageBackgroundUrl, setImageBackgroundUrl] = useState<string | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<PageSize | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [renderScale, setRenderScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dataJsonError, setDataJsonError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewerFieldValues, setViewerFieldValues] = useState<Record<string, ViewerFieldValue>>({});
  const [activeViewerSignatureFieldId, setActiveViewerSignatureFieldId] = useState<string | null>(null);
  const [viewerSignatureMessage, setViewerSignatureMessage] = useState<string | null>(null);
  const [sigWebState, setSigWebState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sigWebError, setSigWebError] = useState<string | null>(null);
  const [pageThumbs, setPageThumbs] = useState<Record<number, string>>({});
  const [isBuildingThumbs, setIsBuildingThumbs] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [draggedFieldListItemId, setDraggedFieldListItemId] = useState<string | null>(null);
  const [fieldListDropTargetId, setFieldListDropTargetId] = useState<string | null>(null);
  const [optionDraft, setOptionDraft] = useState("");
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageObjectUrlRef = useRef<string | null>(null);
  const dataSourceItem = useMemo(() => props.dataSource?.[0], [props.dataSource]);
  const fieldKeySourceMode: FieldKeySourceMode = isFieldKeySourceMode(props.fieldKeySourceMode)
    ? props.fieldKeySourceMode
    : "manual";
  const fieldKeyOptionsSource = props.fieldKeyOptionsSource;
  const fieldKeyOptionAttribute = props.fieldKeyOptionAttribute;
  const fieldKeyOptionsJson = props.fieldKeyOptionsJson || "";

  const revokeImageObjectUrl = useCallback(() => {
    if (imageObjectUrlRef.current) {
      URL.revokeObjectURL(imageObjectUrlRef.current);
      imageObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    selectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

  useEffect(() => {
    return () => {
      revokeImageObjectUrl();
    };
  }, [revokeImageObjectUrl]);

  const workerUrlResolution = useMemo(
    () => resolveTextTemplateValue(props.pdfJsWorkerUrl),
    [props.pdfJsWorkerUrl]
  );
  const configuredWorkerUrl = workerUrlResolution.value;

  const scriptUrlResolution = useMemo(
    () => resolveTextTemplateValue((props as any).pdfJsScriptUrl),
    [(props as any).pdfJsScriptUrl]
  );
  const configuredScriptUrl = scriptUrlResolution.value;
  const sigWebUrlResolution = useMemo(
    () => resolveTextTemplateValue((props as any).sigWebScriptUrl),
    [(props as any).sigWebScriptUrl]
  );
  const configuredSigWebUrl = sigWebUrlResolution.value;
  const existingPdfjsLib = (typeof window !== "undefined" ? (window as any).pdfjsLib : undefined) as PdfjsApi | undefined;
  const derivedScriptUrl = deriveScriptUrlFromWorkerUrl(configuredWorkerUrl);
  const explicitScriptUrl =
    configuredScriptUrl || resolveWorkerUrlValue((window as any).pdfjsScriptSrc) || derivedScriptUrl;
  const resolvedScriptUrl = explicitScriptUrl || (!existingPdfjsLib ? PDFJS_CDN : undefined);
  const existingWorkerUrl = resolveWorkerUrlValue((existingPdfjsLib as any)?.GlobalWorkerOptions?.workerSrc);
  const defaultWorkerUrl =
    resolveWorkerUrlValue((window as any).pdfjsWorkerSrc) ||
    existingWorkerUrl ||
    deriveWorkerUrlFromScriptUrl(resolvedScriptUrl) ||
    (!existingPdfjsLib ? PDFJS_WORKER_CDN : undefined);
  const resolvedWorkerUrl = configuredWorkerUrl || defaultWorkerUrl;
  const isPdfJsConfigLoading = workerUrlResolution.isLoading || scriptUrlResolution.isLoading;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isPdfJsConfigLoading) {
      return;
    }

    loadPdfjs(resolvedScriptUrl)
      .then(pdfjs => {
        pdfjs.GlobalWorkerOptions.workerSrc = resolvedWorkerUrl || pdfjs.GlobalWorkerOptions.workerSrc;
      })
      .catch(() => undefined);
  }, [isPdfJsConfigLoading, resolvedScriptUrl, resolvedWorkerUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !isViewerMode) {
      setSigWebState("idle");
      setSigWebError(null);
      return;
    }

    if (sigWebUrlResolution.isLoading) {
      setSigWebState("loading");
      setSigWebError(null);
      return;
    }

    const existingCaptureFunction = resolveSigWebCaptureFunction(window as any);
    if (!configuredSigWebUrl) {
      setSigWebState(existingCaptureFunction ? "ready" : "idle");
      setSigWebError(null);
      return;
    }

    let cancelled = false;
    setSigWebState("loading");
    setSigWebError(null);
    loadExternalScript(configuredSigWebUrl)
      .then(() => {
        if (cancelled) {
          return;
        }
        const captureFunction = resolveSigWebCaptureFunction(window as any);
        if (!captureFunction) {
          setSigWebState("error");
          setSigWebError(
            "SigWeb loaded, but no supported capture function was found. Expected GetSigImageB64, GetSigImageBase64, or GetSigImage."
          );
          return;
        }
        setSigWebState("ready");
        setSigWebError(null);
      })
      .catch(error => {
        if (cancelled) {
          return;
        }
        setSigWebState("error");
        setSigWebError(error instanceof Error ? error.message : "Failed to load SigWeb script.");
      });

    return () => {
      cancelled = true;
    };
  }, [isViewerMode, configuredSigWebUrl, sigWebUrlResolution.isLoading]);

  const templateJsonValue = useMemo(() => {
    return dataSourceItem?.templateJsonAttr;
  }, [dataSourceItem]);
  const dataJsonValue = useMemo(() => {
    return dataSourceItem?.dataJsonAttr;
  }, [dataSourceItem]);

  const basePdfSource = useMemo(() => dataSourceItem?.basePdfSource, [dataSourceItem]);
  const contextObjectId = useMemo(() => resolveContextObjectId(dataSourceItem), [dataSourceItem]);
  const basePdfFromDatasourceId = useMemo(() => resolveFirstDatasourceObjectId(basePdfSource), [basePdfSource]);

  const basePdfId = basePdfFromDatasourceId || contextObjectId;
  const templateJsonText =
    templateJsonValue && templateJsonValue.status === "available" ? templateJsonValue.value || "" : "";
  const dataJsonText =
    dataJsonValue && dataJsonValue.status === "available" ? dataJsonValue.value || "" : "";
  const isDataJsonBound = Boolean(dataJsonValue && dataJsonValue.status === "available");
  const showViewerDataJsonBindingWarning = isViewerMode && !isDataJsonBound;
  const jsonKeyOptionsState = useMemo(
    () => parseFieldKeyOptionsJson(fieldKeyOptionsJson),
    [fieldKeyOptionsJson]
  );
  const datasourceKeyOptionsState = useMemo(() => {
    if (!fieldKeyOptionsSource) {
      return { options: [] as KeyOption[], loading: false };
    }
    if (!fieldKeyOptionAttribute) {
      return {
        options: [] as KeyOption[],
        loading: false,
        error: "Configure 'Field key option attribute' for datasource mode."
      };
    }

    const sourceStatus = normalizeStatus((fieldKeyOptionsSource as any).status);
    const items = fieldKeyOptionsSource.items || [];
    const options: KeyOption[] = [];

    for (const item of items) {
      const attributeValue = fieldKeyOptionAttribute.get(item);
      if (!attributeValue || normalizeStatus((attributeValue as any).status) !== "available") {
        continue;
      }
      const raw = toTrimmedString((attributeValue as any).value);
      if (!raw) {
        continue;
      }
      options.push({ value: raw, label: raw });
    }

    return {
      options: dedupeKeyOptions(options),
      loading: sourceStatus === "loading",
      error:
        sourceStatus !== "loading" && items.length > 0 && options.length === 0
          ? "Datasource returned no usable key values."
          : undefined
    };
  }, [fieldKeyOptionsSource, fieldKeyOptionAttribute]);

  useEffect(() => {
    if (!templateJsonValue || templateJsonValue.status !== "available") {
      return;
    }

    const incoming = templateJsonValue.value || "";
    if (incoming === lastLoadedJsonRef.current) {
      return;
    }

    const parsed = parseTemplateJson(incoming);
    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }

    setJsonError(null);
    setFields(parsed.fields);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setGuides([]);
    lastLoadedJsonRef.current = incoming;
    if (!selectedFieldId && parsed.fields.length > 0) {
      setSelectedFieldId(parsed.fields[0].id);
    }
  }, [templateJsonText, templateJsonValue, selectedFieldId]);

  useEffect(() => {
    setViewerFieldValues(previousValues => {
      const nextValues: Record<string, ViewerFieldValue> = {};
      for (const field of fields) {
        nextValues[field.key] = initialViewerFieldValue(field, previousValues[field.key]);
      }
      const previousKeys = Object.keys(previousValues);
      const nextKeys = Object.keys(nextValues);
      if (previousKeys.length === nextKeys.length) {
        let hasChanged = false;
        for (const key of nextKeys) {
          if (previousValues[key] !== nextValues[key]) {
            hasChanged = true;
            break;
          }
        }
        if (!hasChanged) {
          return previousValues;
        }
      }
      return nextValues;
    });

    setActiveViewerSignatureFieldId(previousFieldId =>
      previousFieldId && fields.some(field => field.type === "signature" && field.id === previousFieldId)
        ? previousFieldId
        : null
    );
  }, [fields]);

  useEffect(() => {
    if (!isViewerMode || !isDataJsonBound) {
      setDataJsonError(null);
      lastLoadedDataJsonRef.current = undefined;
      lastParsedDataJsonRef.current = {};
      viewerFieldValuesDirtyRef.current = false;
      setViewerFieldValues(previousValues => {
        const nextValues: Record<string, ViewerFieldValue> = {};
        for (const field of fields) {
          nextValues[field.key] = initialViewerFieldValue(field, undefined);
        }
        const previousKeys = Object.keys(previousValues);
        const nextKeys = Object.keys(nextValues);
        if (previousKeys.length === nextKeys.length && nextKeys.every(key => previousValues[key] === nextValues[key])) {
          return previousValues;
        }
        return nextValues;
      });
      return;
    }

    const incoming = dataJsonText || "";
    lastLoadedDataJsonRef.current = incoming;

    const parsed = parseDataJson(incoming);
    if (parsed.error) {
      setDataJsonError(parsed.error);
      lastParsedDataJsonRef.current = {};
      viewerFieldValuesDirtyRef.current = false;
      setViewerFieldValues(previousValues => {
        const nextValues: Record<string, ViewerFieldValue> = {};
        for (const field of fields) {
          nextValues[field.key] = initialViewerFieldValue(field, undefined);
        }
        const previousKeys = Object.keys(previousValues);
        const nextKeys = Object.keys(nextValues);
        if (previousKeys.length === nextKeys.length && nextKeys.every(key => previousValues[key] === nextValues[key])) {
          return previousValues;
        }
        return nextValues;
      });
      return;
    }

    setDataJsonError(null);
    lastParsedDataJsonRef.current = parsed.values;
    viewerFieldValuesDirtyRef.current = false;
    setViewerFieldValues(previousValues => {
      const nextValues: Record<string, ViewerFieldValue> = {};
      for (const field of fields) {
        const normalized = normalizeViewerValueFromPdfField(field, parsed.values[field.key]);
        const shouldUseComputedDefault =
          isComputedTokenKey(field.key) && typeof normalized === "string" && normalized.trim().length === 0;
        nextValues[field.key] =
          normalized === undefined || shouldUseComputedDefault ? initialViewerFieldValue(field, undefined) : normalized;
      }
      const previousKeys = Object.keys(previousValues);
      const nextKeys = Object.keys(nextValues);
      if (previousKeys.length === nextKeys.length && nextKeys.every(key => previousValues[key] === nextValues[key])) {
        return previousValues;
      }
      return nextValues;
    });
  }, [isViewerMode, isDataJsonBound, dataJsonText, fields]);

  useEffect(() => {
    setPageJumpInput(String(pageIndex + 1));
  }, [pageIndex]);

  useEffect(() => {
    if (!viewerRef.current) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      if (!entries.length) {
        return;
      }
      const width = entries[0].contentRect.width;
      setContainerWidth(width);
    });

    observer.observe(viewerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!basePdfId) {
      setPdfDoc(null);
      setImageBackgroundUrl(null);
      setImageNaturalSize(null);
      setRenderError(null);
      revokeImageObjectUrl();
      return;
    }
    if (isPdfJsConfigLoading) {
      return;
    }

    let cancelled = false;
    const loadPdf = async () => {
      setLoadingPdf(true);
      setRenderError(null);
      try {
        const mxGlobal = (window as any).mx;
        if (!mxGlobal?.data?.getDocumentUrl) {
          throw new Error("mx.data.getDocumentUrl is not available.");
        }
        const url = mxGlobal.data.getDocumentUrl(basePdfId);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load PDF. HTTP ${response.status}.`);
        }
        const blob = await response.blob();
        const data = await blob.arrayBuffer();

        try {
          const pdfjs = await loadPdfjs(resolvedScriptUrl);
          pdfjs.GlobalWorkerOptions.workerSrc = resolvedWorkerUrl || pdfjs.GlobalWorkerOptions.workerSrc;
          const doc = await pdfjs.getDocument({ data }).promise;
          if (!cancelled) {
            setPdfDoc(doc);
            setPageIndex(0);
            setImageBackgroundUrl(null);
            setImageNaturalSize(null);
            revokeImageObjectUrl();
          }
          return;
        } catch (pdfError) {
          try {
            const loadedImage = await loadImageFromBlob(blob);
            if (!cancelled) {
              revokeImageObjectUrl();
              imageObjectUrlRef.current = loadedImage.url;
              setImageBackgroundUrl(loadedImage.url);
              setImageNaturalSize({ width: loadedImage.width, height: loadedImage.height });
              setPdfDoc(null);
              setPageIndex(0);
            } else {
              URL.revokeObjectURL(loadedImage.url);
            }
          } catch (imageError) {
            const pdfMessage = pdfError instanceof Error ? pdfError.message : "Unknown PDF parse error.";
            const imageMessage = imageError instanceof Error ? imageError.message : "Unknown image parse error.";
            throw new Error(`Failed to load base document as PDF (${pdfMessage}) or image (${imageMessage}).`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load PDF.";
        if (!cancelled) {
          setRenderError(message);
          setPdfDoc(null);
          setImageBackgroundUrl(null);
          setImageNaturalSize(null);
          revokeImageObjectUrl();
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [basePdfId, isPdfJsConfigLoading, resolvedScriptUrl, resolvedWorkerUrl, revokeImageObjectUrl]);

  useEffect(() => {
    if (!pdfDoc) {
      return;
    }
    if (pageIndex > pdfDoc.numPages - 1) {
      setPageIndex(0);
    }
  }, [pdfDoc, pageIndex]);

  useEffect(() => {
    if (!imageBackgroundUrl) {
      return;
    }
    if (pageIndex !== 0) {
      setPageIndex(0);
    }
  }, [imageBackgroundUrl, pageIndex]);

  useEffect(() => {
    if (!pdfDoc) {
      if (activePageRenderTaskRef.current?.cancel) {
        try {
          activePageRenderTaskRef.current.cancel();
        } catch (_error) {
          // Ignore render cancellation failures.
        }
      }
      activePageRenderTaskRef.current = null;
      return;
    }

    let cancelled = false;
    const renderPage = async () => {
      try {
        if (!cancelled) {
          setRenderError(null);
        }
        if (activePageRenderTaskRef.current?.cancel) {
          try {
            activePageRenderTaskRef.current.cancel();
          } catch (_error) {
            // Ignore render cancellation failures.
          }
          activePageRenderTaskRef.current = null;
        }
        const page = await pdfDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        const fitScale = containerWidth ? Math.min(containerWidth / viewport.width, 2) : 1;
        const nextScale = fitScale * zoom;
        if (!cancelled) {
          setPageSize({ width: viewport.width, height: viewport.height });
          setRenderScale(nextScale);
        }
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
          return;
        }
        const scaledViewport = page.getViewport({ scale: nextScale });
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;
        const renderTask = page.render({ canvasContext: context, viewport: scaledViewport });
        activePageRenderTaskRef.current = renderTask;
        await renderTask.promise;
        if (activePageRenderTaskRef.current === renderTask) {
          activePageRenderTaskRef.current = null;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to render page.";
        const normalizedMessage = message.toLowerCase();
        if (normalizedMessage.includes("renderingcancelledexception") || normalizedMessage.includes("rendering cancelled")) {
          return;
        }
        if (normalizedMessage.includes("cannot use the same canvas during multiple render")) {
          return;
        }
        if (!cancelled) {
          setRenderError(message);
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      const activeTask = activePageRenderTaskRef.current;
      if (activeTask?.cancel) {
        try {
          activeTask.cancel();
        } catch (_error) {
          // Ignore render cancellation failures.
        }
      }
      if (activePageRenderTaskRef.current === activeTask) {
        activePageRenderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageIndex, containerWidth, zoom]);

  useEffect(() => {
    if (pdfDoc || !imageNaturalSize) {
      return;
    }

    const fitScale = containerWidth ? Math.min(containerWidth / imageNaturalSize.width, 2) : 1;
    setPageSize({ width: imageNaturalSize.width, height: imageNaturalSize.height });
    setRenderScale(fitScale * zoom);
  }, [pdfDoc, imageNaturalSize, containerWidth, zoom]);

  useEffect(() => {
    if (!pdfDoc) {
      if (imageBackgroundUrl) {
        setPageThumbs({ 0: imageBackgroundUrl });
      } else {
        setPageThumbs({});
      }
      setIsBuildingThumbs(false);
      return;
    }

    let cancelled = false;
    setPageThumbs({});
    setIsBuildingThumbs(true);

    const buildThumbs = async () => {
      const thumbWidth = 120;
      for (let page = 1; page <= pdfDoc.numPages; page += 1) {
        try {
          const proxy = await pdfDoc.getPage(page);
          const baseViewport = proxy.getViewport({ scale: 1 });
          const scale = thumbWidth / baseViewport.width;
          const viewport = proxy.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await proxy.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (!cancelled) {
            setPageThumbs(prev => ({ ...prev, [page - 1]: dataUrl }));
          }
        } catch (_error) {
          if (cancelled) {
            return;
          }
        }
      }
      if (!cancelled) {
        setIsBuildingThumbs(false);
      }
    };

    buildThumbs();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, imageBackgroundUrl]);

  const runConfiguredAction = useCallback((actionValue?: { canExecute: boolean; execute: () => void }) => {
    if (actionValue?.canExecute) {
      actionValue.execute();
    }
  }, []);

  const commitDataJson = useCallback(
    (
      nextViewerValues: Record<string, ViewerFieldValue>,
      options: {
        runSaveAction?: boolean;
        runOnChangeAction?: boolean;
      } = {}
    ) => {
      const { runSaveAction = false, runOnChangeAction = false } = options;
      const attribute = dataSourceItem?.dataJsonAttr;
      if (attribute && attribute.status === "available") {
        const payloadObject = buildDataPayload(fieldsRef.current, nextViewerValues, lastParsedDataJsonRef.current);
        const payload = buildDataJson(fieldsRef.current, nextViewerValues, lastParsedDataJsonRef.current);
        if ((attribute.value || "") !== payload) {
          try {
            attribute.setValue(payload);
            lastLoadedDataJsonRef.current = payload;
            lastParsedDataJsonRef.current = payloadObject;
          } catch (error) {
            console.warn("Failed to update Data JSON attribute.", error);
          }
        }
      }

      if (runOnChangeAction) {
        runConfiguredAction(dataSourceItem?.onChangeAction);
      }

      if (runSaveAction) {
        runConfiguredAction(dataSourceItem?.onSaveAction);
      }
    },
    [dataSourceItem, runConfiguredAction]
  );

  useEffect(() => {
    if (!isViewerMode || !isDataJsonBound || !viewerFieldValuesDirtyRef.current) {
      return;
    }
    viewerFieldValuesDirtyRef.current = false;
    commitDataJson(viewerFieldValues);
  }, [isViewerMode, isDataJsonBound, viewerFieldValues, commitDataJson]);

  const commitTemplate = useCallback(
    (
      nextFields: TemplateField[],
      options: {
        runSaveAction?: boolean;
        runOnChangeAction?: boolean;
      } = {}
    ) => {
      const { runSaveAction = false, runOnChangeAction = true } = options;
      const payload = buildTemplateJson(nextFields, basePdfId);
      lastLoadedJsonRef.current = payload;

      const attribute = dataSourceItem?.templateJsonAttr;
      if (attribute && attribute.status === "available") {
        try {
          attribute.setValue(payload);
        } catch (error) {
          // Best-effort update; avoid crashing the widget when Mendix marks the attribute read-only.
          console.warn("Failed to update Template JSON attribute.", error);
        }
      }

      if (runOnChangeAction) {
        runConfiguredAction(dataSourceItem?.onChangeAction);
      }

      if (runSaveAction) {
        runConfiguredAction(dataSourceItem?.onSaveAction);
      }
    },
    [dataSourceItem, basePdfId, runConfiguredAction]
  );

  const viewerTemplateValues = useMemo(
    () => buildDataPayload(fields, viewerFieldValues, lastParsedDataJsonRef.current),
    [fields, viewerFieldValues]
  );

  const pushUndoSnapshot = useCallback((snapshot?: TemplateField[]) => {
    const source = snapshot || fieldsRef.current;
    undoStackRef.current.push(cloneFields(source));
    if (undoStackRef.current.length > HISTORY_LIMIT) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  const applyFieldUpdate = useCallback(
    (
      updater: (prev: TemplateField[]) => TemplateField[],
      options: { commit?: boolean; history?: boolean } = {}
    ) => {
      const { commit = true, history = true } = options;
      setFields(prev => {
        const next = cloneFields(updater(prev));
        if (areFieldsEqual(prev, next)) {
          return prev;
        }
        if (history) {
          pushUndoSnapshot(prev);
        }
        if (commit) {
          commitTemplate(next);
        }
        return next;
      });
    },
    [commitTemplate, pushUndoSnapshot]
  );

  const createField = useCallback(
    (
      type: FieldType,
      x: number,
      y: number,
      overrides?: Partial<
        Pick<
          TemplateField,
          | "key"
          | "label"
          | "variablesSampleData"
          | "format"
          | "options"
          | "imageDataUrl"
          | "labelOrientation"
          | "optionsOrientation"
          | "w"
          | "h"
          | "fontSize"
          | "align"
          | "showLabel"
          | "required"
        >
      >
    ): TemplateField => {
      const defaults = FIELD_DEFAULTS[type];
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      const key = overrides?.key?.trim() || nextFieldKey(type, fieldsRef.current);
      const fieldWidth = Math.max(8, toNumber(overrides?.w, defaults.w));
      const fieldHeight = Math.max(8, toNumber(overrides?.h, defaults.h));
      const fontSize = Math.max(6, toNumber(overrides?.fontSize, defaults.fontSize));
      const align = overrides?.align && isAlign(overrides.align) ? overrides.align : defaults.align;
      const format = normalizeFieldFormat(type, overrides?.format);
      const snappedX = snapValue(clamp(x - fieldWidth / 2, 0, width - fieldWidth), snapEnabled);
      const snappedY = snapValue(clamp(y - fieldHeight / 2, 0, height - fieldHeight), snapEnabled);
      return {
        id: createFieldId(),
        key,
        label: overrides?.label ?? "",
        variablesSampleData: overrides?.variablesSampleData ?? "",
        format,
        options: overrides?.options ? [...overrides.options] : defaultOptionsForFieldType(type),
        imageDataUrl: overrides?.imageDataUrl ?? "",
        labelOrientation:
          overrides?.labelOrientation && isFieldOrientation(overrides.labelOrientation)
            ? overrides.labelOrientation
            : defaultLabelOrientationForFieldType(type),
        optionsOrientation:
          overrides?.optionsOrientation && isFieldOrientation(overrides.optionsOrientation)
            ? overrides.optionsOrientation
            : defaultOptionsOrientationForFieldType(type),
        showLabel: overrides?.showLabel ?? true,
        type,
        page: pageIndex,
        x: snappedX,
        y: snappedY,
        w: fieldWidth,
        h: fieldHeight,
        fontSize,
        align,
        required: overrides?.required ?? false
      };
    },
    [pageIndex, pageSize, snapEnabled]
  );

  const addFieldAt = useCallback(
    (
      type: FieldType,
      x: number,
      y: number,
      overrides?: Partial<
        Pick<
          TemplateField,
          | "key"
          | "label"
          | "variablesSampleData"
          | "format"
          | "options"
          | "imageDataUrl"
          | "labelOrientation"
          | "optionsOrientation"
          | "w"
          | "h"
          | "fontSize"
          | "align"
          | "showLabel"
          | "required"
        >
      >
    ) => {
      const field = createField(type, x, y, overrides);
      applyFieldUpdate(prev => [...prev, field]);
      setSelectedFieldId(field.id);
    },
    [createField, applyFieldUpdate]
  );

  const addFieldCentered = useCallback(
    (
      type: FieldType,
      overrides?: Partial<
        Pick<
          TemplateField,
          | "key"
          | "label"
          | "variablesSampleData"
          | "format"
          | "options"
          | "imageDataUrl"
          | "labelOrientation"
          | "optionsOrientation"
          | "w"
          | "h"
          | "fontSize"
          | "align"
          | "showLabel"
          | "required"
        >
      >
    ) => {
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      addFieldAt(type, width / 2, height / 2, overrides);
    },
    [addFieldAt, pageSize]
  );

  const updateField = useCallback(
    (fieldId: string, changes: Partial<TemplateField>, options?: { commit?: boolean; history?: boolean }) => {
      applyFieldUpdate(
        prev => prev.map(field => (field.id === fieldId ? { ...field, ...changes } : field)),
        options
      );
    },
    [applyFieldUpdate]
  );

  const deleteField = useCallback(
    (fieldId: string, options?: { commit?: boolean; history?: boolean }) => {
      applyFieldUpdate(prev => prev.filter(field => field.id !== fieldId), options);
      if (selectedFieldIdRef.current === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [applyFieldUpdate]
  );

  const clearFields = useCallback(() => {
    applyFieldUpdate(() => []);
    setSelectedFieldId(null);
  }, [applyFieldUpdate]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) {
      return;
    }
    redoStackRef.current.push(cloneFields(fieldsRef.current));
    const next = cloneFields(previous);
    setFields(next);
    commitTemplate(next);
    setGuides([]);
    const activeFieldId = selectedFieldIdRef.current;
    if (activeFieldId && !next.some(field => field.id === activeFieldId)) {
      setSelectedFieldId(next[0]?.id || null);
    }
  }, [commitTemplate]);

  const redo = useCallback(() => {
    const nextSnapshot = redoStackRef.current.pop();
    if (!nextSnapshot) {
      return;
    }
    undoStackRef.current.push(cloneFields(fieldsRef.current));
    const next = cloneFields(nextSnapshot);
    setFields(next);
    commitTemplate(next);
    setGuides([]);
    const activeFieldId = selectedFieldIdRef.current;
    if (activeFieldId && !next.some(field => field.id === activeFieldId)) {
      setSelectedFieldId(next[0]?.id || null);
    }
  }, [commitTemplate]);

  const duplicateSelectedField = useCallback(() => {
    const activeFieldId = selectedFieldIdRef.current;
    if (!activeFieldId) {
      return;
    }
    const source = fieldsRef.current.find(field => field.id === activeFieldId);
    if (!source) {
      return;
    }
    const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
    const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
    const field: TemplateField = {
      ...source,
      id: createFieldId(),
      x: snapValue(clamp(source.x + 12, 0, width - source.w), snapEnabled),
      y: snapValue(clamp(source.y + 12, 0, height - source.h), snapEnabled)
    };
    applyFieldUpdate(prev => [...prev, field]);
    setSelectedFieldId(field.id);
  }, [applyFieldUpdate, pageSize, snapEnabled]);

  const nudgeSelectedField = useCallback(
    (deltaX: number, deltaY: number) => {
      const activeFieldId = selectedFieldIdRef.current;
      if (!activeFieldId) {
        return;
      }
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      applyFieldUpdate(prev => {
        let changed = false;
        const next = prev.map(field => {
          if (field.id !== activeFieldId) {
            return field;
          }
          const x = clamp(field.x + deltaX, 0, width - field.w);
          const y = clamp(field.y + deltaY, 0, height - field.h);
          if (x === field.x && y === field.y) {
            return field;
          }
          changed = true;
          return { ...field, x, y };
        });
        return changed ? next : prev;
      });
    },
    [applyFieldUpdate, pageSize]
  );

  const selectedField = useMemo(
    () => fields.find(field => field.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );
  const selectedFieldDateFormat =
    selectedField && selectedField.type === "date"
      ? normalizeFieldFormat("date", selectedField.format)
      : DEFAULT_DATE_FIELD_FORMAT;
  const selectedFieldHasCustomDateFormat = !DATE_FIELD_FORMAT_OPTIONS.some(option => option.value === selectedFieldDateFormat);
  useEffect(() => {
    setOptionDraft("");
    setImageUploadError(null);
  }, [selectedFieldId]);

  const keyInputState = useMemo(() => {
    if (fieldKeySourceMode === "datasource") {
      return {
        mode: "dropdown" as const,
        options: withComputedKeyOptions(datasourceKeyOptionsState.options),
        loading: datasourceKeyOptionsState.loading,
        error: datasourceKeyOptionsState.error
      };
    }

    if (fieldKeySourceMode === "json") {
      return {
        mode: "dropdown" as const,
        options: withComputedKeyOptions(jsonKeyOptionsState.options),
        loading: false,
        error: jsonKeyOptionsState.error
      };
    }

    return {
      mode: "manual" as const,
      options: [] as KeyOption[],
      loading: false,
      error: undefined as string | undefined
    };
  }, [fieldKeySourceMode, datasourceKeyOptionsState, jsonKeyOptionsState]);
  const selectedFieldKeyOptions = useMemo(() => {
    if (keyInputState.mode !== "dropdown" || !selectedField) {
      return [] as KeyOption[];
    }

    const currentValue = selectedField.key;
    const hasCurrentValue = keyInputState.options.some(option => option.value === currentValue);
    if (hasCurrentValue || !currentValue) {
      return keyInputState.options;
    }

    return [{ value: currentValue, label: `${currentValue} (current)` }, ...keyInputState.options];
  }, [keyInputState, selectedField]);
  const selectedFieldSourceKeyOption = useMemo(() => {
    if (keyInputState.mode !== "dropdown" || !selectedField) {
      return undefined;
    }
    return keyInputState.options.find(option => option.value === selectedField.key);
  }, [keyInputState, selectedField]);
  const selectedFieldEnumOptions = useMemo(
    () => normalizeOptionStrings(selectedFieldSourceKeyOption?.options),
    [selectedFieldSourceKeyOption]
  );
  const selectedFieldIsEnumBound =
    Boolean(selectedField) &&
    (selectedField?.type === "select" || selectedField?.type === "radio") &&
    isEnumerationKeyOption(selectedFieldSourceKeyOption);
  const selectedFieldEffectiveOptions = useMemo(() => {
    if (!selectedField || (selectedField.type !== "select" && selectedField.type !== "radio")) {
      return [] as string[];
    }
    if (selectedFieldIsEnumBound && selectedFieldEnumOptions.length > 0) {
      return selectedFieldEnumOptions;
    }
    return selectedField.options.length > 0 ? selectedField.options : defaultOptionsForFieldType(selectedField.type);
  }, [selectedField, selectedFieldIsEnumBound, selectedFieldEnumOptions]);
  const selectedFieldIsImageKeyBound =
    Boolean(selectedField) && selectedField?.type === "image" && Boolean(selectedFieldSourceKeyOption);
  const selectedFieldImagePreview = useMemo(() => {
    if (!selectedField || selectedField.type !== "image") {
      return "";
    }
    const keyedImage = normalizeImageDataFromUnknown(viewerFieldValues[selectedField.key]);
    const staticImage = normalizeImageDataFromUnknown(selectedField.imageDataUrl);
    return keyedImage || staticImage;
  }, [selectedField, viewerFieldValues]);

  useEffect(() => {
    if (!selectedField || (selectedField.type !== "select" && selectedField.type !== "radio")) {
      return;
    }
    if (!selectedFieldIsEnumBound || selectedFieldEnumOptions.length === 0) {
      return;
    }
    if (areStringArraysEqual(selectedField.options, selectedFieldEnumOptions)) {
      return;
    }
    updateField(selectedField.id, { options: [...selectedFieldEnumOptions] }, { history: false });
  }, [selectedField, selectedFieldIsEnumBound, selectedFieldEnumOptions, updateField]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      if (!dragState) {
        return;
      }

      const scale = renderScale || 1;
      const deltaX = (event.clientX - dragState.startX) / scale;
      const deltaY = (event.clientY - dragState.startY) / scale;
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      const relatedFields = fieldsRef.current.filter(
        field => field.page === dragState.startField.page && field.id !== dragState.fieldId
      );
      const verticalRefs = relatedFields.flatMap(fieldVerticalLines);
      const horizontalRefs = relatedFields.flatMap(fieldHorizontalLines);
      const activeGuides: GuideLine[] = [];

      const update = (field: TemplateField): TemplateField => {
        if (field.id !== dragState.fieldId) {
          return field;
        }

        if (dragState.mode === "move") {
          let nextX = clamp(dragState.startField.x + deltaX, 0, width - field.w);
          let nextY = clamp(dragState.startField.y + deltaY, 0, height - field.h);

          if (snapEnabled) {
            nextX = snapValue(nextX, true);
            nextY = snapValue(nextY, true);
            const snappedX = snapPositionToReferences(nextX, field.w, verticalRefs, ALIGN_TOLERANCE);
            const snappedY = snapPositionToReferences(nextY, field.h, horizontalRefs, ALIGN_TOLERANCE);
            nextX = clamp(snappedX.position, 0, width - field.w);
            nextY = clamp(snappedY.position, 0, height - field.h);
            if (snappedX.guide !== undefined) {
              activeGuides.push({ axis: "x", value: snappedX.guide });
            }
            if (snappedY.guide !== undefined) {
              activeGuides.push({ axis: "y", value: snappedY.guide });
            }
          }

          return { ...field, x: nextX, y: nextY };
        }

        const minW = field.type === "checkbox" ? 12 : 20;
        const minH = field.type === "checkbox" ? 12 : 12;
        let nextW = clamp(dragState.startField.w + deltaX, minW, width - field.x);
        let nextH = clamp(dragState.startField.h + deltaY, minH, height - field.y);
        if (snapEnabled) {
          nextW = snapValue(nextW, true);
          nextH = snapValue(nextH, true);
          const rightRef = findClosestReference(field.x + nextW, verticalRefs, ALIGN_TOLERANCE);
          const bottomRef = findClosestReference(field.y + nextH, horizontalRefs, ALIGN_TOLERANCE);
          if (rightRef !== undefined) {
            nextW = clamp(rightRef - field.x, minW, width - field.x);
            activeGuides.push({ axis: "x", value: rightRef });
          }
          if (bottomRef !== undefined) {
            nextH = clamp(bottomRef - field.y, minH, height - field.y);
            activeGuides.push({ axis: "y", value: bottomRef });
          }
        }
        return { ...field, w: nextW, h: nextH };
      };

      applyFieldUpdate(
        prev => prev.map(field => (field.id === dragState.fieldId ? update(field) : field)),
        { commit: false, history: false }
      );
      setGuides(activeGuides);
    };

    const handleUp = () => {
      setDragState(null);
      setGuides([]);
      const previous = undoStackRef.current[undoStackRef.current.length - 1];
      const hasChanged = !previous || !areFieldsEqual(previous, fieldsRef.current);
      if (!hasChanged && previous) {
        undoStackRef.current.pop();
      }
      if (hasChanged) {
        commitTemplate(fieldsRef.current);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, renderScale, pageSize, snapEnabled, applyFieldUpdate, commitTemplate]);

  const handleFieldPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, field: TemplateField, mode: "move" | "resize") => {
      event.stopPropagation();
      event.preventDefault();
      pushUndoSnapshot();
      setSelectedFieldId(field.id);
      setGuides([]);
      setDragState({
        fieldId: field.id,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startField: { ...field }
      });
    },
    [pushUndoSnapshot]
  );

  const selectedPlacementTool = useMemo(
    () => visibleToolRailItems.find(tool => tool.id === placementToolId) || null,
    [placementToolId, visibleToolRailItems]
  );
  useEffect(() => {
    if (placementToolId && !selectedPlacementTool) {
      setPlacementToolId(null);
    }
  }, [placementToolId, selectedPlacementTool]);

  const buildOverridesForTool = useCallback(
    (tool: (typeof TOOL_RAIL_ITEMS)[number]) => {
      const key = nextPrefixedFieldKey(tool.keyBase || tool.id || tool.type, fieldsRef.current);
      return {
        key,
        label: tool.seedLabel || "",
        variablesSampleData: tool.type === "multiVariableText" ? "{name}" : undefined,
        format: tool.format,
        w: tool.w,
        h: tool.h,
        align: tool.align,
        showLabel: tool.showLabel
      } as Partial<Pick<TemplateField, "key" | "label" | "variablesSampleData" | "format" | "w" | "h" | "align" | "showLabel">>;
    },
    []
  );

  const placeToolAtClientPoint = useCallback(
    (tool: (typeof TOOL_RAIL_ITEMS)[number], clientX: number, clientY: number) => {
      if (!overlayRef.current) {
        return;
      }
      const rect = overlayRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / (renderScale || 1);
      const y = (clientY - rect.top) / (renderScale || 1);
      addFieldAt(tool.type, x, y, buildOverridesForTool(tool));
    },
    [addFieldAt, buildOverridesForTool, renderScale]
  );

  const addToolFieldCentered = useCallback(
    (tool: (typeof TOOL_RAIL_ITEMS)[number]) => {
      addFieldCentered(tool.type, buildOverridesForTool(tool));
    },
    [addFieldCentered, buildOverridesForTool]
  );

  const placeAtClientPoint = useCallback(
    (type: FieldType, clientX: number, clientY: number) => {
      if (!overlayRef.current) {
        return;
      }
      const rect = overlayRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / (renderScale || 1);
      const y = (clientY - rect.top) / (renderScale || 1);
      addFieldAt(type, x, y);
    },
    [addFieldAt, renderScale]
  );

  const handlePaletteDragStart = useCallback((event: ReactDragEvent<HTMLButtonElement>, toolId: string) => {
    event.dataTransfer.setData(PALETTE_TYPE_DRAG_TYPE, toolId);
    event.dataTransfer.effectAllowed = "copy";
    setPlacementToolId(toolId);
  }, []);

  const handleOverlayDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(PALETTE_TYPE_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleOverlayDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const droppedToolId = event.dataTransfer.getData(PALETTE_TYPE_DRAG_TYPE).trim();
      const droppedTool =
        visibleToolRailItems.find(tool => tool.id === droppedToolId) ||
        visibleToolRailItems.find(tool => tool.type === droppedToolId);
      if (droppedTool) {
        event.preventDefault();
        placeToolAtClientPoint(droppedTool, event.clientX, event.clientY);
        setPlacementToolId(droppedTool.id);
        return;
      }
      if (isFieldType(droppedToolId)) {
        event.preventDefault();
        placeAtClientPoint(droppedToolId, event.clientX, event.clientY);
      }
    },
    [placeAtClientPoint, placeToolAtClientPoint, visibleToolRailItems]
  );

  const handleOverlayPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target !== overlayRef.current) {
        return;
      }
      if (selectedPlacementTool) {
        event.preventDefault();
        placeToolAtClientPoint(selectedPlacementTool, event.clientX, event.clientY);
        return;
      }
      setSelectedFieldId(null);
    },
    [selectedPlacementTool, placeToolAtClientPoint]
  );

  useEffect(() => {
    if (isViewerMode || !enableKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        setPlacementToolId(null);
        setGuides([]);
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (hasModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (hasModifier && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (hasModifier && key === "d") {
        event.preventDefault();
        duplicateSelectedField();
        return;
      }

      const activeFieldId = selectedFieldIdRef.current;
      if (!activeFieldId) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteField(activeFieldId);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          nudgeSelectedField(-step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          nudgeSelectedField(step, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          nudgeSelectedField(0, -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          nudgeSelectedField(0, step);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerMode, enableKeyboardShortcuts, undo, redo, duplicateSelectedField, deleteField, nudgeSelectedField]);

  const handleSaveClick = useCallback(() => {
    if (isViewerMode) {
      viewerFieldValuesDirtyRef.current = false;
      commitDataJson(viewerFieldValues, { runSaveAction: true, runOnChangeAction: false });
      return;
    }
    commitTemplate(fieldsRef.current, { runSaveAction: true, runOnChangeAction: false });
  }, [isViewerMode, commitDataJson, viewerFieldValues, commitTemplate]);

  const handleReloadTemplateClick = useCallback(() => {
    if (isViewerMode) {
      return;
    }
    const parsed = parseTemplateJson(templateJsonText);
    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }
    setJsonError(null);
    setFields(parsed.fields);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setGuides([]);
    setSelectedFieldId(parsed.fields[0]?.id || null);
    lastLoadedJsonRef.current = templateJsonText;
  }, [isViewerMode, templateJsonText]);

  const handleExportTemplateClick = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const payload = buildTemplateJson(fieldsRef.current, basePdfId);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [basePdfId]);

  const reorderFieldListItem = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) {
        return;
      }
      applyFieldUpdate(prev => {
        const fromIndex = prev.findIndex(field => field.id === sourceId);
        const toIndex = prev.findIndex(field => field.id === targetId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return prev;
        }
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [applyFieldUpdate]
  );

  const handleFieldListDragEnd = useCallback(() => {
    setDraggedFieldListItemId(null);
    setFieldListDropTargetId(null);
  }, []);

  const setViewerFieldValue = useCallback((fieldKey: string, value: ViewerFieldValue) => {
    setViewerFieldValues(previousValues => {
      if (previousValues[fieldKey] === value) {
        return previousValues;
      }
      viewerFieldValuesDirtyRef.current = true;
      return { ...previousValues, [fieldKey]: value };
    });
  }, []);

  const addOptionToSelectedField = useCallback(() => {
    if (!selectedField || (selectedField.type !== "select" && selectedField.type !== "radio")) {
      return;
    }
    if (selectedFieldIsEnumBound) {
      return;
    }
    const nextOption = optionDraft.trim();
    if (!nextOption) {
      return;
    }
    const nextOptions = [...selectedFieldEffectiveOptions];
    if (nextOptions.includes(nextOption)) {
      setOptionDraft("");
      return;
    }
    nextOptions.push(nextOption);
    updateField(selectedField.id, { options: nextOptions });
    setOptionDraft("");
  }, [selectedField, selectedFieldIsEnumBound, optionDraft, selectedFieldEffectiveOptions, updateField]);

  const updateSelectedFieldOption = useCallback(
    (index: number, value: string) => {
      if (!selectedField || (selectedField.type !== "select" && selectedField.type !== "radio")) {
        return;
      }
      if (selectedFieldIsEnumBound) {
        return;
      }
      if (index < 0 || index >= selectedFieldEffectiveOptions.length) {
        return;
      }
      const nextOptions = [...selectedFieldEffectiveOptions];
      nextOptions[index] = value;
      updateField(selectedField.id, { options: nextOptions });
    },
    [selectedField, selectedFieldIsEnumBound, selectedFieldEffectiveOptions, updateField]
  );

  const removeSelectedFieldOption = useCallback(
    (index: number) => {
      if (!selectedField || (selectedField.type !== "select" && selectedField.type !== "radio")) {
        return;
      }
      if (selectedFieldIsEnumBound) {
        return;
      }
      if (index < 0 || index >= selectedFieldEffectiveOptions.length) {
        return;
      }
      const nextOptions = selectedFieldEffectiveOptions.filter((_option, optionIndex) => optionIndex !== index);
      updateField(selectedField.id, { options: nextOptions });
    },
    [selectedField, selectedFieldIsEnumBound, selectedFieldEffectiveOptions, updateField]
  );

  const handleSelectedFieldImageUpload = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      if (!selectedField || selectedField.type !== "image" || selectedFieldIsImageKeyBound) {
        return;
      }
      const selectedFieldImageId = selectedField.id;
      const file = event.currentTarget.files?.[0];
      if (!file) {
        return;
      }
      if (!file.type.toLowerCase().startsWith("image/")) {
        setImageUploadError("Please choose a valid image file.");
        event.currentTarget.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const normalized = normalizeImageDataFromUnknown(reader.result);
        if (!normalized) {
          setImageUploadError("Unable to read the selected image.");
          return;
        }
        rasterizeImageDataUrlToPng(normalized)
          .then(rasterized => {
            const finalImage = normalizeImageDataFromUnknown(rasterized) || normalized;
            setImageUploadError(null);
            updateField(selectedFieldImageId, { imageDataUrl: finalImage });
          })
          .catch(() => {
            setImageUploadError(null);
            updateField(selectedFieldImageId, { imageDataUrl: normalized });
          });
      };
      reader.onerror = () => {
        setImageUploadError("Unable to read the selected image.");
      };
      reader.readAsDataURL(file);
      event.currentTarget.value = "";
    },
    [selectedField, selectedFieldIsImageKeyBound, updateField]
  );

  const clearSelectedFieldImage = useCallback(() => {
    if (!selectedField || selectedField.type !== "image") {
      return;
    }
    setImageUploadError(null);
    updateField(selectedField.id, { imageDataUrl: "" });
  }, [selectedField, updateField]);

  const clearViewerSignature = useCallback(
    (fieldKey: string) => {
      setViewerFieldValue(fieldKey, "");
      setViewerSignatureMessage(null);
    },
    [setViewerFieldValue]
  );

  const importSignatureFromSigWeb = useCallback(
    async (fieldKey: string) => {
      if (typeof window === "undefined") {
        return;
      }
      const globalObject = window as any;
      const captureFunction = resolveSigWebCaptureFunction(globalObject);
      if (!captureFunction) {
        setViewerSignatureMessage(
          "SigWeb capture function was not found. Verify that SigWebTablet.js is loaded and the pad service is available."
        );
        return;
      }

      const pointCountBeforeCapture = getSigWebPointCount(globalObject);
      if (pointCountBeforeCapture !== undefined && pointCountBeforeCapture <= 0) {
        setViewerSignatureMessage("No pen strokes were detected on the signature pad. Please sign first, then click Use SigWeb.");
        return;
      }

      try {
        applySigWebImageDefaults(globalObject);
        const normalizedValue = await captureSignatureFromSigWeb(captureFunction);
        if (!normalizedValue) {
          const pointCountAfterCapture = getSigWebPointCount(globalObject);
          if (pointCountAfterCapture !== undefined && pointCountAfterCapture <= 0) {
            setViewerSignatureMessage("SigWeb reported no captured points. Please sign on the pad and try again.");
          } else {
            setViewerSignatureMessage(
              "SigWeb returned no signature image. Verify SigWebTablet.js is connected to the pad service and try again."
            );
          }
          return;
        }
        setViewerFieldValue(fieldKey, normalizedValue);
        setViewerSignatureMessage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown SigWeb error.";
        setViewerSignatureMessage(`Failed to import signature from SigWeb. ${message}`);
      }
    },
    [setViewerFieldValue]
  );

  const handlePlacementSelect = useCallback((toolId: string) => {
    setPlacementToolId(current => (current === toolId ? null : toolId));
  }, []);

  const applyPageJump = useCallback(() => {
    const maxPages = pdfDoc?.numPages || (imageBackgroundUrl ? 1 : 1);
    const requested = Math.floor(toNumber(pageJumpInput, pageIndex + 1));
    const normalized = clamp(requested, 1, maxPages);
    setPageIndex(normalized - 1);
  }, [pageJumpInput, pageIndex, pdfDoc, imageBackgroundUrl]);

  const pageCount = pdfDoc?.numPages || (imageBackgroundUrl ? 1 : 1);
  const fieldsOnPage = fields.filter(field => field.page === pageIndex);
  const undoDisabled = undoStackRef.current.length === 0;
  const redoDisabled = redoStackRef.current.length === 0;
  const hasRenderableDocument = Boolean(pdfDoc || imageBackgroundUrl);
  // Template coordinates are stored in PDF points (top-left origin). Multiply by renderScale for canvas pixels.
  const renderWidth = pageSize.width * renderScale;
  const renderHeight = pageSize.height * renderScale;
  const activeViewerSignatureField = useMemo(
    () =>
      fieldsOnPage.find(
        field =>
          field.type === "signature" &&
          activeViewerSignatureFieldId !== null &&
          field.id === activeViewerSignatureFieldId
      ),
    [fieldsOnPage, activeViewerSignatureFieldId]
  );

  const renderViewerFieldControl = useCallback(
    (field: TemplateField): ReactElement => {
      if (field.type === "checkbox") {
        return (
          <label
            className={`pdf-template-designer__viewer-checkbox${
              field.labelOrientation === "vertical"
                ? " pdf-template-designer__viewer-checkbox--vertical"
                : " pdf-template-designer__viewer-checkbox--horizontal"
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(viewerFieldValues[field.key])}
              onChange={event => setViewerFieldValue(field.key, event.target.checked)}
            />
            <span>{field.showLabel ? field.label || field.key : ""}</span>
          </label>
        );
      }

      if (field.type === "signature") {
        const rawSignatureValue = viewerFieldValues[field.key];
        const signatureValue = typeof rawSignatureValue === "string" ? rawSignatureValue : "";
        return (
          <InlineSignatureCanvas
            width={Math.max(20, field.w * renderScale)}
            height={Math.max(20, field.h * renderScale)}
            value={signatureValue}
            onFocus={() => {
              setActiveViewerSignatureFieldId(field.id);
              setViewerSignatureMessage(null);
            }}
            onChange={nextValue => {
              setViewerFieldValue(field.key, nextValue);
              setActiveViewerSignatureFieldId(field.id);
              setViewerSignatureMessage(null);
            }}
          />
        );
      }

      if (field.type === "image") {
        const keyedImage = normalizeImageDataFromUnknown(viewerFieldValues[field.key]);
        const staticImage = normalizeImageDataFromUnknown(field.imageDataUrl);
        const imageSrc = keyedImage || staticImage;
        if (imageSrc) {
          return <img className="pdf-template-designer__viewer-image" src={imageSrc} alt={field.label || field.key || "Image"} draggable={false} />;
        }
        return <div className="pdf-template-designer__viewer-image-placeholder">{field.label || field.key || "Image"}</div>;
      }

      if (field.type === "multiVariableText") {
        const resolved = resolveMultiVariableText(field.variablesSampleData || "", viewerTemplateValues);
        return <div className="pdf-template-designer__viewer-multi">{resolved}</div>;
      }

      const inputStyle = {
        fontSize: Math.max(10, field.fontSize * renderScale * 0.9),
        textAlign: field.align
      } as const;
      const rawValue = viewerFieldValues[field.key];
      const value = typeof rawValue === "string" ? rawValue : "";
      const computedFallback =
        isComputedTokenKey(field.key) && !value.trim()
          ? resolveComputedTokenValue(field.key, field.type === "date" ? field.format : undefined) || ""
          : "";
      const displayValue = value.trim() ? value : computedFallback;
      if (field.type === "select") {
        const options = field.options.length > 0 ? field.options : defaultOptionsForFieldType(field.type);
        const hasDisplayValue = displayValue.trim().length > 0;
        const hasOptionValue = options.some(option => option === displayValue);
        return (
          <select
            className="pdf-template-designer__viewer-input pdf-template-designer__viewer-select"
            value={displayValue}
            style={inputStyle}
            onChange={event => setViewerFieldValue(field.key, event.target.value)}
          >
            {!hasDisplayValue ? <option value=""></option> : null}
            {!hasOptionValue && hasDisplayValue ? <option value={displayValue}>{displayValue}</option> : null}
            {options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      }
      if (field.type === "radio") {
        const options = field.options.length > 0 ? field.options : defaultOptionsForFieldType(field.type);
        if (options.length === 0) {
          return (
            <input
              className="pdf-template-designer__viewer-input"
              type="text"
              value={displayValue}
              style={inputStyle}
              onChange={event => setViewerFieldValue(field.key, event.target.value)}
            />
          );
        }
        return (
          <div
            className={`pdf-template-designer__viewer-radio-group${
              field.optionsOrientation === "horizontal"
                ? " pdf-template-designer__viewer-radio-group--horizontal"
                : " pdf-template-designer__viewer-radio-group--vertical"
            }`}
          >
            {options.map(option => (
              <label key={option} className="pdf-template-designer__viewer-radio-option">
                <input
                  type="radio"
                  name={`radio_${field.id}`}
                  value={option}
                  checked={displayValue === option}
                  onChange={event => {
                    if (event.target.checked) {
                      setViewerFieldValue(field.key, option);
                    }
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      }

      if (field.type === "date") {
        if (isComputedTokenKey(field.key)) {
          return (
            <div className="pdf-template-designer__viewer-date-static" style={inputStyle}>
              {displayValue}
            </div>
          );
        }

        const normalizedDateValue = normalizeDateInputValue(displayValue);
        if (!normalizedDateValue && displayValue) {
          return (
            <input
              className="pdf-template-designer__viewer-input"
              type="text"
              value={displayValue}
              style={inputStyle}
              onChange={event => setViewerFieldValue(field.key, event.target.value)}
            />
          );
        }
        return (
          <input
            className="pdf-template-designer__viewer-input"
            type="date"
            value={normalizedDateValue}
            style={inputStyle}
            onChange={event => setViewerFieldValue(field.key, event.target.value)}
          />
        );
      }

      return (
        <input
          className="pdf-template-designer__viewer-input"
          type="text"
          value={displayValue}
          style={inputStyle}
          onChange={event => setViewerFieldValue(field.key, event.target.value)}
        />
      );
    },
    [viewerFieldValues, renderScale, setViewerFieldValue, viewerTemplateValues]
  );

  if (!props.dataSource && !isViewerMode) {
    return (
      <div className={className} style={props.style} tabIndex={props.tabIndex}>
        <div className="pdf-template-designer__alert">Configure a data source for FormConfiguration.</div>
      </div>
    );
  }

  if (isViewerMode) {
    return (
      <div className={className} style={props.style} tabIndex={props.tabIndex}>
        <div className="pdf-template-designer__canvas">
          <div className="pdf-template-designer__toolbar">
            <div className="pdf-template-designer__toolbar-group">
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                type="button"
                disabled={pageIndex === 0}
              >
                Prev
              </button>
              <div className="pdf-template-designer__status">
                Page {pageIndex + 1} / {pageCount}
              </div>
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
                type="button"
                disabled={pageIndex >= pageCount - 1}
              >
                Next
              </button>
              <div className="pdf-template-designer__toolbar-jump">
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageJumpInput}
                  onChange={event => setPageJumpInput(event.target.value)}
                  onBlur={applyPageJump}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      applyPageJump();
                    }
                  }}
                />
              </div>
            </div>
            <div className="pdf-template-designer__toolbar-group">
              <select
                className="pdf-template-designer__select"
                value={zoom}
                onChange={event => setZoom(Number(event.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>
              <button
                className="pdf-template-designer__button pdf-template-designer__button--primary"
                onClick={handleSaveClick}
                type="button"
              >
                {saveButtonText}
              </button>
            </div>
          </div>
          {sigWebState === "loading" ? (
            <div className="pdf-template-designer__status">Loading SigWeb integration...</div>
          ) : null}
          {sigWebError ? <div className="pdf-template-designer__alert">{sigWebError}</div> : null}
          {showViewerDataJsonBindingWarning ? (
            <div className="pdf-template-designer__alert">
              Viewer mode Data JSON is not bound. User edits and signatures will not persist.
            </div>
          ) : null}
          {dataJsonError ? <div className="pdf-template-designer__alert">Data JSON is invalid. {dataJsonError}</div> : null}
          {viewerSignatureMessage ? <div className="pdf-template-designer__alert">{viewerSignatureMessage}</div> : null}

          <div className="pdf-template-designer__viewer" ref={viewerRef}>
            {!basePdfId ? <div className="pdf-template-designer__status">No base PDF linked.</div> : null}
            {loadingPdf ? <div className="pdf-template-designer__status">Loading document...</div> : null}
            {renderError ? <div className="pdf-template-designer__alert">{renderError}</div> : null}
            {hasRenderableDocument ? (
              <div className="pdf-template-designer__page" style={{ width: renderWidth, height: renderHeight }}>
                {pdfDoc ? (
                  <canvas className="pdf-template-designer__canvas-surface" ref={canvasRef} />
                ) : imageBackgroundUrl ? (
                  <img
                    className="pdf-template-designer__image-surface"
                    src={imageBackgroundUrl}
                    alt="Base document"
                    style={{ width: renderWidth, height: renderHeight }}
                    draggable={false}
                  />
                ) : null}
                <div className="pdf-template-designer__overlay pdf-template-designer__overlay--viewer">
                  {fieldsOnPage.map(field => (
                    <div
                      key={field.id}
                      className={`pdf-template-designer__viewer-field pdf-template-designer__viewer-field--${field.type}${
                        activeViewerSignatureFieldId === field.id ? " is-active" : ""
                      }`}
                      style={{
                        left: field.x * renderScale,
                        top: field.y * renderScale,
                        width: field.w * renderScale,
                        height: field.h * renderScale
                      }}
                      onPointerDown={() => {
                        if (field.type === "signature") {
                          setActiveViewerSignatureFieldId(field.id);
                          setViewerSignatureMessage(null);
                        } else if (activeViewerSignatureFieldId) {
                          setActiveViewerSignatureFieldId(null);
                        }
                      }}
                    >
                      {renderViewerFieldControl(field)}
                    </div>
                  ))}
                  {activeViewerSignatureField ? (
                    <div
                      className="pdf-template-designer__signature-actions"
                      style={{
                        left: activeViewerSignatureField.x * renderScale,
                        top: (activeViewerSignatureField.y + activeViewerSignatureField.h) * renderScale + 6
                      }}
                    >
                      <button
                        className="pdf-template-designer__button pdf-template-designer__button--compact"
                        type="button"
                        onClick={() => clearViewerSignature(activeViewerSignatureField.key)}
                      >
                        Clear signature
                      </button>
                      {sigWebState === "ready" ? (
                        <button
                          className="pdf-template-designer__button pdf-template-designer__button--compact"
                          type="button"
                          onClick={() => importSignatureFromSigWeb(activeViewerSignatureField.key)}
                        >
                          Use SigWeb
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={props.style} tabIndex={props.tabIndex}>
      {jsonError ? (
        <div className="pdf-template-designer__alert">Template JSON is invalid. {jsonError}</div>
      ) : null}
      <div
        className={`pdf-template-designer__layout${
          hasRightPanelSections ? "" : " pdf-template-designer__layout--no-properties"
        }${hasSidebarSections ? "" : " pdf-template-designer__layout--no-sidebar"}`}
      >
        {hasSidebarSections ? (
        <aside className="pdf-template-designer__sidebar">
          {showPaletteSection ? (
          <div>
            <div className="pdf-template-designer__palette">
              {visibleToolRailItems.map(item => {
                return (
                  <button
                    key={`palette_${item.id}`}
                    className={`pdf-template-designer__button pdf-template-designer__palette-tool${
                      placementToolId === item.id ? " is-active" : ""
                    }`}
                    title={item.tooltip}
                    aria-label={item.tooltip}
                    data-tooltip={item.tooltip}
                    onClick={() => handlePlacementSelect(item.id)}
                    onDoubleClick={() => addToolFieldCentered(item)}
                    draggable
                    onDragStart={event => handlePaletteDragStart(event, item.id)}
                    type="button"
                  >
                    <span className="pdf-template-designer__palette-tool-icon">{item.glyph}</span>
                    <span className="pdf-template-designer__palette-tool-text">{item.label}</span>
                  </button>
                );
              })}
              {visibleToolRailItems.length === 0 ? (
                <div className="pdf-template-designer__status">No palette tools are enabled in widget settings.</div>
              ) : null}
            </div>
          </div>
          ) : null}

          {showPagesSection ? (
          <div className="pdf-template-designer__sidebar-pages">
            <div className="pdf-template-designer__section-title">Pages</div>
            <div className="pdf-template-designer__thumb-list">
              {Array.from({ length: pageCount }, (_, idx) => (
                <button
                  key={`thumb_${idx}`}
                  type="button"
                  className={`pdf-template-designer__thumb${idx === pageIndex ? " is-selected" : ""}`}
                  onClick={() => setPageIndex(idx)}
                >
                  <div className="pdf-template-designer__thumb-canvas">
                    {pageThumbs[idx] ? (
                      <img src={pageThumbs[idx]} alt={`Page ${idx + 1}`} />
                    ) : (
                      <span className="pdf-template-designer__thumb-placeholder">
                        {isBuildingThumbs ? "..." : idx + 1}
                      </span>
                    )}
                  </div>
                  <span>Page {idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
          ) : null}

        </aside>
        ) : null}

        <section className="pdf-template-designer__canvas">
          <div className="pdf-template-designer__toolbar pdf-template-designer__toolbar--strip">
            <div className="pdf-template-designer__action-group">
              <span className="pdf-template-designer__action-label">Template</span>
              <button className="pdf-template-designer__button" type="button" onClick={handleReloadTemplateClick}>
                Load
              </button>
              <button className="pdf-template-designer__button" onClick={clearFields} type="button">
                Reset
              </button>
              <button className="pdf-template-designer__button" onClick={handleExportTemplateClick} type="button">
                Export
              </button>
              <button
                className="pdf-template-designer__button pdf-template-designer__button--primary"
                onClick={handleSaveClick}
                type="button"
              >
                {saveButtonText}
              </button>
            </div>

            <div className="pdf-template-designer__action-group">
              <span className="pdf-template-designer__action-label">View</span>
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                type="button"
                disabled={pageIndex === 0}
              >
                Prev
              </button>
              <div className="pdf-template-designer__status">
                Page {pageIndex + 1} / {pageCount}
              </div>
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.min(pageCount - 1, pageIndex + 1))}
                type="button"
                disabled={pageIndex >= pageCount - 1}
              >
                Next
              </button>
              <div className="pdf-template-designer__toolbar-jump">
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageJumpInput}
                  onChange={event => setPageJumpInput(event.target.value)}
                  onBlur={applyPageJump}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      applyPageJump();
                    }
                  }}
                />
              </div>
              <select
                className="pdf-template-designer__select"
                value={zoom}
                onChange={event => setZoom(Number(event.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>
            </div>

            <div className="pdf-template-designer__action-group">
              <span className="pdf-template-designer__action-label">Edit</span>
              <button className="pdf-template-designer__button" type="button" onClick={undo} disabled={undoDisabled}>
                Undo
              </button>
              <button className="pdf-template-designer__button" type="button" onClick={redo} disabled={redoDisabled}>
                Redo
              </button>
              <label className="pdf-template-designer__toggle">
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={event => setSnapEnabled(event.target.checked)}
                />
                Snap
              </label>
            </div>
          </div>
          {selectedPlacementTool ? (
            <div className="pdf-template-designer__status">
              Placing{" "}
              <strong>{selectedPlacementTool.tooltip}</strong>
              . Click the page to place.
            </div>
          ) : showShortcutHints ? (
            <div className="pdf-template-designer__status">
              Shortcuts: <code>Cmd/Ctrl+Z</code> undo, <code>Cmd/Ctrl+Shift+Z</code> redo, <code>Cmd/Ctrl+D</code> duplicate, <code>Del</code> delete, arrows nudge.
            </div>
          ) : null}

          <div className="pdf-template-designer__viewer" ref={viewerRef}>
            {!basePdfId ? <div className="pdf-template-designer__status">No base PDF linked.</div> : null}
            {loadingPdf ? <div className="pdf-template-designer__status">Loading PDF...</div> : null}
            {renderError ? <div className="pdf-template-designer__alert">{renderError}</div> : null}
            {hasRenderableDocument ? (
              <div className="pdf-template-designer__page" style={{ width: renderWidth, height: renderHeight }}>
                {pdfDoc ? (
                  <canvas className="pdf-template-designer__canvas-surface" ref={canvasRef} />
                ) : imageBackgroundUrl ? (
                  <img
                    className="pdf-template-designer__image-surface"
                    src={imageBackgroundUrl}
                    alt="Base document"
                    style={{ width: renderWidth, height: renderHeight }}
                    draggable={false}
                  />
                ) : null}
                <div
                  className={`pdf-template-designer__overlay${
                    snapEnabled ? " pdf-template-designer__overlay--grid" : ""
                  }${selectedPlacementTool ? " pdf-template-designer__overlay--placing" : ""}${
                    guides.length > 0 ? " pdf-template-designer__overlay--guides" : ""
                  }`}
                  ref={overlayRef}
                  onPointerDown={handleOverlayPointerDown}
                  onDragOver={handleOverlayDragOver}
                  onDrop={handleOverlayDrop}
                  style={
                    snapEnabled
                      ? { backgroundSize: `${SNAP_SIZE * renderScale}px ${SNAP_SIZE * renderScale}px` }
                      : undefined
                  }
                >
                  {guides.map((guide, index) => (
                    <div
                      key={`${guide.axis}_${guide.value}_${index}`}
                      className={`pdf-template-designer__guide pdf-template-designer__guide--${guide.axis}`}
                      style={guide.axis === "x" ? { left: guide.value * renderScale } : { top: guide.value * renderScale }}
                    />
                  ))}
                  {fieldsOnPage.map(field => (
                    <div
                      key={field.id}
                      className={`pdf-template-designer__field pdf-template-designer__field--${field.type}${
                        selectedFieldId === field.id ? " is-selected" : ""
                      }`}
                      style={{
                        left: field.x * renderScale,
                        top: field.y * renderScale,
                        width: field.w * renderScale,
                        height: field.h * renderScale
                      }}
                      onPointerDown={event => handleFieldPointerDown(event, field, "move")}
                    >
                      <div className="pdf-template-designer__field-content">
                        <div className="pdf-template-designer__field-label">
                          {field.type === "multiVariableText"
                            ? field.variablesSampleData || field.label || field.key
                            : field.showLabel
                            ? field.label || field.key
                            : selectedFieldId === field.id
                              ? "(label hidden)"
                              : ""}
                        </div>
                      </div>
                      <div
                        className="pdf-template-designer__resize-handle"
                        onPointerDown={event => handleFieldPointerDown(event, field, "resize")}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {hasRightPanelSections ? (
          <aside className="pdf-template-designer__properties">
            {showFieldsSection ? (
            <div>
              <div className="pdf-template-designer__section-title">Field list</div>
              <div className="pdf-template-designer__field-list">
                {fields.length === 0 ? (
                  <div className="pdf-template-designer__status">No fields yet.</div>
                ) : (
                  fields.map(field => (
                    <button
                      key={field.id}
                      className={`pdf-template-designer__field-pill${
                        selectedFieldId === field.id ? " is-selected" : ""
                      }${fieldListDropTargetId === field.id ? " is-drop-target" : ""}`}
                      type="button"
                      onClick={() => setSelectedFieldId(field.id)}
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedFieldListItemId(field.id);
                        setFieldListDropTargetId(field.id);
                      }}
                      onDragOver={event => {
                        event.preventDefault();
                        if (!draggedFieldListItemId) {
                          return;
                        }
                        if (fieldListDropTargetId !== field.id) {
                          setFieldListDropTargetId(field.id);
                        }
                      }}
                      onDrop={event => {
                        event.preventDefault();
                        if (draggedFieldListItemId) {
                          reorderFieldListItem(draggedFieldListItemId, field.id);
                        }
                        handleFieldListDragEnd();
                      }}
                      onDragEnd={handleFieldListDragEnd}
                    >
                      <span className="pdf-template-designer__field-pill-main">
                        <span className="pdf-template-designer__field-pill-label">{field.label || field.key}</span>
                        <span className="pdf-template-designer__field-pill-key">{field.key}</span>
                      </span>
                      <span className="pdf-template-designer__field-pill-badges">
                        <span className="pdf-template-designer__field-badge">{field.type}</span>
                        <span className="pdf-template-designer__field-badge">P{field.page + 1}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              {fields.length > 1 ? <div className="pdf-template-designer__status">Drag items to reorder.</div> : null}
            </div>
            ) : null}

            {showFieldProperties ? (
            <div className="pdf-template-designer__inspector">
            <div className="pdf-template-designer__inspector-header">
              <button
                type="button"
                className="pdf-template-designer__inspector-nav"
                onClick={duplicateSelectedField}
                disabled={!selectedField || !showPropertyDuplicateAction}
                title="Duplicate selected field"
              >
                ≡
              </button>
              <div className="pdf-template-designer__inspector-title">Edit Field</div>
              <button
                type="button"
                className="pdf-template-designer__inspector-nav"
                onClick={() => setSelectedFieldId(null)}
                title="Clear selection"
              >
                →
              </button>
            </div>

            {selectedField ? (
              hasVisibleFieldPropertyControls ? (
              <div className="pdf-template-designer__inspector-body">
                {(showPropertyType || showPropertyKey) ? (
                <div className="pdf-template-designer__inspector-grid-two">
                  {showPropertyType ? (
                  <div>
                    <div className="pdf-template-designer__label">Type</div>
                    <select
                      className="pdf-template-designer__select"
                      value={selectedField.type}
                      onChange={event => {
                        const nextType = event.target.value as FieldType;
                        const nextChanges: Partial<TemplateField> = { type: nextType };
                        if (nextType === "select" || nextType === "radio") {
                          const nextOptions =
                            selectedField.options.length > 0 ? selectedField.options : defaultOptionsForFieldType(nextType);
                          nextChanges.options = [...nextOptions];
                        }
                        if (nextType === "date") {
                          nextChanges.format = normalizeFieldFormat("date", selectedField.format);
                        }
                        nextChanges.optionsOrientation = defaultOptionsOrientationForFieldType(nextType);
                        updateField(selectedField.id, nextChanges);
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="multiVariableText">Multi-Variable Text</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="date">Date</option>
                      <option value="signature">Signature</option>
                      <option value="select">Select</option>
                      <option value="radio">Radio</option>
                      <option value="image">Image</option>
                    </select>
                  </div>
                  ) : null}
                  {showPropertyKey ? (
                  <div>
                    <div className="pdf-template-designer__label">Key</div>
                    {keyInputState.mode === "dropdown" ? (
                      <select
                        className="pdf-template-designer__select"
                        value={selectedField.key}
                        onChange={event => {
                          const nextKey = event.target.value.trim();
                          if (!nextKey) {
                            return;
                          }
                          const selectedOption = keyInputState.options.find(option => option.value === nextKey);
                          const mappedType = mapDataTypeToFieldType(selectedOption?.dataType);
                          const nextChanges: Partial<TemplateField> = mappedType
                            ? { key: nextKey, type: mappedType }
                            : { key: nextKey };
                          const nextType = mappedType || selectedField.type;
                          if ((nextType === "select" || nextType === "radio") && isEnumerationKeyOption(selectedOption)) {
                            const enumOptions = normalizeOptionStrings(selectedOption?.options);
                            nextChanges.options =
                              enumOptions.length > 0 ? enumOptions : defaultOptionsForFieldType(nextType);
                          }
                          if (nextType === "date") {
                            nextChanges.format = normalizeFieldFormat("date", selectedField.format);
                          }
                          if (mappedType) {
                            nextChanges.optionsOrientation = defaultOptionsOrientationForFieldType(nextType);
                          }
                          updateField(selectedField.id, nextChanges);
                        }}
                      >
                        {selectedFieldKeyOptions.length === 0 ? (
                          <option value={selectedField.key}>{selectedField.key || "No key options"}</option>
                        ) : null}
                        {selectedFieldKeyOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.dataType ? `${option.label} (${option.dataType})` : option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="pdf-template-designer__input"
                        value={selectedField.key}
                        onChange={event => {
                          const nextKey = event.target.value.trim();
                          if (!nextKey) {
                            return;
                          }
                          updateField(selectedField.id, { key: nextKey });
                        }}
                      />
                    )}
                    {keyInputState.loading ? (
                      <div className="pdf-template-designer__status">Loading key options...</div>
                    ) : null}
                    {keyInputState.error ? (
                      <div className="pdf-template-designer__alert">{keyInputState.error}</div>
                    ) : null}
                  </div>
                  ) : null}
                </div>
                ) : null}

                {(showPropertyShowLabel || showPropertyRequired) ? (
                <div className="pdf-template-designer__inspector-checks">
                  {showPropertyShowLabel ? (
                  <label className="pdf-template-designer__toggle">
                    <input
                      type="checkbox"
                      checked={selectedField.showLabel}
                      onChange={event => updateField(selectedField.id, { showLabel: event.target.checked })}
                    />
                    Editable
                  </label>
                  ) : null}
                  {showPropertyRequired ? (
                  <label className="pdf-template-designer__toggle">
                    <input
                      type="checkbox"
                      checked={selectedField.required}
                      onChange={event => updateField(selectedField.id, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  ) : null}
                </div>
                ) : null}

                {showPropertyAlignment ? (
                <div className="pdf-template-designer__inspector-section">
                  <div className="pdf-template-designer__label">Align</div>
                  <div className="pdf-template-designer__align-group">
                    <button
                      type="button"
                      className={`pdf-template-designer__align-btn${selectedField.align === "left" ? " is-active" : ""}`}
                      onClick={() => updateField(selectedField.id, { align: "left" })}
                    >
                      L
                    </button>
                    <button
                      type="button"
                      className={`pdf-template-designer__align-btn${selectedField.align === "center" ? " is-active" : ""}`}
                      onClick={() => updateField(selectedField.id, { align: "center" })}
                    >
                      C
                    </button>
                    <button
                      type="button"
                      className={`pdf-template-designer__align-btn${selectedField.align === "right" ? " is-active" : ""}`}
                      onClick={() => updateField(selectedField.id, { align: "right" })}
                    >
                      R
                    </button>
                  </div>
                </div>
                ) : null}

                {(showPropertyPosition || showPropertySize || showPropertyPage) ? (
                <div className="pdf-template-designer__inspector-section">
                  {showPropertyPosition ? (
                  <div className="pdf-template-designer__inspector-grid-two">
                    <div>
                      <div className="pdf-template-designer__label">X</div>
                      <input
                        className="pdf-template-designer__input"
                        type="number"
                        value={selectedField.x}
                        onChange={event => updateField(selectedField.id, { x: toNumber(event.target.value, selectedField.x) })}
                      />
                    </div>
                    <div>
                      <div className="pdf-template-designer__label">Y</div>
                      <input
                        className="pdf-template-designer__input"
                        type="number"
                        value={selectedField.y}
                        onChange={event => updateField(selectedField.id, { y: toNumber(event.target.value, selectedField.y) })}
                      />
                    </div>
                  </div>
                  ) : null}
                  {showPropertySize ? (
                  <div className="pdf-template-designer__inspector-grid-two">
                    <div>
                      <div className="pdf-template-designer__label">Width</div>
                      <input
                        className="pdf-template-designer__input"
                        type="number"
                        value={selectedField.w}
                        onChange={event => updateField(selectedField.id, { w: toNumber(event.target.value, selectedField.w) })}
                      />
                    </div>
                    <div>
                      <div className="pdf-template-designer__label">Height</div>
                      <input
                        className="pdf-template-designer__input"
                        type="number"
                        value={selectedField.h}
                        onChange={event => updateField(selectedField.id, { h: toNumber(event.target.value, selectedField.h) })}
                      />
                    </div>
                  </div>
                  ) : null}
                  {showPropertyPage ? (
                  <div>
                    <div className="pdf-template-designer__label">Page</div>
                    <input
                      className="pdf-template-designer__input"
                      type="number"
                      min={1}
                      max={pageCount}
                      value={selectedField.page + 1}
                      onChange={event => {
                        const next = clamp(Math.floor(toNumber(event.target.value, 1)), 1, pageCount);
                        updateField(selectedField.id, { page: next - 1 });
                      }}
                    />
                  </div>
                  ) : null}
                </div>
                ) : null}

                {(showPropertyFontSize || showPropertyLabel) ? (
                <div className="pdf-template-designer__inspector-section">
                  {showPropertyFontSize ? (
                  <div className="pdf-template-designer__inspector-grid-two">
                    <div>
                      <div className="pdf-template-designer__label">Font</div>
                      <input className="pdf-template-designer__input" value="Roboto" disabled />
                    </div>
                    <div>
                      <div className="pdf-template-designer__label">Size</div>
                      <input
                        className="pdf-template-designer__input"
                        type="number"
                        min={6}
                        value={selectedField.fontSize}
                        onChange={event =>
                          updateField(selectedField.id, { fontSize: toNumber(event.target.value, selectedField.fontSize) })
                        }
                      />
                    </div>
                  </div>
                  ) : null}
                  {showPropertyLabel ? (
                  <div>
                    <div className="pdf-template-designer__label">Label</div>
                    <input
                      className="pdf-template-designer__input"
                      value={selectedField.label}
                      onChange={event => updateField(selectedField.id, { label: event.target.value })}
                    />
                    <div className="pdf-template-designer__label">Label orientation</div>
                    <select
                      className="pdf-template-designer__select"
                      value={selectedField.labelOrientation}
                      onChange={event =>
                        updateField(selectedField.id, {
                          labelOrientation: isFieldOrientation(event.target.value) ? event.target.value : "horizontal"
                        })
                      }
                      disabled={!selectedField.showLabel}
                    >
                      <option value="horizontal">Horizontal (inline)</option>
                      <option value="vertical">Vertical (stacked)</option>
                    </select>
                  </div>
                  ) : null}
                </div>
                ) : null}

                {selectedField.type === "date" ? (
                <div className="pdf-template-designer__inspector-section">
                  <div className="pdf-template-designer__label">Format</div>
                  <select
                    className="pdf-template-designer__select"
                    value={selectedFieldDateFormat}
                    onChange={event =>
                      updateField(selectedField.id, {
                        format: normalizeFieldFormat("date", event.target.value)
                      })
                    }
                  >
                    {selectedFieldHasCustomDateFormat ? (
                      <option value={selectedFieldDateFormat}>{selectedFieldDateFormat} (Custom)</option>
                    ) : null}
                    {DATE_FIELD_FORMAT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                ) : null}

                {selectedField.type === "multiVariableText" ? (
                <div className="pdf-template-designer__inspector-section">
                  <div className="pdf-template-designer__label">Variables Sample Data</div>
                  <textarea
                    className="pdf-template-designer__input pdf-template-designer__textarea"
                    rows={4}
                    value={selectedField.variablesSampleData}
                    onChange={event => updateField(selectedField.id, { variablesSampleData: event.target.value })}
                    placeholder="For example: {ClientFirstName} {ClientLastName}"
                  />
                  <div className="pdf-template-designer__status">
                    Add variables with curly brackets, for example <code>{"{name}"}</code>.
                  </div>
                </div>
                ) : null}

                {(selectedField.type === "select" || selectedField.type === "radio") ? (
                <div className="pdf-template-designer__inspector-section">
                  <div className="pdf-template-designer__label">Options</div>
                  {selectedField.type === "radio" ? (
                    <div>
                      <div className="pdf-template-designer__label">Options orientation</div>
                      <select
                        className="pdf-template-designer__select"
                        value={selectedField.optionsOrientation}
                        onChange={event =>
                          updateField(selectedField.id, {
                            optionsOrientation: isFieldOrientation(event.target.value) ? event.target.value : "vertical"
                          })
                        }
                      >
                        <option value="vertical">Vertical</option>
                        <option value="horizontal">Horizontal</option>
                      </select>
                    </div>
                  ) : null}
                  {selectedFieldIsEnumBound ? (
                    <div className="pdf-template-designer__status">
                      Options are provided by the selected enumeration key and cannot be edited here.
                    </div>
                  ) : (
                    <div className="pdf-template-designer__option-add">
                      <input
                        className="pdf-template-designer__input"
                        value={optionDraft}
                        onChange={event => setOptionDraft(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addOptionToSelectedField();
                          }
                        }}
                        placeholder="Enter an option"
                      />
                      <button
                        className="pdf-template-designer__button"
                        type="button"
                        onClick={addOptionToSelectedField}
                      >
                        +
                      </button>
                    </div>
                  )}
                  <div className="pdf-template-designer__option-list">
                    {selectedFieldEffectiveOptions.length === 0 ? (
                      <div className="pdf-template-designer__status">No options configured.</div>
                    ) : (
                      selectedFieldEffectiveOptions.map((option, index) => (
                        <div className="pdf-template-designer__option-row" key={`${option}_${index}`}>
                          <input
                            className="pdf-template-designer__input"
                            value={option}
                            disabled={selectedFieldIsEnumBound}
                            onChange={event => updateSelectedFieldOption(index, event.target.value)}
                          />
                          {!selectedFieldIsEnumBound ? (
                            <button
                              className="pdf-template-designer__button"
                              type="button"
                              onClick={() => removeSelectedFieldOption(index)}
                            >
                              x
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                ) : null}

                {selectedField.type === "image" ? (
                <div className="pdf-template-designer__inspector-section">
                  <div className="pdf-template-designer__label">Image Source</div>
                  {selectedFieldIsImageKeyBound ? (
                    <div className="pdf-template-designer__status">
                      Bound to key <code>{selectedField.key}</code>. Provide a base64 image value in Data JSON for this key.
                    </div>
                  ) : (
                    <input
                      className="pdf-template-designer__input"
                      type="file"
                      accept="image/*"
                      onChange={handleSelectedFieldImageUpload}
                    />
                  )}
                  {imageUploadError ? <div className="pdf-template-designer__alert">{imageUploadError}</div> : null}
                  <div className="pdf-template-designer__image-preview">
                    {selectedFieldImagePreview ? (
                      <img src={selectedFieldImagePreview} alt={selectedField.label || selectedField.key || "Image preview"} />
                    ) : (
                      <div className="pdf-template-designer__status">No image selected.</div>
                    )}
                  </div>
                  {!selectedFieldIsImageKeyBound ? (
                    <button
                      className="pdf-template-designer__button"
                      type="button"
                      onClick={clearSelectedFieldImage}
                      disabled={!normalizeImageDataFromUnknown(selectedField.imageDataUrl)}
                    >
                      Clear image
                    </button>
                  ) : null}
                </div>
                ) : null}

                {showPropertyDeleteAction || showPropertyDuplicateAction ? (
                <div className="pdf-template-designer__inspector-actions">
                  {showPropertyDuplicateAction ? (
                  <button
                    className="pdf-template-designer__button"
                    onClick={duplicateSelectedField}
                    type="button"
                  >
                    Duplicate field
                  </button>
                  ) : null}
                  {showPropertyDeleteAction ? (
                  <button
                    className="pdf-template-designer__button"
                    onClick={() => deleteField(selectedField.id)}
                    type="button"
                  >
                    Delete field
                  </button>
                  ) : null}
                </div>
                ) : null}
              </div>
              ) : (
                <div className="pdf-template-designer__status">All field properties are hidden by widget configuration.</div>
              )
            ) : (
              <div className="pdf-template-designer__status">Select a field to edit.</div>
            )}
            </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

