# Pirate Battle — Business Rules

Version: 1.0 · Source: supplied React & PixiJS challenge.

This document defines observable gameplay and product behavior. Requirements from the challenge are mandatory. Rules marked **Design decision** resolve unspecified behavior and may be tuned without removing a mandatory requirement. This document does not claim that implementation, tests or profiling have already been completed.

## 1. Product and scope

**RN-001 — Objective.** Provide a single-player, top-down naval shooter in the browser. The player navigates around islands, destroys enemy ships and earns points until time expires or the player dies.

**RN-002 — Delivery scope.** The complete challenge is the acceptance scope, including touch controls, API failure recovery, automated tests, visual regression, profiling and public deployment. These requirements cannot be postponed as optional improvements.

**RN-003 — Local gameplay.** Combat and settings operate locally. Network availability must not gate starting, configuring or playing the game. Ranking and history use simulated REST APIs; the product does not require a private service.

**RN-004 — Language.** All delivered UI text, code identifiers and documentation must be in English.

**RN-005 — Player identity. Design decision.** Generate and persist a local player ID on first use and use the display name `Captain` for the current player. No login is required. Fixture players have distinct IDs and names. Identity persists across refreshes in the same browser storage; clearing that storage creates a new identity.

## 2. Screens and navigation

**RN-006 — Main menu.** Display `Play`, `Options`, control instructions and the `Ranking` and `Match History` tabs. Failure in either tab must leave the other menu actions usable.

**RN-007 — Options.** Provide labeled `Game session time` and `Enemy spawn time` inputs, current saved values, validation feedback and an explicit `Save` action. Unsaved edits do not affect gameplay.

**RN-008 — Match screen.** Display the full arena, player/enemy health indicators, score, remaining time, controls and a pause action. Semantic interface text must also expose score, time and match state.

**RN-009 — Result screen.** Display total score, effective active duration, end reason, submission status and `Play Again` / `Main Menu`. A failed or pending submission offers a retry action and never disables starting another match.

**RN-010 — Last result.** Persist the last completed result locally and restore it after refresh. **Design decision:** refreshing while on the result screen restores that screen; otherwise the menu provides `Last Result` when one exists. Restoring a result must not create another match record.

## 3. Settings and balance

**RN-011 — Session validation.** Accept a finite integer duration from 60 to 180 seconds, inclusive. Reject empty, nonnumeric, fractional and out-of-range values without changing the saved configuration.

**RN-012 — Spawn validation. Design decision.** Accept a finite integer spawn interval from 1 to 10 seconds, inclusive. Document these limits in the UI and README. Reject invalid values without changing the saved configuration.

**RN-013 — Persistence.** Save valid options locally and restore them after refresh. **Design decision:** use validated defaults when saved data is missing or malformed; display an accessible message if saving fails rather than claiming persistence succeeded.

**RN-014 — Configuration snapshot.** At match creation, copy the entire effective gameplay configuration into an immutable snapshot. All systems and the submitted result use that snapshot. Later settings changes apply only to subsequent matches.

**RN-015 — Central balance.** Keep duration, spawn interval/distribution, health, movement and rotation speeds, damage, projectile speed/range/lifetime, weapon cooldowns and Shooter range in a typed, adjustable configuration. Balance changes must not require changing combat rules.

Initial balance proposals, not values required by the challenge:

| Parameter | Proposed default |
| --- | --- |
| Session duration | 120 seconds |
| Spawn interval | 3 seconds |
| Player health | 100 |
| Chaser health / impact damage | 30 / 25 |
| Shooter health / projectile damage | 50 / 10 |
| Player projectile damage | 10 per projectile |
| Front weapon cooldown | 0.30 seconds |
| Left / right weapon cooldown | 1 second each |
| Shooter weapon cooldown | 1.5 seconds |
| Enemy distribution | Alternating Chaser and Shooter |

Movement, rotation, collision dimensions and projectile parameters must also receive documented positive values in the implementation configuration. Tune these values against the final arena dimensions and assets; record the final values before delivery.

## 4. Match lifecycle

**RN-016 — States.** Support loading, ready, running, paused, completed and abandoned states. Only running advances simulation time. Loading failures keep combat stopped and offer a retry.

**RN-017 — Start conditions.** Start only after required assets load successfully and the player initiates play. Create a unique match ID, capture the configuration, set full health and zero score, initialize a full timer and clear all previous entities, inputs and effects.

**RN-018 — Active time.** Duration measures simulated active gameplay time, excluding asset loading and all paused periods. Time cannot become negative or exceed the configured duration.

**RN-019 — Completion.** Complete the match when remaining time reaches zero or player health reaches zero. End reasons are `time_expired` and `player_destroyed`. **Design decision:** if both occur in the same simulation update, use `player_destroyed`; do not simulate events beyond the session deadline.

**RN-020 — Completion is final.** Finalize each match once. Stop movement, attacks, damage, spawning and score changes immediately. Capture the result before leaving combat. Cosmetic end effects may continue without modifying gameplay.

**RN-021 — Abandonment.** Refreshing or leaving combat while running or paused abandons the match. Do not record an abandoned match in ranking/history and do not overwrite the last completed result. A result already completed before navigation remains eligible for submission.

**RN-022 — Restart.** `Play Again` creates a new ID and a fresh snapshot of currently saved settings. Restore health, score, timer, weapon readiness and spawn schedule; remove previous entities and held input. Pending submissions from previous matches survive.

## 5. Player and controls

**RN-023 — Movement.** The player advances along the ship's heading and rotates left/right. Movement and rotation are based on elapsed active time and remain consistent across frame rates.

**RN-024 — Controls. Design decision.** Use `W` / `ArrowUp` for forward movement, `A` / `ArrowLeft` and `D` / `ArrowRight` for rotation, `Space` for frontal fire, `Q` for left fire, `E` for right fire and `Escape` / `P` for pause. Show these controls in the interface.

**RN-025 — Touch.** Provide labeled touch controls for forward movement, both rotation directions, all three attacks and pause. Support simultaneous movement and firing with multiple pointers. Released, cancelled or interrupted touches clear their input.

**RN-026 — Input behavior. Design decision.** Held attack buttons fire repeatedly subject to cooldown. Opposing rotation inputs cancel each other. Multiple attack commands may operate together, each respecting its weapon cooldown.

**RN-027 — Input scope.** Capture gameplay keys only in the active gameplay context. Clear held input when pausing, losing focus, leaving combat or restarting. Menu buttons remain usable by keyboard.

**RN-028 — Health.** Player health is limited, never below zero or above maximum. Enemy projectiles and Chaser impacts reduce health. Display health above the player ship and update deterioration feedback as health decreases.

## 6. Arena and collisions

**RN-029 — Arena.** Include water and at least one island. The full playable arena remains visible at supported screen sizes. Resizing must not change the match configuration or world rules.

**RN-030 — Ship boundaries.** Player and enemy collision bodies cannot leave the arena or intersect islands. **Design decision:** blocked movement stops at the collision boundary; blocked movement alone causes no damage. Enemy steering must accommodate islands while preserving each enemy's behavior.

**RN-031 — Projectile collisions.** Islands block all projectiles. A projectile is removed on its first valid target/obstacle impact, expiration or departure from the arena. Collision detection must handle fast projectiles without skipping obstacles or ships between updates.

**RN-032 — Collision ownership.** Player projectiles damage living enemies; enemy projectiles damage the player. **Design decision:** no friendly fire, player self-damage, projectile-versus-projectile damage or ship contact damage except the Chaser impact. Enemy ships do not damage each other.

**RN-033 — Hit order. Design decision.** When a projectile crosses multiple objects in one update, resolve the earliest collision along its path. An island before an enemy blocks that shot. Resolve equal-distance collisions consistently using obstacle priority, then stable entity ID.

## 7. Weapons and scoring

**RN-034 — Frontal attack.** Each accepted frontal shot produces exactly one projectile along the player's current forward direction.

**RN-035 — Lateral attacks.** Each accepted left or right attack produces exactly three parallel projectiles on that side. Their origins are separated along the hull and their headings are perpendicular to the ship's forward direction. They are not a spreading fan.

**RN-036 — Cooldowns.** Each weapon enforces its own configured interval between attacks, measured in active time. **Design decision:** front, left and right cooldowns are independent and ready at match start. Cooldowns do not progress while paused.

**RN-037 — Projectile contract.** Each projectile has an owner, direction, speed, damage and configured range or lifetime. It applies damage at most once, even when multiple overlaps are detected in one update.

**RN-038 — Enemy destruction.** Once health reaches zero, immediately remove the enemy from targeting, firing, contact damage and collision participation. Its explosion is visual feedback only.

**RN-039 — Score.** Award exactly one point per enemy destroyed by player attacks. Do not award points for Chaser self-destruction against the player, abandoned entities, visual effects or any event after completion.

**RN-040 — Competing lethal events. Design decision.** Resolve projectile collisions before Chaser contact within each update, then evaluate player death. If player fire already destroyed a Chaser, it cannot cause contact damage. Stable entity ordering ensures reproducible outcomes.

## 8. Enemies and spawning

**RN-041 — Chaser.** Advance and rotate toward the player while respecting islands/bounds. On contact with a living player during active combat, apply configured impact damage once and destroy itself. That impact gives no score.

**RN-042 — Shooter.** Advance and rotate toward the player. Within configured attack range, fire toward the player subject to its weapon cooldown. Islands continue to block fired projectiles. **Design decision:** stop advancing while within range, continue aiming and resume approach when outside range.

**RN-043 — Spawn timing.** Spawn according to the configured interval until completion. **Design decision:** create one enemy per interval; the first spawn occurs after one complete interval. Alternate types so both occur in a standard surviving match. A player who dies before the second spawn may naturally see only one type.

**RN-044 — Safe spawn.** Spawn only where the full enemy body is inside the arena, outside islands/other ships and sufficiently distant from the player. **Design decision:** configure a minimum safe separation greater than contact distance plus one second of maximum closing movement; enemies cannot deal damage on their creation update.

**RN-045 — No safe location. Design decision.** Search a bounded set of valid candidates. If none is safe, skip that spawn and try at the next interval. Never force an overlapping spawn or loop indefinitely. Tests use seeded candidate selection.

## 9. Pause and feedback

**RN-046 — Manual pause.** Pause active combat from its button or keyboard command. Display a pause dialog with `Resume` and `Main Menu`; leaving through the menu abandons the match.

**RN-047 — Automatic pause.** Pause when the page loses focus or becomes hidden. Returning focus alone does not resume combat; resumption requires a player action.

**RN-048 — Frozen simulation.** While paused, freeze movement, damage, attacks, projectile lifetime, spawn timers, cooldowns and session time. On resume discard paused elapsed time and held inputs; do not catch up paused simulation.

**RN-049 — Feedback.** Provide perceptible firing, impact, damage and destruction effects plus ship deterioration based on remaining health. Effects must preserve arena readability and cannot apply additional damage or points.

## 10. Results, history and ranking

**RN-050 — Result record.** Every completed result includes match ID, player ID/name, completion date, score, effective active duration, end reason and the complete configuration snapshot. Use an unambiguous timestamp; format dates for display. **Design decision:** also store a balance/rules version to distinguish later gameplay changes.

**RN-051 — History.** Return only the current player's confirmed completed matches, with date, score, duration and end reason. **Design decision:** order newest first, then match ID ascending for timestamp ties. Pending submissions are labeled separately and are not presented as confirmed history.

**RN-052 — Comparable ranking.** Rank match entries only against the exact same canonical gameplay configuration and rules version. **Design decision:** the default ranking filter uses currently saved configuration; disclose that filter. Canonical comparison ignores property ordering and excludes UI/network settings and random seeds.

**RN-053 — Ordering.** Sort ranking by score descending. **Design decision:** ties use completion timestamp ascending, then match ID ascending. Display player identity, score and position within the selected configuration. Ranking contains match entries, not an aggregation of each player's best score.

**RN-054 — Pagination. Design decision.** Use 10 entries per page in both tabs. Provide previous/next actions, current page and total count; disable invalid navigation. Empty responses show a clear empty state. Return to page 1 when the ranking filter changes.

**RN-055 — Submission state.** Use `pending`, `submitting`, `confirmed` and `failed` submission states independently of match completion. A network error cannot reverse completion or discard its result.

**RN-056 — Durable pending queue.** Persist completed payloads before their first network submission. Keep all unconfirmed results across refresh, failure and new matches, rather than keeping only the last result. Reuse the original immutable payload for every retry.

**RN-057 — Idempotency.** Use match ID as the submission identity. Repeated requests, clicks or retries return the existing record without adding history/ranking entries. **Design decision:** conflicting payloads using the same ID return a conflict response instead of overwriting the original match.

**RN-058 — Consistency.** Confirmed registration creates one history record and one ranking entry atomically from the same result. Subsequent queries and refreshes observe that confirmed state. Remove a queued payload only after confirmation, including recovery of an already-registered match.

**RN-059 — Retry behavior.** Provide manual retry for unconfirmed submissions. **Design decision:** transient errors receive at most two automatic retries with bounded backoff; validation/conflict errors do not automatically retry and display an actionable error. Only one in-flight submission per match is allowed.

**RN-060 — Timeout recovery.** A timeout does not prove registration failed. Re-submit with the same match ID. If the mock API already committed the record, return it without duplication, then mark the local submission confirmed.

**RN-061 — Query freshness.** Refresh and invalidate both tabs after confirmation and refresh them when shown again. Cache keys distinguish player, configuration and page. Late responses must not replace a newer result for the same view; preserve useful cached content during background refresh and identify stale/error states accessibly.

**RN-062 — Network states.** Each tab supports initial loading, empty, loaded, background refresh and error with retry. Errors leave gameplay/settings accessible. Pending matches may submit while the player starts another match; their responses cannot navigate away from or change the new combat session.

## 11. Mock network scenarios

**RN-063 — Shared simulated data.** Development, automated tests and deployed demonstration share typed contracts, fixtures and MSW network handlers. Persist confirmed records and pending requests locally so refresh does not silently reset them.

**RN-064 — Scenario selector.** Provide a documented selector for success, empty lists, multiple pages, fixed slowness, variable latency, out-of-order responses, timeout, connection failure, HTTP 4xx/5xx, ranking-only failure, history-only failure, post-commit timeout and end-of-match outage followed by recovery. Seeds and timing make each scenario reproducible.

**RN-065 — Reset. Design decision.** A clearly labeled demo reset restores fixtures, clears simulated confirmed records, pending submissions, query caches and fault settings, and returns to the menu. Keep the player's saved options and identity. Because it discards demo match data, show an explicit confirmation describing that effect. Tests reset their complete isolated storage without this UI flow.

## 12. Responsive experience and accessibility

**RN-066 — Mobile layout. Design decision.** Support portrait and landscape: keep the arena aspect ratio and fit its full bounds; place controls/HUD around it without cropping. Use sufficiently large touch targets and prevent gestures on game controls from scrolling gameplay. Resize input coordinates consistently with the canvas.

**RN-067 — Accessible interface.** Menus have keyboard navigation, visible focus, associated labels, adequate contrast and accessible loading/error messages. Dialogs move and contain focus appropriately, then restore focus on close. Expose score, time and match state semantically without announcements every frame.

**RN-068 — Loading.** Display asset loading progress or an explicit loading state. On failure identify the problem and offer a new attempt. Combat cannot start with missing required resources.

## 13. Technical and delivery acceptance — separate from business rules

These constraints are mandatory, but describe implementation and evidence rather than gameplay policy:

- React handles menus/forms/dialogs; PixiJS handles arena, ships, projectiles, effects and ship indicators. TypeScript strict mode is enabled.
- Axios performs ranking/history HTTP calls; TanStack Query manages queries and registration mutations; MSW intercepts the network in development, tests and the published build.
- Separate simulation rules, rendering, input and interface state. Keep continuous combat state in the simulation; do not render React on every frame.
- Use elapsed-time simulation, texture loading/reuse, pixel-density-aware canvas sizing and correct Strict Mode initialization/teardown. Release listeners, tickers, timers, entities and resources on exit/restart.
- Implement the challenge's twelve Playwright coverage groups, in Chromium desktop and mobile. Combat tests operate actual controls and real rules. Use isolated state, seeds and controlled simulation time.
- Version visual baselines for menu, stable arena and results. Deliver an HTML report and failure traces when failures occur.
- Profile optimized three-minute combat against a 60 FPS target. Report frame rate, frame interval p95 and entity counts with hardware, browser, resolution and match configuration. Investigate memory/resource growth across five start/play/exit cycles; state limitations honestly.
- Use supplied assets and include sources/licenses for supplied and complementary resources. Deliver code, lockfile, assets, contracts, fixtures, mocks and tests.
- README documents setup, environment variables, controls, final balance, scenarios/reset, failure reproduction and development/build/preview/lint/typecheck/Playwright commands. ARCHITECTURE explains simulation, collisions, React/Pixi integration, lifecycle, persistence, contracts, cache and recovery.
- Deliver a public functional deployment matching the submitted repository; refresh and mocks must work there, without private services. Expected flows must have no unhandled console errors.
- Communicate an implementation time estimate to the evaluator before coding. This document does not send that message or select a deadline on the candidate's behalf.

## 14. Official behavior examples

| Situation | Expected result |
| --- | --- |
| Five enemies killed by player shots; two Chasers self-destruct on contact | Score is 5 |
| All three lateral projectiles hit the same enemy | Each projectile applies damage once; killing the enemy awards only 1 point |
| Pause after 20 active seconds in a 120-second match for 30 wall-clock seconds | Remaining time is still 100 seconds; cooldowns/spawns remain frozen |
| Player dies after 42 active seconds | One completed result: duration 42 seconds, reason player_destroyed |
| Surviving player reaches the end of a 60-second match | One completed result: duration 60 seconds, reason time_expired |
| Refresh during unfinished combat | Match abandoned; no registration; previous completed result preserved |
| Register commits, but response times out | Queue remains; retry recovers the same record, with one entry in each tab |
| Start a new match while an older submission is pending | New combat starts normally; both match identities remain independent |
| Change session duration from 120 to 180 seconds | New matches use 180; existing snapshots remain 120; rankings stay separated |
| A shot crosses an island before reaching an enemy | Shot removed at island; enemy takes no damage |
| Return to the page after automatic pause | Match remains paused until explicit Resume |

## 15. Change policy

The supplied challenge is authoritative. Changes to design decisions must be reflected in this document, the configuration, relevant tests and delivery documentation. Do not silently drop mandatory scope or change recorded match snapshots. A change affecting comparability requires a new rules/balance version.
