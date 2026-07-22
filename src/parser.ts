import * as cheerio from "cheerio";

import { BASE_URL, extractViewState } from "./session";
import { CourtScope, DocumentRecord, SearchResult } from "./types";

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

function parseDocuments(html: string, court: CourtScope): DocumentRecord[] {
  const $ = cheerio.load(html);
  const documents: DocumentRecord[] = [];

  $('a[title="Ver"][onclick]').each((_, element) => {
    const parameters = parseParameters($(element).attr("onclick") ?? "");
    const uuid = parameters.uuid;

    if (!uuid) {
      throw new Error("Una resolución no contiene UUID");
    }

    documents.push({
      court,
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
    throw new Error("La página no contiene resoluciones");
  }

  return documents;
}

export function parseResultPage(
  html: string,
  query: string,
  court: CourtScope,
): SearchResult {
  const $ = cheerio.load(html);
  const summary = $("#formBuscador\\:optResultado").text().trim();
  const totals = summary.match(
    /De un total de\s+(\d+)\s+resoluciones,\s+se obtuvieron\s+(\d+)\s+resultados/i,
  );

  if (!totals) {
    throw new Error(`No se pudo interpretar el resumen: ${summary}`);
  }

  const documents = parseDocuments(html, court);

  const totalAvailable = Number(totals[1]);
  const totalRecords = Number(totals[2]);

  return {
    court,
    query,
    documents,
    totalAvailable,
    totalRecords,
    totalPages: Math.ceil(totalRecords / 10),
    currentPage: 1,
    viewState: extractViewState(html),
  };
}

export function parsePartialPage(
  xmlBody: string,
  metadata: {
    query: string;
    court: CourtScope;
    currentPage: number;
    totalAvailable: number;
    totalRecords: number;
    totalPages: number;
  },
): SearchResult {
  const xml = cheerio.load(xmlBody, { xmlMode: true });
  const fragments = xml("update")
    .toArray()
    .map((element) => xml(element).text())
    .join("\n");
  const viewStateElement = xml("update")
    .toArray()
    .find((element) =>
      (xml(element).attr("id") ?? "").includes("javax.faces.ViewState"),
    );
  const viewState = viewStateElement
    ? xml(viewStateElement).text().trim()
    : "";

  if (!viewState) {
    throw new Error("La paginación no devolvió un ViewState");
  }

  return {
    ...metadata,
    documents: parseDocuments(fragments, metadata.court),
    viewState,
  };
}
