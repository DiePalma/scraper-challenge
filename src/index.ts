import { initializeSession, SITE_URL } from "./session";

async function main(): Promise<void> {
  console.log(`Iniciando sesión en: ${SITE_URL}`);

  const session = await initializeSession();

  console.log("Sesión inicializada correctamente");
  console.log(`Cookie obtenida: ${session.cookie.split("=")[0]}`);
  console.log(`Longitud del ViewState: ${session.viewState.length}`);
}

main().catch((error: unknown) => {
  console.error("Error fatal:", error);
  process.exitCode = 1;
});