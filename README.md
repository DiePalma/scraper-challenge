# Scraper de jurisprudencia

Scraper en TypeScript para extraer resoluciones y descargar PDFs del Poder Judicial del Perú.

Requiere una conexión con IP de Perú.

## Uso

```powershell
npm install
npm run build

$env:PJ_QUERY="laboral"
$env:PJ_COURT="supreme"
$env:MAX_PAGES="3"
$env:DOWNLOAD_PDFS="false"
npm run dev
```

`PJ_QUERY` es opcional. `PJ_COURT` acepta `supreme`, `superior` o `all`. `MAX_PAGES` acepta un número o `all`.

Los resultados y PDFs se guardan en `data/`.

## Pruebas

```powershell
npm test
```
