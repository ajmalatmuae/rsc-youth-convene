// Registration backend (Google Apps Script web app) and the matching secret in Code.gs.
// Note: anything in this file is visible to people who inspect the page.
export const API_URL =
  'https://script.google.com/macros/s/AKfycbz6KXo9BY5ogcOfVKhPMRq11Lq9op9d7zyJ06PiRUhI9FvoTaxYvyxWxqt7KhrkVokrBQ/exec';
export const REG_KEY = 'Admin@123';

// What the barcode on the pass contains.
//   false: only the ID (e.g. YC-0007). Short, so the bars are thick and easy for a phone camera to read. The scanner page
//          shows the name and sector from the sheet.
//   true : ID|name|sector. Longer, so the bars have to be much thinner and are harder to scan.
export const BARCODE_HAS_DETAILS = false;

// Only used by the scanner page on browsers without a built-in barcode reader (for example iPhone Safari).
export const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
