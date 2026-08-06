import sharp from "sharp";

// Shared paper-white target for Gate S01-S03.  Keeping the red channel a
// little lower than green/blue removes the former yellow cast while leaving
// dense ink close to neutral black.
export const COOL_PAPER_TARGET = [198, 200, 202];

const measurePaperWhite = async (input, width, height) => {
  const sampleHeight = Math.min(height, 500);
  const { data, info } = await sharp(input)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .extract({ left: 0, top: 0, width, height: sampleHeight })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const candidates = [];

  for (let y = 0; y < sampleHeight; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const index = (y * width + x) * info.channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = .2126 * r + .7152 * g + .0722 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance > 150 && chroma < 45) candidates.push({ luminance, r, g, b });
    }
  }

  candidates.sort((a, b) => b.luminance - a.luminance);
  const paperPixels = candidates.slice(0, Math.max(1, Math.floor(candidates.length * .35)));
  return ["r", "g", "b"].map((channel) =>
    paperPixels.reduce((sum, pixel) => sum + pixel[channel], 0) / paperPixels.length
  );
};

export const gradeCoolInkBackground = async (input, width, height) => {
  const resized = await sharp(input)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const measured = await measurePaperWhite(resized, width, height);
  const gains = COOL_PAPER_TARGET.map((target, channel) => target / measured[channel]);
  const buffer = await sharp(resized)
    .linear(gains, [0, 0, 0])
    .png()
    .toBuffer();

  return { buffer, gains, measured };
};
