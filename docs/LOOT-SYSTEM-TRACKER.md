# Tiered Soft Reserve: Design and Progress Tracker

- Document ID: LOOT-PLAN
- Stage: DESIGN_ONLY
- Last updated: 2026-11-01
- Branch: `feature/tiered-soft-res-loot`
- Implementation authorization: NOT_GRANTED
- Governing instructions: [copilot-instructions.md](../.github/copilot-instructions.md)

## How we use this tracker

This is our shared feature plan, not a second instructions file or a claim that features exist.
Read the governing instructions and this tracker before continuing this feature.
Use stable IDs when discussing changes, for example "approve D-03" or "expand I-07".
Keep requirements, recommendations, decisions, and implementation evidence separate.
Update existing rows rather than creating competing plans. Do not start code without approval.

| Record | Allowed status values | Meaning |
| --- | --- | --- |
| Idea `I-*` | REQUIRED, EXPLORING, DEFERRED, DROPPED | REQUIRED captures the requested capability, not approval of its detailed rules. |
| Decision `D-*` | OPEN, APPROVED, REJECTED, SUPERSEDED | A recommendation stays OPEN until explicitly agreed; record the approval below. |
| Work `W-*` | TODO, IN_PROGRESS, BLOCKED, DONE | DONE requires evidence; design completion is not implementation completion. |
| Acceptance `A-*` | NOT_RUN, PASS, FAIL, DEFERRED | PASS requires actual test evidence, not a design walkthrough. |

## Goal and terminology

Give members meaningful item priorities while officers control raid policy and exceptional claims.
The website collects choices; the addon runs eligible rolls and announces results.
The existing desktop/AppHelper bridge transports the plan, not a live website connection.

- **Soft reserve:** a character's item choice; shared claims are resolved by rolling.
- **Tier:** a priority group, such as first choice or second choice, not a roll bonus.
- **Pick:** one item selection within a tier; officers configure picks per tier.
- **Hard reserve:** a proposed guaranteed claim for a named recipient, subject to eligibility.
- **Officer shortlist:** an alternative ordered list of named claimants; not necessarily a guarantee.
- **Roll session:** one controlled contest for one physical item copy.
- **Award:** confirmed delivery, distinct from a suggested winner or an announcement.
- **Snapshot:** a locked, versioned set of rules and reservations for a specific raid session.

## Idea inventory and reasoning

| ID | Status | Idea and proposed behavior | Reasoning / caution | Decisions |
| --- | --- | --- | --- | --- |
| I-01 | REQUIRED | Officer-controlled item priority for named people, above normal soft reserves. | Supports progression needs and exceptions; guaranteed claims and shortlists are different policies. | D-01 |
| I-02 | REQUIRED | Members choose items on a webpage for a specific character and raid. | Accessible outside the game; requires verified character control, not a free-text name claim. | D-04, D-08 |
| I-03 | REQUIRED | Officers configure tier count and a separate pick allowance per tier. | Supports one or two overall picks as well as larger tiered formats; defaults must not become fixed limits. | D-02 |
| I-04 | REQUIRED | Only the highest eligible tier rolls; lower tiers wait. | Preserves the meaning of first choice; a high lower-tier roll cannot bypass priority. | D-03, D-07 |
| I-05 | REQUIRED | Addon counts eligible rolls and announces the winner in raid chat. | Reduces manual mistakes; cannot prevent `/roll` or override the game's loot permissions. | D-09, D-10 |
| I-06 | REQUIRED | Officers can remove reservations and exceptional claims. | Handles errors and roster changes; removals must not silently erase history or alter a live contest. | D-11 |
| I-07 | EXPLORING | Spend earned points to improve a roll, optionally DKP-like. | Adds agency but also accounting and fairness risks; points should not bypass tiers. Recommend a later phase. | D-13 |
| I-08 | EXPLORING | Use attendance and loot history to inform officer-approved bad-luck reserves. | Human review handles context better than an automatic attendance-to-item guarantee. | D-12 |
| I-09 | EXPLORING | Lock selections before the raid and import a clearly identified snapshot. | Avoids changing picks after seeing drops and makes offline decisions reproducible. | D-04, D-05 |
| I-10 | EXPLORING | Separate roll outcomes, confirmed awards, and corrections in an audit history. | An announced winner may disconnect, pass, or never receive the item. | D-06, D-11 |

## Proposed raid flow (not yet approved)

1. Officer creates a loot session for a raid/date, with tier allowances and published rules.
2. Members submit choices; the website shows remaining picks and reservation competition.
3. Officers review exceptional claims and publish changes before the selection deadline.
4. Officer locks the plan; the server produces a snapshot with raid identity and revision.
5. Collector logs out, completes desktop sync, then logs in to load returned AppHelper data.
6. Designated loot controller verifies the snapshot and participating roster before starting.
7. For each item copy, check officer priority, then the first tier with eligible takers.
8. Open a bounded roll window; count one valid roll per eligible character, or record a pass.
9. Close the window; resolve ties within the tied group and announce the suggested winner.
10. Officer confirms delivery; only then consume applicable picks and record the award.
11. Upload outcomes through the normal bridge when SavedVariables are safely written.

Proposed priority: **officer claim -> Tier 1 -> Tier 2 -> further tiers -> fallback policy**.
A lower tier opens only when the higher group has no eligible takers or all pass/time out.
A tier is not abandoned merely because a lower-tier player rolled higher.
Snapshot invalid/missing: stop managed rolling with a visible explanation; never silently open-roll.

### Worked examples (illustrations, not test results)

- Mira and Oren select the same sword in Tier 1; Tess selects it in Tier 2.
  Only Mira and Oren compete. Tess's roll is ignored even if it is higher.
- If Mira is absent and Oren passes, Tess becomes eligible when Tier 2 is opened.
- An approved hard reserve for Mira takes precedence if Mira meets the agreed eligibility rules.
  If Mira is absent, whether to release or retain that claim is still D-07, not an automatic award.
- A tie at 87 causes a reroll only between the tied players; it does not reopen lower tiers.
- Two identical swords create two item-copy sessions; the second recalculates eligibility
  after the first confirmed award under the agreed consumption and duplicate rules.

## Decision register

Every row is OPEN. Proposed defaults are discussion starters, not approved policy.

| ID | Status | Decision needed | Recommended starting point and why |
| --- | --- | --- | --- |
| D-01 | OPEN | Hard reserve, ordered officer shortlist, or both? Who may approve? | Start with one visible hard-reserve recipient per item/session; simpler than overlapping priority lists. Officer approval and reason required. |
| D-02 | OPEN | Tier/pick defaults, overall cap, and technical limits? | Example only: three tiers with 1/2/2 picks. Configurable per tier; publish limits before submissions. Choose bounds after client/payload review. |
| D-03 | OPEN | Are picks equal within a tier? Can one item occupy multiple tiers? | Equal within a tier; no repeated item across a character's tiers. Avoid a hidden second ranking. |
| D-04 | OPEN | Per raid/date, reset, or season? Deadline and carry-forward? | Per scheduled raid session; explicitly copy prior choices into a new draft rather than silently carrying active claims. |
| D-05 | OPEN | Who locks/unlocks? What about mid-raid edits and stale imports? | Officer lock creates a revision; revisions require explicit re-import. No website change silently mutates an active roll. |
| D-06 | OPEN | Does a win consume one pick, all picks, or nothing? | Consume only the winning item selection after confirmed delivery; other choices retain their tier. Decide replacement picks and repeat-copy eligibility explicitly. |
| D-07 | OPEN | Presence, disconnects, passes, timeout, bench, and absent hard-reserve holders? | Present raid characters compete; bench history is separate. All pass/time out advances tiers. Require officer resolution of an absent hard reserve. |
| D-08 | OPEN | Character ownership, member accounts, alts, guests, and signup limits? | Verify ownership before self-service; one participating character per player/session. Define officer-entered choices for members without website access and guests. |
| D-09 | OPEN | Roll range/window, repeated rolls, ties, and identity matching? | Standard 1-100; first valid roll counts; reject wrong ranges, outsiders, and late rolls. Timed tied-player rerolls; choose timeout and tie-pass rules. |
| D-10 | OPEN | Unreserved fallback, off-spec order, and award automation? | Officer explicitly opens main-spec, then off-spec fallback. Start with manual delivery and confirmation, not automatic loot assignment. |
| D-11 | OPEN | Removal/override permissions, notice, history, and privacy? | Record actor, reason, and before/after state. Cancel/reopen affected active rolls; correct awards with linked events, never erase evidence. Publish claim priority; decide reason visibility. |
| D-12 | OPEN | Bad-luck window, qualifying loot, bench credit, and reserve expiry? | Show 30/60/90-day evidence; officer-approved, item-specific reserve with expiry. Define meaningful upgrades and main/alt aggregation before calculating eligibility. |
| D-13 | OPEN | Points earning, caps, spending, refunds, and reset policy? | Defer initially. Later consider a capped, predeclared within-tier bonus, spent only on confirmed wins; define losing-bid refunds and corrections first. |
| D-14 | OPEN | Item catalog, variants, tokens, recipes, and class/spec restrictions? | Stable item IDs plus raid/difficulty context; validate eligibility and availability. Existing local item cache is not a complete raid loot catalog. |
| D-15 | OPEN | Who controls rolls, handoff, restart recovery, and conflicting collectors? | One designated controller per session with an explicit handoff. Persist active state; reconcile duplicates and conflicting claims visibly. |

### Decision log

| Entry | Date | Record | Outcome / evidence |
| --- | --- | --- | --- |
| L-01 | 2026-11-01 | Scope | User requested planning only, then a shared Markdown tracker. No gameplay policy approved and no implementation authorized. |

## Boundaries and implementation implications

These are constraints and design targets, not implemented feature claims.

- Existing [loot/attendance storage](../apps/api/src/db/schema.ts) and
  [append-only ingestion](../apps/api/src/services/ledgerSync.service.ts) are useful evidence,
  but recorded receipt does not prove eligibility, an upgrade, or a contested-roll loss.
- Existing [officer detection](../apps/addon/FlockSync/Officer.lua) is collection-related.
  Do not assume it grants loot-controller authority; distinguish collector, controller, and approver.
- Preserve same-guild/realm checks. Validate website permissions and character ownership server-side;
  clients cannot confer authority merely by declaring themselves officers.
- Keep shared DTOs/Zod validation in shared-types; API owns website policy and persistence;
  web owns choice/review UX; desktop/AppHelper transports snapshots; addon runs local contests.
- Website-to-game data is a snapshot, not an HTTP connection from Lua.
  Existing [bridge guidance](../DEPLOYMENT.md) applies; never overwrite helper data during play.
- Member self-service may need new account/ownership capabilities. Do not assume the existing
  officer dashboard can safely be exposed unchanged to ordinary members.
- Validate the actual Interface 16001 roll events, localization, character identity, raid chat,
  loot permissions, and behavior for players without the addon before promising enforcement.
- Addon messages must respect the 255-byte limit, chunk above 250 bytes, and throttle.
  Lua remains 5.1, event-driven, and namespace-isolated; no polling or OS/file/network bypass.
- Snapshot revisions identify locked policy; mutable-record epoch conflict checks still apply.
  Use stable event IDs for retry-safe uploads; define reconciliation before enabling multiple writers.
- Preserve existing loot/attendance history. Awards, corrections, and point transactions need
  linked audit events; a stale sync must not resurrect a removed claim or double-charge points.

## Work tracker and dependencies

Only W-01 is complete. All code phases remain blocked on design approval and explicit permission.

| ID | Status | Deliverable | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| W-01 | DONE | Capture ideas, tradeoffs, open decisions, and scope in this tracker. | None | This document; no runtime changes. |
| W-02 | TODO | Agree core raid rules, permissions, and initial feature scope. | W-01 | Approved D-01 through D-11, D-14, D-15; explicit disposition of D-12/D-13 in decision log. |
| W-03 | TODO | Validate item source, member ownership, bridge limits, and game events. | W-01 | Bounded feasibility findings and safe test plan; no implementation implied. |
| W-04 | BLOCKED | Define shared contracts, persistence, audit, and migration design. | W-02, W-03 | Reviewed design plus explicit authorization to proceed to implementation. |
| W-05 | BLOCKED | Implement website/API choices, officer controls, and locked snapshots. | W-04 | Permission/validation tests, typecheck, affected builds and candidate artifact. |
| W-06 | BLOCKED | Implement desktop/AppHelper transport and snapshot verification. | W-05 | Round-trip, stale-revision, conflict, and safe-file-I/O tests; candidate artifacts. |
| W-07 | BLOCKED | Implement addon eligibility, rolls, announcements, and confirmed awards. | W-06 | Lua 5.1 regression evidence and controlled in-game test candidate. |
| W-08 | BLOCKED | Complete end-to-end acceptance and maintainer handoff. | W-07 | Acceptance table evidence, numbered manual checklist, blocker disposition. |
| W-09 | BLOCKED | Reconsider optional bad-luck automation and points economy. | W-08 | Separate approval of D-12/D-13 details; no automatic inclusion in first version. |

## Acceptance tracker

Planned future checks only. No manual acceptance has passed; no production testing is authorized.

| ID | Status | Required outcome | Validation surface |
| --- | --- | --- | --- |
| A-01 | NOT_RUN | Configured tiers/picks enforced; duplicate and invalid items rejected; members edit only authorized characters. | API validation/permissions and web UX |
| A-02 | NOT_RUN | Lock/revision behavior is explicit; missing/stale imports cannot silently manage rolls. | API, desktop, AppHelper, addon |
| A-03 | NOT_RUN | Higher tiers exclude lower ones; pass/absence and hard-reserve paths follow approved rules. | Lua fixtures plus controlled game check |
| A-04 | NOT_RUN | Outsider, duplicate, wrong-range, late, tied, and non-addon-player rolls behave correctly. | Lua fixtures plus localized game events |
| A-05 | NOT_RUN | Winner chat is accurate; delivery is separate; corrections and duplicate copies preserve history and pick rules. | Addon, ledger, round-trip sync |
| A-06 | NOT_RUN | Unauthorized controllers, conflicting collectors, replayed sync, and restarts cannot silently corrupt outcomes. | Permissions, recovery, idempotency tests |
| A-07 | NOT_RUN | Existing collection, loot history, attendance, and member addon workflows remain intact. | Relevant regressions, typecheck, affected builds |
| A-08 | DEFERRED | Point spending/refunds and bad-luck calculations follow approved, explainable rules. | Only if optional feature scope is authorized |

## Next discussion

Start with D-01: does officer priority guarantee an item, establish an ordered shortlist,
or create another contested priority group? Then settle D-02/D-06 together: pick allowances
and what winning consumes determine how the system feels over an entire raid.
Before coding, resolve the other core decisions, feasibility findings, and explicit authorization.
