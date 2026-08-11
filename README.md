# SILLVIA Forecast

SurfInn dashboard for tracking Sill wave conditions around Kroessbach, Puig and
Innsbruck-Reichenau.

## What It Does

- collects Hydro Tirol water level and discharge values
- stores 15-minute history points in the Sites D1 database
- displays flow, level, delta, rainfall, volume balance and session values
- lets Wellenmeister enter and edit quality, trim and setup observations
- blends model values with saved observations for the beta wave-quality score

## Local Commands

```bash
npm install
npm run dev
npm run build
npm test
```

## Data

The Sites project uses the logical D1 binding `DB`. Migrations live in
`drizzle/`.

## Notes

The public dashboard version is shown in the page footer together with the
author attribution.
