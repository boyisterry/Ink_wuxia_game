import sharp from "sharp";

export async function buildMirroredFoundationTexture(source, tileWidth, targetWidth, targetHeight) {
  const tile = await sharp(source)
    .resize(tileWidth, targetHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const flippedTile = await sharp(tile).flop().png().toBuffer();
  const composites = [];
  for (let left = 0, index = 0; left < targetWidth; left += tileWidth, index += 1) {
    const visibleWidth = Math.min(tileWidth, targetWidth - left);
    const input = index % 2 === 0 ? tile : flippedTile;
    composites.push({
      input: visibleWidth === tileWidth
        ? input
        : await sharp(input).extract({ left: 0, top: 0, width: visibleWidth, height: targetHeight }).png().toBuffer(),
      left,
      top: 0,
    });
  }
  return sharp({
    create: { width: targetWidth, height: targetHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites).png().toBuffer();
}
