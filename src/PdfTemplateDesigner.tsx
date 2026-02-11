import { createElement, ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from "react";
import "./ui/PdfTemplateDesigner.css";

import { PdfTemplateDesignerContainerProps } from "../typings/PdfTemplateDesignerProps";

type FieldType = "text" | "checkbox" | "date" | "signature";
type FieldAlign = "left" | "center" | "right";

interface TemplateField {
  key: string;
  label: string;
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

interface TemplateDefinition {
  basePdf?: { fileId?: string };
  fields: TemplateField[];
  meta: { units: "pt"; createdWith: string };
}

interface PdfjsViewport {
  width: number;
  height: number;
}

interface PdfjsPageProxy {
  getViewport: (options: { scale: number }) => PdfjsViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfjsViewport }) => { promise: Promise<void> };
}

interface PdfjsDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfjsPageProxy>;
}

interface PdfjsApi {
  getDocument: (options: { data: ArrayBuffer }) => { promise: Promise<PdfjsDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
}

interface PageSize {
  width: number;
  height: number;
}

interface DragState {
  fieldKey: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  startField: TemplateField;
}

interface GuideLine {
  axis: "x" | "y";
  value: number;
}

const DEFAULT_PAGE_SIZE: PageSize = { width: 612, height: 792 };
const SNAP_SIZE = 5;
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const HISTORY_LIMIT = 100;
const ALIGN_TOLERANCE = 4;
const PALETTE_DRAG_TYPE = "application/x-pdf-field-type";
let pdfjsLoader: Promise<PdfjsApi> | null = null;

const FIELD_DEFAULTS: Record<FieldType, Pick<TemplateField, "w" | "h" | "fontSize" | "align">> = {
  text: { w: 180, h: 22, fontSize: 10, align: "left" },
  checkbox: { w: 16, h: 16, fontSize: 10, align: "center" },
  date: { w: 120, h: 20, fontSize: 10, align: "left" },
  signature: { w: 200, h: 30, fontSize: 10, align: "left" }
};

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFieldType(value: unknown): value is FieldType {
  return value === "text" || value === "checkbox" || value === "date" || value === "signature";
}

function isAlign(value: unknown): value is FieldAlign {
  return value === "left" || value === "center" || value === "right";
}

function normalizeField(input: any, index: number): TemplateField {
  const type: FieldType = isFieldType(input?.type) ? input.type : "text";
  const defaults = FIELD_DEFAULTS[type];
  const key = typeof input?.key === "string" && input.key.trim().length > 0 ? input.key.trim() : `field_${index + 1}`;
  const label = typeof input?.label === "string" ? input.label : "";
  const page = Math.max(0, Math.floor(toNumber(input?.page, 0)));
  const x = Math.max(0, toNumber(input?.x, 48));
  const y = Math.max(0, toNumber(input?.y, 48));
  const w = Math.max(8, toNumber(input?.w, defaults.w));
  const h = Math.max(8, toNumber(input?.h, defaults.h));
  const fontSize = Math.max(6, toNumber(input?.fontSize, defaults.fontSize));
  const align = isAlign(input?.align) ? input.align : defaults.align;
  const required = Boolean(input?.required);

  return { key, label, type, page, x, y, w, h, fontSize, align, required };
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

function buildTemplateJson(fields: TemplateField[], basePdfId?: string): string {
  const payload: TemplateDefinition = {
    basePdf: basePdfId ? { fileId: basePdfId } : undefined,
    fields: fields.map(field => ({ ...field })),
    meta: { units: "pt", createdWith: "pdftemplatedesigner" }
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
  const base = type === "checkbox" ? "check" : type;
  let index = 1;
  let candidate = `${base}_${index}`;
  const keys = new Set(fields.map(field => field.key));
  while (keys.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }

  return candidate;
}

function cloneFields(fields: TemplateField[]): TemplateField[] {
  return fields.map(field => ({ ...field }));
}

function areFieldsEqual(left: TemplateField[], right: TemplateField[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      a.key !== b.key ||
      a.label !== b.label ||
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

    try {
      req(
        ["pdfjs-dist/build/pdf"],
        (module: unknown) => {
          const amdLib = (module as any)?.default || module;
          finish(amdLib as PdfjsApi | undefined);
        },
        () => finish(undefined)
      );
    } catch (_error) {
      finish(undefined);
    }

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

export default function PdfTemplateDesigner(props: PdfTemplateDesignerContainerProps): ReactElement {
  const className = ["pdf-template-designer", props.class].filter(Boolean).join(" ");
  const showShortcutHints = props.showShortcutHints !== false;
  const enableKeyboardShortcuts = props.enableKeyboardShortcuts !== false;
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef<TemplateField[]>([]);
  const selectedKeyRef = useRef<string | null>(null);
  const undoStackRef = useRef<TemplateField[][]>([]);
  const redoStackRef = useRef<TemplateField[][]>([]);
  const lastLoadedJsonRef = useRef<string | undefined>(undefined);

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [placementType, setPlacementType] = useState<FieldType | null>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<PdfjsDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [renderScale, setRenderScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pageThumbs, setPageThumbs] = useState<Record<number, string>>({});
  const [isBuildingThumbs, setIsBuildingThumbs] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("1");

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  const templateItem = useMemo(() => {
    if (!props.dataSource || props.dataSource.status !== "available") {
      return undefined;
    }
    return props.dataSource.items?.[0];
  }, [props.dataSource]);

  const workerUrlResolution = useMemo(
    () => resolveTextTemplateValue(props.pdfJsWorkerUrl, templateItem),
    [props.pdfJsWorkerUrl, templateItem]
  );
  const configuredWorkerUrl = workerUrlResolution.value;

  const scriptUrlResolution = useMemo(
    () => resolveTextTemplateValue((props as any).pdfJsScriptUrl, templateItem),
    [templateItem, (props as any).pdfJsScriptUrl]
  );
  const configuredScriptUrl = scriptUrlResolution.value;
  const derivedScriptUrl = deriveScriptUrlFromWorkerUrl(configuredWorkerUrl);
  const defaultScriptUrl = resolveWorkerUrlValue((window as any).pdfjsScriptSrc) || derivedScriptUrl || PDFJS_CDN;
  const resolvedScriptUrl = configuredScriptUrl || defaultScriptUrl;
  const defaultWorkerUrl =
    resolveWorkerUrlValue((window as any).pdfjsWorkerSrc) ||
    deriveWorkerUrlFromScriptUrl(resolvedScriptUrl) ||
    PDFJS_WORKER_CDN;
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

  const templateJsonValue = useMemo(() => {
    if (!templateItem || !props.templateJsonAttr) {
      return undefined;
    }
    return props.templateJsonAttr.get(templateItem);
  }, [templateItem, props.templateJsonAttr]);

  const basePdfReference = useMemo(() => {
    if (!templateItem || !props.basePdfAssociation) {
      return undefined;
    }
    return props.basePdfAssociation.get(templateItem);
  }, [templateItem, props.basePdfAssociation]);

  const basePdfObject = basePdfReference?.status === "available" ? basePdfReference.value : undefined;
  const basePdfId = basePdfObject?.id;
  const templateJsonText =
    templateJsonValue && templateJsonValue.status === "available" ? templateJsonValue.value || "" : "";

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
    if (!selectedKey && parsed.fields.length > 0) {
      setSelectedKey(parsed.fields[0].key);
    }
  }, [templateJsonText, templateJsonValue, selectedKey]);

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
      setRenderError(null);
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
        const data = await response.arrayBuffer();
        const pdfjs = await loadPdfjs(resolvedScriptUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = resolvedWorkerUrl || pdfjs.GlobalWorkerOptions.workerSrc;
        const doc = await pdfjs.getDocument({ data }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setPageIndex(0);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load PDF.";
        if (!cancelled) {
          setRenderError(message);
          setPdfDoc(null);
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
  }, [basePdfId, isPdfJsConfigLoading, resolvedScriptUrl, resolvedWorkerUrl]);

  useEffect(() => {
    if (!pdfDoc) {
      return;
    }
    if (pageIndex > pdfDoc.numPages - 1) {
      setPageIndex(0);
    }
  }, [pdfDoc, pageIndex]);

  useEffect(() => {
    if (!pdfDoc) {
      return;
    }

    let cancelled = false;
    const renderPage = async () => {
      try {
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
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to render page.";
        if (!cancelled) {
          setRenderError(message);
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageIndex, containerWidth, zoom]);

  useEffect(() => {
    if (!pdfDoc) {
      setPageThumbs({});
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
  }, [pdfDoc]);

  const runConfiguredAction = useCallback((actionValue?: { canExecute: boolean; execute: () => void }) => {
    if (actionValue?.canExecute) {
      actionValue.execute();
    }
  }, []);

  const commitTemplate = useCallback(
    (
      nextFields: TemplateField[],
      options: {
        runSaveAction?: boolean;
        runOnChangeAction?: boolean;
      } = {}
    ) => {
      const { runSaveAction = false, runOnChangeAction = true } = options;
      if (!templateItem) {
        return;
      }

      const payload = buildTemplateJson(nextFields, basePdfId);
      lastLoadedJsonRef.current = payload;

      const attribute = props.templateJsonAttr?.get(templateItem);
      if (attribute && attribute.status === "available") {
        try {
          attribute.setValue(payload);
        } catch (error) {
          // Best-effort update; avoid crashing the widget when Mendix marks the attribute read-only.
          console.warn("Failed to update Template JSON attribute.", error);
        }
      }

      if (runOnChangeAction) {
        runConfiguredAction(props.onChangeAction?.get(templateItem));
      }

      if (runSaveAction) {
        runConfiguredAction(props.onSaveAction?.get(templateItem));
      }
    },
    [templateItem, props.templateJsonAttr, props.onChangeAction, props.onSaveAction, basePdfId, runConfiguredAction]
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
    (type: FieldType, x: number, y: number): TemplateField => {
      const defaults = FIELD_DEFAULTS[type];
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      const key = nextFieldKey(type, fieldsRef.current);
      const snappedX = snapValue(clamp(x - defaults.w / 2, 0, width - defaults.w), snapEnabled);
      const snappedY = snapValue(clamp(y - defaults.h / 2, 0, height - defaults.h), snapEnabled);
      return {
        key,
        label: "",
        type,
        page: pageIndex,
        x: snappedX,
        y: snappedY,
        w: defaults.w,
        h: defaults.h,
        fontSize: defaults.fontSize,
        align: defaults.align,
        required: false
      };
    },
    [pageIndex, pageSize, snapEnabled]
  );

  const addFieldAt = useCallback(
    (type: FieldType, x: number, y: number) => {
      const field = createField(type, x, y);
      applyFieldUpdate(prev => [...prev, field]);
      setSelectedKey(field.key);
    },
    [createField, applyFieldUpdate]
  );

  const addFieldCentered = useCallback(
    (type: FieldType) => {
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      addFieldAt(type, width / 2, height / 2);
    },
    [addFieldAt, pageSize]
  );

  const updateField = useCallback(
    (fieldKey: string, changes: Partial<TemplateField>, options?: { commit?: boolean; history?: boolean }) => {
      applyFieldUpdate(
        prev => prev.map(field => (field.key === fieldKey ? { ...field, ...changes } : field)),
        options
      );
    },
    [applyFieldUpdate]
  );

  const deleteField = useCallback(
    (fieldKey: string, options?: { commit?: boolean; history?: boolean }) => {
      applyFieldUpdate(prev => prev.filter(field => field.key !== fieldKey), options);
      if (selectedKeyRef.current === fieldKey) {
        setSelectedKey(null);
      }
    },
    [applyFieldUpdate]
  );

  const clearFields = useCallback(() => {
    applyFieldUpdate(() => []);
    setSelectedKey(null);
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
    const activeKey = selectedKeyRef.current;
    if (activeKey && !next.some(field => field.key === activeKey)) {
      setSelectedKey(next[0]?.key || null);
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
    const activeKey = selectedKeyRef.current;
    if (activeKey && !next.some(field => field.key === activeKey)) {
      setSelectedKey(next[0]?.key || null);
    }
  }, [commitTemplate]);

  const duplicateSelectedField = useCallback(() => {
    const activeKey = selectedKeyRef.current;
    if (!activeKey) {
      return;
    }
    const source = fieldsRef.current.find(field => field.key === activeKey);
    if (!source) {
      return;
    }
    const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
    const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
    const key = nextFieldKey(source.type, fieldsRef.current);
    const field: TemplateField = {
      ...source,
      key,
      x: snapValue(clamp(source.x + 12, 0, width - source.w), snapEnabled),
      y: snapValue(clamp(source.y + 12, 0, height - source.h), snapEnabled)
    };
    applyFieldUpdate(prev => [...prev, field]);
    setSelectedKey(field.key);
  }, [applyFieldUpdate, pageSize, snapEnabled]);

  const nudgeSelectedField = useCallback(
    (deltaX: number, deltaY: number) => {
      const activeKey = selectedKeyRef.current;
      if (!activeKey) {
        return;
      }
      const width = pageSize.width || DEFAULT_PAGE_SIZE.width;
      const height = pageSize.height || DEFAULT_PAGE_SIZE.height;
      applyFieldUpdate(prev => {
        let changed = false;
        const next = prev.map(field => {
          if (field.key !== activeKey) {
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
    () => fields.find(field => field.key === selectedKey) || null,
    [fields, selectedKey]
  );

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
        field => field.page === dragState.startField.page && field.key !== dragState.fieldKey
      );
      const verticalRefs = relatedFields.flatMap(fieldVerticalLines);
      const horizontalRefs = relatedFields.flatMap(fieldHorizontalLines);
      const activeGuides: GuideLine[] = [];

      const update = (field: TemplateField): TemplateField => {
        if (field.key !== dragState.fieldKey) {
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
        prev => prev.map(field => (field.key === dragState.fieldKey ? update(field) : field)),
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
      setSelectedKey(field.key);
      setGuides([]);
      setDragState({
        fieldKey: field.key,
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startField: { ...field }
      });
    },
    [pushUndoSnapshot]
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

  const handlePaletteDragStart = useCallback((event: ReactDragEvent<HTMLButtonElement>, type: FieldType) => {
    event.dataTransfer.setData(PALETTE_DRAG_TYPE, type);
    event.dataTransfer.effectAllowed = "copy";
    setPlacementType(type);
  }, []);

  const handleOverlayDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleOverlayDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      const dropped = event.dataTransfer.getData(PALETTE_DRAG_TYPE);
      if (!isFieldType(dropped)) {
        return;
      }
      event.preventDefault();
      placeAtClientPoint(dropped, event.clientX, event.clientY);
      setPlacementType(dropped);
    },
    [placeAtClientPoint]
  );

  const handleOverlayPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target !== overlayRef.current) {
        return;
      }
      if (placementType) {
        event.preventDefault();
        placeAtClientPoint(placementType, event.clientX, event.clientY);
        return;
      }
      setSelectedKey(null);
    },
    [placementType, placeAtClientPoint]
  );

  useEffect(() => {
    if (!enableKeyboardShortcuts) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        setPlacementType(null);
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

      const activeKey = selectedKeyRef.current;
      if (!activeKey) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteField(activeKey);
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
  }, [enableKeyboardShortcuts, undo, redo, duplicateSelectedField, deleteField, nudgeSelectedField]);

  const handleSaveClick = useCallback(() => {
    commitTemplate(fieldsRef.current, { runSaveAction: true, runOnChangeAction: false });
  }, [commitTemplate]);

  const handlePlacementSelect = useCallback((type: FieldType) => {
    setPlacementType(current => (current === type ? null : type));
  }, []);

  const applyPageJump = useCallback(() => {
    const maxPages = pdfDoc?.numPages || 1;
    const requested = Math.floor(toNumber(pageJumpInput, pageIndex + 1));
    const normalized = clamp(requested, 1, maxPages);
    setPageIndex(normalized - 1);
  }, [pageJumpInput, pageIndex, pdfDoc]);

  const pageCount = pdfDoc?.numPages || 1;
  const fieldsOnPage = fields.filter(field => field.page === pageIndex);
  const undoDisabled = undoStackRef.current.length === 0;
  const redoDisabled = redoStackRef.current.length === 0;
  // Template coordinates are stored in PDF points (top-left origin). Multiply by renderScale for canvas pixels.
  const renderWidth = pageSize.width * renderScale;
  const renderHeight = pageSize.height * renderScale;

  if (!props.dataSource) {
    return (
      <div className={className} style={props.style} tabIndex={props.tabIndex}>
        <div className="pdf-template-designer__alert">Configure a data source for PdfTemplateDefinition.</div>
      </div>
    );
  }

  return (
    <div className={className} style={props.style} tabIndex={props.tabIndex}>
      {jsonError ? (
        <div className="pdf-template-designer__alert">Template JSON is invalid. {jsonError}</div>
      ) : null}
      <div className="pdf-template-designer__layout">
        <aside className="pdf-template-designer__sidebar">
          <div>
            <div className="pdf-template-designer__section-title">Palette</div>
            <div className="pdf-template-designer__palette">
              <button
                className={`pdf-template-designer__button${placementType === "text" ? " is-active" : ""}`}
                onClick={() => handlePlacementSelect("text")}
                onDoubleClick={() => addFieldCentered("text")}
                draggable
                onDragStart={event => handlePaletteDragStart(event, "text")}
                type="button"
              >
                Text field
              </button>
              <button
                className={`pdf-template-designer__button${placementType === "checkbox" ? " is-active" : ""}`}
                onClick={() => handlePlacementSelect("checkbox")}
                onDoubleClick={() => addFieldCentered("checkbox")}
                draggable
                onDragStart={event => handlePaletteDragStart(event, "checkbox")}
                type="button"
              >
                Checkbox
              </button>
              <button
                className={`pdf-template-designer__button${placementType === "date" ? " is-active" : ""}`}
                onClick={() => handlePlacementSelect("date")}
                onDoubleClick={() => addFieldCentered("date")}
                draggable
                onDragStart={event => handlePaletteDragStart(event, "date")}
                type="button"
              >
                Date
              </button>
              <button
                className={`pdf-template-designer__button${placementType === "signature" ? " is-active" : ""}`}
                onClick={() => handlePlacementSelect("signature")}
                onDoubleClick={() => addFieldCentered("signature")}
                draggable
                onDragStart={event => handlePaletteDragStart(event, "signature")}
                type="button"
              >
                Signature
              </button>
              <button
                className="pdf-template-designer__button pdf-template-designer__button--ghost"
                onClick={clearFields}
                type="button"
              >
                Clear fields
              </button>
            </div>
            <div className="pdf-template-designer__status">
              Click a tool, then click on the PDF to place. Double-click tool for centered insert.
            </div>
          </div>

          <div>
            <div className="pdf-template-designer__section-title">Fields</div>
            <div className="pdf-template-designer__field-list">
              {fields.length === 0 ? (
                <div className="pdf-template-designer__status">No fields yet.</div>
              ) : (
                fields.map(field => (
                  <button
                    key={field.key}
                    className={`pdf-template-designer__field-pill${
                      selectedKey === field.key ? " is-selected" : ""
                    }`}
                    type="button"
                    onClick={() => setSelectedKey(field.key)}
                  >
                    <span>{field.label || field.key}</span>
                    <span>{field.type}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
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
        </aside>

        <section className="pdf-template-designer__canvas">
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
              <button className="pdf-template-designer__button pdf-template-designer__button--primary" onClick={handleSaveClick} type="button">
                Save JSON
              </button>
            </div>
          </div>
          {placementType ? (
            <div className="pdf-template-designer__status">
              Placing <strong>{placementType}</strong>. Click the page to place.
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
            {pdfDoc ? (
              <div className="pdf-template-designer__page" style={{ width: renderWidth, height: renderHeight }}>
                <canvas className="pdf-template-designer__canvas-surface" ref={canvasRef} />
                <div
                  className={`pdf-template-designer__overlay${
                    snapEnabled ? " pdf-template-designer__overlay--grid" : ""
                  }${placementType ? " pdf-template-designer__overlay--placing" : ""}${
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
                      key={field.key}
                      className={`pdf-template-designer__field pdf-template-designer__field--${field.type}${
                        selectedKey === field.key ? " is-selected" : ""
                      }`}
                      style={{
                        left: field.x * renderScale,
                        top: field.y * renderScale,
                        width: field.w * renderScale,
                        height: field.h * renderScale
                      }}
                      onPointerDown={event => handleFieldPointerDown(event, field, "move")}
                    >
                      <div className="pdf-template-designer__field-label">{field.label || field.key}</div>
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

        <aside className="pdf-template-designer__properties">
          <div className="pdf-template-designer__section-title">Field properties</div>
          {selectedField ? (
            <div className="pdf-template-designer__form">
              <div>
                <div className="pdf-template-designer__label">Key</div>
                <input
                  className="pdf-template-designer__input"
                  value={selectedField.key}
                  onChange={event => {
                    const nextKey = event.target.value.trim();
                    if (!nextKey || fields.some(field => field.key === nextKey && field.key !== selectedField.key)) {
                      return;
                    }
                    updateField(selectedField.key, { key: nextKey });
                    setSelectedKey(nextKey);
                  }}
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Label</div>
                <input
                  className="pdf-template-designer__input"
                  value={selectedField.label}
                  onChange={event => updateField(selectedField.key, { label: event.target.value })}
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Type</div>
                <select
                  className="pdf-template-designer__select"
                  value={selectedField.type}
                  onChange={event => updateField(selectedField.key, { type: event.target.value as FieldType })}
                >
                  <option value="text">Text</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="date">Date</option>
                  <option value="signature">Signature</option>
                </select>
              </div>
              <div>
                <div className="pdf-template-designer__label">Page (1-based)</div>
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={selectedField.page + 1}
                  onChange={event => {
                    const next = clamp(Math.floor(toNumber(event.target.value, 1)), 1, pageCount);
                    updateField(selectedField.key, { page: next - 1 });
                  }}
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Position (x, y)</div>
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  value={selectedField.x}
                  onChange={event => updateField(selectedField.key, { x: toNumber(event.target.value, selectedField.x) })}
                />
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  value={selectedField.y}
                  onChange={event => updateField(selectedField.key, { y: toNumber(event.target.value, selectedField.y) })}
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Size (w, h)</div>
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  value={selectedField.w}
                  onChange={event => updateField(selectedField.key, { w: toNumber(event.target.value, selectedField.w) })}
                />
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  value={selectedField.h}
                  onChange={event => updateField(selectedField.key, { h: toNumber(event.target.value, selectedField.h) })}
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Font size</div>
                <input
                  className="pdf-template-designer__input"
                  type="number"
                  min={6}
                  value={selectedField.fontSize}
                  onChange={event =>
                    updateField(selectedField.key, { fontSize: toNumber(event.target.value, selectedField.fontSize) })
                  }
                />
              </div>
              <div>
                <div className="pdf-template-designer__label">Alignment</div>
                <select
                  className="pdf-template-designer__select"
                  value={selectedField.align}
                  onChange={event => updateField(selectedField.key, { align: event.target.value as FieldAlign })}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <label className="pdf-template-designer__toggle">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={event => updateField(selectedField.key, { required: event.target.checked })}
                />
                Required
              </label>
              <button
                className="pdf-template-designer__button"
                onClick={duplicateSelectedField}
                type="button"
              >
                Duplicate field
              </button>
              <button
                className="pdf-template-designer__button"
                onClick={() => deleteField(selectedField.key)}
                type="button"
              >
                Delete field
              </button>
            </div>
          ) : (
            <div className="pdf-template-designer__status">Select a field to edit.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
