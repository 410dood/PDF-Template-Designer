import { loadSharedPdfjs } from "./sharedPdfjs";
import {
  createElement,
  Fragment,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  ChangeEvent as ReactChangeEvent,
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import type { CSSProperties } from "react";
import type {
  ActionValue,
  DynamicValue,
  EditableValue,
  IconValue,
  ListAttributeValue,
  ListValue
} from "mendix";
import { Big } from "big.js";
import "./ui/PdfTemplateDesigner.css";

interface PdfDesignerCoreDataSourceItem {
  templateJsonAttr?: EditableValue<string>;
  dataJsonAttr?: EditableValue<string>;
  fieldKeySchemaJsonAttr?: EditableValue<string>;
  tokenContextJsonAttr?: EditableValue<string>;
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
  tokenCatalogSource?: ListValue;
  tokenCatalogKeyAttr?: ListAttributeValue<string>;
  tokenCatalogLabelAttr?: ListAttributeValue<string>;
  tokenCatalogKindAttr?: ListAttributeValue<string>;
  paletteTokenKeys?: string;
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
  showHeaderCheckbox?: boolean;
  headerCheckboxAttribute?: EditableValue<boolean>;
  headerCheckboxLabel?: string;
  headerCheckboxShowLabel?: boolean;
  headerCheckboxVisible?: DynamicValue<boolean>;
  headerCheckboxEditable?: DynamicValue<boolean>;
  headerCheckboxOnChangeAction?: ActionValue;
  showSaveButton?: boolean;
  saveButtonText?: string;
  saveButtonTooltip?: string;
  saveButtonIcon?: IconValue;
  saveButtonRenderMode?: "button" | "link";
  saveButtonStyle?:
    | "default"
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "danger"
    | "link";
  saveButtonTabIndex?: number;
  saveButtonVisible?: DynamicValue<boolean>;
  saveButtonEnabled?: boolean;
  saveButtonAction?: ActionValue;
  showPrintButton?: boolean;
  showImportTemplateButton?: boolean;
  showReplacePdfButton?: boolean;
  showCustomActionButton1?: boolean;
  customActionButton1Text?: string;
  customActionButton1Tooltip?: string;
  customActionButton1Icon?: IconValue;
  customActionButton1RenderMode?: "button" | "link";
  customActionButton1Style?:
    | "default"
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "danger"
    | "link";
  customActionButton1TabIndex?: number;
  customActionButton1Visible?: DynamicValue<boolean>;
  customActionButton1Enabled?: boolean;
  customActionButton1Action?: ActionValue;
  showCustomActionButton2?: boolean;
  customActionButton2Text?: string;
  customActionButton2Tooltip?: string;
  customActionButton2Icon?: IconValue;
  customActionButton2RenderMode?: "button" | "link";
  customActionButton2Style?:
    | "default"
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "danger"
    | "link";
  customActionButton2TabIndex?: number;
  customActionButton2Visible?: DynamicValue<boolean>;
  customActionButton2Enabled?: boolean;
  customActionButton2Action?: ActionValue;
  showCustomActionButton3?: boolean;
  customActionButton3Text?: string;
  customActionButton3Tooltip?: string;
  customActionButton3Icon?: IconValue;
  customActionButton3RenderMode?: "button" | "link";
  customActionButton3Style?:
    | "default"
    | "primary"
    | "success"
    | "info"
    | "warning"
    | "danger"
    | "link";
  customActionButton3TabIndex?: number;
  customActionButton3Visible?: DynamicValue<boolean>;
  customActionButton3Enabled?: boolean;
  customActionButton3Action?: ActionValue;
  viewMode?: "designer" | "viewer" | "readOnly";
  pageLayout?: "continuous" | "single";
  requiredHighlight?: DynamicValue<boolean>;
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

type FieldType =
  | "text"
  | "checkbox"
  | "date"
  | "signature"
  | "multiVariableText"
  | "select"
  | "radio"
  | "image";
type FieldAlign = "left" | "center" | "right";
type FieldOrientation = "horizontal" | "vertical";
type FieldKeySourceMode = "manual" | "datasource" | "json";
type ViewMode = "designer" | "viewer" | "readOnly";
type ToolbarButtonRenderMode = "button" | "link";
type ToolbarButtonStyle =
  | "default"
  | "primary"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "link";

interface KeyOption {
  value: string;
  label: string;
  dataType?: string;
  options?: string[];
}

interface ToolbarButtonConfig {
  key: string;
  visible: boolean;
  text: string;
  tooltip?: string;
  icon?: IconValue;
  className: string;
  tabIndex?: number;
  disabled: boolean;
  onClick: () => void;
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
  transparentBackground: boolean;
  textColor: string;
  backgroundColor: string;
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
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfjsViewport;
  }) => PdfjsRenderTask;
}

interface PdfjsDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPageProxy>;
  getFieldObjects?: () => Promise<Record<string, unknown>>;
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
  onFocus?: (canvas: HTMLCanvasElement) => void;
  placeholderText?: string;
}

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 };
const SNAP_SIZE = 5;
const HISTORY_LIMIT = 100;
const ALIGN_TOLERANCE = 4;
const PALETTE_TYPE_DRAG_TYPE = "application/x-pdf-field-type";
/* Client data (tokens): catalog rows come from the tokenCatalogSource datasource
   (FormStudio.TokenDef). A token field is a multiVariableText whose content holds
   {token.key} placeholders; admins only ever see the catalog label. */
const TOKEN_TOOL_ID_PREFIX = "token:";
const TOKEN_FIELD_KEY_BASE = "tokenText";
const TOKEN_RECENT_STORAGE_KEY = "pdfTemplateDesigner.recentTokens";
const TOKEN_PLACEHOLDER_PATTERN = /\{\s*([^{}]+?)\s*\}/g;
type TokenKind = "client" | "doc" | "computed" | "other";
interface TokenCatalogEntry {
  key: string;
  label: string;
  kind: TokenKind;
}
type TokenContentSegment =
  | { kind: "text"; value: string }
  | { kind: "token"; key: string };
const TOKEN_SAMPLE_VALUES: Record<string, string> = {
  "client.full_name": "Madison Welch",
  "client.first_name": "Madison",
  "client.last_name": "Welch",
  "client.dob": "01/02/1990",
  "client.chart_id": "WEMA046517",
  "client.record_id": "1047",
  "client.gender": "Female",
  "doc.title": "Property Receipt",
  "doc.status": "Draft",
  "doc.provider_name": "Madison Gill",
  "sys.date": "10/27/2026",
  "sys.time": "09:41",
  "sys.datetime": "10/27/2026 09:41"
};
function normalizeTokenKind(raw: unknown, key: string): TokenKind {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "client") {
    return "client";
  }
  if (value === "doc" || value === "document") {
    return "doc";
  }
  if (value === "computed" || value === "sys") {
    return "computed";
  }
  const prefix = key.split(".")[0].toLowerCase();
  if (prefix === "client") {
    return "client";
  }
  if (prefix === "doc") {
    return "doc";
  }
  if (prefix === "sys" || key.startsWith("__")) {
    return "computed";
  }
  return "other";
}
function parseTokenContentSegments(text: string): TokenContentSegment[] {
  const segments: TokenContentSegment[] = [];
  let last = 0;
  const source = text || "";
  TOKEN_PLACEHOLDER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PLACEHOLDER_PATTERN.exec(source)) !== null) {
    segments.push({ kind: "text", value: source.slice(last, match.index) });
    segments.push({ kind: "token", key: match[1].trim() });
    last = match.index + match[0].length;
  }
  segments.push({ kind: "text", value: source.slice(last) });
  return segments;
}
function serializeTokenContentSegments(segments: TokenContentSegment[]): string {
  return segments
    .map((segment) =>
      segment.kind === "token" ? `{${segment.key}}` : segment.value
    )
    .join("");
}
function contentHasTokens(text: string): boolean {
  TOKEN_PLACEHOLDER_PATTERN.lastIndex = 0;
  return TOKEN_PLACEHOLDER_PATTERN.test(text || "");
}
function appendTokenToContent(text: string, key: string): string {
  const base = text || "";
  const needsSpace = base.length > 0 && !/\s$/.test(base);
  return `${base}${needsSpace ? " " : ""}{${key}}`;
}
function readRecentTokenKeys(): string[] {
  try {
    const raw = window.localStorage.getItem(TOKEN_RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch (_error) {
    return [];
  }
}
function rememberRecentTokenKey(key: string): string[] {
  const next = [key, ...readRecentTokenKeys().filter((item) => item !== key)].slice(0, 5);
  try {
    window.localStorage.setItem(TOKEN_RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch (_error) {
    /* storage unavailable: recents are a convenience only */
  }
  return next;
}
function tokenGlyph(kind: TokenKind): ReactElement {
  if (kind === "computed") {
    return (
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (kind === "doc") {
    return (
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
/** Shown (as a soft notice, not an error) when no Topaz pad is detected. The form stays fully usable. */
const SIGWEB_NO_PAD_MESSAGE =
  "No signature pad detected. You can still fill out this form. To capture a signature, plug in the Topaz pad, make sure SigWeb is running, and allow the browser's connection prompt if one appears.";
const SIGWEB_CAPTURE_FUNCTION_CANDIDATES = [
  "GetSigImageB64",
  "GetSigImageBase64",
  "GetSigImage"
];
let fieldIdCounter = 0;

const FIELD_DEFAULTS: Record<
  FieldType,
  Pick<TemplateField, "w" | "h" | "fontSize" | "align">
> = {
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
const DEFAULT_FIELD_TEXT_COLOR = "#111827";
const DEFAULT_FIELD_BACKGROUND_COLOR = "#ffffff";
const BUILTIN_COMPUTED_KEY_OPTIONS: KeyOption[] = [
  {
    value: "__currentDate",
    label: "__currentDate (alias __today)",
    dataType: "Date"
  },
  {
    value: "__currentTime",
    label: "__currentTime (alias __nowTime)",
    dataType: "Time"
  },
  {
    value: "__currentDateTime",
    label: "__currentDateTime (alias __now)",
    dataType: "DateTime"
  },
  {
    value: "__signature",
    label: "__signature (signature placeholder)",
    dataType: "Signature"
  }
];
const TOOL_RAIL_ITEMS: Array<{
  id: string;
  glyph: string;
  tooltip: string;
  label: string;
  type: FieldType;
  keyBase?: string;
  seedLabel?: string;
  seedVariablesSampleData?: string;
  format?: string;
  w?: number;
  h?: number;
  align?: FieldAlign;
  showLabel?: boolean;
}> = [
  {
    id: "text",
    type: "text",
    glyph: "T",
    tooltip: "Text field",
    label: "Text field",
    keyBase: "text"
  },
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
  {
    id: "fixedText",
    type: "multiVariableText",
    glyph: "FX",
    tooltip: "Fixed text (output-only: section headers, instructions)",
    label: "Fixed text",
    keyBase: "fixedText",
    seedLabel: "",
    seedVariablesSampleData: "Fixed text - edit this in Content",
    showLabel: false,
    w: 260,
    h: 22
  },
  {
    id: "tokenText",
    type: "multiVariableText",
    glyph: "TK",
    tooltip: "Token (output-only: resolved from client/document data, not editable when filling)",
    label: "Token",
    keyBase: "tokenText",
    seedLabel: "",
    seedVariablesSampleData: "{client.full_name}",
    showLabel: false,
    w: 220,
    h: 22
  },
  {
    id: "signature",
    type: "signature",
    glyph: "SIG",
    tooltip: "Signature field",
    label: "Signature field",
    keyBase: "signature"
  },
  {
    id: "table",
    type: "text",
    glyph: "TB",
    tooltip: "Table",
    label: "Table",
    keyBase: "table",
    seedLabel: "Table",
    w: 220,
    h: 28
  },
  {
    id: "line",
    type: "text",
    glyph: "LN",
    tooltip: "Line",
    label: "Line",
    keyBase: "line",
    seedLabel: "Line",
    w: 180,
    h: 12
  },
  {
    id: "box",
    type: "text",
    glyph: "BOX",
    tooltip: "Rectangle",
    label: "Rectangle",
    keyBase: "box",
    seedLabel: "Rectangle",
    w: 140,
    h: 80
  },
  {
    id: "circle",
    type: "text",
    glyph: "O",
    tooltip: "Circle",
    label: "Circle",
    keyBase: "circle",
    seedLabel: "Circle",
    w: 64,
    h: 64,
    align: "center"
  },
  {
    id: "image",
    type: "image",
    glyph: "IMG",
    tooltip: "Image",
    label: "Image",
    keyBase: "image",
    seedLabel: "Image",
    w: 140,
    h: 90
  },
  {
    id: "link",
    type: "text",
    glyph: "LNK",
    tooltip: "Link",
    label: "Link",
    keyBase: "link",
    seedLabel: "Link",
    w: 180,
    h: 22
  },
  {
    id: "signaturePad",
    type: "signature",
    glyph: "SG",
    tooltip: "Signature pad",
    label: "Signature pad",
    keyBase: "signaturePad"
  },
  {
    id: "qr",
    type: "text",
    glyph: "QR",
    tooltip: "QR code",
    label: "QR code",
    keyBase: "qr",
    seedLabel: "QR Code",
    w: 86,
    h: 86,
    align: "center"
  },
  {
    id: "date",
    type: "date",
    glyph: "CAL",
    tooltip: "Date field",
    label: "Date field",
    keyBase: "date"
  },
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
  {
    id: "select",
    type: "select",
    glyph: "SEL",
    tooltip: "Select",
    label: "Select",
    keyBase: "select",
    seedLabel: "Select",
    w: 140,
    h: 24
  },
  {
    id: "checkbox",
    type: "checkbox",
    glyph: "CHK",
    tooltip: "Checkbox",
    label: "Checkbox",
    keyBase: "checkbox"
  },
  {
    id: "radio",
    type: "radio",
    glyph: "RAD",
    tooltip: "Radio",
    label: "Radio",
    keyBase: "radio",
    seedLabel: "Radio",
    w: 160,
    h: 36
  },
  {
    id: "barSmall",
    type: "text",
    glyph: "BAR",
    tooltip: "Barcode",
    label: "Barcode",
    keyBase: "barcode",
    seedLabel: "Barcode",
    w: 160,
    h: 24,
    align: "center"
  },
  {
    id: "barWide",
    type: "text",
    glyph: "BAR2",
    tooltip: "Wide barcode",
    label: "Wide barcode",
    keyBase: "barcodeWide",
    seedLabel: "Wide Barcode",
    w: 220,
    h: 24,
    align: "center"
  }
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
  if (
    normalized === "multivariabletext" ||
    normalized === "multi_variable_text" ||
    normalized === "multi-variable-text"
  ) {
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
  return value === "designer" || value === "viewer" || value === "readOnly";
}

function normalizeViewMode(value: unknown): ViewMode {
  if (isViewMode(value)) {
    return value;
  }

  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (text === "readonly" || text === "read-only" || text === "read_only") {
    return "readOnly";
  }
  if (text === "viewer") {
    return "viewer";
  }
  return "designer";
}

function normalizeToolbarButtonRenderMode(
  value: unknown
): ToolbarButtonRenderMode {
  return value === "link" ? "link" : "button";
}

function normalizeToolbarButtonStyle(value: unknown): ToolbarButtonStyle {
  if (
    value === "primary" ||
    value === "success" ||
    value === "info" ||
    value === "warning" ||
    value === "danger" ||
    value === "link"
  ) {
    return value;
  }
  return "default";
}

function resolveBooleanProperty(
  value: DynamicValue<boolean> | boolean | undefined,
  fallback: boolean
): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (!value) {
    return fallback;
  }
  const dynamicValue = value as any;
  if (dynamicValue.status === "available") {
    return Boolean(dynamicValue.value);
  }
  return fallback;
}

function getToolbarButtonClassName(
  renderMode: ToolbarButtonRenderMode,
  style: ToolbarButtonStyle
): string {
  const classes = [
    "pdf-template-designer__button",
    "pdf-template-designer__toolbar-action"
  ];
  const resolvedStyle =
    renderMode === "link" ? "link" : style === "default" ? "" : style;
  if (resolvedStyle) {
    classes.push(`pdf-template-designer__button--${resolvedStyle}`);
  }
  return classes.join(" ");
}

function renderToolbarButtonIcon(
  icon: IconValue | undefined
): ReactElement | null {
  if (!icon) {
    return null;
  }

  if (
    (icon as any).type === "image" &&
    typeof (icon as any).iconUrl === "string"
  ) {
    return (
      <img
        className="pdf-template-designer__toolbar-button-icon-image"
        src={(icon as any).iconUrl}
        alt=""
        aria-hidden="true"
      />
    );
  }

  if (
    ((icon as any).type === "glyph" || (icon as any).type === "icon") &&
    typeof (icon as any).iconClass === "string"
  ) {
    return (
      <span
        className={`pdf-template-designer__toolbar-button-icon ${
          (icon as any).iconClass
        }`}
        aria-hidden="true"
      />
    );
  }

  return null;
}

function normalizeStatus(
  value: unknown
): "available" | "loading" | "unavailable" {
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

function resolveContextObjectId(
  item: PdfDesignerCoreDataSourceItem | undefined
): string | undefined {
  if (!item) {
    return undefined;
  }
  const record = item as unknown as Record<string, unknown>;
  const directId = toObjectId(record.id);
  if (directId) {
    return directId;
  }
  const nestedCandidates = [
    record.value,
    record.object,
    record.obj,
    record._object
  ];
  for (const candidate of nestedCandidates) {
    const nestedId = toObjectId(candidate);
    if (nestedId) {
      return nestedId;
    }
  }
  return undefined;
}

function resolveFirstDatasourceObjectId(
  source?: ListValue
): string | undefined {
  if (
    !source ||
    normalizeStatus((source as any).status) !== "available" ||
    !source.items ||
    source.items.length === 0
  ) {
    return undefined;
  }
  return toObjectId(source.items[0]);
}

function mapDataTypeToFieldType(dataType?: string): FieldType | undefined {
  if (!dataType) {
    return undefined;
  }

  const normalized = dataType.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("signature")) {
    return "signature";
  }
  if (
    normalized.includes("image") ||
    normalized.includes("photo") ||
    normalized.includes("picture")
  ) {
    return "image";
  }
  if (normalized.includes("multivariable")) {
    return "multiVariableText";
  }
  if (normalized.includes("boolean")) {
    return "checkbox";
  }
  if (normalized.includes("enum")) {
    return "select";
  }
  if (
    normalized.includes("datetime") ||
    normalized.includes("timestamp") ||
    normalized.includes("time")
  ) {
    return "date";
  }
  if (normalized.includes("date")) {
    return "date";
  }
  return undefined;
}

function mapDataTypeToDateFormat(dataType?: string): string | undefined {
  if (!dataType) {
    return undefined;
  }
  const normalized = dataType.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("datetime") || normalized.includes("timestamp")) {
    return "MM/dd/yyyy HH:mm";
  }
  if (normalized.includes("time") && !normalized.includes("date")) {
    return "HH:mm";
  }
  if (normalized.includes("date")) {
    return DEFAULT_DATE_FIELD_FORMAT;
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
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
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

function defaultLabelOrientationForFieldType(
  _type: FieldType
): FieldOrientation {
  return "horizontal";
}

function defaultOptionsOrientationForFieldType(
  type: FieldType
): FieldOrientation {
  return type === "radio" ? "vertical" : "horizontal";
}

function supportsTransparentBackground(type: FieldType): boolean {
  return (
    type === "text" ||
    type === "date" ||
    type === "multiVariableText" ||
    type === "select" ||
    type === "radio"
  );
}

function normalizeHexColor(value: unknown, fallback: string): string {
  const fallbackHex = /^#[0-9a-fA-F]{6}$/.test(fallback)
    ? fallback.toLowerCase()
    : "#000000";
  if (typeof value !== "string") {
    return fallbackHex;
  }
  const trimmed = value.trim();
  const fullHex = /^#[0-9a-fA-F]{6}$/.exec(trimmed);
  if (fullHex) {
    return fullHex[0].toLowerCase();
  }
  const shortHex = /^#[0-9a-fA-F]{3}$/.exec(trimmed);
  if (shortHex) {
    const digits = shortHex[0].slice(1).split("");
    return `#${digits.map((char) => `${char}${char}`).join("")}`.toLowerCase();
  }
  return fallbackHex;
}

function normalizeBackgroundColor(value: unknown, fallback: string): string {
  if (
    typeof value === "string" &&
    value.trim().toLowerCase() === "transparent"
  ) {
    return "transparent";
  }
  return normalizeHexColor(value, fallback);
}

function colorPickerValue(color: string, fallback: string): string {
  if (color === "transparent") {
    return normalizeHexColor(fallback, fallback);
  }
  return normalizeHexColor(color, fallback);
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
  return (
    isEnumerationDataType(option.dataType) ||
    Boolean(option.options && option.options.length > 0)
  );
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

function normalizeSchemaPropertyType(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized || undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "string") {
        continue;
      }
      const normalized = item.trim().toLowerCase();
      if (!normalized || normalized === "null") {
        continue;
      }
      return normalized;
    }
  }
  return undefined;
}

function parseOneOfEnumOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const options: string[] = [];
  for (const item of value) {
    if (item === null || item === undefined) {
      continue;
    }
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      options.push(String(item));
      continue;
    }
    if (typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.const !== undefined && record.const !== null) {
      options.push(String(record.const));
      continue;
    }
    const enumValues = normalizeOptionStrings(record.enum);
    if (enumValues.length > 0) {
      options.push(...enumValues);
    }
  }
  return normalizeOptionStrings(options);
}

function inferSchemaPropertyDataType(
  key: string,
  propertyRecord: Record<string, unknown>,
  enumOptions: string[]
): string | undefined {
  if (enumOptions.length > 0) {
    return "Enumeration";
  }

  const schemaType = normalizeSchemaPropertyType(propertyRecord.type);
  const format = toTrimmedString(propertyRecord.format).toLowerCase();
  const contentEncoding = toTrimmedString(
    propertyRecord.contentEncoding
  ).toLowerCase();
  const contentMediaType = toTrimmedString(
    propertyRecord.contentMediaType ?? propertyRecord.mediaType
  ).toLowerCase();
  const keyAndTitle = `${key} ${toTrimmedString(
    propertyRecord.title
  )}`.toLowerCase();
  const hasImageNameHint = /(photo|image|picture|avatar|signature)/.test(
    keyAndTitle
  );

  if (contentMediaType.startsWith("image/")) {
    return "Image";
  }
  if (format === "data-url" && contentMediaType.startsWith("image/")) {
    return "Image";
  }
  if (
    contentEncoding === "base64" &&
    (hasImageNameHint || contentMediaType.startsWith("image/"))
  ) {
    return "Image";
  }

  if (schemaType === "boolean") {
    return "Boolean";
  }
  if (schemaType === "integer") {
    return "Integer";
  }
  if (schemaType === "number") {
    return "Number";
  }
  if (schemaType === "string") {
    if (format === "date-time") {
      return "DateTime";
    }
    if (format === "date") {
      return "Date";
    }
    if (format === "time") {
      return "Time";
    }
    return "String";
  }
  return schemaType
    ? schemaType.charAt(0).toUpperCase() + schemaType.slice(1)
    : undefined;
}

function normalizeKeyOptionFromJsonSchemaProperty(
  key: string,
  value: unknown
): KeyOption | undefined {
  if (
    !key ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  const propertyRecord = value as Record<string, unknown>;
  const enumOptions = normalizeOptionStrings(propertyRecord.enum);
  const oneOfOptions = parseOneOfEnumOptions(propertyRecord.oneOf);
  const options = enumOptions.length > 0 ? enumOptions : oneOfOptions;
  const label = toTrimmedString(propertyRecord.title) || key;
  const dataType = inferSchemaPropertyDataType(key, propertyRecord, options);
  return {
    value: key,
    label,
    dataType,
    options: options.length > 0 ? options : undefined
  };
}

function parseFieldKeyOptionsJson(text?: string): {
  options: KeyOption[];
  error?: string;
} {
  if (!text || !text.trim()) {
    return { options: [] };
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return {
        options: [],
        error:
          "Legacy array format is no longer supported. Provide a JSON Schema object with type='object' and properties."
      };
    }
    if (!parsed || typeof parsed !== "object") {
      return {
        options: [],
        error: "Field key schema JSON must be a JSON Schema object."
      };
    }

    const schema = parsed as Record<string, unknown>;
    const schemaType = normalizeSchemaPropertyType(schema.type);
    if (schemaType && schemaType !== "object") {
      return { options: [], error: "JSON Schema root type must be 'object'." };
    }

    if (
      !schema.properties ||
      typeof schema.properties !== "object" ||
      Array.isArray(schema.properties)
    ) {
      return {
        options: [],
        error: "JSON Schema must include an object 'properties' section."
      };
    }

    const properties = schema.properties as Record<string, unknown>;
    const options = dedupeKeyOptions(
      Object.entries(properties)
        .map(([key, property]) =>
          normalizeKeyOptionFromJsonSchemaProperty(key, property)
        )
        .filter((item): item is KeyOption => Boolean(item))
    );
    if (options.length === 0) {
      return {
        options: [],
        error: "No usable fields were found in JSON Schema properties."
      };
    }
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
  const key =
    typeof input?.key === "string" && input.key.trim().length > 0
      ? input.key.trim()
      : `field_${index + 1}`;
  const label = typeof input?.label === "string" ? input.label : "";
  const variablesSampleData =
    typeof input?.variablesSampleData === "string"
      ? input.variablesSampleData
      : typeof input?.variableSampleData === "string"
      ? input.variableSampleData
      : "";
  const format = normalizeFieldFormat(type, input?.format);
  const options = normalizeOptionStrings(
    input?.options ?? input?.enumOptions ?? input?.values
  );
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
  const transparentBackground = supportsTransparentBackground(type)
    ? Boolean(input?.transparentBackground)
    : false;
  const textColor = normalizeHexColor(
    input?.textColor,
    DEFAULT_FIELD_TEXT_COLOR
  );
  const backgroundColor = normalizeBackgroundColor(
    input?.backgroundColor,
    DEFAULT_FIELD_BACKGROUND_COLOR
  );
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
    transparentBackground,
    textColor,
    backgroundColor,
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

function parseTemplateJson(text?: string): {
  fields: TemplateField[];
  error?: string;
} {
  if (!text || !text.trim()) {
    return { fields: [] };
  }

  try {
    const parsed = JSON.parse(text);
    const fields = Array.isArray(parsed?.fields)
      ? parsed.fields.map((field: any, index: number) =>
          normalizeField(field, index)
        )
      : [];
    return { fields };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { fields: [], error: message };
  }
}

function parseDataJson(text?: string): {
  values: Record<string, unknown>;
  error?: string;
} {
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

function buildTemplateJson(
  fields: TemplateField[],
  basePdfId: string | undefined
): string {
  const payload: TemplateDefinition = {
    basePdf: basePdfId ? { fileId: basePdfId } : undefined,
    fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      variablesSampleData: field.variablesSampleData,
      format: field.format,
      options: normalizeOptionStrings(field.options),
      imageDataUrl: field.imageDataUrl,
      labelOrientation: field.labelOrientation,
      optionsOrientation: field.optionsOrientation,
      showLabel: field.showLabel,
      transparentBackground: field.transparentBackground,
      textColor: field.textColor,
      backgroundColor: field.backgroundColor,
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
    meta: {
      units: "pt",
      createdWith: "pdftemplatedesigner",
      outputMode: "flattened"
    }
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
  const base =
    type === "checkbox"
      ? "check"
      : type === "multiVariableText"
      ? "multiVariableText"
      : type;
  let index = 1;
  let candidate = `${base}_${index}`;
  const keys = new Set(fields.map((field) => field.key));
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
  const keys = new Set(fields.map((field) => field.key));
  while (keys.has(candidate)) {
    index += 1;
    candidate = `${normalizedBase}_${index}`;
  }
  return candidate;
}

function cloneFields(fields: TemplateField[]): TemplateField[] {
  return fields.map((field) => ({ ...field, options: [...field.options] }));
}

function areFieldsEqual(
  left: TemplateField[],
  right: TemplateField[]
): boolean {
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
      a.transparentBackground !== b.transparentBackground ||
      a.textColor !== b.textColor ||
      a.backgroundColor !== b.backgroundColor ||
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
    for (
      let optionIndex = 0;
      optionIndex < a.options.length;
      optionIndex += 1
    ) {
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
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button"
  );
}

function fieldVerticalLines(field: TemplateField): number[] {
  return [field.x, field.x + field.w / 2, field.x + field.w];
}

function fieldHorizontalLines(field: TemplateField): number[] {
  return [field.y, field.y + field.h / 2, field.y + field.h];
}

function findClosestReference(
  line: number,
  refs: number[],
  tolerance: number
): number | undefined {
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

function snapPositionToReferences(
  position: number,
  size: number,
  refs: number[],
  tolerance: number
): { position: number; guide?: number } {
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

function resolveWorkerUrlValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function loadExternalScript(scriptSrc: string): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Document is not available."));
  }

  const existing = document.querySelector(
    `script[src="${scriptSrc}"]`
  ) as HTMLScriptElement | null;
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
    script.onerror = () =>
      reject(new Error(`Failed to load script from ${scriptSrc}.`));
    document.head.appendChild(script);
  });
}

type SigWebCaptureFunction = (...args: unknown[]) => unknown;

function resolveSigWebCaptureFunction(
  globalObject: any
): SigWebCaptureFunction | undefined {
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
  const candidateKeys = [
    "value",
    "dataUrl",
    "imageData",
    "signature",
    "result",
    "data"
  ];
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
  const candidateBase64 =
    commaIndex >= 0 && /base64/i.test(trimmed.slice(0, commaIndex))
      ? trimmed.slice(commaIndex + 1)
      : trimmed;
  const normalizedBase64 = candidateBase64.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
    return `data:image/png;base64,${normalizedBase64}`;
  }
  return undefined;
}

function normalizeSignatureImageFromUnknown(
  value: unknown
): string | undefined {
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
  return new Promise((resolve) => {
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

function renderTypedSignatureDataUrl(
  text: string,
  width: number,
  height: number
): string {
  if (typeof document === "undefined") {
    return "";
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const safeWidth = Math.max(160, Math.round(width * 2));
  const safeHeight = Math.max(72, Math.round(height * 2));
  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }

  context.clearRect(0, 0, safeWidth, safeHeight);
  context.fillStyle = "#111827";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.max(
    28,
    Math.round(safeHeight * 0.56)
  )}px "Segoe Script", "Snell Roundhand", "Brush Script MT", "Lucida Handwriting", cursive`;
  context.fillText(trimmed, safeWidth / 2, safeHeight / 2, safeWidth - 24);

  return canvas.toDataURL("image/png");
}

function exportCanvasToNormalizedPng(canvas: HTMLCanvasElement): string {
  const targetWidth = Math.max(
    1,
    Math.round(canvas.clientWidth || parseFloat(canvas.style.width) || canvas.width)
  );
  const targetHeight = Math.max(
    1,
    Math.round(
      canvas.clientHeight || parseFloat(canvas.style.height) || canvas.height
    )
  );
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = targetWidth;
  exportCanvas.height = targetHeight;
  const exportContext = exportCanvas.getContext("2d");
  if (!exportContext) {
    return canvas.toDataURL("image/png");
  }
  exportContext.clearRect(0, 0, targetWidth, targetHeight);
  exportContext.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  return exportCanvas.toDataURL("image/png");
}

function drawSignatureImageOnCanvas(
  canvas: HTMLCanvasElement,
  value?: string
): Promise<void> {
  if (!value) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const context = canvas.getContext("2d");
    if (!context) {
      resolve();
      return;
    }

    const targetWidth = Math.max(
      1,
      Math.round(
        canvas.clientWidth || parseFloat(canvas.style.width) || canvas.width
      )
    );
    const targetHeight = Math.max(
      1,
      Math.round(
        canvas.clientHeight || parseFloat(canvas.style.height) || canvas.height
      )
    );
    const image = new Image();
    image.onload = () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = value;
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

function getSigWebNumericValue(
  globalObject: any,
  functionName: string
): number | undefined {
  const fn = globalObject?.[functionName];
  if (typeof fn !== "function") {
    return undefined;
  }
  try {
    const value = Number(fn());
    return Number.isFinite(value) ? value : undefined;
  } catch (_error) {
    return undefined;
  }
}

function activateSigWebTablet(globalObject: any): string | undefined {
  const captureFunction = resolveSigWebCaptureFunction(globalObject);
  if (!captureFunction) {
    return "SigWeb capture function was not found. Verify that SigWebTablet.js is loaded.";
  }

  const setTabletState = globalObject?.SetTabletState;
  if (typeof setTabletState === "function") {
    try {
      setTabletState(1);
    } catch (_error) {
      return "The signature pad software (SigWeb) is installed but could not start. Please restart the SigWeb service, or contact support if the problem continues.";
    }
  }

  const tabletState = getSigWebNumericValue(globalObject, "GetTabletState");
  if (tabletState !== undefined && tabletState !== 1) {
    return SIGWEB_NO_PAD_MESSAGE;
  }

  return undefined;
}

function deactivateSigWebTablet(globalObject: any): void {
  callOptionalSigWebFunction(globalObject, "SetTabletState", 0);
}

function clearSigWebTablet(globalObject: any): void {
  callOptionalSigWebFunction(globalObject, "ClearTablet");
  callOptionalSigWebFunction(globalObject, "ClearSigWindow", 1);
  callOptionalSigWebFunction(globalObject, "ClearSigWindow", 0);
}

function clearSignatureCanvasElement(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function prepareCanvasForSigWebCapture(canvas: HTMLCanvasElement): void {
  const targetWidth = Math.max(
    1,
    Math.round(canvas.clientWidth || parseFloat(canvas.style.width) || canvas.width)
  );
  const targetHeight = Math.max(
    1,
    Math.round(
      canvas.clientHeight || parseFloat(canvas.style.height) || canvas.height
    )
  );
  const sizeChanged = canvas.width !== targetWidth || canvas.height !== targetHeight;
  if (canvas.width !== targetWidth) {
    canvas.width = targetWidth;
  }
  if (canvas.height !== targetHeight) {
    canvas.height = targetHeight;
  }
  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  if (sizeChanged) {
    context.clearRect(0, 0, targetWidth, targetHeight);
  }
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = Math.max(1.5, targetHeight * 0.05);
  context.strokeStyle = "#111827";
  context.fillStyle = "#111827";
}

function startSigWebLiveCapture(
  globalObject: any,
  canvas: HTMLCanvasElement,
  clearExisting: boolean
): { timer?: unknown; error?: string } {
  const context = canvas.getContext("2d");
  const setTabletState = globalObject?.SetTabletState;
  if (!context || typeof setTabletState !== "function") {
    return {
      error:
        "SigWeb live capture could not start because the signature canvas is unavailable."
    };
  }

  prepareCanvasForSigWebCapture(canvas);
  if (clearExisting) {
    clearSignatureCanvasElement(canvas);
  }

  try {
    const timer = setTabletState(1, context, 50);
    const tabletState = getSigWebNumericValue(globalObject, "GetTabletState");
    if (tabletState !== undefined && tabletState !== 1) {
      return {
        error: SIGWEB_NO_PAD_MESSAGE
      };
    }
    return { timer };
  } catch (_error) {
    return {
      error:
        "The signature pad could not start capturing. Please check that the Topaz pad is plugged in and SigWeb is running, then try again."
    };
  }
}

function stopSigWebLiveCapture(globalObject: any, timer?: unknown): void {
  const setTabletState = globalObject?.SetTabletState;
  if (typeof setTabletState === "function" && timer !== undefined) {
    try {
      setTabletState(0, timer);
      return;
    } catch (_error) {
      // Fall back to standard deactivation below.
    }
  }
  deactivateSigWebTablet(globalObject);
}

function callOptionalSigWebFunction(
  globalObject: any,
  functionName: string,
  ...args: unknown[]
): void {
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

function captureSignatureFromSigWeb(
  captureFunction: SigWebCaptureFunction
): Promise<string | undefined> {
  return new Promise((resolve) => {
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
      captureFunction(callback);
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

function normalizeTimeInputValue(value: string): string {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const direct24h = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (direct24h) {
    const hours = Number(direct24h[1]);
    const minutes = Number(direct24h[2]);
    if (
      Number.isFinite(hours) &&
      Number.isFinite(minutes) &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`;
    }
  }
  const parsed = Date.parse(`1970-01-01T${trimmed}`);
  if (!Number.isNaN(parsed)) {
    const parsedDate = new Date(parsed);
    return `${String(parsedDate.getHours()).padStart(2, "0")}:${String(
      parsedDate.getMinutes()
    ).padStart(2, "0")}`;
  }
  return "";
}

function stripQuotedDatePatternTokens(pattern: string): string {
  let inQuote = false;
  let sanitized = "";
  for (const character of pattern) {
    if (character === "'") {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote) {
      sanitized += character;
    }
  }
  return sanitized;
}

function patternContainsDateTokens(pattern: string): boolean {
  if (!pattern.trim()) {
    return true;
  }
  const stripped = stripQuotedDatePatternTokens(pattern);
  return /[yYMdD]/.test(stripped);
}

function patternContainsTimeTokens(pattern: string): boolean {
  if (!pattern.trim()) {
    return false;
  }
  const stripped = stripQuotedDatePatternTokens(pattern);
  return /[HhKkmsS]/.test(stripped);
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
  const time24 = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const time12 = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
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

function resolveComputedTokenValue(
  tokenKey: string,
  configuredFormat?: string
): string | undefined {
  const normalized = tokenKey.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  const now = new Date();
  const formatted = configuredFormat
    ? formatDateByPattern(now, configuredFormat)
    : undefined;
  if (formatted) {
    return formatted;
  }
  if (normalized === "__currentdate" || normalized === "__today") {
    return now.toLocaleDateString("en-US");
  }
  if (normalized === "__currenttime" || normalized === "__nowtime") {
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  if (normalized === "__currentdatetime" || normalized === "__now") {
    return `${now.toLocaleDateString("en-US")} ${now.toLocaleTimeString(
      "en-US",
      { hour: "2-digit", minute: "2-digit", hour12: false }
    )}`;
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

function resolveMultiVariableText(
  template: string,
  values: Record<string, unknown>
): string {
  if (!template || !template.trim()) {
    return "";
  }
  return template.replace(
    /\{([^{}]+)\}/g,
    (_match: string, tokenName: string) => {
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
    }
  );
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

function normalizeViewerValueFromPdfField(
  field: TemplateField,
  rawValue: unknown
): ViewerFieldValue | undefined {
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

function initialViewerFieldValue(
  field: TemplateField,
  previousValue: ViewerFieldValue | undefined
): ViewerFieldValue {
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
    return (
      resolveComputedTokenValue(
        field.key,
        field.type === "date" ? field.format : undefined
      ) || ""
    );
  }
  return "";
}

/** Staff-facing name for a required field: its label, else its kind (template keys are internal). */
function describeRequiredField(field: TemplateField): string {
  const kinds: Partial<Record<FieldType, string>> = {
    signature: "Signature",
    checkbox: "Checkbox",
    date: "Date",
    select: "Choice",
    radio: "Choice",
    image: "Image"
  };
  const name = field.label.trim() || kinds[field.type] || "Text field";
  return `${name}, page ${field.page + 1}`;
}

function isViewerRequiredFieldMissing(
  field: TemplateField,
  viewerFieldValues: Record<string, ViewerFieldValue>,
  viewerTemplateValues: Record<string, unknown>
): boolean {
  if (!field.required) {
    return false;
  }

  if (field.type === "checkbox") {
    return !Boolean(viewerFieldValues[field.key]);
  }

  if (field.type === "multiVariableText") {
    return !resolveMultiVariableText(
      field.variablesSampleData || "",
      viewerTemplateValues
    ).trim();
  }

  if (field.type === "image") {
    return (
      !normalizeImageDataFromUnknown(viewerFieldValues[field.key]) &&
      !normalizeImageDataFromUnknown(field.imageDataUrl)
    );
  }

  const rawValue = viewerFieldValues[field.key];
  const displayValue =
    typeof rawValue === "string" ? rawValue.trim() : String(rawValue || "");
  const computedFallback = isComputedTokenKey(field.key)
    ? resolveComputedTokenValue(
        field.key,
        field.type === "date" ? field.format : undefined
      ) || ""
    : "";

  return !displayValue && !computedFallback.trim();
}

interface ContinuousPageCanvasProps {
  pdfDoc: PdfjsDocumentProxy;
  pageNumber: number;
  scale: number;
  scrollRoot: HTMLElement | null;
}

/** One page of the continuous viewer. Renders its canvas once it is near the visible area. */
function ContinuousPageCanvas({
  pdfDoc,
  pageNumber,
  scale,
  scrollRoot
}: ContinuousPageCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isNear) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setIsNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true);
        }
      },
      { root: scrollRoot, rootMargin: "800px 0px" }
    );
    // Watch the full-size page box: until it renders, the canvas is a small default-size box
    // at the page's top, which never intersects when the user lands mid-page (jump, field focus).
    observer.observe(canvas.parentElement ?? canvas);
    return () => observer.disconnect();
  }, [scrollRoot, isNear]);

  useEffect(() => {
    if (!isNear) {
      return;
    }
    let cancelled = false;
    let task: PdfjsRenderTask | null = null;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (cancelled || !canvas || !context) {
          return;
        }
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      } catch (_error) {
        // Cancelled or superseded renders are expected while zooming or resizing.
      }
    })();
    return () => {
      cancelled = true;
      try {
        task?.cancel?.();
      } catch (_error) {
        // Ignore render cancellation failures.
      }
    };
  }, [pdfDoc, pageNumber, scale, isNear]);

  return <canvas className="pdf-template-designer__canvas-surface" ref={canvasRef} />;
}

function InlineSignatureCanvas(
  props: InlineSignatureCanvasProps
): ReactElement {
  const {
    value,
    width,
    height,
    onChange,
    onFocus,
    placeholderText
  } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const drawValue = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const safeWidth = Math.max(20, Math.round(width));
    const safeHeight = Math.max(20, Math.round(height));
    canvas.width = Math.max(1, safeWidth);
    canvas.height = Math.max(1, safeHeight);
    canvas.style.width = `${safeWidth}px`;
    canvas.style.height = `${safeHeight}px`;
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
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
        ctx.drawImage(image, 0, 0, safeWidth, safeHeight);
      };
      image.src = value;
    }
  }, [value, width, height]);

  useEffect(() => {
    drawValue();
  }, [drawValue]);

  const pointFromEvent = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
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
    onChange(exportCanvasToNormalizedPng(canvas));
  }, [onChange]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    onFocus?.(canvas);
    event.preventDefault();
    event.stopPropagation();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    movedRef.current = false;
    const point = pointFromEvent(event);
    lastPointRef.current = point;
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
    movedRef.current = true;
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
    if (!movedRef.current) {
      return;
    }
    commitCurrentStroke();
  };

  return (
    <div className="pdf-template-designer__signature-canvas-shell">
      {!value && placeholderText ? (
        <div className="pdf-template-designer__signature-placeholder">
          {placeholderText}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="pdf-template-designer__signature-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
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

function resolveTextTemplateValue(
  property: unknown,
  templateItem?: unknown
): { value?: string; isLoading: boolean } {
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
      return {
        value: resolveWorkerUrlValue(dynamicProperty.value),
        isLoading: false
      };
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
    return {
      value: resolveWorkerUrlValue(expressionValue.value),
      isLoading: false
    };
  }

  return { isLoading: false };
}

export default function PdfDesignerCore(
  props: PdfDesignerCoreProps
): ReactElement {
  const className = ["pdf-template-designer", props.class]
    .filter(Boolean)
    .join(" ");
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
  const showPropertyDuplicateAction =
    props.showPropertyDuplicateAction !== false;
  const showPropertyDeleteAction = props.showPropertyDeleteAction !== false;
  const showHeaderCheckbox = props.showHeaderCheckbox === true;
  const headerCheckboxLabel =
    (props.headerCheckboxLabel || "").trim() || "Checkbox";
  const headerCheckboxShowLabel = props.headerCheckboxShowLabel !== false;
  const showSaveButton = props.showSaveButton !== false;
  const saveButtonText = (props.saveButtonText || "").trim() || "Save JSON";
  const saveButtonTooltip = (props.saveButtonTooltip || "").trim();
  const showPrintButton = props.showPrintButton === true;
  const showImportTemplateButton = props.showImportTemplateButton !== false;
  const showReplacePdfButton = props.showReplacePdfButton !== false;
  const viewMode = normalizeViewMode((props as any).viewMode);
  const isViewerMode = viewMode === "viewer";
  const isReadOnlyMode = viewMode === "readOnly";
  const isContinuousLayout =
    (isViewerMode || isReadOnlyMode) && (props as any).pageLayout !== "single";
  const customActionButtons = useMemo(
    (): ToolbarButtonConfig[] =>
      [
        {
          key: "custom-action-1",
          visible:
            props.showCustomActionButton1 === true &&
            resolveBooleanProperty(props.customActionButton1Visible, true),
          text: (props.customActionButton1Text || "").trim() || "Action 1",
          tooltip: (props.customActionButton1Tooltip || "").trim(),
          icon: props.customActionButton1Icon,
          className: getToolbarButtonClassName(
            normalizeToolbarButtonRenderMode(
              props.customActionButton1RenderMode
            ),
            normalizeToolbarButtonStyle(props.customActionButton1Style)
          ),
          tabIndex:
            typeof props.customActionButton1TabIndex === "number"
              ? props.customActionButton1TabIndex
              : undefined,
          disabled:
            props.customActionButton1Enabled === false ||
            !props.customActionButton1Action?.canExecute,
          onClick: () => props.customActionButton1Action?.execute()
        },
        {
          key: "custom-action-2",
          visible:
            props.showCustomActionButton2 === true &&
            resolveBooleanProperty(props.customActionButton2Visible, true),
          text: (props.customActionButton2Text || "").trim() || "Action 2",
          tooltip: (props.customActionButton2Tooltip || "").trim(),
          icon: props.customActionButton2Icon,
          className: getToolbarButtonClassName(
            normalizeToolbarButtonRenderMode(
              props.customActionButton2RenderMode
            ),
            normalizeToolbarButtonStyle(props.customActionButton2Style)
          ),
          tabIndex:
            typeof props.customActionButton2TabIndex === "number"
              ? props.customActionButton2TabIndex
              : undefined,
          disabled:
            props.customActionButton2Enabled === false ||
            !props.customActionButton2Action?.canExecute,
          onClick: () => props.customActionButton2Action?.execute()
        },
        {
          key: "custom-action-3",
          visible:
            props.showCustomActionButton3 === true &&
            resolveBooleanProperty(props.customActionButton3Visible, true),
          text: (props.customActionButton3Text || "").trim() || "Action 3",
          tooltip: (props.customActionButton3Tooltip || "").trim(),
          icon: props.customActionButton3Icon,
          className: getToolbarButtonClassName(
            normalizeToolbarButtonRenderMode(
              props.customActionButton3RenderMode
            ),
            normalizeToolbarButtonStyle(props.customActionButton3Style)
          ),
          tabIndex:
            typeof props.customActionButton3TabIndex === "number"
              ? props.customActionButton3TabIndex
              : undefined,
          disabled:
            props.customActionButton3Enabled === false ||
            !props.customActionButton3Action?.canExecute,
          onClick: () => props.customActionButton3Action?.execute()
        }
      ].filter((item) => item.visible),
    [
      props.showCustomActionButton1,
      props.customActionButton1Text,
      props.customActionButton1Tooltip,
      props.customActionButton1Icon,
      props.customActionButton1RenderMode,
      props.customActionButton1Style,
      props.customActionButton1TabIndex,
      props.customActionButton1Visible,
      props.customActionButton1Enabled,
      props.customActionButton1Action,
      props.showCustomActionButton2,
      props.customActionButton2Text,
      props.customActionButton2Tooltip,
      props.customActionButton2Icon,
      props.customActionButton2RenderMode,
      props.customActionButton2Style,
      props.customActionButton2TabIndex,
      props.customActionButton2Visible,
      props.customActionButton2Enabled,
      props.customActionButton2Action,
      props.showCustomActionButton3,
      props.customActionButton3Text,
      props.customActionButton3Tooltip,
      props.customActionButton3Icon,
      props.customActionButton3RenderMode,
      props.customActionButton3Style,
      props.customActionButton3TabIndex,
      props.customActionButton3Visible,
      props.customActionButton3Enabled,
      props.customActionButton3Action
    ]
  );
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
  const tokenCatalog = useMemo<TokenCatalogEntry[]>(() => {
    const source = props.tokenCatalogSource;
    const keyAttr = props.tokenCatalogKeyAttr;
    if (!source || source.status !== "available" || !keyAttr) {
      return [];
    }
    const entries: TokenCatalogEntry[] = [];
    const seen = new Set<string>();
    for (const item of source.items || []) {
      const key = String(keyAttr.get(item).value ?? "").trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      const label = String(props.tokenCatalogLabelAttr?.get(item).value ?? "").trim();
      const kindRaw = props.tokenCatalogKindAttr?.get(item).value;
      entries.push({
        key,
        label: label || key,
        kind: normalizeTokenKind(kindRaw, key)
      });
    }
    return entries;
  }, [
    props.tokenCatalogSource,
    props.tokenCatalogSource?.status,
    props.tokenCatalogSource?.items,
    props.tokenCatalogKeyAttr,
    props.tokenCatalogLabelAttr,
    props.tokenCatalogKindAttr
  ]);
  const tokenLabelByKey = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of tokenCatalog) {
      map[entry.key] = entry.label;
    }
    return map;
  }, [tokenCatalog]);
  const hasTokenCatalog = tokenCatalog.length > 0;
  const tokenToolItems = useMemo<(typeof TOOL_RAIL_ITEMS)[number][]>(() => {
    if (!hasTokenCatalog) {
      return [];
    }
    const wanted = (props.paletteTokenKeys || "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);
    return wanted
      .map((key) => tokenCatalog.find((entry) => entry.key === key))
      .filter((entry): entry is TokenCatalogEntry => Boolean(entry))
      .map((entry) => ({
        id: `${TOKEN_TOOL_ID_PREFIX}${entry.key}`,
        type: "multiVariableText" as FieldType,
        glyph: "",
        tooltip: `${entry.label} (filled automatically)`,
        label: entry.label,
        keyBase: TOKEN_FIELD_KEY_BASE,
        seedLabel: "",
        seedVariablesSampleData: `{${entry.key}}`,
        showLabel: false,
        w: 220,
        h: 22
      }));
  }, [hasTokenCatalog, props.paletteTokenKeys, tokenCatalog]);
  const visibleToolRailItems = useMemo(
    () =>
      TOOL_RAIL_ITEMS.filter(
        (tool) =>
          paletteToolVisibilityById[tool.id] !== false &&
          // the generic Token item is replaced by the Client data group
          !(hasTokenCatalog && tool.id === TOKEN_FIELD_KEY_BASE)
      ),
    [hasTokenCatalog, paletteToolVisibilityById]
  );
  const placementToolCandidates = useMemo(
    () => [...visibleToolRailItems, ...tokenToolItems],
    [tokenToolItems, visibleToolRailItems]
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
  const previousLoadedJsonRef = useRef<string | undefined>(undefined);
  const lastLoadedDataJsonRef = useRef<string | undefined>(undefined);
  const lastParsedDataJsonRef = useRef<Record<string, unknown>>({});
  const viewerFieldValuesDirtyRef = useRef(false);
  const activeSigWebCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeSigWebFieldKeyRef = useRef<string | null>(null);
  const sigWebLiveTimerRef = useRef<unknown>(undefined);
  const sigWebEventTimerRef = useRef<number | null>(null);
  const previousSigWebPenUpHandlerRef = useRef<unknown>(undefined);
  const isPersistingSigWebRef = useRef(false);
  const persistSigWebCanvasValueRef = useRef<(() => void) | null>(null);

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [placementToolId, setPlacementToolId] = useState<string | null>(null);
  // Insert client data picker: "insert" appends to the selected field's content,
  // "add" drops a new token field on the page.
  const [tokenPicker, setTokenPicker] = useState<
    { mode: "insert" | "add"; tab: TokenKind; anchor?: { x: number; y: number } } | null
  >(null);
  const [tokenSearch, setTokenSearch] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [recentTokenKeys, setRecentTokenKeys] = useState<string[]>(() =>
    readRecentTokenKeys()
  );
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<PdfjsDocumentProxy | null>(null);
  const [imageBackgroundUrl, setImageBackgroundUrl] = useState<string | null>(
    null
  );
  const [imageNaturalSize, setImageNaturalSize] = useState<PageSize | null>(
    null
  );
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [renderScale, setRenderScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [visiblePage, setVisiblePage] = useState(1);
  const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfRefreshCounter, setPdfRefreshCounter] = useState(0);
  const importTemplateInputRef = useRef<HTMLInputElement | null>(null);
  const replacePdfInputRef = useRef<HTMLInputElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dataJsonError, setDataJsonError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [viewerFieldValues, setViewerFieldValues] = useState<
    Record<string, ViewerFieldValue>
  >({});
  const [activeViewerSignatureFieldId, setActiveViewerSignatureFieldId] =
    useState<string | null>(null);
  const [showTypedSignatureEditor, setShowTypedSignatureEditor] = useState(false);
  const [typedSignatureDraft, setTypedSignatureDraft] = useState("");
  const [viewerSignatureMessage, setViewerSignatureMessage] = useState<
    string | null
  >(null);
  const [viewerSaveAttempted, setViewerSaveAttempted] = useState(false);
  const [sigWebState, setSigWebState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [sigWebError, setSigWebError] = useState<string | null>(null);
  const [pageThumbs, setPageThumbs] = useState<Record<number, string>>({});
  const [isBuildingThumbs, setIsBuildingThumbs] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("1");
  const [draggedFieldListItemId, setDraggedFieldListItemId] = useState<
    string | null
  >(null);
  const [fieldListDropTargetId, setFieldListDropTargetId] = useState<
    string | null
  >(null);
  const [optionDraft, setOptionDraft] = useState("");
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const imageObjectUrlRef = useRef<string | null>(null);
  const dataSourceItem = useMemo(
    () => props.dataSource?.[0],
    [props.dataSource]
  );
  const configuredSaveAction = props.saveButtonAction ?? dataSourceItem?.onSaveAction;
  const fieldKeySourceMode: FieldKeySourceMode = isFieldKeySourceMode(
    props.fieldKeySourceMode
  )
    ? props.fieldKeySourceMode
    : "manual";
  const fieldKeyOptionsSource = props.fieldKeyOptionsSource;
  const fieldKeyOptionAttribute = props.fieldKeyOptionAttribute;
  const fieldKeySchemaJsonValue = dataSourceItem?.fieldKeySchemaJsonAttr;
  const tokenContextJsonValue = dataSourceItem?.tokenContextJsonAttr;
  const tokenContextValues = useMemo<Record<string, unknown>>(() => {
    const raw =
      tokenContextJsonValue && tokenContextJsonValue.status === "available"
        ? tokenContextJsonValue.value || ""
        : "";
    if (!raw.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch (_error) {
      return {};
    }
  }, [tokenContextJsonValue, tokenContextJsonValue?.status, tokenContextJsonValue?.value]);

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
    if (!isViewerMode) {
      setViewerSaveAttempted(false);
    }
  }, [isViewerMode]);

  useEffect(() => {
    selectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

  useEffect(() => {
    return () => {
      revokeImageObjectUrl();
    };
  }, [revokeImageObjectUrl]);

  const sigWebUrlResolution = useMemo(
    () => resolveTextTemplateValue((props as any).sigWebScriptUrl),
    [(props as any).sigWebScriptUrl]
  );
  const configuredSigWebUrl = sigWebUrlResolution.value;
  // pdf.js comes from the app's single pinned copy (sharedPdfjs.ts), shared with
  // olari.PdfViewer. The pdfJsScriptUrl / pdfJsWorkerUrl props are ignored since 0.4.0.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    loadSharedPdfjs().catch(() => undefined);
  }, []);

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

    const initializeSigWeb = () => {
      const activationError = activateSigWebTablet(window as any);
      if (activationError) {
        setSigWebState("error");
        setSigWebError(activationError);
        return;
      }
      setSigWebState("ready");
      setSigWebError(null);
    };

    const existingCaptureFunction = resolveSigWebCaptureFunction(window as any);
    if (!configuredSigWebUrl) {
      if (existingCaptureFunction) {
        initializeSigWeb();
        return () => {
          if (sigWebEventTimerRef.current !== null) {
            window.clearInterval(sigWebEventTimerRef.current);
            sigWebEventTimerRef.current = null;
          }
          (window as any).onSigPenUp = previousSigWebPenUpHandlerRef.current;
          stopSigWebLiveCapture(window as any, sigWebLiveTimerRef.current);
          sigWebLiveTimerRef.current = undefined;
        };
      } else {
        setSigWebState("idle");
        setSigWebError(null);
      }
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
            "The installed signature pad software (SigWeb) is not a supported version. Please contact support to update it."
          );
          return;
        }
        initializeSigWeb();
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setSigWebState("error");
        setSigWebError(
          error instanceof Error
            ? error.message
            : "The signature pad software (SigWeb) could not be loaded. Signatures cannot be captured on this device right now; the form can still be filled out."
        );
      });

    return () => {
      cancelled = true;
      if (sigWebEventTimerRef.current !== null) {
        window.clearInterval(sigWebEventTimerRef.current);
        sigWebEventTimerRef.current = null;
      }
      (window as any).onSigPenUp = previousSigWebPenUpHandlerRef.current;
      stopSigWebLiveCapture(window as any, sigWebLiveTimerRef.current);
      sigWebLiveTimerRef.current = undefined;
    };
  }, [isViewerMode, configuredSigWebUrl, sigWebUrlResolution.isLoading]);

  const templateJsonValue = useMemo(() => {
    return dataSourceItem?.templateJsonAttr;
  }, [dataSourceItem]);
  const dataJsonValue = useMemo(() => {
    return dataSourceItem?.dataJsonAttr;
  }, [dataSourceItem]);

  const basePdfSource = useMemo(
    () => dataSourceItem?.basePdfSource,
    [dataSourceItem]
  );
  const contextObjectId = useMemo(
    () => resolveContextObjectId(dataSourceItem),
    [dataSourceItem]
  );
  const basePdfFromDatasourceId = useMemo(
    () => resolveFirstDatasourceObjectId(basePdfSource),
    [basePdfSource]
  );

  const basePdfId = basePdfFromDatasourceId || contextObjectId;
  const templateJsonText =
    templateJsonValue && templateJsonValue.status === "available"
      ? templateJsonValue.value || ""
      : "";
  const dataJsonText =
    dataJsonValue && dataJsonValue.status === "available"
      ? dataJsonValue.value || ""
      : "";
  const fieldKeySchemaJsonText =
    fieldKeySchemaJsonValue && fieldKeySchemaJsonValue.status === "available"
      ? fieldKeySchemaJsonValue.value || ""
      : "";
  const isDataJsonBound = Boolean(
    dataJsonValue && dataJsonValue.status === "available"
  );
  const showViewerDataJsonBindingWarning = isViewerMode && !isDataJsonBound;
  const jsonKeyOptionsState = useMemo(
    () => parseFieldKeyOptionsJson(fieldKeySchemaJsonText),
    [fieldKeySchemaJsonText]
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
      if (
        !attributeValue ||
        normalizeStatus((attributeValue as any).status) !== "available"
      ) {
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
    // After commitTemplate, Mendix re-renders once with the attribute's previous value
    // before the new one lands. That echo is not an external change: ignoring it keeps
    // the undo/redo history (and the just-edited fields) intact.
    if (incoming === previousLoadedJsonRef.current) {
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
    setViewerFieldValues((previousValues) => {
      const nextValues: Record<string, ViewerFieldValue> = {};
      for (const field of fields) {
        nextValues[field.key] = initialViewerFieldValue(
          field,
          previousValues[field.key]
        );
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

    setActiveViewerSignatureFieldId((previousFieldId) =>
      previousFieldId &&
      fields.some(
        (field) => field.type === "signature" && field.id === previousFieldId
      )
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
      setViewerFieldValues((previousValues) => {
        const nextValues: Record<string, ViewerFieldValue> = {};
        for (const field of fields) {
          nextValues[field.key] = initialViewerFieldValue(field, undefined);
        }
        const previousKeys = Object.keys(previousValues);
        const nextKeys = Object.keys(nextValues);
        if (
          previousKeys.length === nextKeys.length &&
          nextKeys.every((key) => previousValues[key] === nextValues[key])
        ) {
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
      setViewerFieldValues((previousValues) => {
        const nextValues: Record<string, ViewerFieldValue> = {};
        for (const field of fields) {
          nextValues[field.key] = initialViewerFieldValue(field, undefined);
        }
        const previousKeys = Object.keys(previousValues);
        const nextKeys = Object.keys(nextValues);
        if (
          previousKeys.length === nextKeys.length &&
          nextKeys.every((key) => previousValues[key] === nextValues[key])
        ) {
          return previousValues;
        }
        return nextValues;
      });
      return;
    }

    setDataJsonError(null);
    lastParsedDataJsonRef.current = parsed.values;
    viewerFieldValuesDirtyRef.current = false;
    setViewerFieldValues((previousValues) => {
      const nextValues: Record<string, ViewerFieldValue> = {};
      for (const field of fields) {
        const normalized = normalizeViewerValueFromPdfField(
          field,
          parsed.values[field.key]
        );
        const shouldUseComputedDefault =
          isComputedTokenKey(field.key) &&
          typeof normalized === "string" &&
          normalized.trim().length === 0;
        nextValues[field.key] =
          normalized === undefined || shouldUseComputedDefault
            ? initialViewerFieldValue(field, undefined)
            : normalized;
      }
      const previousKeys = Object.keys(previousValues);
      const nextKeys = Object.keys(nextValues);
      if (
        previousKeys.length === nextKeys.length &&
        nextKeys.every((key) => previousValues[key] === nextValues[key])
      ) {
        return previousValues;
      }
      return nextValues;
    });
  }, [isViewerMode, isDataJsonBound, dataJsonText, fields]);

  useEffect(() => {
    setPageJumpInput(String(isContinuousLayout ? visiblePage : pageIndex + 1));
  }, [pageIndex, visiblePage, isContinuousLayout]);

  useEffect(() => {
    if (!pdfDoc || !isContinuousLayout) {
      setPageSizes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const sizes: PageSize[] = [];
      for (let n = 1; n <= pdfDoc.numPages; n++) {
        const page = await pdfDoc.getPage(n);
        const viewport = page.getViewport({ scale: 1 });
        sizes.push({ width: viewport.width, height: viewport.height });
      }
      if (!cancelled) {
        setPageSizes(sizes);
        setVisiblePage(1);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, isContinuousLayout]);

  useEffect(() => {
    if (!viewerRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
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
    let cancelled = false;
    const loadPdf = async () => {
      setLoadingPdf(true);
      setRenderError(null);
      try {
        const mxGlobal = (window as any).mx;
        if (!mxGlobal?.data?.getDocumentUrl) {
          throw new Error("mx.data.getDocumentUrl is not available.");
        }
        // Mendix 11.12 changed mx.data.getDocumentUrl to return a Promise<string>
        // (previously a synchronous string). Await handles both shapes; without it
        // the Promise stringifies to "[object Promise]" and fetch 400s.
        const url = await mxGlobal.data.getDocumentUrl(basePdfId);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load PDF. HTTP ${response.status}.`);
        }
        const blob = await response.blob();
        const data = await blob.arrayBuffer();

        try {
          const pdfjs = await loadSharedPdfjs();
          // Untrusted uploads (pentest F-2026-18787): no eval'd font programs, no XFA.
          const doc = await pdfjs.getDocument({
            data,
            isEvalSupported: false,
            enableXfa: false
          }).promise as unknown as PdfjsDocumentProxy;
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
              setImageNaturalSize({
                width: loadedImage.width,
                height: loadedImage.height
              });
              setPdfDoc(null);
              setPageIndex(0);
            } else {
              URL.revokeObjectURL(loadedImage.url);
            }
          } catch (imageError) {
            const pdfMessage =
              pdfError instanceof Error
                ? pdfError.message
                : "Unknown PDF parse error.";
            const imageMessage =
              imageError instanceof Error
                ? imageError.message
                : "Unknown image parse error.";
            throw new Error(
              `Failed to load base document as PDF (${pdfMessage}) or image (${imageMessage}).`
            );
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load PDF.";
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
  }, [
    basePdfId,
    revokeImageObjectUrl,
    pdfRefreshCounter
  ]);

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
        const fitScale = containerWidth
          ? Math.min(containerWidth / viewport.width, 2)
          : 1;
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
        const renderTask = page.render({
          canvasContext: context,
          viewport: scaledViewport
        });
        activePageRenderTaskRef.current = renderTask;
        await renderTask.promise;
        if (activePageRenderTaskRef.current === renderTask) {
          activePageRenderTaskRef.current = null;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to render page.";
        const normalizedMessage = message.toLowerCase();
        if (
          normalizedMessage.includes("renderingcancelledexception") ||
          normalizedMessage.includes("rendering cancelled")
        ) {
          return;
        }
        if (
          normalizedMessage.includes(
            "cannot use the same canvas during multiple render"
          )
        ) {
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

    const fitScale = containerWidth
      ? Math.min(containerWidth / imageNaturalSize.width, 2)
      : 1;
    setPageSize({
      width: imageNaturalSize.width,
      height: imageNaturalSize.height
    });
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
            setPageThumbs((prev) => ({ ...prev, [page - 1]: dataUrl }));
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

  const runConfiguredAction = useCallback(
    (actionValue?: { canExecute: boolean; execute: () => void }) => {
      if (actionValue?.canExecute) {
        actionValue.execute();
      }
    },
    []
  );

  const handleHeaderCheckboxChange = useCallback(
    (nextChecked: boolean) => {
      const attribute = props.headerCheckboxAttribute;
      if (!attribute || attribute.status !== "available" || attribute.readOnly) {
        return;
      }

      try {
        attribute.setValue(nextChecked);
      } catch (error) {
        console.warn("Failed to update header checkbox attribute.", error);
        return;
      }

      runConfiguredAction(props.headerCheckboxOnChangeAction);
    },
    [
      props.headerCheckboxAttribute,
      props.headerCheckboxOnChangeAction,
      runConfiguredAction
    ]
  );

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
        const payloadObject = buildDataPayload(
          fieldsRef.current,
          nextViewerValues,
          lastParsedDataJsonRef.current
        );
        const payload = buildDataJson(
          fieldsRef.current,
          nextViewerValues,
          lastParsedDataJsonRef.current
        );
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
        runConfiguredAction(configuredSaveAction);
      }
    },
    [dataSourceItem, configuredSaveAction, runConfiguredAction]
  );

  useEffect(() => {
    if (
      !isViewerMode ||
      !isDataJsonBound ||
      !viewerFieldValuesDirtyRef.current
    ) {
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
      previousLoadedJsonRef.current = lastLoadedJsonRef.current;
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
        runConfiguredAction(configuredSaveAction);
      }
    },
    [dataSourceItem, basePdfId, configuredSaveAction, runConfiguredAction]
  );

  const viewerTemplateValues = useMemo(() => {
    const payload = buildDataPayload(
      fields,
      viewerFieldValues,
      lastParsedDataJsonRef.current
    );
    if (Object.keys(tokenContextValues).length === 0) {
      return payload;
    }
    // Tokens are fallback values: user/data values win unless blank.
    const merged: Record<string, unknown> = { ...tokenContextValues };
    Object.entries(payload).forEach(([key, value]) => {
      const isBlank =
        value === null ||
        value === undefined ||
        (typeof value === "string" && !value.trim());
      if (isBlank && key in merged) {
        return;
      }
      merged[key] = value;
    });
    return merged;
  }, [fields, viewerFieldValues, tokenContextValues]);
  const missingViewerRequiredFields = useMemo(
    () =>
      fields.filter((field) =>
        isViewerRequiredFieldMissing(
          field,
          viewerFieldValues,
          viewerTemplateValues
        )
      ),
    [fields, viewerFieldValues, viewerTemplateValues]
  );
  const missingViewerRequiredFieldIds = useMemo(
    () => new Set(missingViewerRequiredFields.map((field) => field.id)),
    [missingViewerRequiredFields]
  );
  const hasMissingViewerRequiredFields = missingViewerRequiredFields.length > 0;
  // The page can switch the red highlight on (e.g. after a refused Lock), as Save always did.
  const requiredHighlightFromPage =
    (props as any).requiredHighlight?.status === "available" &&
    (props as any).requiredHighlight?.value === true;
  const showRequiredHighlight = viewerSaveAttempted || requiredHighlightFromPage;
  const viewerValidationMessage =
    isViewerMode && showRequiredHighlight && hasMissingViewerRequiredFields
      ? `Required fields still empty: ${missingViewerRequiredFields
          .map(describeRequiredField)
          .join("; ")}.`
      : null;
  const requiredFieldTotal = useMemo(
    () => fields.filter((field) => field.required).length,
    [fields]
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
      setFields((prev) => {
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
          | "transparentBackground"
          | "textColor"
          | "backgroundColor"
          | "required"
        >
      >
    ): TemplateField => {
      const defaults = FIELD_DEFAULTS[type];
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      const key =
        overrides?.key?.trim() || nextFieldKey(type, fieldsRef.current);
      const fieldWidth = Math.max(8, toNumber(overrides?.w, defaults.w));
      const fieldHeight = Math.max(8, toNumber(overrides?.h, defaults.h));
      const fontSize = Math.max(
        6,
        toNumber(overrides?.fontSize, defaults.fontSize)
      );
      const align =
        overrides?.align && isAlign(overrides.align)
          ? overrides.align
          : defaults.align;
      const format = normalizeFieldFormat(type, overrides?.format);
      const snappedX = snapValue(
        clamp(x - fieldWidth / 2, 0, width - fieldWidth),
        snapEnabled
      );
      const snappedY = snapValue(
        clamp(y - fieldHeight / 2, 0, height - fieldHeight),
        snapEnabled
      );
      return {
        id: createFieldId(),
        key,
        label: overrides?.label ?? "",
        variablesSampleData: overrides?.variablesSampleData ?? "",
        format,
        options: overrides?.options
          ? [...overrides.options]
          : defaultOptionsForFieldType(type),
        imageDataUrl: overrides?.imageDataUrl ?? "",
        labelOrientation:
          overrides?.labelOrientation &&
          isFieldOrientation(overrides.labelOrientation)
            ? overrides.labelOrientation
            : defaultLabelOrientationForFieldType(type),
        optionsOrientation:
          overrides?.optionsOrientation &&
          isFieldOrientation(overrides.optionsOrientation)
            ? overrides.optionsOrientation
            : defaultOptionsOrientationForFieldType(type),
        showLabel: overrides?.showLabel ?? true,
        transparentBackground: supportsTransparentBackground(type)
          ? overrides?.transparentBackground ?? true
          : false,
        textColor: normalizeHexColor(
          overrides?.textColor,
          DEFAULT_FIELD_TEXT_COLOR
        ),
        backgroundColor: normalizeBackgroundColor(
          overrides?.backgroundColor,
          DEFAULT_FIELD_BACKGROUND_COLOR
        ),
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
          | "transparentBackground"
          | "textColor"
          | "backgroundColor"
          | "required"
        >
      >
    ) => {
      const field = createField(type, x, y, overrides);
      applyFieldUpdate((prev) => [...prev, field]);
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
          | "transparentBackground"
          | "textColor"
          | "backgroundColor"
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
    (
      fieldId: string,
      changes: Partial<TemplateField>,
      options?: { commit?: boolean; history?: boolean }
    ) => {
      applyFieldUpdate(
        (prev) =>
          prev.map((field) =>
            field.id === fieldId ? { ...field, ...changes } : field
          ),
        options
      );
    },
    [applyFieldUpdate]
  );

  const deleteField = useCallback(
    (fieldId: string, options?: { commit?: boolean; history?: boolean }) => {
      applyFieldUpdate(
        (prev) => prev.filter((field) => field.id !== fieldId),
        options
      );
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
    if (activeFieldId && !next.some((field) => field.id === activeFieldId)) {
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
    if (activeFieldId && !next.some((field) => field.id === activeFieldId)) {
      setSelectedFieldId(next[0]?.id || null);
    }
  }, [commitTemplate]);

  const duplicateSelectedField = useCallback(() => {
    const activeFieldId = selectedFieldIdRef.current;
    if (!activeFieldId) {
      return;
    }
    const source = fieldsRef.current.find(
      (field) => field.id === activeFieldId
    );
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
    applyFieldUpdate((prev) => [...prev, field]);
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
      applyFieldUpdate((prev) => {
        let changed = false;
        const next = prev.map((field) => {
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
    () => fields.find((field) => field.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );
  const selectedFieldDateFormat =
    selectedField && selectedField.type === "date"
      ? normalizeFieldFormat("date", selectedField.format)
      : DEFAULT_DATE_FIELD_FORMAT;
  const selectedFieldHasCustomDateFormat = !DATE_FIELD_FORMAT_OPTIONS.some(
    (option) => option.value === selectedFieldDateFormat
  );
  const selectedFieldSupportsTransparentBackground = Boolean(
    selectedField && supportsTransparentBackground(selectedField.type)
  );
  const selectedFieldSupportsColorStyling =
    selectedFieldSupportsTransparentBackground;
  const selectedFieldTextColorPickerValue = selectedField
    ? colorPickerValue(selectedField.textColor, DEFAULT_FIELD_TEXT_COLOR)
    : DEFAULT_FIELD_TEXT_COLOR;
  const selectedFieldBackgroundColorPickerValue = selectedField
    ? colorPickerValue(
        selectedField.backgroundColor,
        DEFAULT_FIELD_BACKGROUND_COLOR
      )
    : DEFAULT_FIELD_BACKGROUND_COLOR;
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
    const hasCurrentValue = keyInputState.options.some(
      (option) => option.value === currentValue
    );
    if (hasCurrentValue || !currentValue) {
      return keyInputState.options;
    }

    return [
      { value: currentValue, label: `${currentValue} (current)` },
      ...keyInputState.options
    ];
  }, [keyInputState, selectedField]);
  const selectedFieldSourceKeyOption = useMemo(() => {
    if (keyInputState.mode !== "dropdown" || !selectedField) {
      return undefined;
    }
    return keyInputState.options.find(
      (option) => option.value === selectedField.key
    );
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
    if (
      !selectedField ||
      (selectedField.type !== "select" && selectedField.type !== "radio")
    ) {
      return [] as string[];
    }
    if (selectedFieldIsEnumBound && selectedFieldEnumOptions.length > 0) {
      return selectedFieldEnumOptions;
    }
    return selectedField.options.length > 0
      ? selectedField.options
      : defaultOptionsForFieldType(selectedField.type);
  }, [selectedField, selectedFieldIsEnumBound, selectedFieldEnumOptions]);
  const selectedFieldIsImageKeyBound =
    Boolean(selectedField) &&
    selectedField?.type === "image" &&
    Boolean(selectedFieldSourceKeyOption);
  const selectedFieldImagePreview = useMemo(() => {
    if (!selectedField || selectedField.type !== "image") {
      return "";
    }
    const keyedImage = normalizeImageDataFromUnknown(
      viewerFieldValues[selectedField.key]
    );
    const staticImage = normalizeImageDataFromUnknown(
      selectedField.imageDataUrl
    );
    return keyedImage || staticImage;
  }, [selectedField, viewerFieldValues]);

  useEffect(() => {
    if (
      !selectedField ||
      (selectedField.type !== "select" && selectedField.type !== "radio")
    ) {
      return;
    }
    if (!selectedFieldIsEnumBound || selectedFieldEnumOptions.length === 0) {
      return;
    }
    if (areStringArraysEqual(selectedField.options, selectedFieldEnumOptions)) {
      return;
    }
    updateField(
      selectedField.id,
      { options: [...selectedFieldEnumOptions] },
      { history: false }
    );
  }, [
    selectedField,
    selectedFieldIsEnumBound,
    selectedFieldEnumOptions,
    updateField
  ]);

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
        (field) =>
          field.page === dragState.startField.page &&
          field.id !== dragState.fieldId
      );
      const verticalRefs = relatedFields.flatMap(fieldVerticalLines);
      const horizontalRefs = relatedFields.flatMap(fieldHorizontalLines);
      const activeGuides: GuideLine[] = [];

      const update = (field: TemplateField): TemplateField => {
        if (field.id !== dragState.fieldId) {
          return field;
        }

        if (dragState.mode === "move") {
          let nextX = clamp(
            dragState.startField.x + deltaX,
            0,
            width - field.w
          );
          let nextY = clamp(
            dragState.startField.y + deltaY,
            0,
            height - field.h
          );

          if (snapEnabled) {
            nextX = snapValue(nextX, true);
            nextY = snapValue(nextY, true);
            const snappedX = snapPositionToReferences(
              nextX,
              field.w,
              verticalRefs,
              ALIGN_TOLERANCE
            );
            const snappedY = snapPositionToReferences(
              nextY,
              field.h,
              horizontalRefs,
              ALIGN_TOLERANCE
            );
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
        let nextW = clamp(
          dragState.startField.w + deltaX,
          minW,
          width - field.x
        );
        let nextH = clamp(
          dragState.startField.h + deltaY,
          minH,
          height - field.y
        );
        if (snapEnabled) {
          nextW = snapValue(nextW, true);
          nextH = snapValue(nextH, true);
          const rightRef = findClosestReference(
            field.x + nextW,
            verticalRefs,
            ALIGN_TOLERANCE
          );
          const bottomRef = findClosestReference(
            field.y + nextH,
            horizontalRefs,
            ALIGN_TOLERANCE
          );
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
        (prev) =>
          prev.map((field) =>
            field.id === dragState.fieldId ? update(field) : field
          ),
        { commit: false, history: false }
      );
      setGuides(activeGuides);
    };

    const handleUp = () => {
      setDragState(null);
      setGuides([]);
      const previous = undoStackRef.current[undoStackRef.current.length - 1];
      const hasChanged =
        !previous || !areFieldsEqual(previous, fieldsRef.current);
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
  }, [
    dragState,
    renderScale,
    pageSize,
    snapEnabled,
    applyFieldUpdate,
    commitTemplate
  ]);

  const handleFieldPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      field: TemplateField,
      mode: "move" | "resize"
    ) => {
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
    () =>
      placementToolCandidates.find((tool) => tool.id === placementToolId) ||
      null,
    [placementToolId, placementToolCandidates]
  );
  useEffect(() => {
    if (placementToolId && !selectedPlacementTool) {
      setPlacementToolId(null);
    }
  }, [placementToolId, selectedPlacementTool]);

  const buildOverridesForTool = useCallback(
    (tool: (typeof TOOL_RAIL_ITEMS)[number]) => {
      const key = nextPrefixedFieldKey(
        tool.keyBase || tool.id || tool.type,
        fieldsRef.current
      );
      return {
        key,
        label: tool.seedLabel || "",
        variablesSampleData:
          tool.type === "multiVariableText"
            ? tool.seedVariablesSampleData ?? "{name}"
            : undefined,
        format: tool.format,
        w: tool.w,
        h: tool.h,
        align: tool.align,
        showLabel: tool.showLabel
      } as Partial<
        Pick<
          TemplateField,
          | "key"
          | "label"
          | "variablesSampleData"
          | "format"
          | "w"
          | "h"
          | "align"
          | "showLabel"
        >
      >;
    },
    []
  );

  const placeToolAtClientPoint = useCallback(
    (
      tool: (typeof TOOL_RAIL_ITEMS)[number],
      clientX: number,
      clientY: number
    ) => {
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

  const openTokenPicker = useCallback(
    (mode: "insert" | "add", anchorElement?: HTMLElement | null) => {
      setTokenSearch("");
      // The palette sidebar clips overflow, so the "add" picker is fixed-positioned
      // beside the button that opened it.
      const rect = anchorElement?.getBoundingClientRect();
      setTokenPicker({
        mode,
        tab: "client",
        anchor: rect
          ? {
              x: Math.round(rect.right + 10),
              y: Math.round(
                Math.max(8, Math.min(rect.top, window.innerHeight - 440))
              )
            }
          : undefined
      });
    },
    []
  );
  const closeTokenPicker = useCallback(() => setTokenPicker(null), []);
  const handleTokenPick = useCallback(
    (entry: TokenCatalogEntry) => {
      setRecentTokenKeys(rememberRecentTokenKey(entry.key));
      if (tokenPicker?.mode === "add") {
        addFieldCentered("multiVariableText", {
          key: nextPrefixedFieldKey(TOKEN_FIELD_KEY_BASE, fieldsRef.current),
          label: "",
          variablesSampleData: `{${entry.key}}`,
          showLabel: false,
          w: 220,
          h: 22
        });
      } else {
        const target = fieldsRef.current.find(
          (field) => field.id === selectedFieldIdRef.current
        );
        if (target) {
          updateField(target.id, {
            variablesSampleData: appendTokenToContent(
              target.variablesSampleData,
              entry.key
            )
          });
        }
      }
      setTokenPicker(null);
    },
    [addFieldCentered, tokenPicker, updateField]
  );
  const renderTokenPicker = useCallback(() => {
    if (!tokenPicker) {
      return null;
    }
    const search = tokenSearch.trim().toLowerCase();
    const inTab = tokenCatalog.filter((entry) =>
      tokenPicker.tab === "computed"
        ? entry.kind === "computed"
        : tokenPicker.tab === "doc"
        ? entry.kind === "doc"
        : entry.kind === "client" || entry.kind === "other"
    );
    const visible = (search ? tokenCatalog : inTab).filter(
      (entry) =>
        !search ||
        entry.label.toLowerCase().includes(search) ||
        entry.key.toLowerCase().includes(search)
    );
    const recent = search
      ? []
      : recentTokenKeys
          .map((key) => tokenCatalog.find((entry) => entry.key === key))
          .filter((entry): entry is TokenCatalogEntry => Boolean(entry));
    const tabs: Array<{ id: TokenKind; label: string }> = [
      { id: "client", label: "Client" },
      { id: "doc", label: "Document" },
      { id: "computed", label: "Dates" }
    ];
    const renderRow = (entry: TokenCatalogEntry) => (
      <button
        key={`pick_${entry.key}`}
        type="button"
        className="pdf-template-designer__token-row"
        onClick={() => handleTokenPick(entry)}
      >
        <span className="pdf-template-designer__token-row-label">
          {entry.label}
        </span>
        <span className="pdf-template-designer__token-row-sample">
          {TOKEN_SAMPLE_VALUES[entry.key] || ""}
        </span>
      </button>
    );
    return (
      <div
        className="pdf-template-designer__token-picker"
        role="dialog"
        aria-label="Insert client data"
        style={
          tokenPicker.anchor
            ? {
                position: "fixed",
                left: tokenPicker.anchor.x,
                top: tokenPicker.anchor.y,
                bottom: "auto"
              }
            : undefined
        }
      >
        <div className="pdf-template-designer__token-picker-head">
          <span className="pdf-template-designer__token-picker-title">
            {tokenPicker.mode === "add" ? "Add client data" : "Insert client data"}
          </span>
          <button
            type="button"
            className="pdf-template-designer__token-picker-close"
            aria-label="Close"
            onClick={closeTokenPicker}
          >
            ×
          </button>
        </div>
        <input
          className="pdf-template-designer__input"
          type="search"
          placeholder="Search…"
          value={tokenSearch}
          autoFocus
          onChange={(event) => setTokenSearch(event.target.value)}
        />
        <div className="pdf-template-designer__token-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tokenPicker.tab === tab.id}
              className={`pdf-template-designer__token-tab${
                tokenPicker.tab === tab.id ? " is-active" : ""
              }`}
              onClick={() => setTokenPicker({ ...tokenPicker, tab: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pdf-template-designer__token-list">
          {recent.length > 0 ? (
            <div className="pdf-template-designer__token-group">Recent</div>
          ) : null}
          {recent.map(renderRow)}
          {recent.length > 0 ? (
            <div className="pdf-template-designer__token-group">
              All {tabs.find((tab) => tab.id === tokenPicker.tab)?.label.toLowerCase()} data
            </div>
          ) : null}
          {visible.length === 0 ? (
            <div className="pdf-template-designer__status">Nothing matches.</div>
          ) : (
            visible.map(renderRow)
          )}
        </div>
        <div className="pdf-template-designer__token-picker-foot">
          Examples show a sample client. The real document fills in that
          client's own details.
        </div>
      </div>
    );
  }, [
    closeTokenPicker,
    handleTokenPick,
    recentTokenKeys,
    tokenCatalog,
    tokenPicker,
    tokenSearch
  ]);

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

  const handlePaletteDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, toolId: string) => {
      event.dataTransfer.setData(PALETTE_TYPE_DRAG_TYPE, toolId);
      event.dataTransfer.effectAllowed = "copy";
      setPlacementToolId(toolId);
    },
    []
  );

  const handleOverlayDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(PALETTE_TYPE_DRAG_TYPE)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    []
  );

  const handleOverlayDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const droppedToolId = event.dataTransfer
        .getData(PALETTE_TYPE_DRAG_TYPE)
        .trim();
      const droppedTool =
        placementToolCandidates.find((tool) => tool.id === droppedToolId) ||
        visibleToolRailItems.find((tool) => tool.type === droppedToolId);
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
    [
      placeAtClientPoint,
      placeToolAtClientPoint,
      placementToolCandidates,
      visibleToolRailItems
    ]
  );

  const handleOverlayPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target !== overlayRef.current) {
        return;
      }
      if (selectedPlacementTool) {
        event.preventDefault();
        placeToolAtClientPoint(
          selectedPlacementTool,
          event.clientX,
          event.clientY
        );
        return;
      }
      setSelectedFieldId(null);
    },
    [selectedPlacementTool, placeToolAtClientPoint]
  );

  useEffect(() => {
    if (isViewerMode || isReadOnlyMode || !enableKeyboardShortcuts) {
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
  }, [
    isViewerMode,
    isReadOnlyMode,
    enableKeyboardShortcuts,
    undo,
    redo,
    duplicateSelectedField,
    deleteField,
    nudgeSelectedField
  ]);

  const handleSaveClick = useCallback(() => {
    if (isReadOnlyMode) {
      return;
    }
    if (isViewerMode) {
      if (hasMissingViewerRequiredFields) {
        setViewerSaveAttempted(true);
        return;
      }
      setViewerSaveAttempted(false);
      viewerFieldValuesDirtyRef.current = false;
      commitDataJson(viewerFieldValues, {
        runSaveAction: true,
        runOnChangeAction: false
      });
      return;
    }
    commitTemplate(fieldsRef.current, {
      runSaveAction: true,
      runOnChangeAction: false
    });
  }, [
    isReadOnlyMode,
    isViewerMode,
    commitDataJson,
    hasMissingViewerRequiredFields,
    viewerFieldValues,
    commitTemplate
  ]);
  const saveToolbarButton = useMemo<ToolbarButtonConfig | null>(() => {
    if (
      isReadOnlyMode ||
      !showSaveButton ||
      !resolveBooleanProperty(props.saveButtonVisible, true)
    ) {
      return null;
    }

    return {
      key: "save",
      visible: true,
      text: saveButtonText,
      tooltip: saveButtonTooltip || undefined,
      icon: props.saveButtonIcon,
      className: getToolbarButtonClassName(
        normalizeToolbarButtonRenderMode(props.saveButtonRenderMode),
        normalizeToolbarButtonStyle(props.saveButtonStyle ?? "primary")
      ),
      tabIndex:
        typeof props.saveButtonTabIndex === "number"
          ? props.saveButtonTabIndex
          : undefined,
      disabled: props.saveButtonEnabled === false,
      onClick: handleSaveClick
    };
  }, [
    isReadOnlyMode,
    showSaveButton,
    props.saveButtonVisible,
    saveButtonText,
    saveButtonTooltip,
    props.saveButtonIcon,
    props.saveButtonRenderMode,
    props.saveButtonStyle,
    props.saveButtonTabIndex,
    props.saveButtonEnabled,
    handleSaveClick
  ]);
  const toolbarActionButtons = useMemo(
    () =>
      saveToolbarButton
        ? [saveToolbarButton, ...customActionButtons]
        : customActionButtons,
    [customActionButtons, saveToolbarButton]
  );
  const headerCheckboxControl = useMemo<ReactElement | null>(() => {
    const attribute = props.headerCheckboxAttribute;
    if (
      !showHeaderCheckbox ||
      !resolveBooleanProperty(props.headerCheckboxVisible, true) ||
      !attribute ||
      attribute.status !== "available"
    ) {
      return null;
    }

    const disabled =
      attribute.readOnly ||
      !resolveBooleanProperty(props.headerCheckboxEditable, true);

    return (
      <label className="pdf-template-designer__header-checkbox">
        <input
          type="checkbox"
          checked={Boolean(attribute.value)}
          disabled={disabled}
          onChange={(event) => handleHeaderCheckboxChange(event.target.checked)}
        />
        {headerCheckboxShowLabel ? (
          <span>{headerCheckboxLabel}</span>
        ) : null}
      </label>
    );
  }, [
    showHeaderCheckbox,
    props.headerCheckboxVisible,
    props.headerCheckboxAttribute,
    props.headerCheckboxEditable,
    headerCheckboxShowLabel,
    headerCheckboxLabel,
    handleHeaderCheckboxChange
  ]);

  const handleExportTemplateClick = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const payload = buildTemplateJson(fieldsRef.current, basePdfId);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `template-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [basePdfId]);

  const handleImportTemplateClick = useCallback(() => {
    if (isViewerMode || isReadOnlyMode) {
      return;
    }
    importTemplateInputRef.current?.click();
  }, [isViewerMode, isReadOnlyMode]);

  const handleImportTemplateFileChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = ""; // allow re-selecting the same file
      if (!file || isViewerMode || isReadOnlyMode) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        const parsed = parseTemplateJson(text);
        if (parsed.error) {
          setJsonError(`Import failed: ${parsed.error}`);
          return;
        }
        setJsonError(null);
        setFields(parsed.fields);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setGuides([]);
        setSelectedFieldId(parsed.fields[0]?.id || null);
        lastLoadedJsonRef.current = text;
      };
      reader.onerror = () => {
        setJsonError("Unable to read the selected template file.");
      };
      reader.readAsText(file);
    },
    [isViewerMode, isReadOnlyMode]
  );

  const handleReplacePdfClick = useCallback(() => {
    if (isViewerMode || isReadOnlyMode || !basePdfId) {
      return;
    }
    replacePdfInputRef.current?.click();
  }, [isViewerMode, isReadOnlyMode, basePdfId]);

  const handleReplacePdfFileChange = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = ""; // allow re-selecting the same file
      if (!file || !basePdfId || isViewerMode || isReadOnlyMode) {
        return;
      }
      const isPdf =
        file.type.toLowerCase() === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setRenderError("Please choose a PDF file.");
        return;
      }
      if (
        typeof window !== "undefined" &&
        typeof window.confirm === "function" &&
        !window.confirm(
          "Replace the base PDF with this file? This overwrites the stored PDF and keeps your current field layout."
        )
      ) {
        return;
      }
      const mxGlobal = (window as any).mx;
      if (!mxGlobal?.data?.saveDocument) {
        setRenderError("mx.data.saveDocument is not available.");
        return;
      }
      setLoadingPdf(true);
      setRenderError(null);
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        setLoadingPdf(false);
        if (error) {
          const message =
            error instanceof Error ? error.message : "Failed to replace PDF.";
          setRenderError(message);
          return;
        }
        // Force the PDF-load effect to re-fetch and re-render the new document.
        setPdfRefreshCounter((value) => value + 1);
      };
      try {
        // Mendix 11.12 made several mx.data APIs Promise-based; support both the
        // Promise form and the legacy (guid, name, params, blob, ok, err) callbacks.
        const maybePromise = mxGlobal.data.saveDocument(
          basePdfId,
          file.name || "document.pdf",
          {},
          file,
          () => finish(),
          (err: unknown) => finish(err || new Error("Failed to replace PDF."))
        );
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise
            .then(() => finish())
            .catch((err: unknown) => finish(err));
        }
      } catch (error) {
        finish(error);
      }
    },
    [basePdfId, isViewerMode, isReadOnlyMode]
  );

  const handlePrintClick = useCallback(async () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const doc = pdfDoc;
    if (!doc) {
      return;
    }
    const totalPages = doc.numPages;
    const imageDataUrls: string[] = [];
    try {
      for (let i = 1; i <= totalPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const offscreen = document.createElement("canvas");
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const context = offscreen.getContext("2d");
        if (!context) {
          continue;
        }
        await page.render({ canvasContext: context, viewport }).promise;
        imageDataUrls.push(offscreen.toDataURL("image/png"));
      }
    } catch (_error) {
      return;
    }
    if (imageDataUrls.length === 0) {
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }
    const imgTags = imageDataUrls
      .map(
        (url) =>
          '<img src="' +
          url +
          '" style="width:100%;height:auto;display:block" />'
      )
      .join("");
    printWindow.document.write(
      "<!DOCTYPE html><html><head><title>Print</title><style>" +
        "html,body{margin:0;padding:0}" +
        "img{page-break-after:always}" +
        "img:last-child{page-break-after:avoid}" +
        "@media print{@page{margin:0}body{margin:0}}" +
        "</style></head><body>" +
        imgTags +
        "</body></html>"
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, [pdfDoc]);

  const reorderFieldListItem = useCallback(
    (sourceId: string, targetId: string) => {
      if (!sourceId || !targetId || sourceId === targetId) {
        return;
      }
      applyFieldUpdate((prev) => {
        const fromIndex = prev.findIndex((field) => field.id === sourceId);
        const toIndex = prev.findIndex((field) => field.id === targetId);
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

  const setViewerFieldValue = useCallback(
    (fieldKey: string, value: ViewerFieldValue) => {
      setViewerFieldValues((previousValues) => {
        if (previousValues[fieldKey] === value) {
          return previousValues;
        }
        viewerFieldValuesDirtyRef.current = true;
        return { ...previousValues, [fieldKey]: value };
      });
    },
    []
  );

  const addOptionToSelectedField = useCallback(() => {
    if (
      !selectedField ||
      (selectedField.type !== "select" && selectedField.type !== "radio")
    ) {
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
  }, [
    selectedField,
    selectedFieldIsEnumBound,
    optionDraft,
    selectedFieldEffectiveOptions,
    updateField
  ]);

  const updateSelectedFieldOption = useCallback(
    (index: number, value: string) => {
      if (
        !selectedField ||
        (selectedField.type !== "select" && selectedField.type !== "radio")
      ) {
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
    [
      selectedField,
      selectedFieldIsEnumBound,
      selectedFieldEffectiveOptions,
      updateField
    ]
  );

  const removeSelectedFieldOption = useCallback(
    (index: number) => {
      if (
        !selectedField ||
        (selectedField.type !== "select" && selectedField.type !== "radio")
      ) {
        return;
      }
      if (selectedFieldIsEnumBound) {
        return;
      }
      if (index < 0 || index >= selectedFieldEffectiveOptions.length) {
        return;
      }
      const nextOptions = selectedFieldEffectiveOptions.filter(
        (_option, optionIndex) => optionIndex !== index
      );
      updateField(selectedField.id, { options: nextOptions });
    },
    [
      selectedField,
      selectedFieldIsEnumBound,
      selectedFieldEffectiveOptions,
      updateField
    ]
  );

  const handleSelectedFieldImageUpload = useCallback(
    (event: ReactChangeEvent<HTMLInputElement>) => {
      if (
        !selectedField ||
        selectedField.type !== "image" ||
        selectedFieldIsImageKeyBound
      ) {
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
          .then((rasterized) => {
            const finalImage =
              normalizeImageDataFromUnknown(rasterized) || normalized;
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
      if (typeof window !== "undefined") {
        stopSigWebLiveCapture(window as any, sigWebLiveTimerRef.current);
        sigWebLiveTimerRef.current = undefined;
        if (sigWebEventTimerRef.current !== null) {
          window.clearInterval(sigWebEventTimerRef.current);
          sigWebEventTimerRef.current = null;
        }
        (window as any).onSigPenUp = previousSigWebPenUpHandlerRef.current;
      }
      if (typeof window !== "undefined") {
        clearSigWebTablet(window as any);
      }
      if (activeSigWebCanvasRef.current) {
        clearSignatureCanvasElement(activeSigWebCanvasRef.current);
      }
      setShowTypedSignatureEditor(false);
      setTypedSignatureDraft("");
      setViewerFieldValue(fieldKey, "");
      setViewerSignatureMessage(null);
    },
    [setViewerFieldValue]
  );

  const stopSigWebForActiveField = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (sigWebEventTimerRef.current !== null) {
      window.clearInterval(sigWebEventTimerRef.current);
      sigWebEventTimerRef.current = null;
    }
    (window as any).onSigPenUp = previousSigWebPenUpHandlerRef.current;
    stopSigWebLiveCapture(window as any, sigWebLiveTimerRef.current);
    sigWebLiveTimerRef.current = undefined;
  }, []);

  const rearmSigWebForActiveField = useCallback(
    (fieldKey: string, value: string) => {
      if (typeof window === "undefined") {
        return;
      }
      const globalObject = window as any;
      const activeCanvas = activeSigWebCanvasRef.current;
      if (!activeCanvas || activeSigWebFieldKeyRef.current !== fieldKey) {
        return;
      }

      const liveCapture = startSigWebLiveCapture(globalObject, activeCanvas, false);
      if (liveCapture.error) {
        setSigWebState("error");
        setSigWebError(liveCapture.error);
        return;
      }
      sigWebLiveTimerRef.current = liveCapture.timer;
      drawSignatureImageOnCanvas(activeCanvas, value).then(() => {
        previousSigWebPenUpHandlerRef.current = globalObject.onSigPenUp;
        globalObject.onSigPenUp = () => {
          persistSigWebCanvasValueRef.current?.();
        };
        if (typeof globalObject.SigWebEvent === "function") {
          sigWebEventTimerRef.current = window.setInterval(() => {
            try {
              globalObject.SigWebEvent();
            } catch (_error) {
              // Ignore intermittent SigWeb event polling failures.
            }
          }, 20);
        }
        setSigWebState("ready");
        setSigWebError(null);
      });
    },
    []
  );

  const persistSigWebCanvasValue = useCallback(() => {
    if (isPersistingSigWebRef.current) {
      return;
    }
    isPersistingSigWebRef.current = true;
    const fieldKey = activeSigWebFieldKeyRef.current;
    const canvas = activeSigWebCanvasRef.current;
    if (!fieldKey || !canvas) {
      isPersistingSigWebRef.current = false;
      return;
    }
    const globalObject = typeof window !== "undefined" ? (window as any) : null;
    const pointCount = globalObject ? getSigWebPointCount(globalObject) : undefined;
    if (pointCount !== undefined && pointCount <= 0) {
      isPersistingSigWebRef.current = false;
      return;
    }
    stopSigWebForActiveField();
    const persistedValue = exportCanvasToNormalizedPng(canvas);
    setViewerFieldValue(fieldKey, persistedValue);
    setViewerSignatureMessage(null);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        isPersistingSigWebRef.current = false;
        rearmSigWebForActiveField(fieldKey, persistedValue);
      }, 0);
    } else {
      isPersistingSigWebRef.current = false;
    }
  }, [setViewerFieldValue, stopSigWebForActiveField, rearmSigWebForActiveField]);

  useEffect(() => {
    persistSigWebCanvasValueRef.current = persistSigWebCanvasValue;
    return () => {
      persistSigWebCanvasValueRef.current = null;
    };
  }, [persistSigWebCanvasValue]);

  const prepareSigWebForField = useCallback(
    (
      fieldKey: string,
      canvas?: HTMLCanvasElement | null,
      preserveExistingContent = false,
      existingValue?: string
    ): Promise<string | undefined> => {
      if (typeof window === "undefined") {
        return Promise.resolve(undefined);
      }
      const globalObject = window as any;
      if (canvas) {
        activeSigWebCanvasRef.current = canvas;
      }
      activeSigWebFieldKeyRef.current = fieldKey;

      stopSigWebForActiveField();

      const activeCanvas = activeSigWebCanvasRef.current;
      if (activeCanvas) {
        const captureFunction = resolveSigWebCaptureFunction(globalObject);
        if (!captureFunction) {
          const captureError =
            "SigWeb capture function was not found. Verify that SigWebTablet.js is loaded.";
          setSigWebState("error");
          setSigWebError(captureError);
          return Promise.resolve(captureError);
        }
        const liveCapture = startSigWebLiveCapture(
          globalObject,
          activeCanvas,
          !preserveExistingContent
        );
        if (liveCapture.error) {
          setSigWebState("error");
          setSigWebError(liveCapture.error);
          return Promise.resolve(liveCapture.error);
        }
        sigWebLiveTimerRef.current = liveCapture.timer;
        if (!preserveExistingContent) {
          clearSigWebTablet(globalObject);
        }
        return drawSignatureImageOnCanvas(activeCanvas, existingValue).then(() => {
          previousSigWebPenUpHandlerRef.current = globalObject.onSigPenUp;
          globalObject.onSigPenUp = () => {
            persistSigWebCanvasValue();
          };
          if (typeof globalObject.SigWebEvent === "function") {
            sigWebEventTimerRef.current = window.setInterval(() => {
              try {
                globalObject.SigWebEvent();
              } catch (_error) {
                // Ignore intermittent SigWeb event polling failures.
              }
            }, 20);
          }

          setSigWebState("ready");
          setSigWebError(null);
          return undefined;
        });
      } else {
        const activationError = activateSigWebTablet(globalObject);
        if (activationError) {
          setSigWebState("error");
          setSigWebError(activationError);
          return Promise.resolve(activationError);
        }
        if (!preserveExistingContent) {
          clearSigWebTablet(globalObject);
        }
        sigWebLiveTimerRef.current = undefined;
      }
      setSigWebState("ready");
      setSigWebError(null);
      return Promise.resolve(undefined);
    },
    [persistSigWebCanvasValue, stopSigWebForActiveField]
  );

  const importSignatureFromSigWeb = useCallback(
    async (fieldKey: string) => {
      if (typeof window === "undefined") {
        return;
      }
      const globalObject = window as any;
      const activationError = activateSigWebTablet(globalObject);
      if (activationError) {
        setSigWebState("error");
        setSigWebError(activationError);
        setViewerSignatureMessage(activationError);
        return;
      }
      setSigWebState("ready");
      setSigWebError(null);
      const captureFunction = resolveSigWebCaptureFunction(globalObject);
      if (!captureFunction) {
        setViewerSignatureMessage(
          "SigWeb capture function was not found. Verify that SigWebTablet.js is loaded and the pad service is available."
        );
        return;
      }

      const pointCountBeforeCapture = getSigWebPointCount(globalObject);
      if (
        pointCountBeforeCapture !== undefined &&
        pointCountBeforeCapture <= 0
      ) {
        setViewerSignatureMessage(
          "No pen strokes were detected on the signature pad. Please sign first, then click Use SigWeb."
        );
        return;
      }

      try {
        applySigWebImageDefaults(globalObject);
        const normalizedValue = await captureSignatureFromSigWeb(
          captureFunction
        );
        if (!normalizedValue) {
          const pointCountAfterCapture = getSigWebPointCount(globalObject);
          if (
            pointCountAfterCapture !== undefined &&
            pointCountAfterCapture <= 0
          ) {
            setViewerSignatureMessage(
              "SigWeb reported no captured points. Please sign on the pad and try again."
            );
          } else {
            setViewerSignatureMessage(
              "SigWeb returned no signature image. Verify SigWebTablet.js is connected to the pad service and try again."
            );
          }
          return;
        }
        setViewerFieldValue(fieldKey, normalizedValue);
        clearSigWebTablet(globalObject);
        setShowTypedSignatureEditor(false);
        setTypedSignatureDraft("");
        setViewerSignatureMessage(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown SigWeb error.";
        setViewerSignatureMessage(
          `Failed to import signature from SigWeb. ${message}`
        );
      }
    },
    [setViewerFieldValue]
  );

  const openTypedSignatureEditor = useCallback(() => {
    stopSigWebForActiveField();
    setShowTypedSignatureEditor(true);
    setViewerSignatureMessage(null);
  }, [stopSigWebForActiveField]);

  const cancelTypedSignatureEditor = useCallback(() => {
    setShowTypedSignatureEditor(false);
    setTypedSignatureDraft("");
    setViewerSignatureMessage(null);
  }, []);

  const handlePlacementSelect = useCallback((toolId: string) => {
    setPlacementToolId((current) => (current === toolId ? null : toolId));
  }, []);

  const applyPageJump = useCallback(() => {
    const maxPages = pdfDoc?.numPages || (imageBackgroundUrl ? 1 : 1);
    const requested = Math.floor(toNumber(pageJumpInput, pageIndex + 1));
    const normalized = clamp(requested, 1, maxPages);
    if (isContinuousLayout && pdfDoc) {
      const target = scrollHost?.querySelector<HTMLElement>(
        `[data-pdf-page="${normalized}"]`
      );
      if (target && scrollHost) {
        scrollHost.scrollTo({
          top: target.offsetTop - (scrollHost.firstElementChild as HTMLElement)?.offsetHeight - 8,
          behavior: "smooth"
        });
      }
      setPageJumpInput(String(normalized));
      return;
    }
    setPageIndex(normalized - 1);
  }, [
    pageJumpInput,
    pageIndex,
    pdfDoc,
    imageBackgroundUrl,
    isContinuousLayout,
    scrollHost
  ]);

  const handleContinuousScroll = useCallback(() => {
    if (!scrollHost) {
      return;
    }
    const probe = scrollHost.getBoundingClientRect().top + scrollHost.clientHeight / 3;
    const pages = scrollHost.querySelectorAll<HTMLElement>("[data-pdf-page]");
    let current = 1;
    pages.forEach((el) => {
      if (el.getBoundingClientRect().top <= probe) {
        current = Number(el.dataset.pdfPage) || current;
      }
    });
    setVisiblePage((prev) => (prev === current ? prev : current));
  }, [scrollHost]);

  const pageCount = pdfDoc?.numPages || (imageBackgroundUrl ? 1 : 1);
  const fieldsOnPage = fields.filter((field) => field.page === pageIndex);
  const undoDisabled = undoStackRef.current.length === 0;
  const redoDisabled = redoStackRef.current.length === 0;
  const hasRenderableDocument = Boolean(pdfDoc || imageBackgroundUrl);
  // Template coordinates are stored in PDF points (top-left origin). Multiply by renderScale for canvas pixels.
  const renderWidth = pageSize.width * renderScale;
  const renderHeight = pageSize.height * renderScale;
  const activeViewerSignatureField = useMemo(
    () =>
      (isContinuousLayout ? fields : fieldsOnPage).find(
        (field) =>
          field.type === "signature" &&
          activeViewerSignatureFieldId !== null &&
          field.id === activeViewerSignatureFieldId
      ),
    [isContinuousLayout, fields, fieldsOnPage, activeViewerSignatureFieldId]
  );

  useEffect(() => {
    if (activeViewerSignatureField) {
      return;
    }
    activeSigWebCanvasRef.current = null;
    activeSigWebFieldKeyRef.current = null;
    setShowTypedSignatureEditor(false);
    setTypedSignatureDraft("");
    stopSigWebForActiveField();
  }, [activeViewerSignatureField, stopSigWebForActiveField]);

  const applyTypedSignature = useCallback(() => {
    if (!activeViewerSignatureField) {
      return;
    }

    const renderedSignature = renderTypedSignatureDataUrl(
      typedSignatureDraft,
      Math.max(120, activeViewerSignatureField.w * renderScale),
      Math.max(40, activeViewerSignatureField.h * renderScale)
    );
    if (!renderedSignature) {
      setViewerSignatureMessage("Type a name before applying the signature.");
      return;
    }

    setViewerFieldValue(activeViewerSignatureField.key, renderedSignature);
    setShowTypedSignatureEditor(false);
    setTypedSignatureDraft("");
    setViewerSignatureMessage(null);
  }, [
    activeViewerSignatureField,
    typedSignatureDraft,
    renderScale,
    setViewerFieldValue
  ]);

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
              onChange={(event) =>
                setViewerFieldValue(field.key, event.target.checked)
              }
            />
            <span>{field.showLabel ? field.label || field.key : ""}</span>
          </label>
        );
      }

      if (field.type === "signature") {
        const rawSignatureValue = viewerFieldValues[field.key];
        const signatureValue =
          typeof rawSignatureValue === "string" ? rawSignatureValue : "";
        return (
          <InlineSignatureCanvas
            width={Math.max(20, field.w * renderScale)}
            height={Math.max(20, field.h * renderScale)}
            value={signatureValue}
            placeholderText={
              sigWebState === "ready"
                ? "Tap here to sign on the pad or use mouse"
                : "Tap here to sign on the pad or use mouse"
            }
            onFocus={(canvas) => {
              setActiveViewerSignatureFieldId(field.id);
              prepareSigWebForField(
                field.key,
                canvas,
                Boolean(signatureValue),
                signatureValue
              ).then((liveCaptureError) => {
                if (liveCaptureError) {
                  setViewerSignatureMessage(liveCaptureError);
                  return;
                }
                setViewerSignatureMessage(null);
              });
            }}
            onChange={(nextValue) => {
              setViewerFieldValue(field.key, nextValue);
              setActiveViewerSignatureFieldId(field.id);
              setViewerSignatureMessage(null);
            }}
          />
        );
      }

      if (field.type === "image") {
        const keyedImage = normalizeImageDataFromUnknown(
          viewerFieldValues[field.key]
        );
        const staticImage = normalizeImageDataFromUnknown(field.imageDataUrl);
        const imageSrc = keyedImage || staticImage;
        if (imageSrc) {
          return (
            <img
              className="pdf-template-designer__viewer-image"
              src={imageSrc}
              alt={field.label || field.key || "Image"}
              draggable={false}
            />
          );
        }
        return (
          <div className="pdf-template-designer__viewer-image-placeholder">
            {field.label || field.key || "Image"}
          </div>
        );
      }

      if (field.type === "multiVariableText") {
        const resolved = resolveMultiVariableText(
          field.variablesSampleData || "",
          viewerTemplateValues
        );
        return (
          <div className="pdf-template-designer__viewer-multi">{resolved}</div>
        );
      }

      const resolvedBackgroundColor = field.transparentBackground
        ? "transparent"
        : normalizeBackgroundColor(
            field.backgroundColor,
            DEFAULT_FIELD_BACKGROUND_COLOR
          );
      const inputStyle = {
        fontSize: Math.max(10, field.fontSize * renderScale * 0.9),
        textAlign: field.align,
        color: normalizeHexColor(field.textColor, DEFAULT_FIELD_TEXT_COLOR),
        backgroundColor: resolvedBackgroundColor
      } as CSSProperties;
      const rawValue = viewerFieldValues[field.key];
      const value = typeof rawValue === "string" ? rawValue : "";
      const computedFallback =
        isComputedTokenKey(field.key) && !value.trim()
          ? resolveComputedTokenValue(
              field.key,
              field.type === "date" ? field.format : undefined
            ) || ""
          : "";
      const tokenFallbackRaw = tokenContextValues[field.key];
      const tokenFallback =
        !value.trim() && !computedFallback && tokenFallbackRaw !== null && tokenFallbackRaw !== undefined
          ? String(tokenFallbackRaw)
          : "";
      const displayValue = value.trim() ? value : computedFallback || tokenFallback;
      if (field.type === "select") {
        const options =
          field.options.length > 0
            ? field.options
            : defaultOptionsForFieldType(field.type);
        const hasDisplayValue = displayValue.trim().length > 0;
        const hasOptionValue = options.some(
          (option) => option === displayValue
        );
        return (
          <select
            className="pdf-template-designer__viewer-input pdf-template-designer__viewer-select"
            value={displayValue}
            style={inputStyle}
            onChange={(event) =>
              setViewerFieldValue(field.key, event.target.value)
            }
          >
            {!hasDisplayValue ? <option value=""></option> : null}
            {!hasOptionValue && hasDisplayValue ? (
              <option value={displayValue}>{displayValue}</option>
            ) : null}
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      }
      if (field.type === "radio") {
        const options =
          field.options.length > 0
            ? field.options
            : defaultOptionsForFieldType(field.type);
        if (options.length === 0) {
          return (
            <input
              className="pdf-template-designer__viewer-input"
              type="text"
              value={displayValue}
              style={inputStyle}
              onChange={(event) =>
                setViewerFieldValue(field.key, event.target.value)
              }
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
            {options.map((option) => (
              <label
                key={option}
                className="pdf-template-designer__viewer-radio-option"
              >
                <input
                  type="radio"
                  name={`radio_${field.id}`}
                  value={option}
                  checked={displayValue === option}
                  onChange={(event) => {
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
            <div
              className="pdf-template-designer__viewer-date-static"
              style={inputStyle}
            >
              {displayValue}
            </div>
          );
        }

        const configuredFormat = normalizeFieldFormat("date", field.format);
        const expectsDate = patternContainsDateTokens(configuredFormat);
        const expectsTime = patternContainsTimeTokens(configuredFormat);

        if (expectsTime && !expectsDate) {
          const normalizedTimeValue = normalizeTimeInputValue(displayValue);
          if (!normalizedTimeValue && displayValue) {
            return (
              <input
                className="pdf-template-designer__viewer-input"
                type="text"
                value={displayValue}
                style={inputStyle}
                onChange={(event) =>
                  setViewerFieldValue(field.key, event.target.value)
                }
              />
            );
          }
          return (
            <input
              className="pdf-template-designer__viewer-input"
              type="time"
              value={normalizedTimeValue}
              style={inputStyle}
              onChange={(event) =>
                setViewerFieldValue(field.key, event.target.value)
              }
            />
          );
        }

        if (expectsDate && expectsTime) {
          return (
            <input
              className="pdf-template-designer__viewer-input"
              type="text"
              value={displayValue}
              style={inputStyle}
              onChange={(event) =>
                setViewerFieldValue(field.key, event.target.value)
              }
            />
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
              onChange={(event) =>
                setViewerFieldValue(field.key, event.target.value)
              }
            />
          );
        }
        return (
          <input
            className="pdf-template-designer__viewer-input"
            type="date"
            value={normalizedDateValue}
            style={inputStyle}
            onChange={(event) =>
              setViewerFieldValue(field.key, event.target.value)
            }
          />
        );
      }

      return (
        <input
          className="pdf-template-designer__viewer-input"
          type="text"
          value={displayValue}
          style={inputStyle}
          onChange={(event) =>
            setViewerFieldValue(field.key, event.target.value)
          }
        />
      );
    },
    [
      viewerFieldValues,
      renderScale,
      setViewerFieldValue,
      viewerTemplateValues,
      sigWebState,
      prepareSigWebForField
    ]
  );

  if (!props.dataSource && !(isViewerMode || isReadOnlyMode)) {
    return (
      <div className={className} style={props.style} tabIndex={props.tabIndex}>
        <div className="pdf-template-designer__alert">
          Configure a data source for FormConfiguration.
        </div>
      </div>
    );
  }

  const jumpToNextRequired = () => {
    const next = [...missingViewerRequiredFields].sort(
      (a, b) => a.page - b.page || a.y - b.y || a.x - b.x
    )[0];
    setViewerSaveAttempted(true);
    if (!next) {
      return;
    }
    const reveal = () => {
      const host = scrollHost || viewerRef.current;
      const box = host?.querySelector<HTMLElement>(`[data-field-id="${next.id}"]`);
      if (!box) {
        return;
      }
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      box.querySelector<HTMLElement>("input, textarea, select, canvas")?.focus?.();
    };
    if (!isContinuousLayout && next.page !== pageIndex) {
      setPageIndex(next.page);
      window.setTimeout(reveal, 300);
    } else {
      reveal();
    }
  };

  const renderViewerOverlayContent = (
    pageFields: TemplateField[],
    pageNo: number
  ): ReactElement => (
    <Fragment>
                    {pageFields.map((field) => (
                      <div
                        key={field.id}
                        data-field-id={field.id}
                        className={`pdf-template-designer__viewer-field pdf-template-designer__viewer-field--${
                          field.type
                        }${
                          showRequiredHighlight &&
                          missingViewerRequiredFieldIds.has(field.id)
                            ? " is-required-missing"
                            : ""
                        }${
                          activeViewerSignatureFieldId === field.id
                            ? " is-active"
                            : ""
                        }`}
                        style={{
                          left: field.x * renderScale,
                          top: field.y * renderScale,
                          width: field.w * renderScale,
                          height: field.h * renderScale,
                          backgroundColor: field.transparentBackground
                            ? "transparent"
                            : normalizeBackgroundColor(
                                field.backgroundColor,
                                DEFAULT_FIELD_BACKGROUND_COLOR
                              ),
                          color: normalizeHexColor(
                            field.textColor,
                            DEFAULT_FIELD_TEXT_COLOR
                          )
                        }}
                        onPointerDown={() => {
                          if (field.type === "signature") {
                            setActiveViewerSignatureFieldId(field.id);
                            setViewerSignatureMessage(null);
                          } else if (activeViewerSignatureFieldId) {
                            setActiveViewerSignatureFieldId(null);
                            activeSigWebCanvasRef.current = null;
                            activeSigWebFieldKeyRef.current = null;
                            stopSigWebForActiveField();
                          }
                        }}
                      >
                        {renderViewerFieldControl(field)}
                      </div>
                    ))}
                    {activeViewerSignatureField &&
                    activeViewerSignatureField.page === pageNo ? (
                      <div
                        className={`pdf-template-designer__signature-actions${
                          showTypedSignatureEditor
                            ? " pdf-template-designer__signature-actions--stacked"
                            : ""
                        }`}
                        style={{
                          left: activeViewerSignatureField.x * renderScale,
                          top:
                            (activeViewerSignatureField.y +
                              activeViewerSignatureField.h) *
                              renderScale +
                            6
                        }}
                        >
                        <div className="pdf-template-designer__signature-actions-row">
                          <button
                            className="pdf-template-designer__button pdf-template-designer__button--compact"
                            type="button"
                            onClick={() =>
                              clearViewerSignature(activeViewerSignatureField.key)
                            }
                          >
                            Clear signature
                          </button>
                          <button
                            className="pdf-template-designer__button pdf-template-designer__button--compact"
                            type="button"
                            onClick={openTypedSignatureEditor}
                          >
                            Type name
                          </button>
                          {sigWebState === "ready" ? (
                            <button
                              className="pdf-template-designer__button pdf-template-designer__button--compact"
                              type="button"
                              onClick={() =>
                                importSignatureFromSigWeb(
                                  activeViewerSignatureField.key
                                )
                              }
                            >
                              Use SigWeb
                            </button>
                          ) : null}
                        </div>
                        {showTypedSignatureEditor ? (
                          <div className="pdf-template-designer__typed-signature-editor">
                            <input
                              className="pdf-template-designer__input"
                              type="text"
                              placeholder="Type your full name"
                              value={typedSignatureDraft}
                              onChange={(event) =>
                                setTypedSignatureDraft(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  applyTypedSignature();
                                }
                                if (event.key === "Escape") {
                                  cancelTypedSignatureEditor();
                                }
                              }}
                            />
                            <div className="pdf-template-designer__signature-actions-row">
                              <button
                                className="pdf-template-designer__button pdf-template-designer__button--compact pdf-template-designer__button--primary"
                                type="button"
                                onClick={applyTypedSignature}
                              >
                                Apply typed signature
                              </button>
                              <button
                                className="pdf-template-designer__button pdf-template-designer__button--compact"
                                type="button"
                                onClick={cancelTypedSignatureEditor}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
    </Fragment>
  );

  if (isViewerMode || isReadOnlyMode) {
    const useScrollableDocumentLayout = isViewerMode || isReadOnlyMode;
    return (
      <div className={className} style={props.style} tabIndex={props.tabIndex}>
        <div
          className={`pdf-template-designer__canvas${
            useScrollableDocumentLayout
              ? " pdf-template-designer__canvas--viewer"
              : ""
          }`}
          ref={setScrollHost}
          onScroll={isContinuousLayout ? handleContinuousScroll : undefined}
        >
          <div
            className={`pdf-template-designer__toolbar${
              useScrollableDocumentLayout
                ? " pdf-template-designer__toolbar--sticky"
                : ""
            }`}
          >
            <div className="pdf-template-designer__toolbar-group">
              {isContinuousLayout && pdfDoc ? (
                <div className="pdf-template-designer__status">
                  Page {visiblePage} of {pageCount}
                </div>
              ) : (
                <Fragment>
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                type="button"
                title="Go to the previous page of the PDF"
                disabled={pageIndex === 0}
              >
                Prev
              </button>
              <div className="pdf-template-designer__status">
                Page {pageIndex + 1} / {pageCount}
              </div>
              <button
                className="pdf-template-designer__button"
                onClick={() =>
                  setPageIndex(Math.min(pageCount - 1, pageIndex + 1))
                }
                type="button"
                title="Go to the next page of the PDF"
                disabled={pageIndex >= pageCount - 1}
              >
                Next
              </button>
                </Fragment>
              )}
              <div className="pdf-template-designer__toolbar-jump">
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  min={1}
                  max={pageCount}
                  title="Type a page number and press Enter to jump to it"
                  aria-label="Go to page"
                  value={pageJumpInput}
                  onChange={(event) => setPageJumpInput(event.target.value)}
                  onBlur={applyPageJump}
                  onKeyDown={(event) => {
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
                title="Zoom the page in or out. Only changes what you see, not the template."
                aria-label="Zoom"
                onChange={(event) => setZoom(Number(event.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>
              {isViewerMode && requiredFieldTotal > 0 ? (
                <button
                  className={`pdf-template-designer__button pdf-template-designer__required-chip${
                    hasMissingViewerRequiredFields ? " is-missing" : " is-complete"
                  }`}
                  type="button"
                  onClick={jumpToNextRequired}
                  disabled={!hasMissingViewerRequiredFields}
                  title={
                    hasMissingViewerRequiredFields
                      ? "Go to the next required field"
                      : "All required fields are filled"
                  }
                >
                  {hasMissingViewerRequiredFields
                    ? `${missingViewerRequiredFields.length} required left`
                    : "Required fields done"}
                </button>
              ) : null}
              {headerCheckboxControl}
              {showPrintButton ? (
                <button
                  className="pdf-template-designer__button"
                  onClick={handlePrintClick}
                  type="button"
                  title="Print all pages"
                  disabled={!pdfDoc}
                >
                  Print
                </button>
              ) : null}
              {toolbarActionButtons.map((button) => (
                <button
                  key={button.key}
                  className={button.className}
                  type="button"
                  title={button.tooltip || undefined}
                  tabIndex={button.tabIndex}
                  disabled={button.disabled}
                  onClick={button.onClick}
                >
                  {renderToolbarButtonIcon(button.icon)}
                  <span>{button.text}</span>
                </button>
              ))}
            </div>
          </div>
          {sigWebState === "loading" ? (
            <div className="pdf-template-designer__status">
              Loading SigWeb integration...
            </div>
          ) : null}
          {sigWebError ? (
            <div
              className={
                sigWebError === SIGWEB_NO_PAD_MESSAGE
                  ? "pdf-template-designer__notice"
                  : "pdf-template-designer__alert"
              }
              role="status"
            >
              {sigWebError}
            </div>
          ) : null}
          {isViewerMode && showViewerDataJsonBindingWarning ? (
            <div className="pdf-template-designer__alert">
              Viewer mode Data JSON is not bound. User edits and signatures will
              not persist.
            </div>
          ) : null}
          {isViewerMode && dataJsonError ? (
            <div className="pdf-template-designer__alert">
              Data JSON is invalid. {dataJsonError}
            </div>
          ) : null}
          {isViewerMode && viewerValidationMessage ? (
            <div className="pdf-template-designer__alert">
              {viewerValidationMessage}
            </div>
          ) : null}
          {isViewerMode && viewerSignatureMessage ? (
            <div className="pdf-template-designer__alert">
              {viewerSignatureMessage}
            </div>
          ) : null}

          <div
            className={`pdf-template-designer__viewer${
              useScrollableDocumentLayout
                ? " pdf-template-designer__viewer--scrolling"
                : ""
            }`}
            ref={viewerRef}
          >
            {!basePdfId ? (
              <div className="pdf-template-designer__status">
                No base PDF linked.
              </div>
            ) : null}
            {loadingPdf ? (
              <div className="pdf-template-designer__status">
                Loading document...
              </div>
            ) : null}
            {renderError ? (
              <div className="pdf-template-designer__alert">{renderError}</div>
            ) : null}
            {hasRenderableDocument && isContinuousLayout && pdfDoc ? (
              <div className="pdf-template-designer__pages">
                {Array.from({ length: pageCount }, (_, idx) => {
                  const size = pageSizes[idx] || pageSize;
                  return (
                    <div
                      key={`page_${idx}`}
                      className="pdf-template-designer__page"
                      data-pdf-page={idx + 1}
                      style={{
                        width: size.width * renderScale,
                        height: size.height * renderScale
                      }}
                    >
                      <ContinuousPageCanvas
                        pdfDoc={pdfDoc}
                        pageNumber={idx + 1}
                        scale={renderScale}
                        scrollRoot={scrollHost}
                      />
                      {!isReadOnlyMode ? (
                        <div className="pdf-template-designer__overlay pdf-template-designer__overlay--viewer">
                          {renderViewerOverlayContent(
                            fields.filter((field) => field.page === idx),
                            idx
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {hasRenderableDocument && !(isContinuousLayout && pdfDoc) ? (
              <div
                className="pdf-template-designer__page"
                style={{ width: renderWidth, height: renderHeight }}
              >
                {pdfDoc ? (
                  <canvas
                    className="pdf-template-designer__canvas-surface"
                    ref={canvasRef}
                  />
                ) : imageBackgroundUrl ? (
                  <img
                    className="pdf-template-designer__image-surface"
                    src={imageBackgroundUrl}
                    alt="Base document"
                    style={{ width: renderWidth, height: renderHeight }}
                    draggable={false}
                  />
                ) : null}
                {!isReadOnlyMode ? (
                  <div className="pdf-template-designer__overlay pdf-template-designer__overlay--viewer">
                    {renderViewerOverlayContent(fieldsOnPage, pageIndex)}
                  </div>
                ) : null}
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
        <div className="pdf-template-designer__alert">
          Template JSON is invalid. {jsonError}
        </div>
      ) : null}
      <div
        className={`pdf-template-designer__layout${
          hasRightPanelSections
            ? ""
            : " pdf-template-designer__layout--no-properties"
        }${
          hasSidebarSections ? "" : " pdf-template-designer__layout--no-sidebar"
        }`}
      >
        {hasSidebarSections ? (
          <aside className="pdf-template-designer__sidebar">
            {showPaletteSection ? (
              <div>
                <div className="pdf-template-designer__palette">
                  {visibleToolRailItems.map((item) => {
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
                        onDragStart={(event) =>
                          handlePaletteDragStart(event, item.id)
                        }
                        type="button"
                      >
                        <span className="pdf-template-designer__palette-tool-icon">
                          {item.glyph}
                        </span>
                        <span className="pdf-template-designer__palette-tool-text">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                  {visibleToolRailItems.length === 0 ? (
                    <div className="pdf-template-designer__status">
                      No palette tools are enabled in widget settings.
                    </div>
                  ) : null}
                  {hasTokenCatalog ? (
                    <div className="pdf-template-designer__token-palette">
                      <div className="pdf-template-designer__token-palette-head">
                        Client data
                        <span className="pdf-template-designer__token-palette-badge">
                          auto-filled
                        </span>
                      </div>
                      {tokenToolItems.map((item) => {
                        const entry = tokenCatalog.find(
                          (candidate) =>
                            `${TOKEN_TOOL_ID_PREFIX}${candidate.key}` === item.id
                        );
                        return (
                          <button
                            key={`palette_${item.id}`}
                            className={`pdf-template-designer__button pdf-template-designer__palette-tool pdf-template-designer__palette-tool--token${
                              placementToolId === item.id ? " is-active" : ""
                            }`}
                            title={item.tooltip}
                            aria-label={item.tooltip}
                            data-tooltip={item.tooltip}
                            onClick={() => handlePlacementSelect(item.id)}
                            onDoubleClick={() => addToolFieldCentered(item)}
                            draggable
                            onDragStart={(event) =>
                              handlePaletteDragStart(event, item.id)
                            }
                            type="button"
                          >
                            <span className="pdf-template-designer__palette-tool-icon pdf-template-designer__palette-tool-icon--token">
                              {tokenGlyph(entry?.kind || "client")}
                            </span>
                            <span className="pdf-template-designer__palette-tool-text">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                      <div className="pdf-template-designer__token-palette-more">
                        <button
                          type="button"
                          className="pdf-template-designer__button pdf-template-designer__palette-tool pdf-template-designer__palette-tool--more"
                          onClick={(event) =>
                            tokenPicker?.mode === "add"
                              ? closeTokenPicker()
                              : openTokenPicker("add", event.currentTarget)
                          }
                        >
                          <span className="pdf-template-designer__palette-tool-text">
                            More client data…
                          </span>
                        </button>
                        {tokenPicker?.mode === "add" ? renderTokenPicker() : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showPagesSection ? (
              <div className="pdf-template-designer__sidebar-pages">
                <div className="pdf-template-designer__section-title">
                  Pages
                </div>
                <div className="pdf-template-designer__thumb-list">
                  {Array.from({ length: pageCount }, (_, idx) => (
                    <button
                      key={`thumb_${idx}`}
                      type="button"
                      className={`pdf-template-designer__thumb${
                        idx === pageIndex ? " is-selected" : ""
                      }`}
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
              <span className="pdf-template-designer__action-label">
                Template
              </span>
              <input
                ref={importTemplateInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={handleImportTemplateFileChange}
              />
              <input
                ref={replacePdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: "none" }}
                onChange={handleReplacePdfFileChange}
              />
              {showReplacePdfButton && !isViewerMode && !isReadOnlyMode ? (
                <button
                  className="pdf-template-designer__button"
                  onClick={handleReplacePdfClick}
                  type="button"
                  title="Swap the PDF behind this template for a new file. Your fields stay where they are."
                  disabled={!basePdfId}
                >
                  Replace PDF
                </button>
              ) : null}
              {!isViewerMode && !isReadOnlyMode ? (
                <div className="pdf-template-designer__more">
                  <button
                    className={`pdf-template-designer__button${
                      moreMenuOpen ? " is-active" : ""
                    }`}
                    type="button"
                    title="Export, import or clear this template"
                    aria-haspopup="menu"
                    aria-expanded={moreMenuOpen}
                    onClick={() => {
                      setResetArmed(false);
                      setMoreMenuOpen((open) => !open);
                    }}
                  >
                    More ▾
                  </button>
                  {moreMenuOpen ? (
                    <div className="pdf-template-designer__more-menu" role="menu">
                      <button
                        className="pdf-template-designer__more-item"
                        type="button"
                        role="menuitem"
                        title="Download this template's field layout as a JSON file, for backup or to copy it to another form"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          handleExportTemplateClick();
                        }}
                      >
                        <span>Export layout</span>
                        <span className="pdf-template-designer__more-hint">
                          Download the fields as a JSON file
                        </span>
                      </button>
                      {showImportTemplateButton ? (
                        <button
                          className="pdf-template-designer__more-item"
                          type="button"
                          role="menuitem"
                          title="Replace the fields on this template with a layout JSON file exported earlier. The PDF itself is not changed."
                          onClick={() => {
                            setMoreMenuOpen(false);
                            handleImportTemplateClick();
                          }}
                        >
                          <span>Import layout…</span>
                          <span className="pdf-template-designer__more-hint">
                            Load fields from an exported JSON file
                          </span>
                        </button>
                      ) : null}
                      {resetArmed ? (
                        <div className="pdf-template-designer__more-confirm">
                          <span>Remove all {fields.length} fields from this template?</span>
                          <div>
                            <button
                              className="pdf-template-designer__button pdf-template-designer__button--danger"
                              type="button"
                              onClick={() => {
                                setResetArmed(false);
                                setMoreMenuOpen(false);
                                clearFields();
                              }}
                            >
                              Clear fields
                            </button>
                            <button
                              className="pdf-template-designer__button"
                              type="button"
                              onClick={() => setResetArmed(false)}
                            >
                              Keep them
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="pdf-template-designer__more-item pdf-template-designer__more-item--danger"
                          type="button"
                          role="menuitem"
                          title="Remove every field from this template. You can Undo afterwards, and nothing is saved until you click Save."
                          disabled={fields.length === 0}
                          onClick={() => setResetArmed(true)}
                        >
                          <span>Clear all fields…</span>
                          <span className="pdf-template-designer__more-hint">
                            Start the layout over (undoable)
                          </span>
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {showPrintButton ? (
                <button
                  className="pdf-template-designer__button"
                  onClick={handlePrintClick}
                  type="button"
                  title="Print all pages"
                  disabled={!pdfDoc}
                >
                  Print
                </button>
              ) : null}
              {toolbarActionButtons.map((button) => (
                <button
                  key={button.key}
                  className={button.className}
                  type="button"
                  title={button.tooltip || undefined}
                  tabIndex={button.tabIndex}
                  disabled={button.disabled}
                  onClick={button.onClick}
                >
                  {renderToolbarButtonIcon(button.icon)}
                  <span>{button.text}</span>
                </button>
              ))}
            </div>
            {headerCheckboxControl ? (
              <div className="pdf-template-designer__action-group">
                <span className="pdf-template-designer__action-label">
                  Header
                </span>
                {headerCheckboxControl}
              </div>
            ) : null}

            <div className="pdf-template-designer__action-group">
              <span className="pdf-template-designer__action-label">View</span>
              <button
                className="pdf-template-designer__button"
                onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                type="button"
                title="Go to the previous page of the PDF"
                disabled={pageIndex === 0}
              >
                Prev
              </button>
              <div className="pdf-template-designer__status">
                Page {pageIndex + 1} / {pageCount}
              </div>
              <button
                className="pdf-template-designer__button"
                onClick={() =>
                  setPageIndex(Math.min(pageCount - 1, pageIndex + 1))
                }
                type="button"
                title="Go to the next page of the PDF"
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
                  title="Type a page number and press Enter to jump to it"
                  aria-label="Go to page"
                  value={pageJumpInput}
                  onChange={(event) => setPageJumpInput(event.target.value)}
                  onBlur={applyPageJump}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      applyPageJump();
                    }
                  }}
                />
              </div>
              <select
                className="pdf-template-designer__select"
                value={zoom}
                title="Zoom the page in or out. Only changes what you see, not the template."
                aria-label="Zoom"
                onChange={(event) => setZoom(Number(event.target.value))}
              >
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
              </select>
            </div>

            <div className="pdf-template-designer__action-group">
              <span className="pdf-template-designer__action-label">Edit</span>
              <button
                className="pdf-template-designer__button"
                type="button"
                title="Undo the last change (Ctrl+Z)"
                onClick={undo}
                disabled={undoDisabled}
              >
                Undo
              </button>
              <button
                className="pdf-template-designer__button"
                type="button"
                title="Redo the change you just undid (Ctrl+Shift+Z)"
                onClick={redo}
                disabled={redoDisabled}
              >
                Redo
              </button>
              <label
                className="pdf-template-designer__toggle"
                title="Snap fields to a grid and to the edges of nearby fields while you drag"
              >
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={(event) => setSnapEnabled(event.target.checked)}
                />
                Snap
              </label>
            </div>
          </div>
          {selectedPlacementTool ? (
            <div className="pdf-template-designer__status">
              Placing <strong>{selectedPlacementTool.tooltip}</strong>. Click
              the page to place.
            </div>
          ) : showShortcutHints ? (
            <div className="pdf-template-designer__status">
              Shortcuts: <code>Cmd/Ctrl+Z</code> undo,{" "}
              <code>Cmd/Ctrl+Shift+Z</code> redo, <code>Cmd/Ctrl+D</code>{" "}
              duplicate, <code>Del</code> delete, arrows nudge.
            </div>
          ) : null}

          <div className="pdf-template-designer__viewer" ref={viewerRef}>
            {!basePdfId ? (
              <div className="pdf-template-designer__status">
                No base PDF linked.
              </div>
            ) : null}
            {loadingPdf ? (
              <div className="pdf-template-designer__status">
                Loading PDF...
              </div>
            ) : null}
            {renderError ? (
              <div className="pdf-template-designer__alert">{renderError}</div>
            ) : null}
            {hasRenderableDocument ? (
              <div
                className="pdf-template-designer__page"
                style={{ width: renderWidth, height: renderHeight }}
              >
                {pdfDoc ? (
                  <canvas
                    className="pdf-template-designer__canvas-surface"
                    ref={canvasRef}
                  />
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
                  }${
                    selectedPlacementTool
                      ? " pdf-template-designer__overlay--placing"
                      : ""
                  }${
                    guides.length > 0
                      ? " pdf-template-designer__overlay--guides"
                      : ""
                  }`}
                  ref={overlayRef}
                  onPointerDown={handleOverlayPointerDown}
                  onDragOver={handleOverlayDragOver}
                  onDrop={handleOverlayDrop}
                  style={
                    snapEnabled
                      ? {
                          backgroundSize: `${SNAP_SIZE * renderScale}px ${
                            SNAP_SIZE * renderScale
                          }px`
                        }
                      : undefined
                  }
                >
                  {guides.map((guide, index) => (
                    <div
                      key={`${guide.axis}_${guide.value}_${index}`}
                      className={`pdf-template-designer__guide pdf-template-designer__guide--${guide.axis}`}
                      style={
                        guide.axis === "x"
                          ? { left: guide.value * renderScale }
                          : { top: guide.value * renderScale }
                      }
                    />
                  ))}
                  {fieldsOnPage.map((field) => (
                    <div
                      key={field.id}
                      className={`pdf-template-designer__field pdf-template-designer__field--${
                        field.type
                      }${selectedFieldId === field.id ? " is-selected" : ""}${
                        hasTokenCatalog &&
                        field.type === "multiVariableText" &&
                        contentHasTokens(field.variablesSampleData)
                          ? " is-token"
                          : ""
                      }`}
                      style={{
                        left: field.x * renderScale,
                        top: field.y * renderScale,
                        width: field.w * renderScale,
                        height: field.h * renderScale,
                        backgroundColor: field.transparentBackground
                          ? "rgba(255, 255, 255, 0.18)"
                          : normalizeBackgroundColor(
                              field.backgroundColor,
                              DEFAULT_FIELD_BACKGROUND_COLOR
                            ),
                        color: normalizeHexColor(
                          field.textColor,
                          DEFAULT_FIELD_TEXT_COLOR
                        )
                      }}
                      onPointerDown={(event) =>
                        handleFieldPointerDown(event, field, "move")
                      }
                    >
                      <div className="pdf-template-designer__field-content">
                        <div className="pdf-template-designer__field-label">
                          {field.type === "multiVariableText"
                            ? hasTokenCatalog &&
                              contentHasTokens(field.variablesSampleData)
                              ? parseTokenContentSegments(
                                  field.variablesSampleData
                                ).map((segment, index) =>
                                  segment.kind === "token" ? (
                                    <span
                                      key={`seg_${index}`}
                                      className="pdf-template-designer__field-token"
                                    >
                                      {tokenLabelByKey[segment.key] || segment.key}
                                    </span>
                                  ) : (
                                    <span key={`seg_${index}`}>{segment.value}</span>
                                  )
                                )
                              : field.variablesSampleData ||
                                field.label ||
                                field.key
                            : field.showLabel
                            ? field.label || field.key
                            : selectedFieldId === field.id
                            ? "(label hidden)"
                            : ""}
                        </div>
                      </div>
                      <div
                        className="pdf-template-designer__resize-handle"
                        onPointerDown={(event) =>
                          handleFieldPointerDown(event, field, "resize")
                        }
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
                <div className="pdf-template-designer__section-title">
                  Field list
                </div>
                <div className="pdf-template-designer__field-list">
                  {fields.length === 0 ? (
                    <div className="pdf-template-designer__status">
                      No fields yet.
                    </div>
                  ) : (
                    fields.map((field) => (
                      <button
                        key={field.id}
                        className={`pdf-template-designer__field-pill${
                          selectedFieldId === field.id ? " is-selected" : ""
                        }${
                          fieldListDropTargetId === field.id
                            ? " is-drop-target"
                            : ""
                        }`}
                        type="button"
                        onClick={() => setSelectedFieldId(field.id)}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedFieldListItemId(field.id);
                          setFieldListDropTargetId(field.id);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (!draggedFieldListItemId) {
                            return;
                          }
                          if (fieldListDropTargetId !== field.id) {
                            setFieldListDropTargetId(field.id);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedFieldListItemId) {
                            reorderFieldListItem(
                              draggedFieldListItemId,
                              field.id
                            );
                          }
                          handleFieldListDragEnd();
                        }}
                        onDragEnd={handleFieldListDragEnd}
                      >
                        <span className="pdf-template-designer__field-pill-main">
                          <span className="pdf-template-designer__field-pill-label">
                            {field.label || field.key}
                          </span>
                          <span className="pdf-template-designer__field-pill-key">
                            {field.key}
                          </span>
                        </span>
                        <span className="pdf-template-designer__field-pill-badges">
                          <span className="pdf-template-designer__field-badge">
                            {field.type}
                          </span>
                          <span className="pdf-template-designer__field-badge">
                            P{field.page + 1}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {fields.length > 1 ? (
                  <div className="pdf-template-designer__status">
                    Drag items to reorder.
                  </div>
                ) : null}
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
                  <div className="pdf-template-designer__inspector-title">
                    Edit Field
                  </div>
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
                      {showPropertyType || showPropertyKey ? (
                        <div className="pdf-template-designer__inspector-grid-two">
                          {showPropertyType ? (
                            <div>
                              <div className="pdf-template-designer__label">
                                Type
                              </div>
                              <select
                                className="pdf-template-designer__select"
                                value={selectedField.type}
                                onChange={(event) => {
                                  const nextType = event.target
                                    .value as FieldType;
                                  const nextChanges: Partial<TemplateField> = {
                                    type: nextType
                                  };
                                  if (
                                    nextType === "select" ||
                                    nextType === "radio"
                                  ) {
                                    const nextOptions =
                                      selectedField.options.length > 0
                                        ? selectedField.options
                                        : defaultOptionsForFieldType(nextType);
                                    nextChanges.options = [...nextOptions];
                                  }
                                  if (nextType === "date") {
                                    nextChanges.format = normalizeFieldFormat(
                                      "date",
                                      selectedField.format
                                    );
                                  }
                                  if (
                                    !supportsTransparentBackground(nextType)
                                  ) {
                                    nextChanges.transparentBackground = false;
                                  }
                                  nextChanges.optionsOrientation =
                                    defaultOptionsOrientationForFieldType(
                                      nextType
                                    );
                                  updateField(selectedField.id, nextChanges);
                                }}
                              >
                                <option value="text">Text</option>
                                <option value="multiVariableText">
                                  {hasTokenCatalog
                                    ? "Text with client data"
                                    : "Multi-Variable Text"}
                                </option>
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
                              <div className="pdf-template-designer__label">
                                Key
                              </div>
                              {keyInputState.mode === "dropdown" ? (
                                <select
                                  className="pdf-template-designer__select"
                                  value={selectedField.key}
                                  onChange={(event) => {
                                    const nextKey = event.target.value.trim();
                                    if (!nextKey) {
                                      return;
                                    }
                                    const selectedOption =
                                      keyInputState.options.find(
                                        (option) => option.value === nextKey
                                      );
                                    const mappedType = mapDataTypeToFieldType(
                                      selectedOption?.dataType
                                    );
                                    const mappedDateFormat =
                                      mapDataTypeToDateFormat(
                                        selectedOption?.dataType
                                      );
                                    const nextChanges: Partial<TemplateField> =
                                      mappedType
                                        ? { key: nextKey, type: mappedType }
                                        : { key: nextKey };
                                    const nextType =
                                      mappedType || selectedField.type;
                                    if (
                                      (nextType === "select" ||
                                        nextType === "radio") &&
                                      isEnumerationKeyOption(selectedOption)
                                    ) {
                                      const enumOptions =
                                        normalizeOptionStrings(
                                          selectedOption?.options
                                        );
                                      nextChanges.options =
                                        enumOptions.length > 0
                                          ? enumOptions
                                          : defaultOptionsForFieldType(
                                              nextType
                                            );
                                    }
                                    if (nextType === "date") {
                                      nextChanges.format = normalizeFieldFormat(
                                        "date",
                                        mappedDateFormat || selectedField.format
                                      );
                                    }
                                    if (
                                      !supportsTransparentBackground(nextType)
                                    ) {
                                      nextChanges.transparentBackground = false;
                                    }
                                    if (mappedType) {
                                      nextChanges.optionsOrientation =
                                        defaultOptionsOrientationForFieldType(
                                          nextType
                                        );
                                    }
                                    updateField(selectedField.id, nextChanges);
                                  }}
                                >
                                  {selectedFieldKeyOptions.length === 0 ? (
                                    <option value={selectedField.key}>
                                      {selectedField.key || "No key options"}
                                    </option>
                                  ) : null}
                                  {selectedFieldKeyOptions.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.dataType
                                        ? `${option.label} (${option.dataType})`
                                        : option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="pdf-template-designer__input"
                                  value={selectedField.key}
                                  onChange={(event) => {
                                    const nextKey = event.target.value.trim();
                                    if (!nextKey) {
                                      return;
                                    }
                                    updateField(selectedField.id, {
                                      key: nextKey
                                    });
                                  }}
                                />
                              )}
                              {keyInputState.loading ? (
                                <div className="pdf-template-designer__status">
                                  Loading key options...
                                </div>
                              ) : null}
                              {keyInputState.error ? (
                                <div className="pdf-template-designer__alert">
                                  {keyInputState.error}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {showPropertyShowLabel ||
                      showPropertyRequired ||
                      selectedFieldSupportsTransparentBackground ? (
                        <div className="pdf-template-designer__inspector-checks">
                          {showPropertyShowLabel ? (
                            <label className="pdf-template-designer__toggle">
                              <input
                                type="checkbox"
                                checked={selectedField.showLabel}
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    showLabel: event.target.checked
                                  })
                                }
                              />
                              Show label
                            </label>
                          ) : null}
                          {showPropertyRequired ? (
                            <label className="pdf-template-designer__toggle">
                              <input
                                type="checkbox"
                                checked={selectedField.required}
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    required: event.target.checked
                                  })
                                }
                              />
                              Required
                            </label>
                          ) : null}
                          {selectedFieldSupportsTransparentBackground ? (
                            <label className="pdf-template-designer__toggle">
                              <input
                                type="checkbox"
                                checked={selectedField.transparentBackground}
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    transparentBackground: event.target.checked
                                  })
                                }
                              />
                              Transparent background
                            </label>
                          ) : null}
                        </div>
                      ) : null}

                      {showPropertyLabel ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div>
                            <div className="pdf-template-designer__label">
                              Label
                            </div>
                            <input
                              className="pdf-template-designer__input"
                              value={selectedField.label}
                              onChange={(event) =>
                                updateField(selectedField.id, {
                                  label: event.target.value
                                })
                              }
                            />
                          </div>
                          {selectedField.showLabel ? (
                            <div>
                              <div className="pdf-template-designer__label">
                                Label orientation
                              </div>
                              <select
                                className="pdf-template-designer__select"
                                value={selectedField.labelOrientation}
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    labelOrientation: isFieldOrientation(
                                      event.target.value
                                    )
                                      ? event.target.value
                                      : "horizontal"
                                  })
                                }
                              >
                                <option value="horizontal">
                                  Horizontal (inline)
                                </option>
                                <option value="vertical">
                                  Vertical (stacked)
                                </option>
                              </select>
                            </div>
                          ) : (
                            <div className="pdf-template-designer__status">
                              Label is hidden in output for this field.
                            </div>
                          )}
                        </div>
                      ) : null}

                      {showPropertyAlignment ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__label">
                            Align
                          </div>
                          <div className="pdf-template-designer__align-group">
                            <button
                              type="button"
                              className={`pdf-template-designer__align-btn${
                                selectedField.align === "left"
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateField(selectedField.id, { align: "left" })
                              }
                            >
                              L
                            </button>
                            <button
                              type="button"
                              className={`pdf-template-designer__align-btn${
                                selectedField.align === "center"
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateField(selectedField.id, {
                                  align: "center"
                                })
                              }
                            >
                              C
                            </button>
                            <button
                              type="button"
                              className={`pdf-template-designer__align-btn${
                                selectedField.align === "right"
                                  ? " is-active"
                                  : ""
                              }`}
                              onClick={() =>
                                updateField(selectedField.id, {
                                  align: "right"
                                })
                              }
                            >
                              R
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {showPropertyPosition ||
                      showPropertySize ||
                      showPropertyPage ? (
                        <div className="pdf-template-designer__inspector-section">
                          {showPropertyPosition ? (
                            <div className="pdf-template-designer__inspector-grid-two">
                              <div>
                                <div className="pdf-template-designer__label">
                                  X
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  type="number"
                                  value={selectedField.x}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      x: toNumber(
                                        event.target.value,
                                        selectedField.x
                                      )
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <div className="pdf-template-designer__label">
                                  Y
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  type="number"
                                  value={selectedField.y}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      y: toNumber(
                                        event.target.value,
                                        selectedField.y
                                      )
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                          {showPropertySize ? (
                            <div className="pdf-template-designer__inspector-grid-two">
                              <div>
                                <div className="pdf-template-designer__label">
                                  Width
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  type="number"
                                  value={selectedField.w}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      w: toNumber(
                                        event.target.value,
                                        selectedField.w
                                      )
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <div className="pdf-template-designer__label">
                                  Height
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  type="number"
                                  value={selectedField.h}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      h: toNumber(
                                        event.target.value,
                                        selectedField.h
                                      )
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                          {showPropertyPage ? (
                            <div>
                              <div className="pdf-template-designer__label">
                                Page
                              </div>
                              <input
                                className="pdf-template-designer__input"
                                type="number"
                                min={1}
                                max={pageCount}
                                value={selectedField.page + 1}
                                onChange={(event) => {
                                  const next = clamp(
                                    Math.floor(toNumber(event.target.value, 1)),
                                    1,
                                    pageCount
                                  );
                                  updateField(selectedField.id, {
                                    page: next - 1
                                  });
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {showPropertyFontSize ? (
                        <div className="pdf-template-designer__inspector-section">
                          {showPropertyFontSize ? (
                            <div className="pdf-template-designer__inspector-grid-two">
                              <div>
                                <div className="pdf-template-designer__label">
                                  Font
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  value="Roboto"
                                  disabled
                                />
                              </div>
                              <div>
                                <div className="pdf-template-designer__label">
                                  Size
                                </div>
                                <input
                                  className="pdf-template-designer__input"
                                  type="number"
                                  min={6}
                                  value={selectedField.fontSize}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      fontSize: toNumber(
                                        event.target.value,
                                        selectedField.fontSize
                                      )
                                    })
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedFieldSupportsColorStyling ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__inspector-grid-two">
                            <div>
                              <div className="pdf-template-designer__label">
                                Text Color
                              </div>
                              <div className="pdf-template-designer__color-row">
                                <input
                                  className="pdf-template-designer__color-input"
                                  type="color"
                                  value={selectedFieldTextColorPickerValue}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      textColor: normalizeHexColor(
                                        event.target.value,
                                        DEFAULT_FIELD_TEXT_COLOR
                                      )
                                    })
                                  }
                                />
                                <input
                                  className="pdf-template-designer__input"
                                  value={selectedField.textColor}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      textColor: normalizeHexColor(
                                        event.target.value,
                                        selectedField.textColor ||
                                          DEFAULT_FIELD_TEXT_COLOR
                                      )
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div>
                              <div className="pdf-template-designer__label">
                                Background Color
                              </div>
                              <div className="pdf-template-designer__color-row">
                                <input
                                  className="pdf-template-designer__color-input"
                                  type="color"
                                  value={
                                    selectedFieldBackgroundColorPickerValue
                                  }
                                  disabled={selectedField.transparentBackground}
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      transparentBackground: false,
                                      backgroundColor: normalizeHexColor(
                                        event.target.value,
                                        DEFAULT_FIELD_BACKGROUND_COLOR
                                      )
                                    })
                                  }
                                />
                                <input
                                  className="pdf-template-designer__input"
                                  value={
                                    selectedField.transparentBackground
                                      ? "transparent"
                                      : selectedField.backgroundColor
                                  }
                                  onChange={(event) => {
                                    const raw = event.target.value.trim();
                                    if (!raw) {
                                      updateField(selectedField.id, {
                                        transparentBackground: true,
                                        backgroundColor:
                                          DEFAULT_FIELD_BACKGROUND_COLOR
                                      });
                                      return;
                                    }
                                    if (raw.toLowerCase() === "transparent") {
                                      updateField(selectedField.id, {
                                        transparentBackground: true,
                                        backgroundColor:
                                          DEFAULT_FIELD_BACKGROUND_COLOR
                                      });
                                      return;
                                    }
                                    updateField(selectedField.id, {
                                      transparentBackground: false,
                                      backgroundColor: normalizeHexColor(
                                        raw,
                                        selectedField.backgroundColor ||
                                          DEFAULT_FIELD_BACKGROUND_COLOR
                                      )
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedField.type === "date" ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__label">
                            Format
                          </div>
                          <select
                            className="pdf-template-designer__select"
                            value={selectedFieldDateFormat}
                            onChange={(event) =>
                              updateField(selectedField.id, {
                                format: normalizeFieldFormat(
                                  "date",
                                  event.target.value
                                )
                              })
                            }
                          >
                            {selectedFieldHasCustomDateFormat ? (
                              <option value={selectedFieldDateFormat}>
                                {selectedFieldDateFormat} (Custom)
                              </option>
                            ) : null}
                            {DATE_FIELD_FORMAT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}

                      {selectedField.type === "multiVariableText" &&
                      hasTokenCatalog ? (
                        <div className="pdf-template-designer__inspector-section">
                          {contentHasTokens(selectedField.variablesSampleData) ? (
                            <div className="pdf-template-designer__token-type">
                              {tokenGlyph("client")}
                              <span>Client data</span>
                              <span className="pdf-template-designer__token-type-note">
                                filled automatically
                              </span>
                            </div>
                          ) : null}
                          <div className="pdf-template-designer__label">
                            Content
                          </div>
                          <div className="pdf-template-designer__token-content">
                            {parseTokenContentSegments(
                              selectedField.variablesSampleData
                            ).map((segment, index, segments) =>
                              segment.kind === "token" ? (
                                <span
                                  key={`chip_${index}`}
                                  className="pdf-template-designer__token-chip"
                                >
                                  {tokenLabelByKey[segment.key] || segment.key}
                                  <button
                                    type="button"
                                    aria-label={`Remove ${
                                      tokenLabelByKey[segment.key] || segment.key
                                    }`}
                                    onClick={() =>
                                      updateField(selectedField.id, {
                                        variablesSampleData:
                                          serializeTokenContentSegments(
                                            segments.filter(
                                              (_item, itemIndex) =>
                                                itemIndex !== index
                                            )
                                          )
                                      })
                                    }
                                  >
                                    ×
                                  </button>
                                </span>
                              ) : (
                                <input
                                  key={`gap_${index}`}
                                  className="pdf-template-designer__token-gap"
                                  type="text"
                                  value={segment.value}
                                  placeholder={
                                    segments.length === 1 ? "Type text…" : ""
                                  }
                                  size={Math.max(2, segment.value.length + 1)}
                                  aria-label="Text"
                                  onChange={(event) =>
                                    updateField(selectedField.id, {
                                      variablesSampleData:
                                        serializeTokenContentSegments(
                                          segments.map((item, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                  kind: "text",
                                                  value: event.target.value
                                                }
                                              : item
                                          )
                                        )
                                    })
                                  }
                                />
                              )
                            )}
                          </div>
                          <div className="pdf-template-designer__token-insert">
                            <button
                              type="button"
                              className="pdf-template-designer__button pdf-template-designer__button--compact pdf-template-designer__token-insert-button"
                              onClick={() =>
                                tokenPicker?.mode === "insert"
                                  ? closeTokenPicker()
                                  : openTokenPicker("insert")
                              }
                            >
                              + Insert client data
                            </button>
                            {tokenPicker?.mode === "insert"
                              ? renderTokenPicker()
                              : null}
                          </div>
                          <div className="pdf-template-designer__status">
                            Shown on the form exactly as the client's record has
                            it. Staff can't change it while filling.
                          </div>
                          <details className="pdf-template-designer__token-advanced">
                            <summary>Advanced</summary>
                            <div className="pdf-template-designer__status">
                              Key: <code>{selectedField.key}</code>
                            </div>
                            <textarea
                              className="pdf-template-designer__input pdf-template-designer__textarea"
                              rows={3}
                              value={selectedField.variablesSampleData}
                              onChange={(event) =>
                                updateField(selectedField.id, {
                                  variablesSampleData: event.target.value
                                })
                              }
                              aria-label="Raw content"
                            />
                          </details>
                        </div>
                      ) : selectedField.type === "multiVariableText" ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__label">
                            Variables Sample Data
                          </div>
                          <textarea
                            className="pdf-template-designer__input pdf-template-designer__textarea"
                            rows={4}
                            value={selectedField.variablesSampleData}
                            onChange={(event) =>
                              updateField(selectedField.id, {
                                variablesSampleData: event.target.value
                              })
                            }
                            placeholder="For example: {ClientFirstName} {ClientLastName}"
                          />
                          <div className="pdf-template-designer__status">
                            Add variables with curly brackets, for example{" "}
                            <code>{"{name}"}</code>.
                          </div>
                        </div>
                      ) : null}

                      {selectedField.type === "select" ||
                      selectedField.type === "radio" ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__label">
                            Options
                          </div>
                          {selectedField.type === "radio" ? (
                            <div>
                              <div className="pdf-template-designer__label">
                                Options orientation
                              </div>
                              <select
                                className="pdf-template-designer__select"
                                value={selectedField.optionsOrientation}
                                onChange={(event) =>
                                  updateField(selectedField.id, {
                                    optionsOrientation: isFieldOrientation(
                                      event.target.value
                                    )
                                      ? event.target.value
                                      : "vertical"
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
                              Options are provided by the selected enumeration
                              key and cannot be edited here.
                            </div>
                          ) : (
                            <div className="pdf-template-designer__option-add">
                              <input
                                className="pdf-template-designer__input"
                                value={optionDraft}
                                onChange={(event) =>
                                  setOptionDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
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
                              <div className="pdf-template-designer__status">
                                No options configured.
                              </div>
                            ) : (
                              selectedFieldEffectiveOptions.map(
                                (option, index) => (
                                  <div
                                    className="pdf-template-designer__option-row"
                                    key={`${option}_${index}`}
                                  >
                                    <input
                                      className="pdf-template-designer__input"
                                      value={option}
                                      disabled={selectedFieldIsEnumBound}
                                      onChange={(event) =>
                                        updateSelectedFieldOption(
                                          index,
                                          event.target.value
                                        )
                                      }
                                    />
                                    {!selectedFieldIsEnumBound ? (
                                      <button
                                        className="pdf-template-designer__button"
                                        type="button"
                                        onClick={() =>
                                          removeSelectedFieldOption(index)
                                        }
                                      >
                                        x
                                      </button>
                                    ) : null}
                                  </div>
                                )
                              )
                            )}
                          </div>
                        </div>
                      ) : null}

                      {selectedField.type === "image" ? (
                        <div className="pdf-template-designer__inspector-section">
                          <div className="pdf-template-designer__label">
                            Image Source
                          </div>
                          {selectedFieldIsImageKeyBound ? (
                            <div className="pdf-template-designer__status">
                              Bound to key <code>{selectedField.key}</code>.
                              Provide a base64 image value in Data JSON for this
                              key.
                            </div>
                          ) : (
                            <input
                              className="pdf-template-designer__input"
                              type="file"
                              accept="image/*"
                              onChange={handleSelectedFieldImageUpload}
                            />
                          )}
                          {imageUploadError ? (
                            <div className="pdf-template-designer__alert">
                              {imageUploadError}
                            </div>
                          ) : null}
                          <div className="pdf-template-designer__image-preview">
                            {selectedFieldImagePreview ? (
                              <img
                                src={selectedFieldImagePreview}
                                alt={
                                  selectedField.label ||
                                  selectedField.key ||
                                  "Image preview"
                                }
                              />
                            ) : (
                              <div className="pdf-template-designer__status">
                                No image selected.
                              </div>
                            )}
                          </div>
                          {!selectedFieldIsImageKeyBound ? (
                            <button
                              className="pdf-template-designer__button"
                              type="button"
                              onClick={clearSelectedFieldImage}
                              disabled={
                                !normalizeImageDataFromUnknown(
                                  selectedField.imageDataUrl
                                )
                              }
                            >
                              Clear image
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {showPropertyDeleteAction ||
                      showPropertyDuplicateAction ? (
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
                    <div className="pdf-template-designer__status">
                      All field properties are hidden by widget configuration.
                    </div>
                  )
                ) : (
                  <div className="pdf-template-designer__status">
                    Select a field to edit.
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
