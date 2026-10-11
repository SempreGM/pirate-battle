# Production profiling — 2026-10-11

Measured against `npm run build` / `npm run preview`, not the Vite development server. Raw data: [profile.json](profile.json). The earlier, shorter software run is preserved as [profile-software.json](profile-software.json).

## Reference environment

- Windows 10.0.26300, AMD Ryzen 5 3600X, 12 logical CPUs, approximately 32 GiB RAM.
- Headless Chromium 156.0.8078.4, viewport 1440 × 1000.
- Actual renderer reported by WebGL: ANGLE / Vulkan SwiftShader software device. Removing the explicit software flag did **not** expose a hardware GPU in this environment.
- Configuration: 180-second session, 10-second alternating spawns, default remaining balance. Seed 3. An automated captain presses real movement/weapon keys along a perimeter route; it does not alter health, entities, rules or the simulation clock.

## Three-minute match

The second run completed all 180 active seconds with `time_expired`, score 7 and no uncaught JavaScript errors. It recorded 2840 frame intervals, approximately **15.77 FPS**, **100ms p95** and at most **31 entities** (ships, projectiles and effects).

The **60 FPS target was not met in this reference environment**. These results demonstrate a software-rendering limitation, not a successful hardware performance certification. The draw workload includes a full-resolution arena and antialiasing; effect display objects are rebuilt and health geometry is updated each frame. Potential follow-up optimizations include effect pooling, health redraw only when changed, resolution adaptation and profiling on an actual GPU. No unmeasured improvement is claimed.

## Five start/play/exit cycles

After the completed match, five cycles played for two wall-clock seconds each, paused and returned to the menu. CDP forced garbage collection before samples.

| Sample | DOM nodes | JS listeners | JS heap bytes |
| --- | ---: | ---: | ---: |
| Baseline | 209 | 213 | 8,042,280 |
| Cycle 1 | 232 | 205 | 8,250,612 |
| Cycle 2 | 232 | 205 | 8,427,800 |
| Cycle 3 | 232 | 205 | 8,519,924 |
| Cycle 4 | 232 | 205 | 8,623,688 |
| Cycle 5 | 232 | 205 | 8,772,424 |

DOM/listener counts stabilize after cycle 1, supporting cleanup of gameplay input and canvas ownership. JS heap grows by 730,144 bytes (approximately 713 KiB), so these samples **do not establish the absence of a memory leak**.

The investigation checked the application's cleanup and the installed Pixi texture system: application destruction removes managed GPU resources and texture event subscriptions while cached source textures remain reusable. The game disconnects ResizeObserver, removes window/document input listeners, destroys ticker/display objects and unloads audio elements. React Query and Pixi asset caches intentionally remain mounted. This explains possible retained allocations but does not prove the entire heap delta is benign. Longer-cycle heap snapshots and retainer analysis remain required to distinguish cache/JIT warm-up from continuing retention.

## Extended public-build memory investigation

[memory-20-cycles.json](memory-20-cycles.json) records 20 independent start/play/exit cycles on the public optimized build, with two seconds of actual combat per cycle and forced garbage collection after returning to the menu. No uncaught JavaScript errors occurred. Documents (3), DOM nodes (267) and JavaScript listeners (188) stayed constant across all samples.

Heap usage increased from 8,236,036 to 10,165,096 bytes (approximately 1.84 MiB). Growth slowed after initial cycles but continued through cycle 20, so this investigation does not certify leak-free behavior. Retainer snapshots remain necessary to identify the allocations; no speculative cleanup patch was applied. Reproduce with `node scripts/memory-check.mjs`.

## Profiling commands

```sh
npm run build
npm run preview
# In a second terminal:
npm run profile
```

Use `PROFILE_URL` to target another optimized preview, `PROFILE_SOFTWARE=1` to force SwiftShader, `PROFILE_HEADED=1` to use a visible browser on the target computer, and `PROFILE_OUTPUT` for a separate raw JSON output path. The reported WebGL renderer must identify the actual GPU before calling a run hardware-accelerated. On Windows, use `npm.cmd` and set `PLAYWRIGHT_BROWSERS_PATH` to the same directory used for installation. Run without simultaneous browser tests or builds. A captain may die earlier with different frame/input timing; always check `activeDuration` and `reason` before calling it a three-minute match.

For an interactive Windows measurement against the public optimized build:

```powershell
$env:PROFILE_HEADED = '1'
$env:PROFILE_URL = 'https://pirate-battle-sempregm.vercel.app'
$env:PROFILE_OUTPUT = 'reports/profile-hardware.json'
npm.cmd run profile
```

Keep the browser focused throughout the measurement. Hardware results have not yet been collected.
