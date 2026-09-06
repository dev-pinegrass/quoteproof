# QuoteProof

Compare two or three supplier quotes using source evidence and exact INR arithmetic. Per-carton pricing, minimum order quantities and missing freight can change what an apparent low price means.

## Current status

The working practice flow extracts the supplied synthetic sample, checks source quotations, computes totals, exposes missing costs, supports explicit user assumptions and exports a JSON report. The NVIDIA-on-Nebius adapter is implemented, but live inference has **not** been verified. Practice alone does not satisfy the hackathon's runtime requirement.

## Run and test

Use Node 22.13+ and npm. Run `npm ci`, then `npm run dev -- --port 3122`. Run `npm run test:unit` for the twelve arithmetic and evidence tests. With the server running, `npm test` includes four HTTP checks; override `TEST_URL` if using another port. Type-check with `npx tsc --noEmit`, lint with `npx oxlint app lib --deny-warnings`, and build with `npm run build`.

## Live configuration

Set secret `NEBIUS_API_KEY` in hosting secrets or ignored `.dev.vars`. Set `NEBIUS_MODEL_ID` to an NVIDIA model available in your Token Factory account. The current candidate is `nvidia/Nemotron-3_5-Lightning`; confirm account availability and run an actual inference before claiming integration. Requests use `https://api.tokenfactory.nebius.com/v1/chat/completions`. No API key is sent to the browser. Live errors remain visible and never become canned results.

## Input and decision boundaries

Only INR and labeled text terms are supported. Paste one term per line, for example `Unit price: INR 110.00`, `Minimum quantity: 1`, `Freight: INR 0.00`, and `Tax: INR 0.00`. A carton quote must state its units per carton. Missing freight or tax remains unknown; missing required price, pack or minimum quantity evidence rejects extraction. Source validation checks both exact quotations and whether the quoted text establishes the numeric value.

Costs use integer paise and exact ratios, not floating-point rounding. Minimum quantity can make a quote incomparable for the requested quantity. A landed-cost winner requires at least two comparable offers with complete costs. Editable freight/tax overrides are separately exported as user assumptions, never supplier evidence. No purchasing, payments or supplier contact occurs.

Live analysis sends pasted quotes to Nebius. Reports stay in the page until exported; editing source text invalidates the report. Provider usage and latency are retained when returned. There is no measured live extraction accuracy, latency or cost yet. The malicious-document test covers the deterministic validator, not NVIDIA model robustness. Browser interactions and WebMCP execution have not been verified.

Original work began September 6, 2026. Sites, React and shadcn provide the scaffold/UI; original application source is MIT licensed. Public video, judging access, platform feedback and a live evaluation remain submission tasks.
