# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

The repository root (`/Users/yanshili/me/projects/gails/`) wraps the Go module at `gails/` — the Gails codebase (a fork of Wails, module path `github.com/gailsapp/gails`). All Go work happens inside `gails/`. The wrapper root holds `Taskfile.yaml` (delegates to the inner Taskfiles), `qodana.yaml`, and `assets/`.

`gails/old` is a symlink to a legacy iOS project outside the repo; ignore it.

## Common Commands

Run from `gails/` unless noted. `task` is the build runner (https://taskfile.dev); all CI invokes Taskfile targets.

### Build / install CLI

```bash
cd gails
task install            # go install ./cmd/gails → adds `gails` to $GOPATH/bin
go build ./cmd/gails    # alternative
```

### Tests

```bash
# All Go tests (matches CI; ~10 min, requires dbus/xvfb on Linux)
go test -v -timeout 10m ./...

# Single package
go test -v ./pkg/application/...

# Single test by name
go test -v -run TestMenu ./pkg/application/...

# Linux CI variant (skips GUI service tests that hang headless)
dbus-run-session -- xvfb-run --server-args="-screen 0 1024x768x24" \
  go test -v -timeout 10m -skip TestService ./...

# Linux GTK3 legacy opt-in (default is GTK4)
go test -tags gtk3 ./...
```

### Examples (compilation smoke tests, 43 apps)

```bash
task test:examples                  # current platform only
task test:examples:all              # Mac + Windows + Linux, ~10-15 min
task test:example:darwin DIR=badge  # single example, one OS
BUILD_TAGS=gtk3 task test:examples  # GTK3 legacy build (linux)
task sanity                         # linux-only quick GTK4+GTK3 spot check
```

### Generator / runtime / templates

```bash
task generator:test                 # bindings codegen tests
task generator:test:check           # typecheck generated TS + circular-dep check
task runtime:check                  # tsc on @gailsio/runtime
task runtime:test                   # vitest on runtime
task runtime:build                  # esbuild bundles → internal/assetserver/bundledassets/
task generate:events                # regen pkg/events/events.go from events.yml
```

### Pre-commit / format

```bash
task precommit          # go test ./... + format
task format             # prettier on **/*.md (root Taskfile)
```

### Server mode (HTTP-only build)

```bash
task build:server DIR=examples/server
task test:server        # -tags server in pkg/application
```

## High-Level Architecture

Gails is a Go framework for desktop apps with web frontend. The Go process hosts a webview (WKWebView / WebKitGTK / WebView2) that loads a bundled JS runtime; user Go methods are bound to JS via reflection + JSON-RPC.

### Module layout (`gails/`)

- **`cmd/gails/main.go`** — CLI entrypoint. Uses `github.com/leaanthony/clir`. Subcommands wired to `internal/commands`:
  - `init`, `build`, `dev`, `package`, `doctor`, `task`, `version`
  - `generate {bindings, icons, syso, runtime, webview2bootstrapper, template, constants, .desktop, appimage, build-assets}`
  - `update {cli, build-assets}`, `service init`, `tool {checkport, watcher, cp, buildinfo, package, version, lipo, capabilities, has-cc, sign}`, `setup {signing, entitlements}`, `sign`, `ios {overlay:gen, xcode:gen}`
- **`pkg/application/`** — **public** desktop API. Multi-platform via `application_<os>.go` build-tag files + `.m/.h` Objective-C for darwin/ios + CGO. `application.New(Options)` returns the global `*App`; manages windows, services, events, bindings, autostart, system tray, clipboard, dialogs, browser manager. `application_server.go` (`-tags server`) drops GUI for HTTP-only mode.
- **`pkg/events/`** — Public events abstraction (multi-platform files). Generated from `tasks/events/generate.go` → run `task generate:events` after editing the event catalogue.
- **`pkg/services/`** — Built-in services users can register: `badge`, `dock`, `fileserver`, `kvstore`, `log`, `notifications`, `sqlite`.
- **`pkg/updater/`** — Self-updater framework with providers (`appcast`, `github`, `keygen`). Live tests (`*_live_test.go`) hit real APIs and are `t.Skip`-gated.
- **`pkg/w32/`** — Windows-only (`//go:build windows`) wrappers for user32/gdi32/etc. ~30 files, almost no tests.
- **`internal/commands/`** — CLI command implementations. Subdirs per platform: `{darwin,linux,windows,android,ios,dmg,webview2}` plus shared helpers. `signing_setup.go`, `entitlements_setup.go`, `msix.go`, `sign.go`, `wake_report.go` are larger files.
- **`internal/runtime/`** — Per-platform JS invocation strings (`runtime_darwin.go`, `runtime_linux.go`, etc.). The runtime JS lives at `internal/runtime/desktop/@gailsio/runtime/` (npm package, bundled by esbuild into `internal/assetserver/bundledassets/`).
- **`internal/generator/`** — Go→TS bindings generator. Uses reflection on registered services. Has `testcases/` and `testdata/` (used by `task generator:test:check`).
- **`internal/assetserver/`** — Static asset serving + webview bridge (`webview/` subdir, the Go↔JS bridge layer; 19 files, currently 0% test coverage). `bundledassets/` holds the prebuilt JS bundles (generated, gitignored patterns elsewhere).
- **`internal/wake/`** — **Go-native Taskfile executor** that replaces the `task` CLI when `WAILS_USE_WAKE=true`. Sub-packages: `ast`, `parse`, `resolve` (DAG), `exec` (cache + runner + capture), `fallback` (delegates to external `task`), `override` (Taskfile.local.yml + Taskfile.override.yml layers), `cmds` (shell/native/frontend/task-ref), `platform`. Renders builds through `internal/report` (wire protocol) + `internal/report/termui` (lipgloss spinner/`[k/N]` UI). Has its own `AGENTS.md` with detailed rules.
- **`internal/templates/`** — Frontend scaffolds (`svelte`, `vue`, `react`, `lit`, `vanilla`, `preact`, x-ts variants) generated by `gails init -t <template>`.
- **`internal/setupwizard/`** — Cross-platform installer wizard (5 files, no tests).
- **`internal/{dbus,operatingsystem,capabilities,keychain,setupwizard,signal,hash,term,version,debug,defaults,s,lo,semver,sliceutil,optional,uuid,tint,debounce,browser,fileexplorer,changelog,flags,buildinfo}/`** — Leaf utility packages.
- **`examples/`** — 43 demo apps, each a standalone `go.mod` with `replace github.com/gailsapp/gails => ../..`. Tests build them; doesn't run them.
- **`tasks/`** — Generator helpers: `events/generate.go` (regen events), `cleanup/cleanup.go` (artifact cleanup), `contribs/main.go` (all-contributors CLI), `release/release.go` (release flow), `sed/`.

### Bridge / IPC flow

1. Go app calls `application.New(Options{Services: ...})` → registers bound methods.
2. On startup, `internal/runtime/desktop/@gailsio/runtime/` JS bundle is injected into the webview (via `internal/runtime/runtime_<os>.go` `invoke` string + esbuild bundle).
3. Webview loads user frontend (embedded via `//go:embed all:frontend`); user JS calls `window.gails.xxx(args)`.
4. `internal/assetserver/webview/` translates JS messages to JSON-RPC calls into `pkg/application/bindings.go` (reflection).
5. On iOS specifically: `application_ios.go` ↔ `application_ios.m/.h` via CGO (`#cgo CFLAGS: -x objective-c -fobjc-arc`); URL scheme `gails://` is intercepted by `WailsSchemeHandler` and answered by Go's asset server in-process.

### Build / runtime tags

Common build tags you'll see on files: `darwin`, `linux`, `windows`, `ios`, `android`, `server`, `unix`, `integration`, `full_test`, `bench`, `bench && goexperiment.jsonv2`. GTK3 is opt-in via `BUILD_TAGS=gtk3` (default GTK4).

CI matrix is `windows-latest / ubuntu-latest / macos-latest` × Go 1.25, with `GOWORK=off` set so the workspace module doesn't interfere with the standalone `gails/go.mod`.

## Test coverage summary

See `TEST_COVERAGE.md` for the full audit. Key shape: utility packages (`lo`, `semver`, `sliceutil`, `optional`, `uuid`, `tint`, `flags`, `browser`, `debounce`, `gosod`) hit ~100%; `pkg/updater`, `pkg/updater/providers/*`, `internal/changelog`, `internal/fileexplorer`, `internal/doctor`, `internal/packager`, `internal/report` are 70–95%. The big gaps are `internal/assetserver/webview/*` (0%), `pkg/w32/` (~0%), `pkg/services/*` (0%), `pkg/events` (0%), `internal/operatingsystem` (0%), `internal/commands` (~22%), `pkg/application` (~22%), `internal/setupwizard` (0%), `internal/dbus/*` (0%), `pkg/doctor-ng` (0%). No fuzz tests, no `Example*` doc tests.

Benchmarks live in `*_bench_test.go` files behind `//go:build bench`; not run by default.

## Conventions / gotchas

- **Work inside `gails/`**: don't run Go commands from the repo root — the inner module is `github.com/gailsapp/gails` (Go 1.25).
- **Set `GOWORK=off`** in CI-style environments — the parent workspace module will shadow this one otherwise.
- **Asset embedding**: examples use `//go:embed all:frontend` (works whether or not `frontend/dist` exists). Use the same pattern for new examples.
- **Example replace directive**: every `examples/*/go.mod` uses `replace github.com/gailsapp/gails => ../..`. Keep this consistent — `task test:examples` standardizes it across the matrix.
- **Wake vs `task` CLI**: wake handles Taskfiles natively; set `WAILS_USE_WAKE=true` to enable. See `internal/wake/AGENTS.md` for unsupported features (dotenv, output modes, defer, interval, requires, short, run!=always) — when present, wake falls back to the external `task` binary.
- **Events code is generated**: edit the event catalogue, then `task generate:events` to regenerate `pkg/events/events.go`. Don't hand-edit that file.
- **Bundled runtime is generated**: `task runtime:build` runs esbuild over `internal/runtime/desktop/@gailsio/runtime/src/index.ts` and writes `internal/assetserver/bundledassets/runtime.js` + `runtime.debug.js`.
- **CLI flag handling**: `internal/flags/` provides `AddFlags(...)` helpers consumed by `clir` in `cmd/gails/main.go`; per-command flag structs live next to each command.
- **Markdown formatting**: prettier with printWidth 80 + proseWrap always (`.prettierrc.yml`).
- **Conventional commits** (per `.github/workflows/changelog.yml`): changelog is auto-generated from commits.
- **Release notes** accumulate in `UNRELEASED_CHANGELOG.md`, validated by `scripts/validate-changelog.go`. The nightly-release workflow promotes them.
- **Sensitive env**: `.env` at repo root contains a `GITHUB_TOKEN`. Treat as secret — don't commit, log, or echo it.