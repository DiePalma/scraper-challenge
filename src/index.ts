import { fetchPage, searchAll } from "./search";
import { initializeSession, SITE_URL } from "./session";
import { DocumentRecord } from "./types";


function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function main(): Promise<void> {
  console.log(`Iniciando sesión en: ${SITE_URL}`);

  const session = await initializeSession();
  console.log("Sesión inicializada correctamente");


  const firstPage = await searchAll(session);

  const documents: DocumentRecord[] = [...firstPage.documents];
  let currentViewState = firstPage.viewState;

  console.log(
    `Página 1: ${firstPage.documents.length} documentos extraídos`,
  );


  const pagesToTest = Math.min(3, firstPage.totalPages);

  for (let pageNumber = 2; pageNumber <= pagesToTest; pageNumber += 1) {
    await delay(1_000);

    console.log(`Solicitando página ${pageNumber}...`);

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

  console.log(`Total de prueba: ${documents.length} documentos`);
  console.table(documents);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});