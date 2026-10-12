# QR Maker API examples

Small, complete programs for the [QR Maker REST API](https://qrmaker.ai/docs). Each one runs as it is once you set your token.

| File | What it does | Needs |
| --- | --- | --- |
| [`quickstart.sh`](https://qrmaker.ai/docs/examples/quickstart.sh) | Create a code, save its SVG, change the destination, read the scan count | `curl`, `jq` |
| [`node-quickstart.mjs`](https://qrmaker.ai/docs/examples/node-quickstart.mjs) | The same flow in JavaScript, with retry-safe creation | Node 18 or later, no packages |
| [`python-bulk-from-csv.py`](https://qrmaker.ai/docs/examples/python-bulk-from-csv.py) | Turn a CSV of links into codes, 100 per request, and save one SVG per row | Python 3.9 or later, no packages |
| [`google-sheets.gs`](https://qrmaker.ai/docs/examples/google-sheets.gs) | Create codes from spreadsheet rows and write the short links back | Google Sheets (Apps Script) |

## Before you start

1. The API is part of the **Business plan** ($29 a month or $279 a year). New customers get a 14-day free trial of the monthly plan; a card is required.
2. Create a token under **Settings → API Tokens**. It starts with `qrs_` and is shown once. Choose the read-only scope for anything that only pulls reports.
3. Call the API **from a server**. Browsers are blocked by CORS, so the token never has to be shipped to a web page.

```bash
export QR_TOKEN="qrs_your_token_here"
```

## Things that are easy to get wrong

- **Encode the `short_link`, not your own URL.** The short link is what makes the code editable and countable.
- **Send an `external_id`.** With it, creating the same code twice returns the first one instead of a duplicate, so retries are safe. A POST never changes an existing code's destination; use PATCH for that.
- **Only `code` in an error is stable.** The `error` text is for people and may change.
- **Only successful requests count** towards the 50,000 a month. The rate limit is 120 requests a minute per account.
- **The API returns SVG, not PNG.** SVG prints sharply at any size; convert it in your own system if you need a bitmap.
- **There are no webhooks.** Poll `GET /v1/scans?since_id=…` every 30 to 60 seconds and store `next_since_id`.

## Reference

- Interactive docs: <https://qrmaker.ai/docs>
- OpenAPI 3 spec: <https://qrmaker.ai/openapi.json>
- Postman collection: <https://qrmaker.ai/postman/qrmaker-api-v1.postman_collection.json>
- Rules file for AI coding assistants: <https://qrmaker.ai/llms-business-api.txt>
- Full integration guide: <https://qrmaker.ai/docs/business-api-guide.md>
