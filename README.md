# Scraper de jurisprudencia

Scraper en TypeScript para extraer resoluciones y PDFs del Poder Judicial del Perú.

Requiere una conexión con IP de Perú.

## Uso

```bash
npm install
npm run build
```

```powershell
$env:PJ_QUERY="laboral"
$env:MAX_PAGES="3"
$env:DOWNLOAD_PDFS="false"
npm run dev
```

`MAX_PAGES` acepta un número o `all`. Para descargar PDFs, usa `DOWNLOAD_PDFS="true"`.

`PJ_QUERY` es opcional. Si no se define, se consultan todas las resoluciones de la Corte Suprema.

Los resultados se guardan en `data/`. El scraper conserva el progreso, evita descargas duplicadas y reintenta errores 429.

## Pruebas

```bash
npm test
```
