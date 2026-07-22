# Scraper de sitio web de jurisprudencia

Scraper en TypeScript para extraer resoluciones y descargar PDFs del Poder Judicial del Perú. Desarrollado como desafío de Scraping.

Requiere una conexión con IP de Perú.

## Uso

```powershell
npm install
npm run build
npm run scrape:all
```

`scrape:all` busca sin filtro, procesa ambas cortes y descarga todos los PDFs. El progreso queda guardado en `data/` para evitar descargas duplicadas.

Para realizar una búsqueda limitada:

```powershell
$env:PJ_QUERY="laboral"
$env:PJ_COURT="supreme"
$env:MAX_PAGES="3"
$env:DOWNLOAD_PDFS="false"
npm run dev
```

`PJ_QUERY` es opcional. `PJ_COURT` acepta `supreme`, `superior` o `all`. `MAX_PAGES` acepta un número o `all`.

## Pruebas

```powershell
npm test
```
