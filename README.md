# Import Simulator

A one-page tool to check whether a product imported from China to Chile is worth selling.

**Live page:** https://antunesdediogo-design.github.io/import-simulator/

## What it does

- **Landed cost per product:** goods (FCA), air freight with volumetric weight, insurance, CIF, customs duty (0% with the Chile-China FTA certificate, Form F, or 6%), IVA 19% and customs agent. Shows the net cost per unit after the IVA credit.
- **Combined sea shipment (LCL):** tick several products to share one shipment. Freight is split by volume, the customs agent by goods value, and the page shows how full the billed cubic metres are and the total contribution.
- **Marketplace P&L in CLP:** RRP, commission per marketplace (Mercado Libre, Falabella, Paris, Ripley, Sodimac, own store), shipping, returns, ad spend from a ROAS, break-even ROAS, RRP for a target margin, and the IVA paid to the SII per unit.
- **Mercado Libre Full:** daily storage and old-stock charges, driven by how many days it takes to sell one unit.
- **Notes per product:** comments, links and photos.

## Where your data is saved

Everything you type is saved only in your own browser (local storage). Nothing is sent to a server. Another person opening the link starts from the example data, and clearing your browser data erases your entries.

## Sources and limits

Marketplace commissions and Mercado Libre shipping and Full rates were read from each marketplace's seller pages in November 2026 and can change. The Sodimac commission is a placeholder. Exchange rate, freight, agent cost, RRP, ROAS and returns are example values to replace with your own quotes.

This is a planning tool, not tax or legal advice. Confirm the IVA and customs treatment with your accountant and customs agent.
