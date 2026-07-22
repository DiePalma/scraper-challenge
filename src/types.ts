export interface DocumentRecord {
  index: number;
  expediente: string;
  administrado: string;
  unidadFiscalizable: string;
  sector: string;
  resolucion: string;

  uuid: string | null;
  downloadAction: string | null;
}

export interface SearchResult {
  documents: DocumentRecord[];
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  viewState: string;
}
