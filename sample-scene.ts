const SAMPLE_WIDTH = 1200;
const SAMPLE_HEIGHT = 900;

export function paintSampleScene(context: CanvasRenderingContext2D, width = SAMPLE_WIDTH, height = SAMPLE_HEIGHT) {
  const sx = width / SAMPLE_WIDTH;
  const sy = height / SAMPLE_HEIGHT;
  const x = (value: number) => value * sx;
  const y = (value: number) => value * sy;

  const wall = context.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, "#e4d2b8");
  wall.addColorStop(1, "#b48962");
  context.fillStyle = wall;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#f3ecdf";
  context.fillRect(x(64), y(48), x(392), y(500));
  const sky = context.createLinearGradient(0, y(64), 0, y(520));
  sky.addColorStop(0, "#6eaddc");
  sky.addColorStop(0.55, "#b7d7ee");
  sky.addColorStop(1, "#f2e3c4");
  context.fillStyle = sky;
  context.fillRect(x(84), y(68), x(352), y(460));
  context.fillStyle = "#f7f1e6";
  context.fillRect(x(246), y(68), x(14), y(460));
  context.fillRect(x(84), y(286), x(352), y(14));

  const daylight = context.createRadialGradient(x(250), y(280), x(20), x(430), y(360), x(560));
  daylight.addColorStop(0, "rgba(255, 244, 214, 0.55)");
  daylight.addColorStop(1, "rgba(255, 244, 214, 0)");
  context.fillStyle = daylight;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#6d412c";
  context.beginPath();
  context.moveTo(0, y(630));
  context.lineTo(width, y(586));
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.fill();
  context.strokeStyle = "rgba(255, 214, 170, 0.16)";
  context.lineWidth = Math.max(1, x(2));
  for (let line = 0; line < 9; line++) {
    context.beginPath();
    context.moveTo(0, y(660 + line * 26));
    context.lineTo(width, y(616 + line * 26));
    context.stroke();
  }

  context.fillStyle = "rgba(48, 24, 12, 0.22)";
  context.beginPath();
  context.ellipse(x(430), y(760), x(250), y(28), -0.08, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(x(300), y(700));
  context.rotate(-0.12);
  context.fillStyle = "#e7b194";
  context.beginPath();
  context.ellipse(0, 0, x(150), y(62), 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.18)";
  context.beginPath();
  context.ellipse(x(-30), y(-16), x(70), y(18), -0.4, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.translate(x(620), y(690));
  context.rotate(-0.06);
  context.fillStyle = "#9a2e28";
  roundRect(context, 0, 0, x(230), y(132), x(6));
  context.fill();
  context.fillStyle = "#f0ddc0";
  context.fillRect(x(14), y(12), x(202), y(18));
  context.fillStyle = "#6e1d1a";
  context.fillRect(0, y(18), x(16), y(114));
  context.restore();

  const orange = context.createRadialGradient(x(500), y(700), x(6), x(530), y(724), x(52));
  orange.addColorStop(0, "#ffc56a");
  orange.addColorStop(1, "#e06a12");
  context.fillStyle = orange;
  context.beginPath();
  context.arc(x(530), y(724), x(48), 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#6a8f3a";
  context.lineWidth = Math.max(2, x(3));
  context.beginPath();
  context.moveTo(x(530), y(678));
  context.quadraticCurveTo(x(548), y(664), x(556), y(676));
  context.stroke();

  const lemon = context.createRadialGradient(x(760), y(760), x(4), x(780), y(770), x(40));
  lemon.addColorStop(0, "#fff1a8");
  lemon.addColorStop(1, "#e2b423");
  context.fillStyle = lemon;
  context.beginPath();
  context.ellipse(x(786), y(768), x(34), y(28), 0.4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#1f6a52";
  roundRect(context, x(900), y(600), x(54), y(150), x(8));
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.22)";
  context.fillRect(x(912), y(612), x(8), y(120));
  context.fillStyle = "#163e32";
  context.fillRect(x(914), y(584), x(26), y(22));

  context.fillStyle = "#f4f0e8";
  roundRect(context, x(820), y(630), x(78), y(96), x(8));
  context.fill();
  context.fillStyle = "#3d7ea6";
  context.fillRect(x(820), y(662), x(78), y(16));
  context.strokeStyle = "#f4f0e8";
  context.lineWidth = Math.max(6, x(8));
  context.beginPath();
  context.arc(x(902), y(676), x(22), -1.1, 1.1);
  context.stroke();
  context.fillStyle = "rgba(255,255,255,0.55)";
  context.beginPath();
  context.ellipse(x(848), y(652), x(10), y(6), -0.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#b8613a";
  context.beginPath();
  context.moveTo(x(150), y(760));
  context.lineTo(x(250), y(760));
  context.lineTo(x(236), y(640));
  context.lineTo(x(164), y(640));
  context.closePath();
  context.fill();
  context.fillStyle = "#8d4528";
  context.fillRect(x(156), y(628), x(88), y(18));

  const leaf = (px: number, py: number, rx: number, ry: number, rotation: number, color: string) => {
    context.save();
    context.translate(x(px), y(py));
    context.rotate(rotation);
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(0, 0, x(rx), y(ry), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };
  leaf(200, 560, 70, 28, -0.8, "#2f6b3a");
  leaf(168, 520, 64, 24, -0.2, "#3e8a48");
  leaf(230, 500, 72, 26, 0.7, "#245c34");
  leaf(196, 470, 54, 20, -1.1, "#4c9a52");
  leaf(150, 548, 48, 18, 0.4, "#1e4d30");
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
