export interface DocumentRecord {
  uuid: string;
  recurso: string;
  expediente: string;
  palabras: string;
  pretensiones: string;
  normaDI: string;
  tipoResolucion: string;
  fechaResolucion: string;
  sala: string;
  sumilla: string;
  pdfUrl: string;
}

export interface SearchResult {
  query: string;
  documents: DocumentRecord[];
  totalAvailable: number;
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  viewState: string;
}
