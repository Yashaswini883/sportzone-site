/* ══════════════════════════════════════════════
   CONFIG — Data Cloud credentials
   ⚠️ This file is gitignored — do NOT remove it from
   .gitignore, and never commit real secrets to GitHub.
   For a real production site, move this token exchange
   to a serverless function instead of doing it in the browser.
   ══════════════════════════════════════════════ */
const DC_CONFIG = {
  tenantEndpoint : 'https://YOUR-TENANT.c360a.salesforce.com',
  loginUrl       : 'https://YOUR-ORG.my.salesforce.com',
  clientId       : 'YOUR_CLIENT_ID',
  clientSecret   : 'YOUR_CLIENT_SECRET',
  connectorName  : 'SportZone_Web_Events',
  streams        : {
    browse  : 'ProductViewEvent',
    cart    : 'AddToCartEvent',
    session : 'WebsiteSession'
  }
};
