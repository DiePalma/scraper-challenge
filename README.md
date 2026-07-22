# Scraper OEFA

Scraper en TypeScript para extraer resoluciones y descargar PDFs del repositorio público de OEFA, usando Axios y Cheerio.

Sitio: https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml

## Instalación

```bash
npm install
npm run build
```

## Ejecución

```powershell
$env:MAX_PAGES="3"
$env:DOWNLOAD_PDFS="false"
npm run dev
```

`MAX_PAGES` acepta un número o `all`. `DOWNLOAD_PDFS` acepta `true` o `false`.

Los resultados se guardan en `data/`:

- `documents.json`
- `downloaded.json`
- `failed-downloads.json`
- `pdfs/`

El scraper guarda el progreso, evita descargas duplicadas y reintenta errores temporales y respuestas 429.

## Pruebas

```bash
npm test
```
