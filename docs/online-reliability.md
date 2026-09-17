# Online sources remain optional

Bulk enrichment forwards cancellation to the real dictionary adapter. A cancelled or timed-out result is never saved as a successful enrichment. Already committed batches remain intact.

Dictionary deadlines cover headers and the complete response body. External cancellation remains attached until the body is read; callers receive a buffered native Response. Streaming use cases must use a separate API.

Production attempts same-origin /api/translate just like development. A 404 disables this optional source for the session; transient failures use the circuit breaker. Static deployments still fall back without requiring a server.

AI HTTP responses use the same body-aware deadline. A stalled provider response falls back to null so dictionary/local content can still be shown.

Morphology analysis shares one deadline across its two attempts, including response bodies. Expired or cancelled jobs do not retry.

AI cache entries include a hash of the target learning sense. Manual retranslation bypasses the entry and replaces it only after a valid response; normal lookups retain the 24-hour bounded cache.

Auto-enriched Quizlet imports attach missing raw source text and set membership in one transaction after rereading current cards. Existing raw provenance, notes and review history are retained.

Calls with an AbortSignal own their request lifetime and do not join another caller’s in-flight promise. Calls without a signal still deduplicate. This trades some overlapping network work for independent cancellation; completed results still share the bounded cache.

Quizlet URL endpoints in Vite and the optional standalone server share admission limits: at most two requests per process (including uploads), an 8 KiB request body and a five-second upload deadline. Excess work receives structured 413/503 responses; paste import remains available. Deploy reverse-proxy rate limits if exposing the optional service publicly.

Quizlet browser jobs have a 30-second deadline, including launch, navigation and extraction. Disconnect cancels the browser; admission is held until cleanup finishes. An in-progress browser launch may take up to its bounded launch timeout to stop. Chromium sandbox is enabled (Linux deployments must support it); no unsafe fallback disables it. Security challenges return immediately to paste import. Browser launch failures no longer expose raw process details. This is an application budget, not a hard OS memory/CPU quota; use a constrained non-root container for public hosting.

Quizlet page resources are restricted to HTTPS on quizlet.com, www.quizlet.com, assets.quizlet.com, quizletstatic.com and assets.quizletstatic.com. Every redirect is checked; public DNS answers are pinned into TLS connections, with private/reserved IPv4 and non-global/reserved IPv6 rejected. Each job allows 150 resource requests, 8 MiB per response, 32 MiB total and three redirects. Compressed responses are rejected when a server ignores the identity request. Images/audio/fonts, WebSockets, downloads and page service workers are disabled. No cookies or authorization headers are forwarded. This may reject future Quizlet/CDN changes; use paste import until the allowlist is reviewed. Keep OS/network isolation for hostile browser exploits; application routing is not a container firewall.

Extraction rejects more than 10,000 cards, text fields over 20,000 characters, or embedded JSON above 8 MiB of characters. Limits return resource_limit without partial terms; 1,000-card extraction is covered with a local fixture. These limits do not limit the size of the local deck or alter saved cards.

The Quizlet client deadline also covers backend response bodies, so an incomplete JSON download exits to the timeout state instead of leaving the import spinner running.

Busy, timeout, blocked-source and size-limit responses have Vietnamese/English explanations and a visible paste-import fallback. Technical diagnostics use status/code rather than dumping those backend responses.

Production builds emit sw-precache.js with every built asset, including nested lazy review modes and export tools. Installation succeeds only when the full precache succeeds. First paint remains separate; offline readiness begins after serviceWorker.ready. Serve the entire dist directory (including sw-precache.js) from the origin root.

Updates wait for user consent. Only the accepting tab reloads; update is disabled during an active review, import/export, settings or word edit, and lookup requests. Other tabs keep their in-memory session and cached build assets. Navigation uses the active build's cached HTML to avoid mixing versions. Only LexiPulse shell caches can be removed, during a natural activation with no open windows; long-lived tabs may retain multiple builds until all tabs close. Nothing touches IndexedDB. Keep previous deployment assets when upgrading clients from the older partial-cache worker. Worker/update files must be revalidated by the host (Cache-Control: no-cache); deploy assets and manifest before publishing the worker.

References: [MDN service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [Playwright Chromium sandbox](https://playwright.dev/docs/api/class-browsertype).

Static asset cache matches ignore Vary because the same-origin hashed files have identical bytes; this covers preview/proxy hosts that add Vary: Origin. External fonts and remote audio remain optional network resources and are not precached.
