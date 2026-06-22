/* Strava -> content/data/biking.json (latest ride + year-to-date km + ride day).
 * Uses a long-lived refresh token stored as a CI secret; no token is exposed
 * to the browser. Skips gracefully if secrets are not configured. */
import fs from "fs";

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;
if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
  console.log("Strava secrets missing — skipping biking.json");
  process.exit(0);
}

const tokRes = await fetch("https://www.strava.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: STRAVA_REFRESH_TOKEN
  })
});
const tok = await tokRes.json();
if (!tok.access_token) { console.error("Strava token error", tok); process.exit(1); }

const jan1 = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
let acts = [], page = 1;
while (true) {
  const r = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${jan1}&per_page=100&page=${page}`,
    { headers: { Authorization: "Bearer " + tok.access_token } }
  );
  const batch = await r.json();
  if (!Array.isArray(batch) || batch.length === 0) break;
  acts = acts.concat(batch);
  if (batch.length < 100) break;
  page++;
}

const rides = acts.filter((a) => a.type === "Ride" || a.sport_type === "Ride");
rides.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
const km = (m) => m / 1000;
const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 1 : 0 });
const ytd = rides.reduce((s, a) => s + a.distance, 0);

let out = { latestKm: "0", latestLabel: "No rides yet", ytdKm: fmt(km(ytd)), rideDay: "" };
if (rides.length) {
  const L = rides[0];
  const md = new Date(L.start_date).toLocaleString("en-US", { month: "short", day: "numeric" });
  out.latestKm = km(L.distance).toFixed(1);
  out.latestLabel = `${L.name} · ${md}`;
  const days = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const counts = {};
  rides.forEach((a) => { const w = new Date(a.start_date).getDay(); counts[w] = (counts[w] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  out.rideDay = top ? days[top[0]] : "";
}

fs.mkdirSync("content/data", { recursive: true });
fs.writeFileSync("content/data/biking.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote biking.json", out);
