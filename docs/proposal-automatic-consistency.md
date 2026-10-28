# Automatic consistency before publication

The legacy autonomous proposal pipeline previously checked facts in a background job after saving a section. This allowed later sections to draft before earlier decisions were registered. Prompt instructions alone did not prevent contradictory values or placeholders.

Autonomous sections passing through ResearchService now audit their draft against the existing project facts before saving. A detected disagreement triggers one targeted Markdown repair, followed by another audit. Invalid audit responses, unresolved conflicts, empty repair output, or lost embedded chart payloads block publication and enter the existing NeedsReview flow. Previously established facts remain authoritative; the repair does not accept a competing generated value as canonical. Successful checks register new facts synchronously before the next autonomous section starts, and skip the duplicate background facts check. Citation verification still runs on the repaired content.

The check also rejects common unresolved design placeholders such as `[bracketed retention period ...]` and `[insert ...]`. The repair reuses an established value where available; it must omit an unsupported commitment rather than invent a decision. Required missing decisions can still need review.

This adds one fact audit per autonomous section and, only when needed, one repair and one repeat audit. The existing section execution budget still applies. It cannot guarantee that a model detects every semantic contradiction. Existing saved proposals are not silently rewritten. The separate strict specification workflow is unchanged by this patch.

Activation requires running the rebuilt backend. An already-running API process does not load source changes. Avoid restarting a worker while it is generating a section.
