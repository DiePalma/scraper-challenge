import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { downloadPdf } from "./downloader";
import {
  FailedDownload,
  getErrorMessage,
  saveFailedDownloads,
} from "./failures";
import {
  DownloadManifest,
  isDocumentDownloaded,
  loadDownloadManifest,
  registerDownloadedDocument,
  saveDownloadManifest,
} from "./progress";
import { searchAll } from "./search";
import { initializeSession, SessionState, SITE_URL } from "./session";
import { DocumentRecord } from "./types";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shouldDownloadPdfs(): boolean {
  return process.env.DOWNLOAD_PDFS?.trim().toLowerCase() === "true";
}

async function saveDocuments(documents: DocumentRecord[]): Promise<string> {
  const outputDirectory = path.resolve(process.cwd(), "data");
  const outputFile = path.join(outputDirectory, "documents.json");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, JSON.stringify(documents, null, 2), "utf8");

  return outputFile;
}

async function downloadDocuments(
  session: SessionState,
  viewState: string,
  documents: DocumentRecord[],
  failures: FailedDownload[],
  manifest: DownloadManifest,
): Promise<void> {
  for (const [position, document] of documents.entries()) {
    if (await isDocumentDownloaded(manifest, document)) {
      console.log(
        `PDF ${position + 1}/${documents.length} omitido: ` +
          document.expediente,
      );
      continue;
    }

    console.log(
      `Descargando PDF ${position + 1}/${documents.length}: ` +
        document.expediente,
    );

    try {
      const outputFile = await downloadPdf(session, viewState, document);
      console.log(`  Guardado en: ${outputFile}`);
      registerDownloadedDocument(manifest, document, outputFile);
      await saveDownloadManifest(manifest);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error(`  No se pudo descargar: ${errorMessage}`);
      failures.push({
        document,
        page: 1,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
    }

    await delay(1_000);
  }
}

async function main(): Promise<void> {
  const query = process.env.PJ_QUERY?.trim() || "laboral";

  console.log(`Iniciando sesión en: ${SITE_URL}`);
  const session = await initializeSession();
  console.log(`Buscando: ${query}`);

  const result = await searchAll(session, query);
  const downloadEnabled = shouldDownloadPdfs();
  const failures: FailedDownload[] = [];
  const manifest = await loadDownloadManifest();

  console.log(`Resoluciones disponibles: ${result.totalAvailable}`);
  console.log(`Resultados: ${result.totalRecords}`);
  console.log(`Páginas: ${result.totalPages}`);
  console.log(`Documentos extraídos: ${result.documents.length}`);
  console.log(
    `Descarga de PDFs: ${downloadEnabled ? "activada" : "desactivada"}`,
  );

  if (downloadEnabled) {
    await downloadDocuments(
      session,
      result.viewState,
      result.documents,
      failures,
      manifest,
    );
  }

  const outputFile = await saveDocuments(result.documents);
  const failuresFile = await saveFailedDownloads(failures);

  console.table(result.documents);
  console.log(`Resultado guardado en: ${outputFile}`);
  console.log(`Descargas fallidas: ${failures.length}`);
  console.log(`Registro de fallos: ${failuresFile}`);
  console.log(`PDFs registrados: ${Object.keys(manifest).length}`);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});
