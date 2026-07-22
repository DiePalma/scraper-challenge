import axios from "axios";

import { parsePartialPage, parseResultPage } from "./parser";
import {
  BASE_URL,
  RESULT_URL,
  SessionState,
  START_URL,
} from "./session";
import { SearchResult } from "./types";

const FORM_ID = "formBuscador";

export async function searchAll(
  session: SessionState,
  query: string,
): Promise<SearchResult> {
  const body = new URLSearchParams({
    [FORM_ID]: FORM_ID,
    "javax.faces.ViewState": session.viewState,
    [`${FORM_ID}:tabpanel-value`]: "general",
    [`${FORM_ID}:txtBusqueda`]: query,
    [`${FORM_ID}:buCorte`]: "1",
    [`${FORM_ID}:buDistrito`]: "0",
    [`${FORM_ID}:buEspecialidad`]: "0",
    [`${FORM_ID}:buSala`]: "0",
    [`${FORM_ID}:buPretensionDelitoSupValue`]: "",
    [`${FORM_ID}:buPretensionDelitoSupInput`]: "",
    [`${FORM_ID}:buPretensionValue`]: "",
    [`${FORM_ID}:buPretensionInput`]: "",
    [`${FORM_ID}:buPalabraClaveValue`]: "",
    [`${FORM_ID}:buPalabraClaveInput`]: "",
    [`${FORM_ID}:buNroExpediente`]:
      "Ingrese Nro de Expediente XXXXXX",
    [`${FORM_ID}:buAnio`]: "",
    [`${FORM_ID}:j_idt31`]: `${FORM_ID}:j_idt31`,
    forward: "buscar",
    busqueda: "especializada",
    [`${FORM_ID}:j_idt34`]: "21",
    [`${FORM_ID}:j_idt35`]: "DESC",
    [`${FORM_ID}:j_idt36`]: "Principal",
    [`${FORM_ID}:j_idt37`]: "1",
  });

  const postResponse = await axios.post(
    START_URL,
    body.toString(),
    {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: session.cookie,
        Origin: BASE_URL,
        Referer: START_URL,
        "User-Agent": "scraper-challenge/1.0",
      },
      maxRedirects: 0,
      timeout: 30_000,
      validateStatus: (status) => status === 302,
    },
  );

  if (!postResponse.headers.location?.includes("resultado.xhtml")) {
    throw new Error("La búsqueda no redirigió a resultados");
  }

  const resultResponse = await axios.get<string>(RESULT_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Cookie: session.cookie,
      Referer: START_URL,
      "User-Agent": "scraper-challenge/1.0",
    },
    timeout: 30_000,
  });

  return parseResultPage(resultResponse.data, query);
}

export async function fetchPage(
  session: SessionState,
  viewState: string,
  pageNumber: number,
  previousResult: SearchResult,
): Promise<SearchResult> {
  if (!Number.isInteger(pageNumber) || pageNumber < 2) {
    throw new Error(`Número de página inválido: ${pageNumber}`);
  }

  const body = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": `${FORM_ID}:data1`,
    "javax.faces.partial.execute": `${FORM_ID}:data1`,
    [`${FORM_ID}:data1`]: `${FORM_ID}:data1`,
    [`${FORM_ID}:data1:page`]: String(pageNumber),
    [FORM_ID]: FORM_ID,
    "javax.faces.ViewState": viewState,
  });

  const response = await axios.post<string>(
    RESULT_URL,
    body.toString(),
    {
      headers: {
        Accept: "application/xml, text/xml, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Cookie: session.cookie,
        "Faces-Request": "partial/ajax",
        Referer: RESULT_URL,
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "scraper-challenge/1.0",
      },
      timeout: 30_000,
    },
  );

  return parsePartialPage(response.data, {
    query: previousResult.query,
    currentPage: pageNumber,
    totalAvailable: previousResult.totalAvailable,
    totalRecords: previousResult.totalRecords,
    totalPages: previousResult.totalPages,
  });
}
