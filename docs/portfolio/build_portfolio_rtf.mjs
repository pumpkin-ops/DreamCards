import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "D:/新建文件夹/dreamcards/docs/portfolio";
const rendered = path.join(root, "generated/rendered");
const output = path.join(root, "generated/DreamCards_Portfolio.rtf");

const parts = [
  String.raw`{\rtf1\ansi\deff0\landscape\paperw16838\paperh11906\margl300\margr300\margt220\margb220`,
];

for (let i = 1; i <= 18; i += 1) {
  const number = String(i).padStart(2, "0");
  const image = await sharp(path.join(rendered, `page-${number}.png`))
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toBuffer();
  parts.push(
    String.raw`{\pard\sl0\slmult0\sa0\sb0{\pict\jpegblip\picw1123\pich794\picwgoal16238\pichgoal11466 ` +
      image.toString("hex") +
      String.raw`}\par}`,
  );
  if (i < 18) parts.push(String.raw`\page`);
}

parts.push("}");
await fs.writeFile(output, parts.join(""));
console.log(output);
