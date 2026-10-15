import fs from "node:fs/promises";
import path from "node:path";
import { parseExcelWorkbook } from "../lib/excel-parser";
import { DEFAULT_SETTINGS } from "../lib/constants";

const source = process.argv[2];
if (!source) throw new Error("Usage: tsx scripts/generate-demo-data.ts <workbook.xlsx>");

const parsed = await parseExcelWorkbook(await fs.readFile(source));
const payload = {
  students: parsed.records,
  quality: parsed.quality,
  settings: DEFAULT_SETTINGS,
  versions: [
    {
      id: "demo-v1",
      filename: path.basename(source),
      createdAt: parsed.quality.importedAt,
      uploadedBy: "Bundled demo workbook",
      totalRecords: parsed.quality.recordsLoaded,
      validRecords: parsed.quality.validRecords,
      active: true,
      validationSummary: parsed.quality,
    },
  ],
  columnMapping: parsed.columnMapping,
};
await fs.writeFile("data/demo-data.json", `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${parsed.records.length} records to data/demo-data.json`);
