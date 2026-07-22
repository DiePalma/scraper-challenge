import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import axios from "axios";

import { SessionState, SITE_URL } from "./session";
import { DocumentRecord } from "./types";

const FORM_ID = "listarDetalleInfraccionRAAForm";


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

  const unquotedMatch = contentDisposition.match(
    /filename\s*=\s*([^;]+)/i,
  );

  return unquotedMatch?.[1]?.trim() || fallback;
}


function validatePdf(buffer: Buffer): void {
  const signature = buffer.subarray(0, 5).toString("ascii");

  if (signature !== "%PDF-") {
    const preview = buffer
      .subarray(0, 100)
      .toString("utf8")
      .replace(/\s+/g, " ");

    throw new Error(
      `El servidor no devolvió un PDF válido. Inicio recibido: ${preview}`,
    );
  }
}


export async function downloadPdf(
  session: SessionState,
  viewState: string,
  document: DocumentRecord,
): Promise<string> {
    if (!document.uuid || !document.downloadAction) {
  throw new Error(
    `El documento ${document.resolucion || document.expediente} ` +
      `no tiene un PDF disponible`,
  );
}
  const body = new URLSearchParams({
    [FORM_ID]: FORM_ID,
    [`${FORM_ID}:txtNroexp`]: "",
    [`${FORM_ID}:j_idt21`]: "",
    [`${FORM_ID}:j_idt25`]: "",
    [`${FORM_ID}:idsector`]: "",
    [`${FORM_ID}:j_idt34`]: "",
    [`${FORM_ID}:dt_scrollState`]: "0,0",
    "javax.faces.ViewState": viewState,

    [document.downloadAction]: document.downloadAction,


    param_uuid: document.uuid,
  });

  const response = await axios.post<ArrayBuffer>(
    SITE_URL,
    body,
    {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: session.cookie,
        Referer: SITE_URL,
        "User-Agent": "scraper-challenge/1.0",
      },
      responseType: "arraybuffer",
      timeout: 60_000,
    },
  );

  const pdfBuffer = Buffer.from(response.data);
  validatePdf(pdfBuffer);

  const fallbackName = `${document.resolucion}.pdf`;
  const serverFileName = extractFileName(
    response.headers["content-disposition"],
    fallbackName,
  );

  const fileName = sanitizeFileName(serverFileName);
  const outputDirectory = path.resolve(process.cwd(), "data", "pdfs");
  const outputFile = path.join(outputDirectory, fileName);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, pdfBuffer);

  return outputFile;
}