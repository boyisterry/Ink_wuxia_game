import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const dir = path.join(root, "tmp", "s03-guides");
const width = 1672;
const height = 941;

const architecture = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#00ff00"/>
  <g fill="#9b9182" stroke="#171713" stroke-width="8">
    <path d="M0 540H240V632H0Z"/>
    <path d="M180 620L540 620L900 600L1260 580V660H180Z"/>
    <path d="M180 620L540 420H1260V580L900 600L540 620Z" fill="#b0a898" opacity=".75"/>
    <rect x="620" y="492" width="240" height="26"/>
    <rect x="1120" y="442" width="220" height="26"/>
    <rect x="1260" y="360" width="300" height="210" fill="#756f61" fill-opacity=".55"/>
    <path d="M1230 376Q1410 270 1590 376Z"/>
  </g>
  <g stroke="#171713" stroke-width="10" fill="none">
    <path d="M30 540V632M90 540V632M150 540V632M210 540V632"/>
    <path d="M1285 570V380M1535 570V380M1260 425H1560M1260 500H1560"/>
    <path d="M300 590L1120 500M360 620L1180 530" opacity=".65"/>
  </g>
</svg>`;

const decoration = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#ff00ff"/>
  <g stroke="#171713" fill="none" stroke-linecap="round">
    <path d="M160 620Q145 475 190 330M230 620Q240 490 218 390M520 610Q505 495 548 380M980 590Q960 470 1012 350M1430 570Q1400 400 1450 250M1510 570Q1518 410 1490 300" stroke-width="12"/>
    <path d="M180 410l-95-48m105 90l100-65M535 455l-92-40m102 8l88-70M1000 430l-86-54m92 12l85-68M1440 330l-105-55m110 95l110-68" stroke-width="7"/>
  </g>
  <g fill="#2a2924" stroke="#171713" stroke-width="6">
    <rect x="1040" y="515" width="70" height="62"/><path d="M1028 515h94l-18-28h-58Z"/>
    <rect x="1320" y="492" width="45" height="78"/><path d="M1300 492h85"/>
  </g>
</svg>`;

await sharp(Buffer.from(architecture)).png().toFile(path.join(dir, "20-architecture-guide.png"));
await sharp(Buffer.from(decoration)).png().toFile(path.join(dir, "30-decoration-guide.png"));
console.log(dir);
