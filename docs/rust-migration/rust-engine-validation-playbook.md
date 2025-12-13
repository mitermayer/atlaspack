# Rust Engine Validation Playbook for Existing Atlaspack Projects

This guide explains how to enable and validate the **Rust Atlaspack engine** in an existing codebase that already uses Atlaspack. It focuses on safe, incremental rollout: JS remains the source of truth; Rust is evaluated via dual‑run and controlled feature flags.

---

## 1. Scope and Caveats

- The Rust engine is **experimental but functional**:
  - The JS engine is still the authoritative implementation.
  - The Rust engine is wired behind feature flags and the `ATLASPACK_ENGINE` / `--engine` controls.
- Use this guide to:
  - Run your existing builds with **JS + Rust dual‑run** for parity.
  - Trial **Rust‑only** builds in non‑critical environments.
  - Maintain a **fast fallback** to JS.

---

## 2. Prerequisites

Before enabling the Rust engine in an existing project:

- **Atlaspack version**
  - Ensure your project depends on an Atlaspack version that includes:
    - `ATLASPACK_ENGINE` support in the core orchestrator, and
    - The CLI `--engine=js|rust|dual` option.
  - Check `package.json` for dependencies like:
    - `@atlaspack/cli`
    - Other `@atlaspack/*` packages
  - If in doubt, upgrade to the latest Atlaspack release and run your existing JS build first.

- **Runtime and platform**
  - Node.js: **>= 16** (or whatever is specified by the monorepo you are using).
  - OS/arch: a platform for which Atlaspack ships native binaries (macOS / Linux, x64 or arm64). Other platforms will use the WASM fallback lane if available.

- **Baseline health**
  - Your project **must already build and test successfully on the JS engine** (no `ATLASPACK_ENGINE` set, no `--engine` flag) before you attempt Rust.

---

## 3. CLI Usage (Most Projects)

Most consumers use Atlaspack through `package.json` scripts, for example:

````json
{
  "scripts": {
    "build": "atlaspack src/index.html",
    "start": "atlaspack src/index.html --watch"
  }
}
``

There are three modes you can select:

1. **JS (baseline)** – current, default behavior.
2. **Dual‑run** – JS + Rust, compares outputs, JS remains the source of truth.
3. **Rust‑only** – Rust engine runs the build; JS is not executed.

### 3.1 JS Baseline (No Change)

This is your existing setup and should be green before trying Rust:

```bash
yarn build
# or
npm run build
````

No engine flags, JS orchestrator only.

### 3.2 Dual‑Run Mode (Recommended First Step)

Use **dual‑run** to validate Rust **without changing outputs**. The JS build remains the one you ship; Rust runs in parallel and diffs are written to parity artifacts.

#### Option A: Environment variable

From your project root:

```bash
ATLASPACK_ENGINE=dual yarn build
# or
ATLASPACK_ENGINE=dual npm run build
```

This will:

- Execute the JS engine first.
- Execute the Rust engine on the same inputs.
- Compare bundles/graphs/diagnostics and write parity artifacts to the cache, typically:
  - `.parcel-cache/parity/js/<fixture-or-entry>/summary.json`
  - `.parcel-cache/parity/rust/<fixture-or-entry>/summary.json`
  - `.parcel-cache/parity/reports/<fixture-or-entry>.json`

#### Option B: CLI flag

If your CLI entrypoint exposes `--engine` (current mainline Atlaspack does), you can also run:

```bash
yarn build --engine=dual
# or
npm run build -- --engine=dual
```

This is equivalent to setting `ATLASPACK_ENGINE=dual` but is often easier to wire into package scripts or CI job definitions.

#### Suggested script setup

Add a dedicated dual‑run script so it’s easy to run locally and in CI:

```json
{
  "scripts": {
    "build": "atlaspack src/index.html",
    "build:dual": "ATLASPACK_ENGINE=dual atlaspack src/index.html"
  }
}
```

Then:

```bash
yarn build:dual
```

Run `build:dual` in a **non‑blocking environment** (nightlies, pre‑release pipelines) and inspect `.parcel-cache/parity/` for reports.

### 3.3 Rust‑Only Mode (Experimental)

Only after you gain confidence from dual‑run parity should you try Rust as the primary engine.

Run with the Rust engine only:

```bash
ATLASPACK_ENGINE=rust yarn build
# or
ATLASPACK_ENGINE=rust npm run build
```

or:

```bash
yarn build --engine=rust
# or
npm run build -- --engine=rust
```

Internally, this drives the `rustEngineEnabled` feature flag and bridges into the Rust core (`atlaspackV3`), so the Rust orchestrator handles requests instead of JS.

### 3.4 Fast Fallback to JS

If you need a **kill switch** for Rust (e.g. sudden regression in CI or production):

```bash
ATLASPACK_ENGINE_FORCE_JS_FALLBACK=true yarn build
```

This forces:

- `rustEngineEnabled = false`
- `rustEngineDualRun = false`
- `atlaspackV3 = false`

even if `ATLASPACK_ENGINE=rust` or `ATLASPACK_ENGINE=dual` is set.

This flag is the recommended way to keep Rust rollout safe and reversible.

---

## 4. Programmatic Usage (Node API)

If you create an Atlaspack instance directly from Node (e.g. in a custom build script):

```ts
import Atlaspack from '@atlaspack/core';

const bundler = new Atlaspack({
  entries: 'src/index.html',
  defaultConfig: require.resolve('@atlaspack/config-default'),
  // other options...
});

const result = await bundler.run();
```

You can use the same mechanisms as the CLI.

### 4.1 Environment variables (recommended)

The Node API respects `ATLASPACK_ENGINE` in the same way as the CLI:

```bash
ATLASPACK_ENGINE=dual node scripts/build.js
# or
ATLASPACK_ENGINE=rust node scripts/build.js
```

No code changes are required.

### 4.2 Explicit feature flags in code

If you prefer to drive the engine mode from configuration or a feature‑flag service, you can pass `featureFlags` when constructing `Atlaspack`:

```ts
import Atlaspack from '@atlaspack/core';

const bundler = new Atlaspack({
  entries: 'src/index.html',
  defaultConfig: require.resolve('@atlaspack/config-default'),
  featureFlags: {
    // Enable Rust engine
    rustEngineEnabled: true,

    // Optional: dual‑run mode (JS + Rust)
    rustEngineDualRun: false,

    // Optional: always force JS fallback even if Rust would be enabled
    rustEngineForceJsFallback: false,
  },
});
```

Notes:

- Values passed in `featureFlags` **override** environment‑derived values for those specific flags.
- If you set `rustEngineForceJsFallback: true`, the Rust engine will be disabled even when `ATLASPACK_ENGINE=rust` or `dual` is present.

A typical pattern is to use env vars or a feature flag service to compute these values before you construct the `Atlaspack` instance.

---

## 5. Project‑Level Checklist

Use this checklist when enabling the Rust engine for an existing Atlaspack‑based project.

### 5.1 Upgrade and baseline

1. **Upgrade Atlaspack packages** to a Rust‑enabled version.
2. Confirm that your **JS‑only build is green**:
   - Run your normal `build` and `test` commands with no engine flags.
   - Fix unrelated regressions before introducing Rust.

### 5.2 Add dual‑run validation

3. **Add a dual‑run script**:

   ```json
   {
     "scripts": {
       "build": "atlaspack src/index.html",
       "build:dual": "ATLASPACK_ENGINE=dual atlaspack src/index.html"
     }
   }
   ```

4. **Run `build:dual`** on representative entries:
   - Your main application entry.
   - Any complex bundles: code splitting, CSS modules, HMR, dynamic imports, etc.
   - Inspect parity artifacts under `.parcel-cache/parity/`.

### 5.3 Wire a fallback

5. Decide where to set **`ATLASPACK_ENGINE_FORCE_JS_FALLBACK=true`** as a safety net:
   - CI job configuration (e.g. for critical pipelines).
   - Production deployment environment variables.
   - Operational runbooks for incident handling.

### 5.4 Trial Rust‑only builds

6. In an internal or low‑risk environment:

   ```bash
   ATLASPACK_ENGINE=rust yarn build
   # or
   yarn build --engine=rust
   ```

7. Monitor for differences vs JS baseline:
   - Build success/failure rates.
   - Build time (cold and warm).
   - Output size and behavior (where applicable).

### 5.5 Plan rollout

8. Keep JS as the default engine while:
   - Dual‑run parity looks clean.
   - Rust‑only builds pass and behave as expected in internal environments.
   - Observability (logs, metrics, traces) around Rust is sufficient.

9. Only consider defaulting to Rust (`ATLASPACK_ENGINE=rust` or `rustEngineEnabled=true` globally) once:
   - You have a documented **fallback path** (how to force JS again).
   - The team owning Atlaspack in your environment is comfortable supporting Rust in production.

---

## 6. What You Do _Not_ Need to Change

In most cases, enabling Rust does **not** require changes to:

- Your Atlaspack configuration files (e.g. `.parcelrc`, `@atlaspack/config-default`).
- Your project’s source code (JS/TS/CSS/etc.).
- Plugin code that already passes the plugin parity tests.

The engine swap is controlled by environment variables and feature flags, not by changing your bundles or entry points.

---

## 7. Recommended Next Steps

After you’ve followed this playbook:

- Keep `build:dual` as a long‑term guardrail (e.g. nightly or weekly in CI).
- Promote `ATLASPACK_ENGINE=rust` step‑by‑step:
  - Dev machines → internal test envs → select production services.
- Track and document any intentional differences you observe between JS and Rust so they can be either fixed or codified as acceptable deltas.
