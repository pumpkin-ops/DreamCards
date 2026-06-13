import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import sharp from "sharp";

const portfolioDir = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(portfolioDir, "generated", "word-assets");
await fs.mkdir(assetDir, { recursive: true });

const COLORS = {
  navy: "17365D",
  blue: "2F5597",
  blueLight: "DCE6F1",
  bluePale: "EEF3F8",
  gray: "D9E1F2",
  grayLight: "F2F2F2",
  grayBorder: "B7C3D0",
  text: "252525",
  muted: "666666",
  white: "FFFFFF",
  greenPale: "E2F0D9",
  goldPale: "FFF2CC",
};

const FONT = {
  ascii: "Microsoft YaHei",
  hAnsi: "Microsoft YaHei",
  eastAsia: "微软雅黑",
  cs: "Microsoft YaHei",
};

const A4 = {
  width: 11906,
  height: 16838,
  margin: {
    top: 1134,
    right: 1276,
    bottom: 1134,
    left: 1276,
    header: 567,
    footer: 567,
    gutter: 0,
  },
};

const DOCS = [
  {
    source: "DreamCards_游戏设计文档.md",
    output: "DreamCards_游戏设计文档.docx",
    coverTitle: "DreamCards",
    coverSubtitle: "图片联想叙事桌游",
    coverType: "游戏设计文档",
    placeholderHeadings: new Map([
      ["5. 核心玩法流程", "核心玩法流程示意图 / 对局截图"],
      ["6.7 回合状态机", "回合状态机图"],
      ["8. 梦境集系统", "梦境集界面与作品策展示意"],
      ["9. 图鉴、收藏与梦境档案馆", "图鉴与梦境档案馆界面"],
      ["15. 长期循环", "UGC 内容长期循环图"],
    ]),
  },
  {
    source: "DreamCards_系统分析报告.md",
    output: "DreamCards_系统分析报告.docx",
    coverTitle: "DreamCards",
    coverSubtitle: "",
    coverType: "系统分析报告",
    placeholderHeadings: new Map([
      ["2.1 系统关系", "系统关系图"],
      ["3. 核心循环分析", "单局循环与长期循环关系图"],
      ["4. 状态机分析", "逐玩家异步状态机图"],
      ["5. 信息权限矩阵", "分阶段信息权限示意图"],
      ["6. AI 系统分析", "AI 行为流与局部降级图"],
    ]),
  },
];

const today = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replaceAll("/", "年")
  .replace(/年(\d{2})年/, "年$1月")
  .replace(/(\d{2})$/, "$1日");

const escXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function stripInlineMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/, "")
    .trim();
}

function inlineRuns(value, options = {}) {
  const runs = [];
  const text = value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let cursor = 0;
  for (const match of text.matchAll(tokenPattern)) {
    if (match.index > cursor) {
      runs.push(
        new TextRun({
          text: text.slice(cursor, match.index),
          font: FONT,
          size: options.size ?? 22,
          color: options.color ?? COLORS.text,
          bold: options.bold,
          italics: options.italics,
        }),
      );
    }
    const token = match[0];
    if (token.startsWith("**")) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          font: FONT,
          size: options.size ?? 22,
          color: options.color ?? COLORS.text,
          bold: true,
        }),
      );
    } else if (token.startsWith("`")) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: FONT,
          size: options.size ?? 22,
          color: COLORS.blue,
          shading: { type: ShadingType.CLEAR, fill: COLORS.grayLight },
        }),
      );
    } else {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: FONT,
          size: options.size ?? 22,
          color: options.color ?? COLORS.text,
          italics: true,
        }),
      );
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(cursor),
        font: FONT,
        size: options.size ?? 22,
        color: options.color ?? COLORS.text,
        bold: options.bold,
        italics: options.italics,
      }),
    );
  }
  return runs.length
    ? runs
    : [
        new TextRun({
          text,
          font: FONT,
          size: options.size ?? 22,
          color: options.color ?? COLORS.text,
        }),
      ];
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim() || /^---+$/.test(line.trim())) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const language = fence[1] || "text";
      const content = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        content.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", language, content: content.join("\n").trimEnd() });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: stripInlineMarkdown(heading[2]),
      });
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && index + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[index + 1])) {
      const rows = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(
          lines[index]
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
        index += 1;
      }
      if (rows.length >= 2) rows.splice(1, 1);
      blocks.push({ type: "table", rows });
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*>/.test(lines[index]) &&
      !/^\s*\|.*\|\s*$/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !/^---+$/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function isDiagramCode(content, language) {
  return (
    language === "mermaid" ||
    content.includes("↓") ||
    content.includes("→") ||
    content.includes("-->") ||
    content.includes("├─") ||
    content.includes("└─") ||
    (/玩家A|牌桌中心/.test(content) && content.split("\n").length >= 4)
  );
}

function extractDiagramLabels(content, language) {
  if (language === "mermaid") {
    const labels = [];
    for (const line of content.split("\n")) {
      if (/^(stateDiagram|flowchart)/.test(line.trim())) continue;
      for (const match of line.matchAll(/([A-Za-z_][\w]*)\[([^\]]+)\]/g)) {
        if (!labels.includes(match[2])) labels.push(match[2]);
      }
      const stateMatch = line.match(/^\s*([A-Za-z_][\w]*)\s+-->\s+([A-Za-z_][\w]*)(?::\s*(.+))?/);
      if (stateMatch) {
        for (const state of [stateMatch[1], stateMatch[2]]) {
          if (!labels.includes(state)) labels.push(state);
        }
      }
    }
    return labels;
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[↓→]+$/.test(line))
    .map((line) => line.replace(/^[├└]─\s*/, "").trim());
}

function wrapSvgText(text, maxChars = 18) {
  const clean = stripInlineMarkdown(text);
  const result = [];
  for (let offset = 0; offset < clean.length; offset += maxChars) {
    result.push(clean.slice(offset, offset + maxChars));
  }
  return result.length ? result : [""];
}

async function renderDiagram(content, language, name) {
  const labels = extractDiagramLabels(content, language);
  const width = 1400;
  const columns = labels.length > 6 ? 4 : labels.length > 3 ? 3 : 1;
  const rows = Math.ceil(labels.length / columns);
  const boxW = columns === 1 ? 720 : columns === 3 ? 350 : 285;
  const boxH = 132;
  const gapX = columns === 1 ? 0 : 55;
  const gapY = 85;
  const height = Math.max(420, 150 + rows * (boxH + gapY));
  const totalW = columns * boxW + (columns - 1) * gapX;
  const startX = (width - totalW) / 2;
  const startY = 70;

  const positions = labels.map((label, index) => {
    let row = Math.floor(index / columns);
    let col = index % columns;
    if (columns > 1 && row % 2 === 1) col = columns - 1 - col;
    return {
      label,
      x: startX + col * (boxW + gapX),
      y: startY + row * (boxH + gapY),
    };
  });

  const arrows = [];
  for (let i = 0; i < positions.length - 1; i += 1) {
    const a = positions[i];
    const b = positions[i + 1];
    const sameRow = Math.abs(a.y - b.y) < 5;
    const x1 = sameRow ? (a.x < b.x ? a.x + boxW : a.x) : a.x + boxW / 2;
    const y1 = sameRow ? a.y + boxH / 2 : a.y + boxH;
    const x2 = sameRow ? (a.x < b.x ? b.x : b.x + boxW) : b.x + boxW / 2;
    const y2 = sameRow ? b.y + boxH / 2 : b.y;
    arrows.push(`
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6E88A6" stroke-width="4" marker-end="url(#arrow)"/>
    `);
  }

  const boxes = positions
    .map(({ label, x, y }, index) => {
      const maxChars = columns === 1 ? 24 : columns === 3 ? 11 : 9;
      const lines = wrapSvgText(label, maxChars);
      const lineHeight = 31;
      const textStart = y + boxH / 2 - ((lines.length - 1) * lineHeight) / 2;
      return `
        <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="10" fill="${index % 2 ? "#EEF3F8" : "#DCE6F1"}" stroke="#2F5597" stroke-width="2"/>
        ${lines
          .map(
            (line, lineIndex) =>
              `<text x="${x + boxW / 2}" y="${textStart + lineIndex * lineHeight}" text-anchor="middle" dominant-baseline="middle" fill="#17365D" font-family="Microsoft YaHei, Microsoft YaHei UI, sans-serif" font-size="21" font-weight="600">${escXml(line)}</text>`,
          )
          .join("")}
      `;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#6E88A6"/>
        </marker>
      </defs>
      <rect width="${width}" height="${height}" fill="#FFFFFF"/>
      ${arrows.join("")}
      ${boxes}
    </svg>
  `;

  const output = path.join(assetDir, `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(output);
  const metadata = await sharp(output).metadata();
  return { output, width: metadata.width, height: metadata.height };
}

function normalParagraph(text, options = {}) {
  return new Paragraph({
    children: inlineRuns(text, options),
    alignment: options.alignment ?? AlignmentType.JUSTIFIED,
    spacing: {
      line: 360,
      before: options.before ?? 0,
      after: options.after ?? 150,
    },
    indent: options.indent,
    keepLines: true,
    keepNext: options.keepNext,
    shading: options.shading,
    border: options.border,
  });
}

function quoteTable(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      left: { style: BorderStyle.SINGLE, size: 18, color: COLORS.blue },
      right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLORS.bluePale },
            margins: { top: 180, bottom: 180, left: 260, right: 260 },
            children: lines.map((line) =>
              normalParagraph(line, {
                color: COLORS.navy,
                size: 21,
                after: 60,
              }),
            ),
          }),
        ],
      }),
    ],
  });
}

function placeholderTable(label) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.DASHED, size: 8, color: COLORS.grayBorder },
      bottom: { style: BorderStyle.DASHED, size: 8, color: COLORS.grayBorder },
      left: { style: BorderStyle.DASHED, size: 8, color: COLORS.grayBorder },
      right: { style: BorderStyle.DASHED, size: 8, color: COLORS.grayBorder },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    rows: [
      new TableRow({
        height: { value: 1080, rule: "atLeast" },
        cantSplit: true,
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            shading: { type: ShadingType.CLEAR, fill: "FAFBFC" },
            margins: { top: 180, bottom: 180, left: 220, right: 220 },
            children: [
              normalParagraph(`【插图位置：${label}】`, {
                alignment: AlignmentType.CENTER,
                color: "7A8794",
                size: 20,
                after: 0,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function markdownTable(rows) {
  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, () => Math.floor(100 / columnCount));
  widths[widths.length - 1] += 100 - widths.reduce((sum, value) => sum + value, 0);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    columnWidths: widths.map((value) => Math.round((A4.width - A4.margin.left - A4.margin.right) * (value / 100))),
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.grayBorder },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.grayBorder },
      left: { style: BorderStyle.SINGLE, size: 6, color: COLORS.grayBorder },
      right: { style: BorderStyle.SINGLE, size: 6, color: COLORS.grayBorder },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9E0E7" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9E0E7" },
    },
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          cantSplit: true,
          tableHeader: rowIndex === 0,
          children: Array.from({ length: columnCount }, (_, cellIndex) => {
            const text = row[cellIndex] ?? "";
            return new TableCell({
              width: { size: widths[cellIndex], type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              shading:
                rowIndex === 0
                  ? { type: ShadingType.CLEAR, fill: COLORS.gray }
                  : rowIndex % 2 === 0
                    ? { type: ShadingType.CLEAR, fill: "F8FAFC" }
                    : undefined,
              children: [
                new Paragraph({
                  children: inlineRuns(text, {
                    size: 19,
                    bold: rowIndex === 0,
                    color: rowIndex === 0 ? COLORS.navy : COLORS.text,
                  }),
                  alignment: AlignmentType.CENTER,
                  spacing: { line: 300, before: 40, after: 40 },
                  keepLines: true,
                }),
              ],
            });
          }),
        }),
    ),
  });
}

function dataBlock(content) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.grayBorder },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.grayBorder },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.grayBorder },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.grayBorder },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: COLORS.grayLight },
            margins: { top: 170, bottom: 170, left: 260, right: 260 },
            children: content.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [
                    new TextRun({
                      text: line || " ",
                      font: FONT,
                      size: 19,
                      color: "3E4A56",
                    }),
                  ],
                  spacing: { line: 300, after: 20 },
                }),
            ),
          }),
        ],
      }),
    ],
  });
}

function diagramParagraph(buffer, dimensions) {
  const maxWidth = 600;
  const maxHeight = 360;
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180, after: 180 },
    keepLines: true,
    children: [
      new ImageRun({
        data: buffer,
        type: "png",
        transformation: {
          width: Math.round(dimensions.width * ratio),
          height: Math.round(dimensions.height * ratio),
        },
        altText: {
          title: "DreamCards 流程图",
          description: "由原文流程代码块转换的可视化流程图",
          name: "DreamCards diagram",
        },
      }),
    ],
  });
}

function headingParagraph(text, level) {
  const styles = {
    1: { heading: HeadingLevel.HEADING_1, size: 32, color: COLORS.navy, before: 300, after: 180 },
    2: { heading: HeadingLevel.HEADING_2, size: 28, color: COLORS.blue, before: 260, after: 140 },
    3: { heading: HeadingLevel.HEADING_3, size: 24, color: COLORS.text, before: 220, after: 120 },
  };
  const style = styles[level];
  return new Paragraph({
    heading: style.heading,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: style.size,
        bold: true,
        color: style.color,
      }),
    ],
    spacing: { before: style.before, after: style.after, line: 360 },
    keepNext: true,
    border:
      level === 1
        ? {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 12,
              color: COLORS.blue,
              space: 6,
            },
          }
        : undefined,
  });
}

function coverChildren(config) {
  const coverRows = [
    new TableRow({
      height: { value: 2750, rule: "exact" },
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: COLORS.navy },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 400, bottom: 400, left: 620, right: 620 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 180 },
              children: [
                new TextRun({
                  text: config.coverTitle,
                  font: FONT,
                  size: 60,
                  bold: true,
                  color: COLORS.white,
                }),
              ],
            }),
            ...(config.coverSubtitle
              ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 110 },
                    children: [
                      new TextRun({
                        text: config.coverSubtitle,
                        font: FONT,
                        size: 30,
                        color: "DCE6F1",
                      }),
                    ],
                  }),
                ]
              : []),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: config.coverType,
                  font: FONT,
                  size: 38,
                  bold: true,
                  color: COLORS.white,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  return [
    new Paragraph({ spacing: { before: 900, after: 0 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        bottom: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        left: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        right: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: COLORS.white },
      },
      rows: coverRows,
    }),
    new Paragraph({ spacing: { before: 1280, after: 0 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({ text: "作者：Chen Ming", font: FONT, size: 24, color: COLORS.text }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: "版本：V1.0", font: FONT, size: 24, color: COLORS.text })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `日期：${today}`, font: FONT, size: 24, color: COLORS.text })],
    }),
  ];
}

function header() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "C7D2DE", space: 4 },
        },
        children: [
          new TextRun({
            text: "DreamCards",
            font: FONT,
            size: 18,
            color: COLORS.muted,
          }),
        ],
      }),
    ],
  });
}

function footer() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "第 ", font: FONT, size: 18, color: COLORS.muted }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: COLORS.muted }),
          new TextRun({ text: " 页", font: FONT, size: 18, color: COLORS.muted }),
        ],
      }),
    ],
  });
}

async function buildBody(blocks, config) {
  const children = [];
  let diagramIndex = 0;

  for (const block of blocks) {
    if (block.type === "heading") {
      if (block.level === 1) continue;
      const wordLevel = block.level - 1;
      children.push(headingParagraph(block.text, wordLevel));

      const placeholder = config.placeholderHeadings.get(block.text);
      if (placeholder) {
        children.push(placeholderTable(placeholder));
        children.push(new Paragraph({ spacing: { after: 100 } }));
      }
      continue;
    }

    if (block.type === "quote") {
      children.push(quoteTable(block.lines));
      children.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    if (block.type === "table") {
      children.push(markdownTable(block.rows));
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    if (block.type === "list") {
      block.items.forEach((item, index) => {
        children.push(
          new Paragraph({
            children: inlineRuns(item),
            bullet: block.ordered ? undefined : { level: 0 },
            numbering: block.ordered ? { reference: "ordered-list", level: 0 } : undefined,
            spacing: { line: 360, after: 90 },
            indent: { left: 360, hanging: 180 },
            keepLines: true,
          }),
        );
      });
      children.push(new Paragraph({ spacing: { after: 40 } }));
      continue;
    }

    if (block.type === "code") {
      if (isDiagramCode(block.content, block.language)) {
        const diagram = await renderDiagram(
          block.content,
          block.language,
          `${path.parse(config.output).name}-diagram-${++diagramIndex}`,
        );
        const buffer = await fs.readFile(diagram.output);
        children.push(diagramParagraph(buffer, diagram));
      } else {
        children.push(dataBlock(block.content));
        children.push(new Paragraph({ spacing: { after: 100 } }));
      }
      continue;
    }

    if (block.type === "paragraph") {
      children.push(normalParagraph(block.text));
    }
  }

  return children;
}

async function buildDocument(config) {
  const sourcePath = path.join(portfolioDir, config.source);
  const markdown = await fs.readFile(sourcePath, "utf8");
  const blocks = parseMarkdown(markdown);
  const body = await buildBody(blocks, config);

  const document = new Document({
    title: config.coverType,
    subject: "DreamCards 游戏系统策划校招作品集文档",
    creator: "Chen Ming",
    lastModifiedBy: "Chen Ming",
    description: `${config.coverTitle} ${config.coverType}`,
    keywords: "DreamCards, 游戏系统策划, 游戏设计文档, 系统分析报告",
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: COLORS.text },
          paragraph: { spacing: { line: 360, after: 150 } },
        },
        heading1: {
          run: { font: FONT, size: 32, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 300, after: 180 }, keepNext: true },
        },
        heading2: {
          run: { font: FONT, size: 28, bold: true, color: COLORS.blue },
          paragraph: { spacing: { before: 260, after: 140 }, keepNext: true },
        },
        heading3: {
          run: { font: FONT, size: 24, bold: true, color: COLORS.text },
          paragraph: { spacing: { before: 220, after: 120 }, keepNext: true },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 360, hanging: 180 } },
                run: { font: FONT },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4.width, height: A4.height, orientation: PageOrientation.PORTRAIT },
            margin: A4.margin,
          },
          verticalAlign: "top",
        },
        children: coverChildren(config),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: A4.width, height: A4.height, orientation: PageOrientation.PORTRAIT },
            margin: A4.margin,
            pageNumbers: { start: 1 },
          },
        },
        headers: { default: header() },
        footers: { default: footer() },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 320 },
            children: [
              new TextRun({
                text: "目录",
                font: FONT,
                size: 36,
                bold: true,
                color: COLORS.navy,
              }),
            ],
          }),
          new TableOfContents("", {
            hyperlink: true,
            headingStyleRange: "1-3",
            useAppliedParagraphOutlineLevel: true,
            preserveNewLineInEntries: true,
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...body,
        ],
      },
    ],
  });

  const outputPath = path.join(portfolioDir, config.output);
  const buffer = await Packer.toBuffer(document);
  await fs.writeFile(outputPath, buffer);
  return { outputPath, size: buffer.length, blocks, bodyCount: body.length };
}

for (const config of DOCS) {
  const result = await buildDocument(config);
  console.log(
    JSON.stringify({
      output: result.outputPath,
      bytes: result.size,
      markdownBlocks: result.blocks.length,
      wordElements: result.bodyCount,
    }),
  );
}
