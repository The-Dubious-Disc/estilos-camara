export const MAX_EDGE = 1600;

export const STYLES = [
  {
    id: "seventies",
    name: "Cámara de los 70s",
    description: "Color cálido, negros velados, grano, viñeta y un roce de luz de carrete.",
  },
  {
    id: "polaroid",
    name: "Polaroid 90s",
    description: "Colores pastel, marco blanco y la fecha de hoy escrita a mano.",
  },
  {
    id: "digicam",
    name: "Cámara digital 2000s",
    description: "Flash directo, balance frío, ruido de sensor y la fecha de hoy en naranja.",
  },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

export type AnyCanvas = {
  width: number;
  height: number;
  getContext(
    contextId: "2d",
    options?: { willReadFrequently?: boolean },
  ): CanvasRenderingContext2D | null;
};

export type CanvasFactory = (width: number, height: number) => AnyCanvas;

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

type Rgb = [number, number, number];

export type RenderOptions = {
  style: StyleId;
  handFont: string;
  now?: Date;
  maxEdge?: number;
  factory?: CanvasFactory;
  onProgress?: (message: string) => void;
};

export function fitSize(width: number, height: number, maxEdge: number) {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function renderStyledPhoto(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: RenderOptions,
): Promise<AnyCanvas> {
  const factory = options.factory ?? browserFactory;
  const maxEdge = options.maxEdge ?? MAX_EDGE;
  const fitted = fitSize(sourceWidth, sourceHeight, maxEdge);
  options.onProgress?.("Preparando la foto…");
  await yieldToMain();

  const photo = factory(fitted.width, fitted.height);
  const base = ctx2d(photo);
  base.imageSmoothingEnabled = true;
  base.imageSmoothingQuality = "high";
  base.drawImage(source, 0, 0, fitted.width, fitted.height);

  const snapshot = base.getImageData(0, 0, fitted.width, fitted.height);
  const seed = hashSamples(snapshot.data, styleSalt(options.style));

  options.onProgress?.("Aplicando el color…");
  await yieldToMain();

  if (options.style === "seventies") {
    mapPixels(snapshot.data, fitted.width, fitted.height, (r, g, b, x, y, out) =>
      gradeSeventies(r, g, b, x, y, out),
    );
  } else if (options.style === "polaroid") {
    mapPixels(snapshot.data, fitted.width, fitted.height, (r, g, b, x, y, out) =>
      gradePolaroid(r, g, b, x, y, out),
    );
  } else {
    mapPixels(snapshot.data, fitted.width, fitted.height, (r, g, b, x, y, out) =>
      gradeDigicam(r, g, b, x, y, fitted.width, fitted.height, out),
    );
    sharpen(snapshot.data, fitted.width, fitted.height, 0.42);
    softenChroma(snapshot.data, fitted.width, fitted.height, 0.62);
    addChromaNoise(snapshot.data, fitted.width, fitted.height, seed);
  }

  base.putImageData(snapshot, 0, 0);

  options.onProgress?.("Añadiendo textura…");
  await yieldToMain();

  const now = options.now ?? new Date();

  if (options.style === "seventies") {
    blendBlur(base, photo, factory, 0.34, 1, 0.18, "source-over");
    blendBlur(base, photo, factory, 0.18, 2, 0.72, "screen", true);
    paintLightLeak(base, fitted.width, fitted.height, seed);
    paintVignette(base, fitted.width, fitted.height, "#6a4330", 0.42);
    paintScratches(base, fitted.width, fitted.height, seed);
    return photo;
  }

  if (options.style === "polaroid") {
    blendBlur(base, photo, factory, 0.4, 1, 0.12, "source-over");
    paintWhiteEdge(base, fitted.width, fitted.height);
    options.onProgress?.("Montando el marco…");
    await yieldToMain();
    return framePolaroid(photo, factory, polaroidDate(now), options.handFont, seed);
  }

  paintVignette(base, fitted.width, fitted.height, "#9aa8a4", 0.55);
  paintDigicamStamp(base, fitted.width, fitted.height, now);
  return photo;
}

/** Local calendar date. The 70s print has no stamp. */
export function polaroidDate(now: Date) {
  const year = String(now.getFullYear() % 100).padStart(2, "0");
  return `${now.getDate()} ${MONTHS[now.getMonth()]} '${year}`;
}

export function digicamDate(now: Date) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}.${month}.${day}`;
}

export function stampLabel(style: StyleId, now: Date) {
  if (style === "digicam") return digicamDate(now);
  if (style === "polaroid") return polaroidDate(now);
  return "";
}

function browserFactory(width: number, height: number): AnyCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function ctx2d(canvas: AnyCanvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No se pudo preparar el lienzo.");
  return context;
}

function yieldToMain() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function styleSalt(style: StyleId) {
  if (style === "seventies") return 1974;
  if (style === "polaroid") return 1996;
  return 2004;
}

function hashSamples(data: Uint8ClampedArray, salt: number) {
  let hash = salt >>> 0;
  const step = Math.max(4, Math.floor(data.length / 80));
  for (let index = 0; index < data.length; index += step) {
    hash = Math.imul(hash ^ data[index], 16777619);
  }
  return hash >>> 0;
}

function mapPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  grade: (
    r: number,
    g: number,
    b: number,
    x: number,
    y: number,
    out: Rgb,
  ) => void,
) {
  const out: Rgb = [0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      grade(data[index] / 255, data[index + 1] / 255, data[index + 2] / 255, x, y, out);
      data[index] = clamp255(out[0] * 255);
      data[index + 1] = clamp255(out[1] * 255);
      data[index + 2] = clamp255(out[2] * 255);
    }
  }
}

function gradeSeventies(r: number, g: number, b: number, x: number, y: number, out: Rgb) {
  let red = r * 0.9 + 0.06;
  let green = g * 0.86 + 0.05;
  let blue = b * 0.74 + 0.055;

  red = red * 1.1 + green * 0.04;
  green = green * 0.94 + red * 0.05;
  blue = blue * 0.82;

  red = (red - 0.5) * 0.78 + 0.54;
  green = (green - 0.5) * 0.76 + 0.52;
  blue = (blue - 0.5) * 0.74 + 0.5;

  let luma = luminance(red, green, blue);
  const faded = mixToward(red, green, blue, luma, 0.7);
  red = faded[0];
  green = faded[1];
  blue = faded[2];

  const shadow = 1 - smoothstep(0.02, 0.42, luma);
  red += 0.045 * shadow;
  green += 0.02 * shadow;

  const highlight = smoothstep(0.68, 1, luma);
  red = red * (1 - highlight) + (red * 0.9 + 0.08) * highlight;
  green = green * (1 - highlight) + (green * 0.86 + 0.07) * highlight;
  blue = blue * (1 - highlight) + (blue * 0.78 + 0.05) * highlight;

  luma = luminance(red, green, blue);
  const grain = (hash01(x, y, 70) - 0.5) * (0.05 + (1 - luma) * 0.035);
  out[0] = clamp01(red + grain);
  out[1] = clamp01(green + grain * 0.95);
  out[2] = clamp01(blue + grain * 0.85);
}

function gradePolaroid(r: number, g: number, b: number, x: number, y: number, out: Rgb) {
  let red = 1 - Math.exp(-1.28 * (r * 1.05 + 0.02));
  let green = 1 - Math.exp(-1.22 * (g * 1.03 + 0.02));
  let blue = 1 - Math.exp(-1.14 * (b * 1.01 + 0.03));

  let luma = luminance(red, green, blue);
  const pastel = mixToward(red, green, blue, luma, 0.55);
  red = pastel[0] * 0.86 + 0.09;
  green = pastel[1] * 0.86 + 0.095;
  blue = pastel[2] * 0.86 + 0.1;

  luma = luminance(red, green, blue);
  const shadow = 1 - smoothstep(0, 0.5, luma);
  const highlight = smoothstep(0.42, 1, luma);
  const mid = Math.sin(clamp01(luma) * Math.PI);
  red += -0.015 * shadow + 0.06 * highlight + 0.035 * mid;
  green += 0.03 * shadow + 0.04 * highlight;
  blue += 0.055 * shadow - 0.045 * highlight + 0.012 * mid;

  red = (red - 0.5) * 0.86 + 0.54;
  green = (green - 0.5) * 0.86 + 0.53;
  blue = (blue - 0.5) * 0.84 + 0.53;

  luma = luminance(red, green, blue);
  const grain = (hash01(x, y, 96) - 0.5) * (0.028 + (1 - luma) * 0.012);
  out[0] = clamp01(red + grain);
  out[1] = clamp01(green + grain);
  out[2] = clamp01(blue + grain);
}

function gradeDigicam(
  r: number,
  g: number,
  b: number,
  x: number,
  y: number,
  width: number,
  height: number,
  out: Rgb,
) {
  let red = r * 0.94 + 0.015;
  let green = g * 1.08;
  let blue = b * 1.06;

  const dx = (x + 0.5) / width - 0.5;
  const dy = (y + 0.5) / height - 0.4;
  const falloff = Math.exp(-(dx * dx + dy * dy) * 2.6);
  const exposure = 0.86 + 0.28 * falloff;
  red *= exposure;
  green *= exposure;
  blue *= exposure;

  const hot = falloff * falloff * falloff * 0.16;
  red = red + (1 - red) * hot;
  green = green + (1 - green) * hot * 0.92;
  blue = blue + (1 - blue) * hot * 0.85;

  red = contrast(red, 1.36, 0.45);
  green = contrast(green, 1.36, 0.45);
  blue = contrast(blue, 1.34, 0.45);

  let luma = luminance(red, green, blue);
  if (luma < 0.18) {
    const toe = 0.45 + 0.55 * (luma / 0.18);
    red *= toe;
    green *= toe;
    blue *= toe;
    luma *= toe;
  }

  const shadow = 1 - smoothstep(0.04, 0.38, luma);
  red -= 0.03 * shadow;
  green += 0.045 * shadow;
  blue += 0.02 * shadow;

  const saturated = mixToward(red, green, blue, luma, 1.26);
  out[0] = clamp01(saturated[0]);
  out[1] = clamp01(saturated[1]);
  out[2] = clamp01(saturated[2]);
}

function sharpen(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const source = new Uint8ClampedArray(data);
  const center = 1 + 4 * amount;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      const left = index - 4;
      const right = index + 4;
      const up = index - width * 4;
      const down = index + width * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value =
          source[index + channel] * center -
          amount *
            (source[left + channel] +
              source[right + channel] +
              source[up + channel] +
              source[down + channel]);
        data[index + channel] = clamp255(value);
      }
    }
  }
}

function softenChroma(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const points: number[] = [];
      let cb = 0;
      let cr = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px >= width || py >= height) continue;
          const index = (py * width + px) * 4;
          const channels = rgb01(data, index);
          cb += chromaCb(channels[0], channels[1], channels[2]);
          cr += chromaCr(channels[0], channels[1], channels[2]);
          points.push(index);
        }
      }
      if (points.length === 0) continue;
      cb /= points.length;
      cr /= points.length;
      for (const index of points) {
        const channels = rgb01(data, index);
        const yLuma = luminance(channels[0], channels[1], channels[2]);
        const mixedCb =
          chromaCb(channels[0], channels[1], channels[2]) * (1 - amount) + cb * amount;
        const mixedCr =
          chromaCr(channels[0], channels[1], channels[2]) * (1 - amount) + cr * amount;
        const rgb = ycbcrToRgb(yLuma, mixedCb, mixedCr);
        data[index] = clamp255(rgb[0] * 255);
        data[index + 1] = clamp255(rgb[1] * 255);
        data[index + 2] = clamp255(rgb[2] * 255);
      }
    }
  }
}

function addChromaNoise(data: Uint8ClampedArray, width: number, height: number, seed: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const luma =
        (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
      const amp = luma < 0.45 ? 18 : 9;
      data[index] = clamp255(data[index] + (hash01(x, y, seed + 1) - 0.5) * amp * 2);
      data[index + 1] = clamp255(data[index + 1] + (hash01(x, y, seed + 2) - 0.5) * amp * 2);
      data[index + 2] = clamp255(data[index + 2] + (hash01(x, y, seed + 3) - 0.5) * amp * 1.7);
    }
  }
}

function blendBlur(
  context: CanvasRenderingContext2D,
  source: AnyCanvas,
  factory: CanvasFactory,
  scale: number,
  radius: number,
  alpha: number,
  operation: GlobalCompositeOperation,
  highlight = false,
) {
  const layer = blurredLayer(source, factory, scale, radius, highlight);
  context.save();
  context.globalCompositeOperation = operation;
  context.globalAlpha = alpha;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(layer as CanvasImageSource, 0, 0, source.width, source.height);
  context.restore();
}

function blurredLayer(
  source: AnyCanvas,
  factory: CanvasFactory,
  scale: number,
  radius: number,
  highlight: boolean,
) {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const small = factory(width, height);
  const context = ctx2d(small);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  if (highlight) {
    for (let index = 0; index < data.length; index += 4) {
      const luma = (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255;
      const mask = smoothstep(0.55, 0.94, luma);
      data[index] *= mask;
      data[index + 1] *= mask;
      data[index + 2] *= mask;
    }
  }
  boxBlur(data, width, height, radius);
  boxBlur(data, width, height, radius);
  context.putImageData(image, 0, 0);
  return small;
}

function paintLightLeak(context: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const random = mulberry32(seed);
  const corners = [
    [width * 0.02, height * 0.04],
    [width * 0.98, 0],
    [0, height],
    [width, height * 0.2],
  ];
  const [cx, cy] = corners[Math.floor(random() * corners.length)];
  const radius = Math.max(width, height) * (0.48 + random() * 0.16);
  const gradient = context.createRadialGradient(cx, cy, radius * 0.02, cx, cy, radius);
  gradient.addColorStop(0, "rgba(255, 168, 74, 0.5)");
  gradient.addColorStop(0.28, "rgba(255, 96, 48, 0.16)");
  gradient.addColorStop(1, "rgba(255, 80, 40, 0)");
  context.save();
  context.globalCompositeOperation = "screen";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function paintVignette(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  edge: string,
  innerRatio: number,
) {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * innerRatio,
    width / 2,
    height * 0.5,
    Math.hypot(width, height) * 0.58,
  );
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, edge);
  context.save();
  context.globalCompositeOperation = "multiply";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function paintWhiteEdge(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.42,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.62,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(255, 248, 238, 0.38)");
  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function paintScratches(context: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const random = mulberry32(seed ^ 0x9e3779b9);
  const count = 4 + Math.floor(random() * 3);
  context.save();
  context.lineCap = "round";
  for (let index = 0; index < count; index++) {
    const x = random() * width;
    const y = random() * height * 0.75;
    const length = height * (0.12 + random() * 0.5);
    const light = random() > 0.45;
    context.strokeStyle = light
      ? `rgba(255, 246, 226, ${0.16 + random() * 0.28})`
      : `rgba(48, 32, 22, ${0.1 + random() * 0.16})`;
    context.lineWidth = random() > 0.82 ? 1.6 : 1;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      x + (random() - 0.5) * 16,
      y + length * 0.5,
      x + (random() - 0.5) * 10,
      y + length,
    );
    context.stroke();
  }
  for (let index = 0; index < 16; index++) {
    const light = random() > 0.35;
    context.fillStyle = light
      ? `rgba(255, 250, 236, ${0.18 + random() * 0.35})`
      : `rgba(40, 28, 18, ${0.12 + random() * 0.2})`;
    context.beginPath();
    context.ellipse(
      random() * width,
      random() * height,
      0.4 + random() * 1.7,
      0.4 + random() * 1.7,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function framePolaroid(
  photo: AnyCanvas,
  factory: CanvasFactory,
  date: string,
  handFont: string,
  seed: number,
) {
  const side = Math.max(18, Math.round(photo.width * 0.058));
  const top = Math.max(16, Math.round(photo.width * 0.052));
  const bottom = Math.max(54, Math.round(photo.width * 0.2));
  const width = photo.width + side * 2;
  const height = photo.height + top + bottom;
  const framed = factory(width, height);
  const context = ctx2d(framed);
  const paper = context.createLinearGradient(0, 0, 0, height);
  paper.addColorStop(0, "#f6f2ea");
  paper.addColorStop(1, "#ebe3d4");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  context.drawImage(photo as CanvasImageSource, side, top, photo.width, photo.height);
  context.strokeStyle = "rgba(70, 48, 28, 0.2)";
  context.lineWidth = 1;
  context.strokeRect(side + 0.5, top + 0.5, photo.width - 1, photo.height - 1);

  const random = mulberry32(seed);
  const size = Math.max(22, Math.min(Math.round(photo.width * 0.064), bottom * 0.46));
  const family = handFont || "cursive";
  context.font = `500 ${size}px ${family}`;
  context.fillStyle = "rgba(52, 40, 32, 0.84)";
  context.textBaseline = "middle";
  context.save();
  context.translate(side + photo.width * (0.05 + random() * 0.04), top + photo.height + bottom * 0.52);
  context.rotate(-0.045 + random() * 0.03);
  context.fillText(date, 0, 0);
  context.restore();
  return framed;
}

function paintDigicamStamp(context: CanvasRenderingContext2D, width: number, height: number, now: Date) {
  const label = digicamDate(now);
  let scale = Math.max(2, Math.round(width / 280));
  const margin = Math.round(Math.min(width, height) * 0.04);
  while (scale > 2 && bitmapWidth(label, scale) > width - margin * 2) {
    scale -= 1;
  }
  const textWidth = bitmapWidth(label, scale);
  const textHeight = 7 * scale;
  const x = width - margin - textWidth;
  const y = height - margin - textHeight;
  drawBitmapText(context, label, x, y, scale, "#ff8a1e");
}

function bitmapWidth(text: string, scale: number) {
  return text.length * 6 * scale - scale;
}

function drawBitmapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: string,
) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.75)";
  drawGlyphs(context, text, x + Math.max(1, scale * 0.6), y + Math.max(1, scale * 0.6), scale);
  context.fillStyle = color;
  drawGlyphs(context, text, x, y, scale);
  context.restore();
}

function drawGlyphs(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  scale: number,
) {
  let cursor = x;
  for (const character of text) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "];
    for (let row = 0; row < glyph.length; row++) {
      const line = glyph[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === "1") {
          context.fillRect(cursor + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function boxBlur(data: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    let red = 0;
    let green = 0;
    let blue = 0;
    const row = y * width;
    for (let offset = -radius; offset <= radius; offset++) {
      const x = clampIndex(offset, width);
      const index = (row + x) * 4;
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
    }
    for (let x = 0; x < width; x++) {
      const index = (row + x) * 4;
      tmp[index] = red / windowSize;
      tmp[index + 1] = green / windowSize;
      tmp[index + 2] = blue / windowSize;
      tmp[index + 3] = 255;
      const outgoing = (row + clampIndex(x - radius, width)) * 4;
      const incoming = (row + clampIndex(x + radius + 1, width)) * 4;
      red += data[incoming] - data[outgoing];
      green += data[incoming + 1] - data[outgoing + 1];
      blue += data[incoming + 2] - data[outgoing + 2];
    }
  }

  for (let x = 0; x < width; x++) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const y = clampIndex(offset, height);
      const index = (y * width + x) * 4;
      red += tmp[index];
      green += tmp[index + 1];
      blue += tmp[index + 2];
    }
    for (let y = 0; y < height; y++) {
      const index = (y * width + x) * 4;
      data[index] = red / windowSize;
      data[index + 1] = green / windowSize;
      data[index + 2] = blue / windowSize;
      data[index + 3] = 255;
      const outgoing = (clampIndex(y - radius, height) * width + x) * 4;
      const incoming = (clampIndex(y + radius + 1, height) * width + x) * 4;
      red += tmp[incoming] - tmp[outgoing];
      green += tmp[incoming + 1] - tmp[outgoing + 1];
      blue += tmp[incoming + 2] - tmp[outgoing + 2];
    }
  }
}

function clampIndex(value: number, size: number) {
  if (value < 0) return 0;
  if (value >= size) return size - 1;
  return value;
}

function mixToward(r: number, g: number, b: number, luma: number, saturation: number): Rgb {
  return [luma + (r - luma) * saturation, luma + (g - luma) * saturation, luma + (b - luma) * saturation];
}

function contrast(value: number, amount: number, pivot: number) {
  return clamp01((value - pivot) * amount + pivot);
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function chromaCb(r: number, g: number, b: number) {
  return -0.168736 * r - 0.331264 * g + 0.5 * b;
}

function chromaCr(r: number, g: number, b: number) {
  return 0.5 * r - 0.418688 * g - 0.081312 * b;
}

function ycbcrToRgb(y: number, cb: number, cr: number): Rgb {
  return [y + 1.402 * cr, y - 0.344136 * cb - 0.714136 * cr, y + 1.772 * cb];
}

function rgb01(data: Uint8ClampedArray, index: number): Rgb {
  return [data[index] / 255, data[index + 1] / 255, data[index + 2] / 255];
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clamp255(value: number) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function hash01(x: number, y: number, seed: number) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1440662683);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
