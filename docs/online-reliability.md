# Online sources remain optional

Bulk enrichment forwards cancellation to the real dictionary adapter. A cancelled or timed-out result is never saved as a successful enrichment. Already committed batches remain intact.

Dictionary deadlines cover headers and the complete response body. External cancellation remains attached until the body is read; callers receive a buffered native Response. Streaming use cases must use a separate API.

Production attempts same-origin /api/translate just like development. A 404 disables this optional source for the session; transient failures use the circuit breaker. Static deployments still fall back without requiring a server.

AI HTTP responses use the same body-aware deadline. A stalled provider response falls back to null so dictionary/local content can still be shown.

Morphology analysis shares one deadline across its two attempts, including response bodies. Expired or cancelled jobs do not retry.

AI cache entries include a hash of the target learning sense. Manual retranslation bypasses the entry and replaces it only after a valid response; normal lookups retain the 24-hour bounded cache.

Auto-enriched Quizlet imports attach missing raw source text and set membership in one transaction after rereading current cards. Existing raw provenance, notes and review history are retained.

Calls with an AbortSignal own their request lifetime and do not join another caller’s in-flight promise. Calls without a signal still deduplicate. This trades some overlapping network work for independent cancellation; completed results still share the bounded cache.
