# Local MVP implementation notes

## Assets and teaching material

The ball asset is an original Blender model, supplied as an editable `.blend`, exported `.glb`, and inspected PNG render. It represents a concept product because the customer's prototype image was not accessible in this workspace. The initial learning library contains four beginner and three progression lessons authored in `COURSE-CONTENT.md`; these are written instruction, not video footage.

## Payment boundary

Test payment is explicitly labelled `paid_test`. It does not call Zarinpal or move money. It checks order ownership, verifies available stock and decrements stock once. Production payment handling requires verified callbacks and transaction reconciliation before replacing this test flow.

## Storage boundary

The initial Go service supports PostgreSQL persistence through a single JSONB state record and offers a separate explicitly enabled JSON-file demonstration mode. The current state is loaded into memory and protected by a process mutex. Run one API process against a database. Multiple instances would require database transactions and concurrency control to prevent lost updates. Persistence failures roll back the in-memory mutation.

## Deployment boundary

Local demonstration credentials must be replaced before sharing a server. PostgreSQL mode requires an explicit administrator password. Login throttling is implemented in the API process; production needs shared rate-limit storage, a production session/cookie policy, managed secrets, backup/restore verification, delivery communication, actual product details, shipping and return policies, and real-gateway verification. The storefront currently uses English copy and toman prices; a Persian RTL version remains a business decision.

These notes describe implementation boundaries and should be read alongside the final README verification results.
