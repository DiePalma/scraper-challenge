import {
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { DocumentRecord } from "./types";

export interface DownloadedDocument {
  uuid: string;
  expediente: string;
  filePath: string;
  downloadedAt: string;
}

export type DownloadManifest = Record<string, DownloadedDocument>;

const DATA_DIRECTORY = path.resolve(process.cwd(), "data");
const MANIFEST_FILE = path.join(DATA_DIRECTORY, "downloaded.json");

function isFileNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export async function loadDownloadManifest(): Promise<DownloadManifest> {
  try {
    const content = await readFile(MANIFEST_FILE, "utf8");

    if (!content.trim()) {
      return {};
    }

    const parsed: unknown = JSON.parse(content);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new SyntaxError("El manifiesto no contiene un objeto JSON");
    }

    return parsed as DownloadManifest;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return {};
    }

    if (error instanceof SyntaxError) {
      const backupFile = path.join(
        DATA_DIRECTORY,
        `downloaded.corrupt-${Date.now()}.json`,
      );

      await rename(MANIFEST_FILE, backupFile);
      console.warn(`Manifiesto corrupto respaldado en: ${backupFile}`);

      return {};
    }

    throw error;
  }
}

export async function isDocumentDownloaded(
  manifest: DownloadManifest,
  document: DocumentRecord,
): Promise<boolean> {
  if (!document.uuid) {
    return false;
  }

  const entry = manifest[document.uuid];

  if (!entry) {
    return false;
  }

  const absoluteFilePath = path.resolve(process.cwd(), entry.filePath);

  try {
    const fileInfo = await stat(absoluteFilePath);
    return fileInfo.isFile() && fileInfo.size > 5;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

export function registerDownloadedDocument(
  manifest: DownloadManifest,
  document: DocumentRecord,
  absoluteFilePath: string,
): void {
  if (!document.uuid) {
    throw new Error(`Documento sin UUID: ${document.expediente}`);
  }

  manifest[document.uuid] = {
    uuid: document.uuid,
    expediente: document.expediente,
    filePath: path.relative(process.cwd(), absoluteFilePath),
    downloadedAt: new Date().toISOString(),
  };
}

export async function saveDownloadManifest(
  manifest: DownloadManifest,
): Promise<string> {
  await mkdir(DATA_DIRECTORY, { recursive: true });

  const temporaryFile = `${MANIFEST_FILE}.tmp`;
  const serializedManifest = JSON.stringify(manifest, null, 2);

  await writeFile(temporaryFile, serializedManifest, "utf8");
  await rename(temporaryFile, MANIFEST_FILE);

  return MANIFEST_FILE;
}
