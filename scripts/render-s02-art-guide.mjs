import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const output = path.join(root, "tmp", "s02-art-guide.png");
const width = 1672;
const height = 941;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="1672" height="941" fill="#eee8d8"/>
  <path d="M0 420L140 360L280 430L460 260L640 400L820 220L1040 360L1260 240L1480 350L1672 420V760H0Z" fill="#b8bdba" opacity=".55"/>
  <g fill="#516a58" opacity=".46" stroke="#395044" stroke-width="5">
    <path d="M0 80L18 674H38L24 80Z"/>
    <path d="M12 130L76 95M15 170L92 145M20 220L86 205M22 280L96 250" fill="none" stroke-width="12"/>
    <path d="M600 400H980V674H600Z" fill="none" stroke-dasharray="12 12"/>
  </g>
  <g fill="#8d493f" fill-opacity=".32" stroke="#6e2926" stroke-width="7">
    <rect x="240" y="430" width="280" height="244"/>
    <path d="M210 430Q380 320 540 430Z"/>
    <rect x="780" y="390" width="340" height="256"/>
    <path d="M750 390Q950 270 1140 390Z"/>
    <path d="M1380 632V480H1672V632Z"/>
  </g>
  <g fill="none" stroke="#2c7185" stroke-width="10">
    <path d="M500 560H720M520 560V620M700 560V620"/>
    <path d="M260 540H510M820 505H1090"/>
    <path d="M1400 540H1640M1420 540V632M1600 540V632"/>
  </g>
  <path d="M0 674H720V660H900V646H1100V632H1672V941H0Z" fill="#171717"/>
  <path d="M0 674H720V660H900V646H1100V632H1672" fill="none" stroke="#f3c65c" stroke-width="10"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(output);
console.log(output);
