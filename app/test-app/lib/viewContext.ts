import { Box } from "tldraw";

export type ViewportBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WhiteboardShapeSummary = {
  _type: string;
  shapeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  geo?: string;
  color?: string;
  fill?: string;
};

export type ViewContext = {
  viewport: ViewportBounds;
  bounds: any;
  shapes: Array<WhiteboardShapeSummary>;
  blurryShapes: Array<WhiteboardShapeSummary>;
  peripheralClusters: Array<any>;
  selectedShapes: Array<WhiteboardShapeSummary>;
};

export function getViewContext(editor: any, agent: any): ViewContext {
  if (!editor || !agent) throw new Error("Editor/agent not ready");
  const viewport = editor.getViewportPageBounds();
  const bounds = viewport;
  const viewportBounds: ViewportBounds = {
    x: viewport.x,
    y: viewport.y,
    w: viewport.w,
    h: viewport.h,
  };
  const allShapes = editor.getCurrentPageShapesSorted();
  const inView = allShapes.filter((s: any) => {
    const b = editor.getShapeMaskedPageBounds(s);
    return b && b.collides(viewport);
  });
  const blurryShapes = inView
    .map((s: any) => toBlurryShapeSummary(s))
    .filter((s: any) => s);
  const peripheralClusters: Array<any> = [];
  const selectedShapes = editor
    .getSelectedShapes()
    .map((shape: any) => toSimpleShape(shape))
    .filter((s: any) => s);
  const shapes = blurryShapes as WhiteboardShapeSummary[];
  return {
    viewport: viewportBounds,
    bounds,
    shapes,
    blurryShapes: blurryShapes as WhiteboardShapeSummary[],
    peripheralClusters,
    selectedShapes: selectedShapes as WhiteboardShapeSummary[],
  };
}

export async function getViewportScreenshot(
  editor: any,
): Promise<string | null> {
  if (!editor) throw new Error("Editor not ready");
  const viewport = editor.getViewportPageBounds();
  const shapes = editor.getCurrentPageShapesSorted().filter((s: any) => {
    const b = editor.getShapeMaskedPageBounds(s);
    return b && b.collides(viewport);
  });
  if (!shapes.length) return null;
  const result = await editor.toImage(shapes, {
    format: "jpeg",
    background: true,
    bounds: Box.From(viewport),
    padding: 0,
    pixelRatio: 1,
    scale: 1,
  });
  const blob = result.blob as Blob;
  const toDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  return await toDataUrl();
}

function toSimpleShape(shape: any) {
  try {
    const rawId = String(shape?.id ?? "");
    const shapeId = rawId.replace(/^shape:/, "");
    const type = String(shape?.type ?? "unknown");
    const x = typeof shape?.x === "number" ? shape.x : 0;
    const y = typeof shape?.y === "number" ? shape.y : 0;
    const w =
      typeof shape?.props?.w === "number"
        ? shape.props.w
        : typeof shape?.w === "number"
          ? shape.w
          : 0;
    const h =
      typeof shape?.props?.h === "number"
        ? shape.props.h
        : typeof shape?.h === "number"
          ? shape.h
          : 0;
    const text =
      typeof shape?.props?.label === "string" ? shape.props.label : "";
    const geo =
      typeof shape?.props?.geo === "string" ? shape.props.geo : undefined;
    return { _type: type, shapeId, x, y, w, h, text, geo };
  } catch {
    return null;
  }
}

function toBlurryShapeSummary(shape: any) {
  try {
    const simple = toSimpleShape(shape);
    if (!simple) return null;
    const color =
      typeof shape?.props?.color === "string" ? shape.props.color : undefined;
    const fill =
      typeof shape?.props?.fill === "string" ? shape.props.fill : undefined;
    return { ...simple, color, fill };
  } catch {
    return null;
  }
}
