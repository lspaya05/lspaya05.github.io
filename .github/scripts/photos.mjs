/* Google Photos album -> content/data/pictures.json ([{caption, image}]).
 * Uses an OAuth refresh token stored as a CI secret. Skips gracefully if
 * secrets are not configured.
 *
 * NOTE: Google Photos `baseUrl`s are short-lived (~60 min). For a daily build
 * that means URLs can expire before the next run. If you see broken images,
 * either (a) run this workflow more often, or (b) switch this script to
 * download the bytes into assets/photos/ and emit local paths instead. */
import fs from "fs";

const {
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_PHOTOS_ALBUM_ID
} = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_PHOTOS_ALBUM_ID) {
  console.log("Google Photos secrets missing — skipping pictures.json");
  process.exit(0);
}

const tokRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token"
  })
});
const tok = await tokRes.json();
if (!tok.access_token) { console.error("Google token error", tok); process.exit(1); }

let items = [], pageToken;
do {
  const r = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ albumId: GOOGLE_PHOTOS_ALBUM_ID, pageSize: 50, pageToken })
  });
  const j = await r.json();
  if (j.error) { console.error(j.error); process.exit(1); }
  (j.mediaItems || []).forEach((m) =>
    items.push({ caption: (m.description || "").trim(), image: m.baseUrl + "=w1200" })
  );
  pageToken = j.nextPageToken;
} while (pageToken);

fs.mkdirSync("content/data", { recursive: true });
fs.writeFileSync("content/data/pictures.json", JSON.stringify(items, null, 2) + "\n");
console.log("wrote pictures.json", items.length, "photos");
