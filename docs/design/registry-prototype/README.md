# Bifrost Registry — interactive design prototype

From this directory, run `npm ci` then `npm run dev -- --port 4173 --strictPort`. Open http://127.0.0.1:4173/. Run `npm run build` and `npm run check` to verify compilation and demo state logic.

All records and API responses are illustrative, held in browser memory. Refresh or **Demo settings → Reset demo** resets the demo. No gateway, credentials, provider calls, or production data are used. The optional **Quick tour** can be restarted from the header. Sofian's UX approval is still pending; this prototype is not the UI currently served by the plugin.

The React UI primitives in `src/components/ui/`, `src/hooks/`, `src/lib/utils.ts`, `src/globals.css`, and the Bifrost images in `public/` are copied from [Maxim AI Bifrost](https://github.com/maximhq/bifrost) commit `6493abd3d1422c9bfde95f242fd57b38e73ce881` (`ui/`). `globals.css` adapts Tailwind source scan paths; `textarea.tsx` drops the unused autosize variant and its dependency. These upstream files remain under the Apache 2.0 license in `LICENSE`. Geist font files have their separate SIL Open Font License in `public/static/fonts/OFL.txt`. The screens and fixture data in `src/App.tsx` and `src/demo.ts` are new prototype code. Exact source hashes and shell adaptations are recorded in `PROVENANCE.md`.
