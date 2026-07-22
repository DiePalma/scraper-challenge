import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import axios, { AxiosResponse } from "axios";

import { withExponentialBackoff } from "./retry";
import { SessionState } from "./session";
import { DocumentRecord } from "./types";

export function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const retryDate = Date.parse(value);
  return Number.isNaN(retryDate)
    ? undefined
    : Math.max(0, retryDate - Date.now());
}

export function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return [408, 429, 500, 502, 503, 504].includes(
    error.response.status,
  );
}

async function requestPdfWithRetry(
  session: SessionState,
  url: string,
  maxAttempts = 5,
): Promise<AxiosResponse<ArrayBuffer>> {
  return withExponentialBackoff(
    async (attempt) => {
      console.log(`  Intento de descarga ${attempt}/${maxAttempts}`);

      return axios.get<ArrayBuffer>(url, {
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
          Cookie: session.cookie,
          "User-Agent": "scraper-challenge/1.0",
        },
        responseType: "arraybuffer",
        timeout: 60_000,
      });
    },
    {
      maxAttempts,
      baseDelayMilliseconds: 1_000,
      maximumDelayMilliseconds: 30_000,
      shouldRetry: isRetryableError,
      getRetryAfterMilliseconds: (error) =>
        axios.isAxiosError(error)
          ? parseRetryAfter(error.response?.headers["retry-after"])
          : undefined,
      onRetry: ({ error, waitingTime }) => {
        const status = axios.isAxiosError(error)
          ? error.response?.status ?? "sin respuesta"
          : "desconocido";

        console.warn(
          `  Descarga fallida (${status}). ` +
            `Nuevo intento en ${waitingTime} ms`,
        );
      },
    },
  );
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFileName(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  if (!contentDisposition) {
    return fallback;
  }

  const quotedMatch = contentDisposition.match(
    /filename\s*=\s*"([^"]+)"/i,
  );

  if (quotedMatch) {
    return quotedMatch[1];
  }

  return (
    contentDisposition.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ||
    fallback
  );
}

function validatePdf(buffer: Buffer): void {
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    const preview = buffer
      .subarray(0, 100)
      .toString("utf8")
      .replace(/\s+/g, " ");

    throw new Error(`El servidor no devolvió un PDF válido: ${preview}`);
  }
}

export async function downloadPdf(
  session: SessionState,
  _viewState: string,
  document: DocumentRecord,
): Promise<string> {
  const response = await requestPdfWithRetry(session, document.pdfUrl);
  const pdfBuffer = Buffer.from(response.data);
  validatePdf(pdfBuffer);

  const serverFileName = extractFileName(
    response.headers["content-disposition"],
    `${document.expediente}.pdf`,
  );
  const outputDirectory = path.resolve(process.cwd(), "data", "pdfs");
  const fileName = `${document.uuid}-${sanitizeFileName(serverFileName)}`;
  const outputFile = path.join(outputDirectory, fileName);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, pdfBuffer);

  return outputFile;
}
