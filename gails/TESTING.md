# Cross-Platform Testing Guide for Gails

This document describes the cross-platform testing system for Gails examples, supporting Mac, Linux, and Windows compilation.

## Overview

The testing system ensures all Gails examples build successfully across all supported platforms:

- **macOS (Darwin)** - Native compilation
- **Windows** - Cross-compilation from any platform
- **Linux** - Native compilation on the host

## All Examples (No DIR Parameter Needed)

```bash
# Current platform only (all examples + CLI code)
task test:examples

# All examples for all supported platforms
task test:examples:all

# CLI code testing only
task test:cli
```

## Single Example Builds (Requires DIR=example)

```bash
# macOS/Darwin single example
task test:example:darwin DIR=badge

# Windows cross-compilation single example
task test:example:windows DIR=badge

# Linux native build (on Linux systems)
task test:example:linux DIR=badge

# Linux native build with GTK3 (legacy, opt-in via -tags gtk3)
task test:example:linux:gtk3 DIR=badge
```

## Build Artifacts

All builds generate platform-specific binaries with clear naming:

- **macOS**: `testbuild-{example}-darwin`
- **Windows**: `testbuild-{example}-windows.exe`
- **Linux**: `testbuild-{example}-linux`
- **Linux GTK3 (legacy)**: `testbuild-{example}-linux-gtk3`

Example outputs:

```text
examples/badge/testbuild-badge-darwin
examples/badge/testbuild-badge-windows.exe
examples/badge/testbuild-badge-linux
```

## Validation Status

### Current Status

- **Total Examples**: All examples tested
- **macOS**: ✅ All examples compile successfully
- **Windows**: ✅ All examples cross-compile successfully
- **Linux**: ✅ Native compilation (host arch)
- **Build System**: Taskfile.yaml integration
- **Git Integration**: .gitignore patterns for build artifacts

## Platform Requirements

### macOS (Darwin)

- Go 1.23+
- Xcode Command Line Tools
- No additional dependencies required

**Environment Variables:**

```bash
CGO_LDFLAGS="-framework UniformTypeIdentifiers -mmacosx-version-min=10.13"
CGO_CFLAGS="-mmacosx-version-min=10.13"
```

### Windows (Cross-compilation)

- Go 1.23+
- No additional dependencies for cross-compilation

**Environment Variables:**

```bash
GOOS=windows
GOARCH=amd64
```

### Linux (Native)

- Go 1.23+
- GTK4 + WebKitGTK 6.0 development headers (default)
- Or GTK3 + WebKit2GTK 4.1 (legacy, opt-in via `BUILD_TAGS=gtk3`)

## Build Process Details

### macOS Builds

1. Sets macOS-specific CGO flags for compatibility
2. Runs `go mod tidy` in each example directory
3. Compiles with `go build -o testbuild-{example}-darwin`
4. Links against UniformTypeIdentifiers framework

### Windows Cross-Compilation

1. Sets `GOOS=windows GOARCH=amd64` environment
2. Runs `go mod tidy` in each example directory
3. Cross-compiles with `go build -o testbuild-{example}-windows.exe`
4. No CGO dependencies required (uses Windows APIs)

### Linux Builds

1. Runs `go mod tidy` in each example directory
2. Compiles natively with `go build -o testbuild-{example}-linux`
3. Default uses GTK4/WebKitGTK 6.0; GTK3 via `BUILD_TAGS=gtk3`

## Troubleshooting

### Go Module Resolution Errors

```bash
Error: replacement directory ../gails does not exist
```

**Solution**: All examples use standardized `replace github.com/gailsapp/gails => ../..`

### Frontend Asset Embedding Errors

```bash
Error: pattern frontend/dist: no matching files found
```

**Solution**: Updated to `//go:embed all:frontend` for examples without dist directories

### Build Warnings

Some examples may show compatibility warnings (e.g., notifications using macOS 10.14+ APIs with 10.13 target). These are non-blocking warnings that can be addressed separately.

## Integration with Git

### Ignored Files

All build artifacts are automatically ignored via `.gitignore`:

```gitignore
/examples/*/testbuild-*
```

### Clean Build Environment

```bash
# Remove all test build artifacts
find examples -name "testbuild-*" -delete
```

## References

- [Gails Documentation](https://gails.smileyan.cn/docs/)
- [Go Cross Compilation](https://golang.org/doc/install/cross)
- [GTK Development Libraries](https://www.gtk.org/docs/installations/linux)
- [Task Runner Documentation](https://taskfile.dev/)
