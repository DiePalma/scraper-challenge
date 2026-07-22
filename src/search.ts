import axios from "axios";
import { parsePartialResponse } from "./parser";
import { SessionState, SITE_URL } from "./session";
import { SearchResult } from "./types";

const FORM_ID = "listarDetalleInfraccionRAAForm";


export async function searchAll(session: SessionState): Promise<SearchResult> {

  const body = new URLSearchParams({
    "javax.faces.partial.ajax": "true",
    "javax.faces.source": `${FORM_ID}:btnBuscar`,
    "javax.faces.partial.execute": "@all",
    "javax.faces.partial.render": `${FORM_ID}:pgLista ${FORM_ID}:txtNroexp`,
    [`${FORM_ID}:btnBuscar`]: `${FORM_ID}:btnBuscar`,
    [FORM_ID]: FORM_ID,
    [`${FORM_ID}:txtNroexp`]: "",
    [`${FORM_ID}:j_idt21`]: "",
    [`${FORM_ID}:j_idt25`]: "",
    [`${FORM_ID}:idsector`]: "",
    [`${FORM_ID}:j_idt34`]: "",
    [`${FORM_ID}:dt_scrollState`]: "0,0",
    "javax.faces.ViewState": session.viewState,
  });

  const response = await axios.post<string>(SITE_URL, body, {
    headers: {
      Accept: "application/xml, text/xml, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: session.cookie,
      "Faces-Request": "partial/ajax",
      Referer: SITE_URL,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "scraper-challenge/1.0",
    },
    timeout: 30_000,
  });

  return parsePartialResponse(response.data);
}