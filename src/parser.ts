import * as cheerio from "cheerio";

import { BASE_URL, extractViewState } from "./session";
import { DocumentRecord, SearchResult } from "./types";

function parseParameters(onclick: string): Record<string, string> {
  const normalized = onclick.replace(/\\"/g, '"');
  const match = normalized.match(
    /"parameters":(\{.*?\})\s*,\s*"incId"/s,
  );

  if (!match) {
    throw new Error("No se encontraron los datos de una resolución");
  }

  const parsed: unknown = JSON.parse(match[1]);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Los datos de la resolución no son válidos");
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [
      key,
      String(value)
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
          String.fromCharCode(Number.parseInt(hex, 16)),
        )
        .replace(/\\\//g, "/")
        .replace(/\\\\/g, "\\"),
    ]),
  );
}

export function parseResultPage(
  html: string,
  query: string,
): SearchResult {
  const $ = cheerio.load(html);
  const summary = $("#formBuscador\\:optResultado").text().trim();
  const totals = summary.match(
    /De un total de\s+(\d+)\s+resoluciones,\s+se obtuvieron\s+(\d+)\s+resultados/i,
  );

  if (!totals) {
    throw new Error(`No se pudo interpretar el resumen: ${summary}`);
  }

  const documents: DocumentRecord[] = [];

  $('a[title="Ver"][onclick]').each((_, element) => {
    const parameters = parseParameters($(element).attr("onclick") ?? "");
    const uuid = parameters.uuid;

    if (!uuid) {
      throw new Error("Una resolución no contiene UUID");
    }

    documents.push({
      uuid,
      recurso: parameters.recurso ?? "",
      expediente: parameters.nroexp ?? "",
      palabras: parameters.palabras ?? "",
      pretensiones: parameters.pretensiones ?? "",
      normaDI: parameters.normaDI ?? "",
      tipoResolucion: parameters.tipoResolucion ?? "",
      fechaResolucion: parameters.fechaResolucion ?? "",
      sala: parameters.sala ?? "",
      sumilla: parameters.sumilla ?? "",
      pdfUrl:
        `${BASE_URL}/jurisprudenciaweb/ServletDescarga?uuid=` +
        encodeURIComponent(uuid),
    });
  });

  if (documents.length === 0) {
    throw new Error("La búsqueda no contiene resoluciones");
  }

  const totalAvailable = Number(totals[1]);
  const totalRecords = Number(totals[2]);

  return {
    query,
    documents,
    totalAvailable,
    totalRecords,
    totalPages: Math.ceil(totalRecords / 10),
    currentPage: 1,
    viewState: extractViewState(html),
  };
}
