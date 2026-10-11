# Pirate Battle architecture

## Responsibilities

React owns screens, forms, dialogs, the semantic HUD and network panels. `Simulation` owns continuous combat state. PixiJS owns the arena, entities, ship health indicators and effects. `InputController` combines keyboard and multiple pointer inputs, and `GameAudio` manages sound playback. No network request participates in combat.

The configuration in `src/game/config.ts` is typed and copied/frozen at match creation. Rendering uses a 1200 × 760 logical world and scales the entire world to the canvas without changing collision coordinates. Default balance is documented in the configuration; options only expose duration and spawn interval. Rules version `1.0.0` is included in every result.

## Simulation and collisions

The ticker feeds an accumulator with a capped real frame delta. Combat advances in fixed 1/120-second steps. The remaining deadline clamps the final step. Only running advances active time. Pausing clears held keys/pointers and the accumulator; resumption requires an explicit action. A frame stall does not cause a large collision step or paused-time catch-up.

Ships use circular collision bodies. Island collision bodies are circular and independent of decorative tiles. Blocked movement stops; enemies steer around obstacles using a local look-ahead tangent. Projectiles use segment-versus-expanded-circle intersection, selecting the earliest collision, then obstacle priority and entity ID. Projectiles resolve before Chaser contact. A destroyed ship immediately stops participating in targeting and contact. Chaser contact never increments score.

Each front attack generates one projectile. Broadside attacks generate three parallel projectiles at hull offsets −16, 0 and +16, with independent front/port/starboard cooldowns. Spawns alternate types and search at most 48 seeded candidates, rejecting island/ship overlap and separation below 340 units. This exceeds combined contact radii plus one second of maximum closing speed (43 + 275 = 318). The first spawn follows a full interval.

## Rendering and lifecycle

Required textures load through a shared promise and Pixi Assets cache; failures clear the promise for retry. A match cannot run before successful asset loading. Ship/projectile display objects are reused by entity ID and removed on destruction. The ResizeObserver fits the logical world inside the canvas with device pixel ratio capped at 2. React HUD updates are throttled to ten per second; no per-frame React combat state.

Every effect setup has a cancellation guard. Strict Mode can mount/unmount while texture loading or async Application.init is pending: a cancelled initialization destroys its own application. Unmount removes keyboard/visibility/focus listeners, stops/destroys the application, disconnects resize observation and releases audio elements. Cached source textures remain reusable across matches. Effect sprites are currently short-lived and rebuilt per frame; profiling must establish whether pooling is necessary.

## Persistence and REST mocks

Browser localStorage stores options, player identity, last result, result-screen restoration, confirmed mock records, fault scenario and the complete pending queue. Unfinished combat is never persisted or submitted. Storage is browser-local, not a remote shared leaderboard. Other captains come from deterministic fixtures.

Axios calls GET `/api/ranking?config&version&page`, GET `/api/history?playerId&page` and POST `/api/matches`. MSW intercepts these URLs in development and production. Handlers share typed contracts and fixture generation. Ten entries per page; ranking sorts score descending, completion ascending, ID ascending; history sorts completion descending, ID ascending. Canonical configuration comparison sorts property keys and includes all gameplay parameters and the rules version.

The result is persisted in the pending queue before its first registration. TanStack Query mutations submit it with up to two bounded retries for transient failures. A per-ID in-flight guard prevents duplicate concurrent requests. Manual retries reuse the same immutable payload. The mock POST handler commits a single source record that feeds both views; an existing ID returns the original or rejects conflicting data with HTTP 409. Post-commit timeout demonstrates recovery without duplicate entries. Queue removal follows confirmation only.

Queries use configuration/player/page keys, AbortSignal cancellation, cached placeholder content and explicit loading/error/refresh states. Confirmation invalidates both tabs; showing a tab revalidates it. Selecting a network scenario cancels queries before invalidation. Pending mutation completion cannot navigate or change a new combat session.

## Accessibility and testing

Native dialogs manage modal focus and restore previous focus; menus have labeled fields and visible focus. The semantic HUD exposes score, time and health without a live announcement every frame. Game keys are captured only while running. Touch uses pointer capture and separate pointer IDs, permitting motion and firing together. Both mobile orientations fit the arena in full.

`?test=1&seed=42` exposes read-only state snapshots and controlled simulation advancement while leaving inputs, collisions, damage and Pixi rendering real. It does not inject entities or mutate health. Playwright runs desktop and mobile Chromium in isolated browser contexts; snapshots are versioned and HTML reports/traces are generated. Profiling runs separately against an optimized preview; automated software rendering is not evidence of consumer GPU performance.

## Remaining delivery evidence

Public deployment, asset provenance/licenses and performance evidence must be verified before declaring the challenge complete. See `DELIVERY_STATUS.md` for measured results and outstanding limitations.
