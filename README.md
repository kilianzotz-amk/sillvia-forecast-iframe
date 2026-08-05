# SILLVIA Forecast

SurfInn forecast dashboard for the Sill wave in Innsbruck.

The app combines live hydro data for Kroessbach/Ruetz, Puig/Sill, and
Innsbruck-Reichenau with collected history, surf observations, wave quality
ratings, and forecast model controls.

## Live App

Current production deployment:

https://sill-confluence-monitor.kilianzotz.chatgpt.site/

## Tech Stack

- Next/Vinext app running on a Cloudflare Worker style runtime
- Cloudflare D1 binding named `DB`
- Drizzle schema and migrations in `db/` and `drizzle/`
- Hydro data helpers in `lib/hydro.ts`
- API routes in `app/api/`

## Local Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

## Build And Test

```bash
npm run build
npm test
```

## GitHub Pages Note

GitHub Pages can only serve static files. This repository now contains the full
application source code, but the live data APIs, collector cron endpoint, and D1
database need a Worker-capable deployment target. For embedding into the
SurfInn website, use the production URL above as the iframe source unless this
app is deployed to another full-stack host.

Example iframe:

```html
<iframe
  src="https://sill-confluence-monitor.kilianzotz.chatgpt.site/"
  title="SILLVIA Forecast"
  style="width: 100%; height: 900px; border: 0;"
  loading="lazy"
></iframe>
```
