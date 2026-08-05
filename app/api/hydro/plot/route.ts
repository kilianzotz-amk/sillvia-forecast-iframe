const allowedStations = new Set(["202283", "201574", "201624"]);

function plotUrl(station: string, type: string) {
  if (type === "Q") {
    return `https://hydro.tirol.gv.at/stations/${station}/Parameter/Q/${station}_Q_JAHR.png`;
  }

  return `https://hydro.tirol.gv.at/stations/${station}/Parameter/W/${station}_W.png`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const station = url.searchParams.get("station") ?? "";
  const type = url.searchParams.get("type") === "Q" ? "Q" : "W";

  if (!allowedStations.has(station)) {
    return new Response("Unknown station", { status: 400 });
  }

  const response = await fetch(plotUrl(station, type), { cache: "no-store" });

  if (!response.ok || !response.body) {
    return new Response("Plot unavailable", { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "cache-control": "no-store",
      "content-type": response.headers.get("content-type") ?? "image/png",
    },
  });
}
