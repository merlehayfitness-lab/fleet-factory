import type { KnowledgeFileType } from "./knowledge-types";

/**
 * Extract plain text from a file buffer based on file type.
 * Supports: text, markdown, pdf, docx, xlsx.
 */
export async function extractText(
  buffer: Buffer,
  fileType: KnowledgeFileType
): Promise<string> {
  let result: string;

  switch (fileType) {
    case "text":
    case "markdown": {
      result = buffer.toString("utf-8");
      break;
    }

    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      result = textResult.text;
      await parser.destroy();
      break;
    }

    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      result = value;
      break;
    }

    case "xlsx": {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        parts.push(`--- Sheet: ${sheetName} ---`);

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          header: 1,
          defval: "",
        });

        for (const row of rows) {
          const values = Object.values(row as Record<string, unknown>);
          const line = values.map((v) => String(v ?? "")).join("\t");
          if (line.trim()) {
            parts.push(line);
          }
        }
      }

      result = parts.join("\n");
      break;
    }

    default: {
      const _exhaustive: never = fileType;
      throw new Error(`Unsupported file type: ${_exhaustive}`);
    }
  }

  if (!result || !result.trim()) {
    throw new Error("Document contains no extractable text");
  }

  return result;
}
