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
