const SITE_URL =
  "https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml";

async function main(): Promise<void> {
  console.log(`Scraper configurado para: ${SITE_URL}`);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});