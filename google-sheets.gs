/**
 * QR Maker API for Google Sheets (Apps Script).
 *
 * Sheet layout, with a header in row 1:
 *   A: external_id   B: target_url   C: name (optional)   D: short_link (filled in)   E: status (filled in)
 *
 * Setup:
 *   1. Extensions > Apps Script, paste this file.
 *   2. Project Settings > Script properties > add QR_TOKEN = your token (starts with qrs_).
 *      Keep the token in script properties, never in a cell: everyone with access to the sheet can read cells.
 *   3. Reload the sheet and use the "QR Maker" menu.
 *
 * Rows are matched by external_id, so running it again only fills in what is missing and never creates duplicates.
 */
const API = 'https://qrmaker.ai/api/v1';
const BATCH = 100;

function onOpen() {
  SpreadsheetApp.getUi().createMenu('QR Maker').addItem('Create codes for new rows', 'createCodes').addToUi();
}

function createCodes() {
  const token = PropertiesService.getScriptProperties().getProperty('QR_TOKEN');
  if (!token) throw new Error('Add QR_TOKEN under Project Settings > Script properties.');

  const sheet = SpreadsheetApp.getActiveSheet();
  const last = sheet.getLastRow();
  if (last < 2) return;
  const values = sheet.getRange(2, 1, last - 1, 5).getValues();

  // Rows that have an id and a URL but no short link yet.
  const todo = [];
  values.forEach((r, i) => { if (r[0] && r[1] && !r[3]) todo.push({ row: i + 2, external_id: String(r[0]).trim(), target_url: String(r[1]).trim(), name: String(r[2] || '').trim() }); });

  for (let start = 0; start < todo.length; start += BATCH) {
    const chunk = todo.slice(start, start + BATCH);
    const res = UrlFetchApp.fetch(API + '/qrcodes/batch', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ items: chunk.map((c) => (c.name ? { external_id: c.external_id, target_url: c.target_url, name: c.name } : { external_id: c.external_id, target_url: c.target_url })) }),
      muteHttpExceptions: true,
    });
    const body = JSON.parse(res.getContentText());
    if (!body.success) throw new Error(body.code + ': ' + body.error);

    // Results come back in the same order as the rows that were sent.
    body.data.forEach((item, i) => {
      const row = chunk[i].row;
      if (item.status === 200 || item.status === 201) {
        sheet.getRange(row, 4, 1, 2).setValues([[item.data.short_link, item.status === 201 ? 'created' : 'already existed']]);
      } else {
        sheet.getRange(row, 5).setValue((item.error && item.error.code) || 'error');
      }
    });
  }
}
