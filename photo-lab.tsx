"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  url: string;
};

type Result = {
  url: string;
  style: StyleId;
  canvas: HTMLCanvasElement;
};

const FILE_SLUG: Record<StyleId, string> = {
  seventies: "70s",
  polaroid: "polaroid",
  digicam: "2000s",
};

export function PhotoLab({ handFont }: { handFont: string }) {
  const [source, setSource] = useState<Source | null>(null);
  const [style, setStyle] = useState<StyleId>("seventies");
  const [dateStamp, setDateStamp] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [wipe, setWipe] = useState(100);

  const sourceRef = useRef<Source | null>(null);
  const resultRef = useRef<Result | null>(null);
  const runRef = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const styleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resultSectionRef = useRef<HTMLElement>(null);
  const statusId = useId();
  const selected = STYLES.find((item) => item.id === style) ?? STYLES[0];

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.bitmap.close();
        URL.revokeObjectURL(sourceRef.current.url);
      }
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    };
  }, []);

  function rememberSource(next: Source | null) {
    if (sourceRef.current) {
      sourceRef.current.bitmap.close();
      URL.revokeObjectURL(sourceRef.current.url);
    }
    sourceRef.current = next;
    setSource(next);
  }

  function rememberResult(next: Result | null) {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = next;
    setResult(next);
  }

  async function adoptBitmap(bitmap: ImageBitmap) {
    const fitted = fitSize(bitmap.width, bitmap.height, MAX_EDGE);
    const prepared =
      fitted.width === bitmap.width && fitted.height === bitmap.height
        ? bitmap
        : await resizeBitmap(bitmap, fitted.width, fitted.height);
    const blob = await canvasBlob(await bitmapToCanvas(prepared), "image/jpeg", 0.9);
    if (!blob) throw new Error("preview");
    runRef.current += 1;
    rememberSource({ bitmap: prepared, url: URL.createObjectURL(blob) });
    rememberResult(null);
    setProcessing(false);
    setError(null);
    setProgress(null);
    setWipe(100);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      setProgress(null);
      setError("Ese archivo no es una imagen. Prueba con JPG, PNG o WEBP.");
      return;
    }
    setError(null);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      await adoptBitmap(bitmap);
    } catch {
      setProgress(null);
      setError("No pudimos leer esa foto. Si está en HEIC, exporta una copia en JPG, PNG o WEBP.");
    }
  }

  async function loadSample() {
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      paintSampleScene(context, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      await adoptBitmap(bitmap);
    } catch {
      setError("No pudimos preparar la escena de ejemplo.");
    }
  }

  async function generate() {
    const current = sourceRef.current;
    if (!current || processing) return;
    const token = ++runRef.current;
    const chosen = style;
    setProcessing(true);
    setError(null);
    setProgress("Revelando la foto…");
    try {
      const family = chosen === "polaroid" ? await ensureHandFont(handFont) : "cursive";
      if (token !== runRef.current) return;
      const rendered = await renderStyledPhoto(current.bitmap, current.bitmap.width, current.bitmap.height, {
        style: chosen,
        dateStamp,
        handFont: family,
        onProgress: (message) => {
          if (token === runRef.current) setProgress(message);
        },
      });
      if (token !== runRef.current) return;
      const canvas = rendered as HTMLCanvasElement;
      const blob = await canvasBlob(canvas, "image/png");
      if (!blob || token !== runRef.current) return;
      rememberResult({
        url: URL.createObjectURL(blob),
        style: chosen,
        canvas,
      });
      setWipe(100);
      const name = STYLES.find((item) => item.id === chosen)?.name ?? "estilo";
      setProgress(`Listo. Así queda «${name}».`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultSectionRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "nearest",
      });
    } catch {
      if (token !== runRef.current) return;
      setError("No pudimos revelar esta foto. Prueba otra vez o con otra imagen.");
      setProgress(null);
    } finally {
      if (token === runRef.current) setProcessing(false);
    }
  }

  function focusStyles() {
    const index = STYLES.findIndex((item) => item.id === style);
    styleRefs.current[index]?.focus();
  }

  function resetPhoto() {
    runRef.current += 1;
    rememberSource(null);
    rememberResult(null);
    setProcessing(false);
    setError(null);
    setProgress(null);
    setWipe(100);
    uploadRef.current?.focus();
  }

  function onStyleKey(event: KeyboardEvent<HTMLDivElement>) {
    const current = STYLES.findIndex((item) => item.id === style);
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % STYLES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current + STYLES.length - 1) % STYLES.length;
    else return;
    event.preventDefault();
    setStyle(STYLES[next].id);
    styleRefs.current[next]?.focus();
  }

  const stale = result !== null && result.style !== style;

  return (
    <div className="flex min-h-full flex-col">
      <div className="h-1 bg-[#b8431f]" aria-hidden />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">Cuarto oscuro</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-foreground sm:text-5xl">
            Estilos <span className="italic">cámara</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Tres looks de otra época para una foto. El revelado se hace en este dispositivo: nada se sube y no hace falta una cuenta.
          </p>
        </header>

        <div className="mt-8 grid flex-1 items-start gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="foto-heading">
            <h2 id="foto-heading" className="font-serif text-2xl tracking-tight">
              Tu foto
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Súbela, tómala con la cámara o prueba una escena.</p>

            <div
              className={cn(
                "mt-4 rounded-xl border border-dashed border-border bg-background/60 p-3 transition-colors",
                dragging && "border-foreground bg-accent",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void loadFile(event.dataTransfer.files?.[0]);
              }}
            >
              {source ? (
                // The preview is a local blob, so next/image cannot optimize it.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source.url}
                  alt="Foto elegida, todavía sin estilo"
                  className="mx-auto max-h-72 w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center px-4 py-8 text-center">
                  <p className="font-medium">Suelta una foto aquí</p>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">JPG, PNG o WEBP. En el móvil también puedes usar la cámara.</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "relative h-12 cursor-pointer px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                )}
              >
                <ImagePlus aria-hidden />
                Subir foto
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void loadFile(file);
                  }}
                />
              </label>
              <label
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "relative h-12 cursor-pointer px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                )}
              >
                <Camera aria-hidden />
                Tomar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void loadFile(file);
                  }}
                />
              </label>
              <Button type="button" variant="ghost" className="h-12 px-4" onClick={() => void loadSample()}>
                Probar una escena
              </Button>
            </div>

            <h2 id="estilo-heading" className="mt-8 font-serif text-2xl tracking-tight">
              Elige un estilo
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="estilo-heading"
              className="mt-3 grid gap-3 sm:grid-cols-3"
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
                    tabIndex={checked ? 0 : -1}
                    onClick={() => setStyle(item.id)}
                    className="flex flex-col gap-2 rounded-xl border-2 border-border bg-background p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:border-foreground"
                  >
                    <StyleSwatch id={item.id} />
                    <span className="px-1 pb-1">
                      <span className="block text-sm font-semibold">{item.name}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selected.date ? (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-foreground"
                  checked={dateStamp}
                  onChange={(event) => setDateStamp(event.target.checked)}
                />
                <span>
                  <span className="block font-medium">Incluir fecha en la foto</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {selected.id === "polaroid"
                      ? "Se escribe a mano en el marco, como en una instantánea de los 90."
                      : "Aparece en naranja, abajo a la derecha, como en las compactas."}
                  </span>
                </span>
              </label>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Este look no lleva fecha impresa: el carrete de los 70 no la escribía en la foto.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-3">
              <Button
                type="button"
                className="h-12 px-5 text-base"
                disabled={!source || processing}
                onClick={() => void generate()}
              >
                {processing ? "Revelando…" : "Crear estilo"}
              </Button>
              <p id={statusId} aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
                {error ? <span role="alert" className="text-destructive">{error}</span> : progress}
                {!error && !progress && source && "La foto está lista. Pulsa Crear estilo."}
                {!error && !progress && !source && "Empieza por una foto."}
              </p>
              {stale && !processing && (
                <p className="text-sm text-muted-foreground">
                  El resultado visible es de otro estilo. Pulsa Crear estilo para actualizarlo.
                </p>
              )}
            </div>
          </section>

          <section
            ref={resultSectionRef}
            aria-labelledby="resultado-heading"
            aria-busy={processing}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:sticky lg:top-4"
          >
            <h2 id="resultado-heading" className="font-serif text-2xl tracking-tight">
              Resultado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result
                ? STYLES.find((item) => item.id === result.style)?.name
                : "Aquí aparece la foto revelada."}
            </p>

            <div className="relative mt-4 overflow-hidden rounded-xl bg-[#2a241e] p-3 sm:p-4">
              {result && source && result.style !== "polaroid" ? (
                <CompareWipe before={source.url} after={result.url} wipe={wipe} />
              ) : result && source ? (
                <PolaroidCompare before={source.url} after={result.url} />
              ) : source ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source.url}
                  alt="Foto original, a la espera del estilo"
                  className="mx-auto max-h-[32rem] w-full object-contain"
                />
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-[#f3eadf]">
                  <p className="font-serif text-2xl">Todavía no hay foto</p>
                  <p className="mt-2 max-w-xs text-sm text-[#d9cbb8]">
                    Cuando elijas una imagen y un estilo, el antes y el después se verán aquí.
                  </p>
                </div>
              )}
              {processing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1b1612]/72 px-6 text-center text-[#f6f1e8]">
                  <p className="font-medium">{progress ?? "Revelando la foto…"}</p>
                  <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20" aria-hidden>
                    <div className="lab-sheen h-full w-1/2 bg-[#f0b48a]" />
                  </div>
                </div>
              )}
            </div>

            {result && source && result.style !== "polaroid" && (
              <div className="mt-3">
                <label className="flex items-center gap-3 text-xs font-medium text-muted-foreground" htmlFor="comparar">
                  <span>Antes</span>
                  <input
                    id="comparar"
                    className="compare-range w-full"
                    type="range"
                    min={0}
                    max={100}
                    aria-label="Comparar antes y después"
                    value={wipe}
                    onChange={(event) => setWipe(Number(event.target.value))}
                    aria-valuetext={wipe >= 98 ? "Después" : wipe <= 2 ? "Antes" : `${wipe}% del estilo aplicado`}
                  />
                  <span>Después</span>
                </label>
                <p className="mt-1 text-xs text-muted-foreground">Desliza para comparar la foto original con el estilo.</p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" className="h-11 px-4" disabled={!result || processing} onClick={() => void download(result, "png")}>
                Descargar PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 px-4"
                disabled={!result || processing}
                onClick={() => void download(result, "jpeg")}
              >
                Descargar JPEG
              </Button>
              <Button type="button" variant="secondary" className="h-11 px-4" onClick={focusStyles}>
                Probar otro estilo
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-4" onClick={resetPhoto} disabled={!source && !result}>
                Nueva foto
              </Button>
            </div>
            {result?.style === "polaroid" && (
              <p className="mt-3 text-xs text-muted-foreground">La descarga incluye el marco blanco.</p>
            )}
          </section>
        </div>

        <footer className="mt-8 text-sm text-muted-foreground">
          La foto no sale de este navegador. Si ya abriste la página, puedes seguir usándola sin conexión.
        </footer>
      </main>
    </div>
  );
}

function StyleSwatch({ id }: { id: StyleId }) {
  if (id === "polaroid") {
    return (
      <span className="block aspect-[16/9] rounded-md bg-[#f4f0e6] p-1.5 pb-4" aria-hidden>
        <span
          className="block h-full rounded-[2px]"
          style={{ background: "linear-gradient(180deg, #f6d7c8 0%, #d7e3dc 55%, #8fb0b4 100%)" }}
        />
      </span>
    );
  }
  if (id === "digicam") {
    return (
      <span className="relative block aspect-[16/9] overflow-hidden rounded-md" aria-hidden>
        <span
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, #f4f7f2 0%, #9eb8b4 38%, #35524f 72%, #121c1b 100%)",
          }}
        />
        <span className="absolute right-1.5 bottom-1.5 font-mono text-[10px] tracking-tight text-[#ff8a1e]">
          04.11.06
        </span>
      </span>
    );
  }
  return (
    <span className="relative block aspect-[16/9] overflow-hidden rounded-md" aria-hidden>
      <span
        className="absolute inset-0"
        style={{ background: "linear-gradient(150deg, #f0c9a0 0%, #c47c49 46%, #7a4632 100%)" }}
      />
      <span
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at center, transparent 40%, rgba(42,20,10,0.55) 100%)" }}
      />
      <span className="absolute inset-y-2 left-[22%] w-px bg-white/35" />
    </span>
  );
}

function CompareWipe({ before, after, wipe }: { before: string; after: string; wipe: number }) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="" className="mx-auto max-h-[32rem] w-full object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Foto con el estilo aplicado"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }}
      />
      <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-[#f6f1e8]/90 px-2 py-0.5 text-[11px] font-medium text-[#241c16]">
        Antes
      </span>
      <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-[#f6f1e8]/90 px-2 py-0.5 text-[11px] font-medium text-[#241c16]">
        Después
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
        style={{ left: `${wipe}%` }}
      />
    </div>
  );
}

function PolaroidCompare({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Foto original" className="w-full rounded-md object-contain" />
        <figcaption className="mt-2 text-center text-xs text-[#d9cbb8]">Antes</figcaption>
      </figure>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="Foto con marco Polaroid y el estilo aplicado" className="w-full rounded-md object-contain" />
        <figcaption className="mt-2 text-center text-xs text-[#d9cbb8]">Después</figcaption>
      </figure>
    </div>
  );
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

async function bitmapToCanvas(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.drawImage(bitmap, 0, 0);
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
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
  link.download = `estilos-camara-${FILE_SLUG[result.style]}.${kind === "png" ? "png" : "jpg"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
