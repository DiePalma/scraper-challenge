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
import { fetchPage, searchAll } from "./search";
import { initializeSession, SessionState, SITE_URL } from "./session";
import { CourtScope, DocumentRecord } from "./types";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function shouldDownloadPdfs(): boolean {
  return process.env.DOWNLOAD_PDFS?.trim().toLowerCase() === "true";
}

function resolvePageLimit(totalPages: number): number {
  const configuredValue = process.env.MAX_PAGES?.trim().toLowerCase() ?? "3";

  if (configuredValue === "all") {
    return totalPages;
  }

  const requestedPages = Number(configuredValue);

  if (!Number.isInteger(requestedPages) || requestedPages < 1) {
    throw new Error(
      `MAX_PAGES debe ser un entero positivo o "all": ${configuredValue}`,
    );
  }

  return Math.min(requestedPages, totalPages);
}

function resolveCourts(): CourtScope[] {
  const value = process.env.PJ_COURT?.trim().toLowerCase() ?? "supreme";

  if (value === "all") {
    return ["supreme", "superior"];
  }

  if (value === "supreme" || value === "superior") {
    return [value];
  }

  throw new Error(`PJ_COURT debe ser supreme, superior o all: ${value}`);
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
  pageNumber: number,
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
        page: pageNumber,
        error: errorMessage,
        failedAt: new Date().toISOString(),
      });
    }

    await delay(1_000);
  }
}

async function scrapeCourt(
  court: CourtScope,
  query: string,
  downloadEnabled: boolean,
  documents: DocumentRecord[],
  failures: FailedDownload[],
  manifest: DownloadManifest,
): Promise<void> {
  console.log(`Iniciando sesión en: ${SITE_URL}`);
  console.log(`Corte: ${court}`);

  const session = await initializeSession();
  const firstPage = await searchAll(session, query, court);
  const pageLimit = resolvePageLimit(firstPage.totalPages);

  console.log(`Resoluciones disponibles: ${firstPage.totalAvailable}`);
  console.log(`Resultados: ${firstPage.totalRecords}`);
  console.log(`Páginas: ${firstPage.totalPages}`);
  console.log(`Se procesarán ${pageLimit} páginas`);
  console.log(`Página 1: ${firstPage.documents.length} documentos extraídos`);

  documents.push(...firstPage.documents);

  if (downloadEnabled) {
    await downloadDocuments(
      session,
      firstPage.viewState,
      firstPage.documents,
      1,
      failures,
      manifest,
    );
  }

  await saveDocuments(documents);
  await saveFailedDownloads(failures);

  let currentPage = firstPage;
  let currentViewState = firstPage.viewState;

  for (let pageNumber = 2; pageNumber <= pageLimit; pageNumber += 1) {
    await delay(1_000);
    console.log(`Solicitando página ${pageNumber} de ${pageLimit}...`);

    const page = await fetchPage(
      session,
      currentViewState,
      pageNumber,
      currentPage,
    );

    documents.push(...page.documents);
    currentPage = page;
    currentViewState = page.viewState;

    console.log(
      `Página ${page.currentPage}: ${page.documents.length} documentos extraídos`,
    );

    if (downloadEnabled) {
      await downloadDocuments(
        session,
        page.viewState,
        page.documents,
        pageNumber,
        failures,
        manifest,
      );
    }

    await saveDocuments(documents);
    await saveFailedDownloads(failures);
  }
}

async function main(): Promise<void> {
  const query = process.env.PJ_QUERY?.trim() ?? "";
  const courts = resolveCourts();
  const downloadEnabled = shouldDownloadPdfs();
  const documents: DocumentRecord[] = [];
  const failures: FailedDownload[] = [];
  const manifest = await loadDownloadManifest();

  console.log(`Buscando: ${query || "sin filtro"}`);
  console.log(`Descarga de PDFs: ${downloadEnabled ? "activada" : "desactivada"}`);

  for (const court of courts) {
    await scrapeCourt(
      court,
      query,
      downloadEnabled,
      documents,
      failures,
      manifest,
    );
  }

  const outputFile = await saveDocuments(documents);
  const failuresFile = await saveFailedDownloads(failures);

  console.log(`Total extraído: ${documents.length} documentos`);
  console.log(`Resultado guardado en: ${outputFile}`);
  console.log(`Descargas fallidas: ${failures.length}`);
  console.log(`Registro de fallos: ${failuresFile}`);
  console.log(`PDFs registrados: ${Object.keys(manifest).length}`);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});
