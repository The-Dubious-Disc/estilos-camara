"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import { paintSampleScene } from "@/lib/sample-scene";
import {
  MAX_EDGE,
  STYLES,
  fitSize,
  renderStyledPhoto,
  type StyleId,
} from "@/lib/process";

type Source = {
  bitmap: ImageBitmap;
};

type Result = {
  style: StyleId;
  dateStamp: boolean;
  canvas: HTMLCanvasElement;
};

const FILE_SLUG: Record<StyleId, string> = {
  seventies: "70s",
  polaroid: "polaroid",
  digicam: "2000s",
};

const SHORT_LABEL: Record<StyleId, string> = {
  seventies: "70s",
  polaroid: "Polaroid",
  digicam: "2000s",
};

const PRIVACY = "La foto no sale de este dispositivo.";

export function PhotoLab({ handFont }: { handFont: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [style, setStyle] = useState<StyleId>("seventies");
  const [dateStamp, setDateStamp] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const sourceRef = useRef<Source | null>(null);
  const resultRef = useRef<Result | null>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const loadGen = useRef(0);
  const renderGen = useRef(0);
  const styleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fileId = useId();
  const statusId = useId();
  const selected = STYLES.find((item) => item.id === style) ?? STYLES[0];

  useEffect(() => {
    return () => {
      const current = sourceRef.current;
      sourceRef.current = null;
      if (current) releaseBitmap(current.bitmap);
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    const token = ++renderGen.current;
    const chosen = style;
    const stamp = dateStamp;
    let active = true;
    const bitmap = source.bitmap;

    const snap = document.createElement("canvas");
    snap.width = bitmap.width;
    snap.height = bitmap.height;
    const snapContext = snap.getContext("2d");
    if (snapContext) snapContext.drawImage(bitmap, 0, 0);

    if (snapContext && !resultRef.current && displayRef.current) {
      paintSource(displayRef.current, bitmap, bitmap.width, bitmap.height);
    }

    async function run() {
      if (!snapContext) {
        setProcessing(false);
        setProgress(null);
        setError("No pudimos revelar esta foto. Prueba otra vez o con otra imagen.");
        return;
      }
      setProcessing(true);
      setError(null);
      setProgress("Revelando…");
      try {
        const family = chosen === "polaroid" ? await ensureHandFont(handFont) : "cursive";
        if (!active || token !== renderGen.current) return;
        const rendered = await renderStyledPhoto(snap, snap.width, snap.height, {
          style: chosen,
          dateStamp: stamp,
          handFont: family,
          onProgress: (message) => {
            if (!active || token !== renderGen.current) throw new StaleRender();
            setProgress(message);
          },
        });
        if (!active || token !== renderGen.current) return;
        const canvas = rendered as HTMLCanvasElement;
        if (displayRef.current) paintSource(displayRef.current, canvas, canvas.width, canvas.height);
        const next = { style: chosen, dateStamp: stamp, canvas };
        resultRef.current = next;
        setResult(next);
        setProgress(null);
      } catch (caught) {
        if (caught instanceof StaleRender) return;
        if (!active || token !== renderGen.current) return;
        setError("No pudimos revelar esta foto. Prueba otra vez o con otra imagen.");
        setProgress(null);
      } finally {
        if (active && token === renderGen.current) setProcessing(false);
      }
    }

    void run();
    return () => {
      active = false;
    };
  }, [source, style, dateStamp, handFont]);

  function rememberSource(next: Source | null) {
    const previous = sourceRef.current;
    sourceRef.current = next;
    resultRef.current = null;
    setSource(next);
    setResult(null);
    if (previous) {
      const bitmap = previous.bitmap;
      window.setTimeout(() => releaseBitmap(bitmap), 0);
    }
  }

  function beginLoad() {
    const token = ++loadGen.current;
    setError(null);
    setProgress("Abriendo foto…");
    setProcessing(true);
    return token;
  }

  async function commitBitmap(bitmap: ImageBitmap, token: number) {
    let prepared: ImageBitmap | null = null;
    try {
      const fitted = fitSize(bitmap.width, bitmap.height, MAX_EDGE);
      prepared =
        fitted.width === bitmap.width && fitted.height === bitmap.height
          ? bitmap
          : await resizeBitmap(bitmap, fitted.width, fitted.height);
      if (token !== loadGen.current) {
        releaseBitmap(prepared);
        return false;
      }
      const owned = prepared;
      prepared = null;
      rememberSource({ bitmap: owned });
      return true;
    } catch (caught) {
      if (prepared) releaseBitmap(prepared);
      else releaseBitmap(bitmap);
      throw caught;
    }
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      setError("Ese archivo no es una imagen. Prueba con JPG, PNG o WEBP.");
      return;
    }
    const token = beginLoad();
    try {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch {
        bitmap = await createImageBitmap(file);
      }
      if (token !== loadGen.current) {
        releaseBitmap(bitmap);
        return;
      }
      await commitBitmap(bitmap, token);
    } catch {
      if (token !== loadGen.current) return;
      setProcessing(false);
      setProgress(null);
      setError("No pudimos leer esa foto. Si está en HEIC, exporta una copia en JPG, PNG o WEBP.");
    }
  }

  async function loadSample() {
    const token = beginLoad();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      paintSampleScene(context, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      if (token !== loadGen.current) {
        releaseBitmap(bitmap);
        return;
      }
      await commitBitmap(bitmap, token);
    } catch {
      if (token !== loadGen.current) return;
      setProcessing(false);
      setProgress(null);
      setError("No pudimos preparar la escena de ejemplo.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clearing the value lets the same file be chosen again. An empty list is a cancel.
    event.target.value = "";
    if (!file) return;
    void loadFile(file);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  function onStyleKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = STYLES.findIndex((item) => item.id === style);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % STYLES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current + STYLES.length - 1) % STYLES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = STYLES.length - 1;
    else return;
    event.preventDefault();
    setStyle(STYLES[next].id);
    styleRefs.current[next]?.focus();
  }

  const ready = result !== null && result.style === style && result.dateStamp === dateStamp && !processing;
  const previewLabel = !source
    ? undefined
    : result
      ? `Foto con el estilo ${STYLES.find((item) => item.id === result.style)?.name ?? "elegido"}`
      : "Foto elegida, preparando el estilo";

  return (
    <main
      className="lab-shell"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="lab-header">
        <h1>Retro Pic</h1>
        {selected.date ? (
          <label className="lab-date">
            <input
              type="checkbox"
              checked={dateStamp}
              onChange={(event) => setDateStamp(event.target.checked)}
            />
            Fecha
          </label>
        ) : null}
      </header>

      <div
        className="lab-finder"
        data-dragging={dragging ? "true" : "false"}
        aria-busy={processing}
      >
        {source ? (
          <canvas ref={displayRef} className="lab-photo" role="img" aria-label={previewLabel} />
        ) : (
          <div className="lab-empty">
            <p>Elige una foto para ver el estilo.</p>
            <button type="button" className="lab-sample" onClick={() => void loadSample()}>
              Probar una escena
            </button>
          </div>
        )}
        {processing ? (
          <div className="lab-progress" aria-hidden="true">
            <span />
          </div>
        ) : null}
      </div>

      <div
        className="lab-modes"
        role="radiogroup"
        aria-label="Estilo"
        onKeyDown={onStyleKey}
      >
        {STYLES.map((item, index) => {
          const checked = item.id === style;
          return (
            <button
              key={item.id}
              ref={(node) => {
                styleRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${item.name}. ${item.description}`}
              tabIndex={checked ? 0 : -1}
              className="lab-mode"
              onClick={() => setStyle(item.id)}
            >
              <StyleSwatch id={item.id} />
              <span aria-hidden="true">{SHORT_LABEL[item.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="lab-actions">
        <label className={source ? "lab-choose" : "lab-choose is-primary"} htmlFor={fileId}>
          {source ? "Cambiar foto" : "Elegir foto"}
          {/* One chooser, no capture and no multiple: the browser or OS offers camera, library, or files. */}
          <input
            id={fileId}
            className="lab-file-input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
          />
        </label>
        <button
          type="button"
          className={ready ? "lab-download is-primary" : "lab-download"}
          disabled={!ready}
          onClick={() => void download(result, "png")}
        >
          Descargar PNG
        </button>
        <button type="button" className="lab-download" disabled={!ready} onClick={() => void download(result, "jpeg")}>
          Descargar JPEG
        </button>
      </div>

      <p id={statusId} className={error ? "lab-status is-error" : "lab-status"} role="status" aria-live="polite">
        {error ?? progress ?? PRIVACY}
      </p>
    </main>
  );
}

function StyleSwatch({ id }: { id: StyleId }) {
  if (id === "polaroid") {
    return (
      <span className="lab-swatch lab-swatch-polaroid" aria-hidden="true">
        <span />
      </span>
    );
  }
  if (id === "digicam") return <span className="lab-swatch lab-swatch-digicam" aria-hidden="true" />;
  return <span className="lab-swatch lab-swatch-seventies" aria-hidden="true" />;
}

class StaleRender extends Error {
  constructor() {
    super("stale");
    this.name = "StaleRender";
  }
}

/** Paint at the processed pixel size. CSS only scales the view; download uses these pixels. */
function paintSource(
  target: HTMLCanvasElement,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");
  if (!context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
}

function releaseBitmap(bitmap: ImageBitmap) {
  try {
    bitmap.close();
  } catch {
    // Already closed by a faster replace.
  }
}

async function resizeBitmap(bitmap: ImageBitmap, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return createImageBitmap(canvas);
}

async function ensureHandFont(family: string) {
  const primary = family.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  if (!primary) return "cursive";
  try {
    await document.fonts.load(`500 72px "${primary}"`);
    await document.fonts.ready;
    if (document.fonts.check(`500 72px "${primary}"`)) return `"${primary}", cursive`;
  } catch {
    return "cursive";
  }
  return "cursive";
}

async function download(result: Result | null, kind: "png" | "jpeg") {
  if (!result) return;
  const type = kind === "png" ? "image/png" : "image/jpeg";
  const blob = await canvasBlob(result.canvas, type, kind === "jpeg" ? 0.92 : undefined);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `retro-pic-${FILE_SLUG[result.style]}.${kind === "png" ? "png" : "jpg"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
