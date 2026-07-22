import axios from "axios";
import * as cheerio from "cheerio";

export const BASE_URL = "https://jurisprudencia.pj.gob.pe";
export const START_URL =
  `${BASE_URL}/jurisprudenciaweb/faces/page/inicio.xhtml`;
export const RESULT_URL =
  `${BASE_URL}/jurisprudenciaweb/faces/page/resultado.xhtml`;
export const SITE_URL = START_URL;

export interface SessionState {
  cookie: string;
  viewState: string;
}

export function extractViewState(html: string): string {
  const $ = cheerio.load(html);
  const value = $('input[name="javax.faces.ViewState"]').val();

  if (typeof value !== "string" || !value) {
    throw new Error("No se encontró javax.faces.ViewState");
  }

  return value;
}

export async function initializeSession(): Promise<SessionState> {
  const response = await axios.get<string>(START_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "scraper-challenge/1.0",
    },
    timeout: 30_000,
  });

  const setCookieHeaders = response.headers["set-cookie"];

  if (!setCookieHeaders?.length) {
    throw new Error("El servidor no entregó una cookie de sesión");
  }

  const cookie = setCookieHeaders
    .map((header) => header.split(";", 1)[0])
    .join("; ");

  return {
    cookie,
    viewState: extractViewState(response.data),
  };
}
