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
import {
  initializeSession,
  SessionState,
  SITE_URL,
} from "./session";
import { DocumentRecord } from "./types";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function resolvePageLimit(totalPages: number): number {
  const configuredValue =
    process.env.MAX_PAGES?.trim().toLowerCase() ?? "3";

  if (configuredValue === "all") {
    return totalPages;
  }

  const requestedPages = Number(configuredValue);

  if (!Number.isInteger(requestedPages) || requestedPages < 1) {
    throw new Error(
      `MAX_PAGES debe ser un entero positivo o "all". ` +
        `Valor recibido: ${configuredValue}`,
    );
  }

  return Math.min(requestedPages, totalPages);
}

function shouldDownloadPdfs(): boolean {
  return (
    process.env.DOWNLOAD_PDFS?.trim().toLowerCase() === "true"
  );
}

async function saveDocuments(
  documents: DocumentRecord[],
): Promise<string> {
  const outputDirectory = path.resolve(process.cwd(), "data");
  const outputFile = path.join(
    outputDirectory,
    "documents.json",
  );

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    outputFile,
    JSON.stringify(documents, null, 2),
    "utf8",
  );

  return outputFile;
}

async function downloadPageDocuments(
  session: SessionState,
  viewState: string,
  documents: DocumentRecord[],
  pageNumber: number,
  failures: FailedDownload[],
  manifest: DownloadManifest,
): Promise<void> {
  for (const [position, document] of documents.entries()) {
    if (!document.uuid || !document.downloadAction) {
      console.log(
        `PDF ${position + 1}/${documents.length} de la página ` +
          `${pageNumber} omitido: archivo no disponible`,
      );

      continue;
    }

    const alreadyDownloaded = await isDocumentDownloaded(
      manifest,
      document,
    );

    if (alreadyDownloaded) {
      console.log(
        `PDF ${position + 1}/${documents.length} de la página ` +
          `${pageNumber} omitido: ${document.resolucion}`,
      );

      continue;
    }

    console.log(
      `Descargando PDF ${position + 1}/${documents.length} ` +
        `de la página ${pageNumber}: ${document.resolucion}`,
    );

    try {
      const outputFile = await downloadPdf(
        session,
        viewState,
        document,
      );

      console.log(`  Guardado en: ${outputFile}`);

      registerDownloadedDocument(manifest, document, outputFile);
      await saveDownloadManifest(manifest);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);

      console.error(
        `  No se pudo descargar ${document.resolucion}: ` +
          errorMessage,
      );

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

async function main(): Promise<void> {
  console.log(`Iniciando sesión en: ${SITE_URL}`);

  const session = await initializeSession();
  console.log("Sesión inicializada correctamente");

  const firstPage = await searchAll(session);
  const pageLimit = resolvePageLimit(firstPage.totalPages);
  const downloadEnabled = shouldDownloadPdfs();
  const failures: FailedDownload[] = [];
  const downloadManifest = await loadDownloadManifest();
  const documents: DocumentRecord[] = [
    ...firstPage.documents,
  ];

  let currentViewState = firstPage.viewState;

  console.log(
    `El sitio contiene ${firstPage.totalRecords} documentos ` +
      `en ${firstPage.totalPages} páginas`,
  );
  console.log(`Se procesarán ${pageLimit} páginas`);
  console.log(
    `Descarga de PDFs: ` +
      `${downloadEnabled ? "activada" : "desactivada"}`,
  );
  console.log(
    `Página 1: ${firstPage.documents.length} documentos extraídos`,
  );

  if (downloadEnabled) {
    await downloadPageDocuments(
      session,
      currentViewState,
      firstPage.documents,
      1,
      failures,
      downloadManifest,
    );
  }

  for (
    let pageNumber = 2;
    pageNumber <= pageLimit;
    pageNumber += 1
  ) {
    await delay(1_000);

    console.log(
      `Solicitando página ${pageNumber} de ${pageLimit}...`,
    );

    const page = await fetchPage(
      session,
      currentViewState,
      pageNumber,
      firstPage.totalPages,
      firstPage.totalRecords,
    );

    documents.push(...page.documents);

    console.log(
      `Página ${page.currentPage}: ` +
        `${page.documents.length} documentos extraídos`,
    );

    if (downloadEnabled) {
      await downloadPageDocuments(
        session,
        page.viewState,
        page.documents,
        pageNumber,
        failures,
        downloadManifest,
      );
    }

    currentViewState = page.viewState;
  }

  const outputFile = await saveDocuments(documents);
  const failuresFile = await saveFailedDownloads(failures);

  console.log(`Total extraído: ${documents.length} documentos`);
  console.log(`Resultado guardado en: ${outputFile}`);
  console.log(`Descargas fallidas: ${failures.length}`);
  console.log(`Registro de fallos: ${failuresFile}`);
  console.log(
    `PDFs registrados: ${Object.keys(downloadManifest).length}`,
  );
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});
