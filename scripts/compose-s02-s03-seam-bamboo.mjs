import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sharedDir = path.join(root, "local-art-source/runtime-originals/assets/maps/gate/shared");
const source = path.join(sharedDir, "s01-s02-seam-bamboo.png");
const output = path.join(sharedDir, "s02-s03-seam-bamboo-world.png");

// One continuous transparent decoration asset.  Its centre (X=622) sits on
// the S02/S03 world seam, so both screens crop the exact same bamboo cluster.
await sharp(source)
  .resize(1244, 700, { fit: "fill", kernel: sharp.kernel.lanczos3 })
  .flop()
  .greyscale()
  .png()
  .toFile(output);

console.log("S02/S03 seam bamboo world asset exported at 1244x700.");
