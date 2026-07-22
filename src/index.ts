import { searchAll } from "./search";
import { initializeSession, SITE_URL } from "./session";

async function main(): Promise<void> {
  console.log(`Iniciando sesion en: ${SITE_URL}`);

  const session = await initializeSession();
  console.log("Sesion inicializada correctamente");

  const result = await searchAll(session);

  console.log(
    `Pagina ${result.currentPage} de ${result.totalPages} ` +
      `(${result.totalRecords} registros)`,
  );
  console.table(result.documents);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});