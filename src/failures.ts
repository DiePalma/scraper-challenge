import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { DocumentRecord } from "./types";

export interface FailedDownload {
  document: DocumentRecord;
  page: number;
  error: string;
  failedAt: string;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function saveFailedDownloads(
  failures: FailedDownload[],
): Promise<string> {
  const outputDirectory = path.resolve(process.cwd(), "data");
  const outputFile = path.join(
    outputDirectory,
    "failed-downloads.json",
  );

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    outputFile,
    JSON.stringify(failures, null, 2),
    "utf8",
  );

  return outputFile;
}