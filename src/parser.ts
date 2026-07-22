import * as cheerio from "cheerio";
import { DocumentRecord, SearchResult } from "./types";


function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseDownloadData(onclick: string): {
  uuid: string;
  downloadAction: string;
} {
  const uuidMatch = onclick.match(/['"]param_uuid['"]\s*:\s*['"]([^'"]+)['"]/);
  const actionMatch = onclick.match(
    /['"]([^'"]+:dt:\d+:j_idt\d+)['"]\s*:\s*['"]\1['"]/,
  );

  if (!uuidMatch || !actionMatch) {
    throw new Error("No se pudo interpretar la accion de descarga de una fila");
  }

  return {
    uuid: uuidMatch[1],
    downloadAction: actionMatch[1],
  };
}


function parseTable(html: string): Omit<SearchResult, "viewState"> {
  const $ = cheerio.load(html);
  const documents: DocumentRecord[] = [];

  $("#listarDetalleInfraccionRAAForm\\:dt_data tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length < 7) {
      return;
    }

    const downloadLink = cells.eq(6).find("a[onclick]");
    const downloadData = parseDownloadData(downloadLink.attr("onclick") ?? "");

    documents.push({
      index: Number(cleanText(cells.eq(0).text())),
      expediente: cleanText(cells.eq(1).text()),
      administrado: cleanText(cells.eq(2).text()),
      unidadFiscalizable: cleanText(cells.eq(3).text()),
      sector: cleanText(cells.eq(4).text()),
      resolucion: cleanText(cells.eq(5).text()),
      ...downloadData,
    });
  });

  const paginatorText = cleanText($(".ui-paginator-current").first().text());
  const paginatorMatch = paginatorText.match(
    /Pagina\s+(\d+)\s+de\s+(\d+)\s+\((\d+)\s+registros\)/i,
  ) ?? paginatorText.match(
    /Página\s+(\d+)\s+de\s+(\d+)\s+\((\d+)\s+registros\)/i,
  );

  if (!paginatorMatch) {
    throw new Error(`No se pudo interpretar la paginacion: ${paginatorText}`);
  }

  return {
    documents,
    currentPage: Number(paginatorMatch[1]),
    totalPages: Number(paginatorMatch[2]),
    totalRecords: Number(paginatorMatch[3]),
  };
}


export function parsePartialResponse(xmlBody: string): SearchResult {
  const xml = cheerio.load(xmlBody, { xmlMode: true });
  const tableHtml = xml(
    'update[id="listarDetalleInfraccionRAAForm:pgLista"]',
  ).text();

  const viewStateElement = xml("update")
    .toArray()
    .find((element) =>
      (xml(element).attr("id") ?? "").includes("javax.faces.ViewState"),
    );
  const viewState = viewStateElement ? xml(viewStateElement).text().trim() : "";

  if (!tableHtml) {
    throw new Error("La respuesta JSF no contiene la tabla de resultados");
  }

  if (!viewState) {
    throw new Error("La respuesta JSF no contiene un ViewState actualizado");
  }

  return {
    ...parseTable(tableHtml),
    viewState,
  };
}