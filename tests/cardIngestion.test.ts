import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { localDreamCardStyle } from "../backend/services/cardIngestionService.js";

test("local DreamCards fallback produces a portrait WebP card", async () => {
  const source = await sharp({
    create: {
      width: 480,
      height: 480,
      channels: 3,
      background: { r: 82, g: 118, b: 144 }
    }
  })
    .png()
    .toBuffer();

  const styled = await localDreamCardStyle(source);
  const metadata = await sharp(styled).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 768);
  assert.equal(metadata.height, 1024);
});
