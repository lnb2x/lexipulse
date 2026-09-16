# Online sources remain optional

Bulk enrichment forwards cancellation to the real dictionary adapter. A cancelled or timed-out result is never saved as a successful enrichment. Already committed batches remain intact.

Dictionary deadlines cover headers and the complete response body. External cancellation remains attached until the body is read; callers receive a buffered native Response. Streaming use cases must use a separate API.
