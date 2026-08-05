import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("contains the SILLVIA forecast dashboard source", async () => {
  const [page, layout, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /SILLVIA FORECAST/);
  assert.match(page, /Wellenqualit/);
  assert.match(page, /Forecast Reichenau/);
  assert.match(page, /Wellenmeister/);
  assert.match(page, /surfinn-logo\.png/);
  assert.match(styles, /brand-lockup/);
});

test("keeps required API routes and database migrations", async () => {
  const apiRoutes = await readdir(new URL("../app/api/", import.meta.url), {
    recursive: true,
  });
  const migrations = await readdir(new URL("../drizzle/", import.meta.url));

  assert.ok(apiRoutes.includes("collect/route.ts"));
  assert.ok(apiRoutes.includes("history/route.ts"));
  assert.ok(apiRoutes.includes("hydro/route.ts"));
  assert.ok(apiRoutes.includes("surf-observations/route.ts"));
  assert.ok(migrations.some((file) => file.endsWith(".sql")));
  assert.ok(migrations.includes("0004_backfill_surfinn_sessions.sql"));
});
