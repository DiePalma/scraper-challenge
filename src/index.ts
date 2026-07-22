import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadPdf } from "./downloader";
import { fetchPage, searchAll } from "./search";
import { initializeSession, SITE_URL } from "./session";
import { DocumentRecord } from "./types";

/** Pausa entre peticiones para reducir la carga sobre el servidor. */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}


function resolvePageLimit(totalPages: number): number {
  const configuredValue = process.env.MAX_PAGES?.trim().toLowerCase() ?? "3";

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


async function saveDocuments(
  documents: DocumentRecord[],
): Promise<string> {
  const outputDirectory = path.resolve(process.cwd(), "data");
  const outputFile = path.join(outputDirectory, "documents.json");

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    outputFile,
    JSON.stringify(documents, null, 2),
    "utf8",
  );

  return outputFile;
}

async function main(): Promise<void> {
  console.log(`Iniciando sesión en: ${SITE_URL}`);

  const session = await initializeSession();
  console.log("Sesión inicializada correctamente");


  const firstPage = await searchAll(session);
  const firstDocument = firstPage.documents[0];

if (!firstDocument) {
  throw new Error("La primera página no contiene documentos");
}

console.log(
  `Descargando PDF de prueba: ${firstDocument.resolucion}`,
);

const downloadedFile = await downloadPdf(
  session,
  firstPage.viewState,
  firstDocument,
);

console.log(`PDF guardado en: ${downloadedFile}`);
  const pageLimit = resolvePageLimit(firstPage.totalPages);

  const documents: DocumentRecord[] = [...firstPage.documents];
  let currentViewState = firstPage.viewState;

  console.log(
    `El sitio contiene ${firstPage.totalRecords} documentos ` +
      `en ${firstPage.totalPages} páginas`,
  );

  console.log(`Se procesarán ${pageLimit} páginas`);
  console.log(
    `Página 1: ${firstPage.documents.length} documentos extraídos`,
  );

  for (let pageNumber = 2; pageNumber <= pageLimit; pageNumber += 1) {
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

    currentViewState = page.viewState;
    documents.push(...page.documents);

    console.log(
      `Página ${page.currentPage}: ` +
        `${page.documents.length} documentos extraídos`,
    );
  }

  const outputFile = await saveDocuments(documents);

  console.log(`Total extraído: ${documents.length} documentos`);
  console.log(`Resultado guardado en: ${outputFile}`);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});