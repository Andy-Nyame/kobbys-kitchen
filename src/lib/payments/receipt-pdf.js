import {
  RECEIPT_COPY,
  createReceiptPresentation,
} from "./receipt-presentation.js";

const PAGE_WIDTH = 226.77;
const PAGE_HEIGHT = 396;
const MARGIN = 14;
const TOP = PAGE_HEIGHT - 18;
const BOTTOM = 18;
const BODY_SIZE = 8;
const BODY_LEADING = 11;

function escapePdfText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function textWidth(value, size) {
  return String(value).length * size * 0.6;
}

function wrapText(value, maxCharacters) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";

  for (const word of words) {
    if (word.length > maxCharacters) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += maxCharacters) {
        lines.push(word.slice(index, index + maxCharacters));
      }
      line = "";
      continue;
    }

    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function addText(commands, text, x, y, size = BODY_SIZE, bold = false) {
  commands.push(
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
  );
}

function addCenteredText(commands, text, y, size = BODY_SIZE, bold = false) {
  const x = Math.max(MARGIN, (PAGE_WIDTH - textWidth(text, size)) / 2);
  addText(commands, text, x, y, size, bold);
}

function addRightText(commands, text, y, size = BODY_SIZE, bold = false) {
  addText(commands, text, PAGE_WIDTH - MARGIN - textWidth(text, size), y, size, bold);
}

function splitMoney(value) {
  const normalized = String(value);
  if (!normalized.startsWith("GH₵")) return null;
  return normalized.slice(3);
}

function moneyWidth(value, size) {
  const amount = splitMoney(value);
  return amount === null
    ? textWidth(value, size)
    : textWidth("GH", size) + size * 0.6 + textWidth(amount, size);
}

function addMoney(commands, value, right, y, size = BODY_SIZE, bold = false) {
  const amount = splitMoney(value);
  if (amount === null) {
    addText(commands, value, right - textWidth(value, size), y, size, bold);
    return;
  }

  const font = bold ? "F2" : "F1";
  const width = moneyWidth(value, size);
  const x = right - width;
  const ghWidth = textWidth("GH", size);
  const cediWidth = size * 0.6;
  commands.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (GH) Tj ET`);
  commands.push(`BT /F3 ${size} Tf ${(x + ghWidth).toFixed(2)} ${y.toFixed(2)} Td (\\001) Tj ET`);
  commands.push(`BT /${font} ${size} Tf ${(x + ghWidth + cediWidth).toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(amount)}) Tj ET`);
}

function createReceiptLines(model) {
  const lines = [
    { type: "center", text: "KOBBY'S KITCHEN", size: 14, bold: true, height: 18 },
    { type: "center", text: "PAYMENT RECEIPT", size: 10, bold: true, height: 16 },
    { type: "rule", height: 9 },
    { type: "fact", label: "RECEIPT", value: model.receiptNumber },
    { type: "fact", label: "ORDER", value: model.orderReference },
    { type: "fact", label: "DATE", value: model.paymentDate },
    { type: "fact", label: "TIME", value: model.paymentTime },
    { type: "fact", label: "PICKUP", value: model.pickupName },
    { type: "fact", label: "FULFILLMENT", value: model.fulfillment },
    { type: "rule", height: 9 },
    { type: "columns", left: "QTY", middle: "ITEM", right: "AMOUNT", bold: true },
    { type: "rule", height: 9 },
  ];

  for (const item of model.items) {
    const itemNameLines = wrapText(item.name, 21);
    lines.push({ type: "item", quantity: String(item.quantity), name: itemNameLines[0], amount: item.lineTotal });
    for (const continuation of itemNameLines.slice(1)) {
      lines.push({ type: "item-continuation", name: continuation });
    }
    lines.push({ type: "item-detail", detail: "Unit price", amount: item.unitPrice, height: 10 });
  }

  lines.push(
    { type: "rule", height: 10 },
    { type: "total", label: "TOTAL", amount: model.total, height: 18 },
    { type: "rule", height: 10 },
    { type: "fact", label: "METHOD", value: model.paymentMethod.toUpperCase() },
    { type: "fact", label: "STATUS", value: model.paymentStatus },
    ...(model.paymentProvider ? [{ type: "fact", label: "PROVIDER", value: model.paymentProvider.toUpperCase() }] : []),
    ...(model.providerReference ? [{ type: "fact", label: "REFERENCE", value: model.providerReference }] : []),
    ...(model.refundStatus ? [{ type: "fact", label: "REFUND STATUS", value: model.refundStatus }] : []),
    { type: "space", height: 9 },
    { type: "center", text: "APPROVED", size: 10, bold: true, height: 15 },
    ...(model.copyLabel === "CUSTOMER COPY" ? [{ type: "center", text: "THANK YOU", size: 9, bold: true, height: 14 }] : []),
    { type: "center", text: model.copyLabel, size: 9, bold: true, height: 13 }
  );

  return lines;
}

function renderLine(commands, line, y) {
  if (line.type === "center") addCenteredText(commands, line.text, y, line.size, line.bold);
  if (line.type === "rule") commands.push(`${MARGIN} ${(y + 4).toFixed(2)} m ${PAGE_WIDTH - MARGIN} ${(y + 4).toFixed(2)} l 0.5 w S`);
  if (line.type === "fact") {
    addText(commands, line.label, MARGIN, y, BODY_SIZE, true);
    wrapText(line.value, 25).forEach((value, index) => addRightText(commands, value, y - index * BODY_LEADING, BODY_SIZE));
  }
  if (line.type === "columns") {
    addText(commands, line.left, MARGIN, y, BODY_SIZE, line.bold);
    addText(commands, line.middle, 39, y, BODY_SIZE, line.bold);
    addRightText(commands, line.right, y, BODY_SIZE, line.bold);
  }
  if (line.type === "item") {
    addText(commands, line.quantity, MARGIN, y);
    addText(commands, line.name, 39, y);
    addMoney(commands, line.amount, PAGE_WIDTH - MARGIN, y);
  }
  if (line.type === "item-continuation") addText(commands, line.name, 39, y);
  if (line.type === "item-detail") {
    addText(commands, line.detail, 39, y, 6.5);
    addMoney(commands, line.amount, PAGE_WIDTH - MARGIN, y, 6.5);
  }
  if (line.type === "total") {
    addText(commands, line.label, MARGIN, y, 11, true);
    addMoney(commands, line.amount, PAGE_WIDTH - MARGIN, y, 11, true);
  }
}

function lineHeight(line) {
  if (line.type === "fact") return Math.max(BODY_LEADING, wrapText(line.value, 25).length * BODY_LEADING);
  return line.height || BODY_LEADING;
}

function paginate(lines) {
  const pages = [];
  let page = [];
  let used = 0;
  const available = TOP - BOTTOM;

  for (const line of lines) {
    const height = lineHeight(line);
    if (page.length && used + height > available) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(line);
    used += height;
  }
  if (page.length) pages.push(page);
  return pages;
}

function buildPdfObjects(pageContents) {
  const pageIds = pageContents.map((_, index) => 3 + index * 2);
  const fontRegularId = 3 + pageContents.length * 2;
  const fontBoldId = fontRegularId + 1;
  const fontCediId = fontBoldId + 1;
  const cediGlyphId = fontCediId + 1;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  ];

  pageContents.forEach((content, index) => {
    const contentId = pageIds[index] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontCediId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
    );
  });

  const cediGlyph = "600 0 0 -100 600 800 d1 55 w 1 J 470 600 m 390 675 175 675 100 500 c 25 320 175 105 470 180 c S 285 90 m 285 690 l S";
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Type /Font /Subtype /Type3 /FontBBox [0 -100 600 800] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << /cedi ${cediGlyphId} 0 R >> /Encoding << /Type /Encoding /Differences [1 /cedi] >> /FirstChar 1 /LastChar 1 /Widths [600] /Resources << >> >>`,
    `<< /Length ${Buffer.byteLength(cediGlyph)} >>\nstream\n${cediGlyph}\nendstream`
  );
  return objects;
}

export function buildReceiptPdf(receipt, { copyType = RECEIPT_COPY.CUSTOMER } = {}) {
  const model = createReceiptPresentation(receipt, copyType);
  const pageContents = paginate(createReceiptLines(model)).map((page) => {
    const commands = [];
    let y = TOP;
    page.forEach((line) => {
      renderLine(commands, line, y);
      y -= lineHeight(line);
    });
    return commands.join("\n");
  });
  const objects = buildPdfObjects(pageContents);
  let output = "%PDF-1.4\n% Thermal payment receipt\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "binary");
}
