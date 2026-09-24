# Browser review — catalog assistance

24 September 2026. Disposable, loopback-only Bifrost/Registry fixtures with synthetic provider responses and keys. The existing local pilot on port 8082 and production were not modified.

## Observed interactions

| Area | Result |
| --- | --- |
| Model search | Typing narrows results; ArrowDown + Enter selects the first result. Known native access fills an empty row while native IDs remain separate from Registry aliases. |
| Creator and series | Known choices and explicit custom values work through the shared selector. |
| Reference mapping | Choosing an exact reference, then Save, persists the mapping and updates the catalogue grouping without reloading the page. |
| AI settings | The selected virtual key limits model options to its `/v1/models` IDs; endpoint selection saves successfully. |
| AI review | Chat UI exercised on the 2.2.2 preliminary fixture; Responses UI exercised on 2.2.3. Existing display name starts unchecked, unknown Tools starts checked, and applying selected fields preserves the name. Saving is separate. |
| Short viewport | At 1024 × 640 the body scrolls, capability rows are accessible, and Cancel/Save remain available. |
| Mobile | At 390 × 700 model/creator/series selection, provider prefill, mapping and Save work. |
| Key copy | Reveal fetches the synthetic secret on demand; copied text equals the displayed value. Closing removes the secret input. The prior clipboard contents were restored. |

A live Save initially crashed React because the server returned null modality arrays after catalogue enrichment. This was reproduced as a failing native probe, fixed at the DTO boundary, and the same browser Save subsequently completed with the catalogue visible and no new JavaScript error. Independent source reviews covered the editor/mapping and assistant/secret paths; findings were corrected before final qualification.

The source fixes are in `1206103`; `e25de3d` additionally bounds the mobile sheet width and displays failed catalogue refreshes even when an older catalogue is cached. On the final `e25de3d` native fixture, a 390 × 700 screenshot confirmed the whole editor stays inside the viewport with Cancel/Save visible; opening Creator offered the known fixture creator on the first click. The draft was cancelled and the viewport reset. The final native report identifies the exact delivered test artifact hashes and build source.

No real-provider metadata accuracy, paid inference, production upgrade or AMD64 2.2.3 qualification is claimed. Browser viewport overrides are temporary and reset after testing.
