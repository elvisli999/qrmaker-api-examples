// QR Maker API quickstart for Node 18+ (uses the built-in fetch, no packages).
// Usage: QR_TOKEN=qrs_... node node-quickstart.mjs
import { writeFile } from 'node:fs/promises'

const API = process.env.QR_API ?? 'https://qrmaker.ai/api/v1'
const TOKEN = process.env.QR_TOKEN
if (!TOKEN) throw new Error('Set QR_TOKEN to an API token from Settings > API Tokens')

/** One request. Retries on 429 and 5xx; throws an Error carrying the stable error `code` otherwise. */
async function api(method, path, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Number(res.headers.get('Retry-After')) || attempt * 2
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    const json = await res.json()
    if (!json.success) {
      // Branch on `code` (stable), not on `error` (wording may change).
      throw Object.assign(new Error(`${json.code}: ${json.error}`), { code: json.code, status: res.status, params: json.params })
    }
    return { json, replay: res.headers.get('X-Idempotent-Replay') === 'true' }
  }
}

// 1. Create. Because of external_id, running this twice never creates two codes:
//    same external_id + same target_url -> 200 with the existing code (X-Idempotent-Replay: true);
//    same external_id + a different target_url -> 409 EXTERNAL_ID_CONFLICT (a POST never moves a printed code).
const wanted = {
  target_url: 'https://example.com/spring-menu',
  external_id: 'demo-menu-1',
  name: 'Spring menu',
  folder: 'demo',
  style: { dot_style: 'fluid', finder_shape: 'smooth', fg_color: '#111111' },
}
let code, how
try {
  const created = await api('POST', '/qrcodes?include=svg', wanted)
  code = created.json.data
  how = created.replay ? 'Already existed' : 'Created'
} catch (err) {
  if (err.code !== 'EXTERNAL_ID_CONFLICT') throw err
  // The code exists and points somewhere else (step 2 of an earlier run moved it). Load it instead.
  code = (await api('GET', `/qrcodes/by-external-id/${encodeURIComponent(wanted.external_id)}?include=svg`)).json.data
  how = 'Already existed (destination was changed earlier)'
}
await writeFile(`${code.external_id}.svg`, code.svg)
console.log(`${how}: ${code.id} -> ${code.short_link}`)

// 2. Change the destination. A POST with a different target_url would return 409; PATCH is the explicit way.
const patched = await api('PATCH', `/qrcodes/by-external-id/${encodeURIComponent(code.external_id)}`, {
  target_url: 'https://example.com/summer-menu',
})
console.log('Now points to', patched.json.data.target_url, '| picture unchanged:', patched.json.data.image_version === code.image_version)

// 3. Scans for the last 30 days.
const stats = (await api('GET', `/qrcodes/${code.id}/analytics?tz=America/Toronto`)).json.data
console.log(`Scans: ${stats.scans} (${stats.unique_visitors} unique), bots filtered out: ${stats.bot_scans}`)

// 4. New scan events since the last one you processed. Store next_since_id and pass it next time.
const feed = (await api('GET', '/scans?since_id=0&limit=100')).json
console.log(`Fetched ${feed.data.length} scan events; next since_id = ${feed.next_since_id}`)
