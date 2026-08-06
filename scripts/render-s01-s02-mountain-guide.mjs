import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const output = path.join(root, "tmp", "s01-s02-mountain-guide.png");
const width = 3344;
const height = 941;

// Composition-only guide for one uninterrupted S01–S02 panorama.
// The lower field remains deliberately quiet so gameplay architecture and the
// Layer 5 foundation keep their silhouettes after multiply compositing.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eee8d8"/>
      <stop offset="1" stop-color="#f5efe2"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity=".92"/>
      <stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="3344" height="941" fill="url(#paper)"/>

  <!-- Farthest mist ridge; intentionally crosses the screen join at x=1672. -->
  <path d="M0 476L180 410L350 438L520 352L700 420L900 330L1090 405L1270 342L1460 414L1660 360L1830 408L2040 320L2220 400L2420 346L2610 414L2800 328L3030 405L3190 366L3344 420V690H0Z"
        fill="#c9c7bd" opacity=".42"/>

  <!-- Tall primary karst masses. Peaks sit off-centre to avoid a mirrored diptych. -->
  <path d="M80 604L210 518L318 314L398 160L455 376L532 262L610 510L720 588Z"
        fill="#707471" opacity=".58"/>
  <path d="M520 622L690 506L782 238L856 92L914 356L1002 194L1088 486L1204 612Z"
        fill="#686d69" opacity=".66"/>
  <path d="M980 626L1160 520L1268 336L1340 196L1402 402L1498 282L1582 510L1740 618Z"
        fill="#7c807b" opacity=".55"/>
  <path d="M1500 632L1692 516L1810 274L1898 126L1970 390L2064 236L2160 484L2318 620Z"
        fill="#676c68" opacity=".63"/>
  <path d="M2110 632L2290 522L2400 330L2476 210L2536 406L2638 282L2738 514L2890 624Z"
        fill="#767b77" opacity=".55"/>
  <path d="M2690 638L2860 530L2964 286L3032 146L3090 404L3170 286L3250 522L3344 594V638Z"
        fill="#696e6a" opacity=".61"/>

  <!-- Broken vertical ink fissures suggest the requested dry-brush cliff rhythm. -->
  <g fill="none" stroke="#3f4743" stroke-width="13" stroke-linecap="round" opacity=".45">
    <path d="M402 208L390 342M438 282L424 434M848 140L832 302M892 230L876 450M1008 250L978 444"/>
    <path d="M1336 254L1318 430M1398 332L1378 506M1892 184L1872 360M1950 296L1926 492"/>
    <path d="M2470 262L2454 430M2530 348L2508 514M3028 214L3008 382M3082 310L3060 496"/>
  </g>

  <!-- Pale atmosphere clears the lower 42% for Layer 2–5 silhouettes. -->
  <rect x="0" y="525" width="3344" height="290" fill="url(#fade)" opacity=".82"/>
  <rect x="0" y="720" width="3344" height="221" fill="#f4eee1" opacity=".94"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(output);
console.log(output);
