# Import Simulator

A one-page tool to check whether a product imported from China to Chile is worth selling.

**Live page:** https://antunesdediogo-design.github.io/import-simulator/

## What it does

- **Landed cost per product:** goods (FCA), air freight with volumetric weight, insurance, CIF, customs duty (0% with the Chile-China FTA certificate, Form F, or 6%), IVA 19% and customs agent. Shows the net cost per unit after the IVA credit.
- **Combined sea shipment (LCL):** tick several products to share one shipment. Freight is split by volume, the customs agent by goods value, and the page shows how full the billed cubic metres are and the total contribution.
- **Marketplace P&L in CLP:** RRP, commission per marketplace (Mercado Libre, Falabella, Paris, Ripley, Sodimac, own store), shipping, returns, ad spend from a ROAS, break-even ROAS, RRP for a target margin, and the IVA paid to the SII per unit.
- **Mercado Libre Full:** daily storage and old-stock charges, driven by how many days it takes to sell one unit.
- **Notes per product:** comments, links and photos.
- **Shipment board:** container summary per product (units, goods cost, freight, net cost, ROAS, gross and net profit, with % and a unit or total view) and a freight split by volume or by value.
- **Cost build-up with duty options:** Form F, general 6% or a custom rate, and what changes if the certificate is missing.
- **Ideas:** a block shared by André and Agustín for products still to investigate, with author, whether it exists in Chile, market price and saturation by number of listings.
- **Last edit:** each product shows who changed it last and when.

## Where your data is saved

- **Signed in as André or Agustín (Google sign-in):** the André and Agustín profiles are saved in a shared Firebase database. Each of you can open either profile with the selector at the top, and changes appear for both. Only the two emails in `firestore.rules` can read or write this data.
- **Anyone else, or before signing in:** everything is saved only in that person's own browser (local storage). Nothing is sent to a server, and clearing browser data erases it.

The Firebase web config in `index.html` is not a secret. Access is controlled by Google sign-in and the rules in `firestore.rules`, which must be published in the Firebase console (Firestore Database > Rules).

## Development

The page is built from the files in `src/` (see `ARCHITECTURE.md` for what is where).

1. Edit the files in `src/`, not `index.html`.
2. Run `python3 build.py` to rebuild `index.html` (`python3 build.py --local` writes `dist/local.html` without Firebase, for offline testing).
3. Run `node tests/run.js` (Node and Playwright with Chromium). It must end with 0 failed.
4. Commit both `src/` and the rebuilt `index.html`; GitHub Pages serves `index.html` from `main`.

## Sources and limits

Marketplace commissions and Mercado Libre shipping and Full rates were read from each marketplace's seller pages in November 2026 and can change. The Sodimac commission is a placeholder. Exchange rate, freight, agent cost, RRP, ROAS and returns are example values to replace with your own quotes.

This is a planning tool, not tax or legal advice. Confirm the IVA and customs treatment with your accountant and customs agent.
