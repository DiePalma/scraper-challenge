import axios from "axios";
import * as cheerio from "cheerio";

export const SITE_URL =
  "https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml";

export interface SessionState {
  cookie: string;
  viewState: string;
}

export async function initializeSession(): Promise<SessionState> {
  const response = await axios.get<string>(SITE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "scraper-challenge/1.0",
    },
    timeout: 30_000,
  });

  const setCookieHeaders = response.headers["set-cookie"];

  if (!setCookieHeaders?.length) {
    throw new Error("El servidor no entregó ninguna cookie de sesión");
  }

  const cookie = setCookieHeaders
    .map((header) => header.split(";", 1)[0])
    .join("; ");

  const $ = cheerio.load(response.data);

  const viewStateValue = $(
    'input[name="javax.faces.ViewState"]',
  ).val();

  if (typeof viewStateValue !== "string" || !viewStateValue) {
    throw new Error("No se encontró javax.faces.ViewState en el HTML");
  }

  return {
    cookie,
    viewState: viewStateValue,
  };
}