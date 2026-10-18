# AYA CHANGE – daily rate sync

Your site is static (Netlify), so the browser can't read another site's prices directly (CORS) and
nothing runs by itself. Solution: a free GitHub Action runs every 3 hours, reads the rates with a headless
browser, writes `rates.json`, and your site loads it.

## Setup (one time, ~10 min)
1. Create a GitHub repo, upload everything in this folder + your `index.html` (the AYA CHANGE file, renamed).
2. Paste the block from `PATCH-index-html.txt` into `index.html` just after the main script.
3. Netlify → "Add new site" → "Import from Git" → pick the repo (instead of Netlify Drop).
   Every daily commit then redeploys your site automatically.
4. GitHub → Actions tab → "Update exchange rates daily" → Run workflow (to test now).

## Notes
- The scraper reads the first two numbers per currency (buy, sell) from the source table. If the source
  redesigns its page, the run fails and the old rates are kept; check the Actions log.
- Want a margin over the source? Set BUY_OFFSET / SELL_OFFSET in the workflow (e.g. "-0.02" / "0.02").
- Their "Nous achetons / Nous vendons" columns are from their point of view, same as yours.
