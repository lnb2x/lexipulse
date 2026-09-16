# Data integrity changes

## Validation

`npm run check` collects tracked-style tests under `tests/`; local experiments
under `scratch/` are not part of the correctness gate. No scratch files are deleted.
UI tests wait for the actual screen/card/database result rather than elapsed time.
`npm run test:performance` runs the existing timing budgets with one worker;
correctness assertions still run in the normal suite. Run performance budgets
on an idle machine and report failures separately from correctness failures.

## Concurrent content writes

Content updates read and write in one IndexedDB transaction. Quizlet normalization
only applies fields unchanged since its snapshot; later reviews, notes and edits
win. Deleted cards are not recreated and a rename cannot replace another term.
No schema upgrade or historical replay is required.

## Imported identifiers

An ID occupied by another term is replaced with a fresh ID. Both cards and the
original history survive. Reimporting merges by term without creating duplicates.
Quizlet set references remain attached to the incoming card. No schema change.

## Daily statistics merge

Default restore keeps an existing day with recorded reviews. Missing/empty days
are restored from the file; counts are never summed, so reimport is idempotent.
Explicit progress replacement restores file counts. This preserves local activity
without pretending overlapping histories from different devices can be added.

## Invalid backup records

Invalid nested word data or FSRS values reject that record, not the valid records
beside it. The result reports the original zero-based index and invalid field.
Rejected records and their histories are never repaired by guessing; keep the
source backup. Unsupported envelope type/version is rejected before any write.

## Backup envelope v2

Full export snapshots words, dailyStats, settingsTable and quizletSets in one read
transaction. API-key fields are blanked, including extra settings rows. The v2
envelope has schemaVersion and a SHA-256 checksum of canonical JSON (sorted object
keys, array order retained). The checksum detects corruption, not authenticity.
v1 and bare word arrays remain readable. No IndexedDB schema change is needed.

## Atomic restore

All restored tables commit in one write transaction. A write/quota failure rolls
back every table; the old session key is restored when browser storage permits.
Restoring settings clears API keys, including the current session key, so an old
credential is never attached to a restored provider endpoint. Re-enter it manually.

## Preview and selective restore

Preview never writes. It reports incoming, new, matching and removed record counts
and captures a full recovery file. Restore can select tables; replacement requires
a complete v2 recovery snapshot and replaces words and Quizlet sets together.
The current database is compared with that snapshot inside the write transaction;
another tab's edit/review makes the preview stale and blocks all writes.
Replacement rejects damaged word records rather than clearing their originals.

## Normalization safeguard

Today's-word normalization stops before any mutation if its local recovery copy
cannot be written and read back. A full localStorage quota can therefore block
this optional operation; it never bypasses the backup requirement silently.

Backup v2 khôi phục theo ID: các thẻ cùng cách viết nhưng khác ID giữ lịch sử riêng. ID trùng từ khác được bỏ qua và báo lỗi khi merge; replace từ snapshot hợp lệ giữ nguyên timestamp của thẻ.

Trong v2, `settingsTable` là nguồn cài đặt chính; `settings` chỉ để tương thích. Các trường khóa AI cũng được loại khi nhập các dòng settings mở rộng.

Sau khi transaction khôi phục từ thành công, cache thẻ và gợi ý tra cứu trong tab được xóa để không trả lại thẻ đã bị thay thế.
