package generator

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	pathpkg "path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/gailsapp/gails/internal/flags"
	"github.com/gailsapp/gails/internal/generator/config"
	"github.com/gailsapp/gails/internal/generator/render"
)

const testcases = "github.com/gailsapp/gails/internal/generator/testcases/..."

type testParams struct {
	name      string
	options   *flags.GenerateBindingsOptions
	outputDir string
	want      map[string]bool
}

func TestGenerator(t *testing.T) {
	const (
		useNamesBit = 1 << iota
		useInterfacesBit
		tsBit
	)

	// Generate configuration matrix.
	tests := make([]*testParams, 1<<3)
	for i := range tests {
		options := &flags.GenerateBindingsOptions{
			ModelsFilename: "models",
			IndexFilename:  "index",

			UseBundledRuntime: true,

			TS:            i&tsBit != 0,
			UseInterfaces: i&useInterfacesBit != 0,
			UseNames:      i&useNamesBit != 0,
		}

		name := configString(options)

		tests[i] = &testParams{
			name:      name,
			options:   options,
			outputDir: filepath.Join("testdata/output", name),
			want:      make(map[string]bool),
		}
	}

	for _, test := range tests {
		// Create output dir.
		if err := os.MkdirAll(test.outputDir, 0777); err != nil {
			t.Fatal(err)
		}

		// Walk output dir.
		err := filepath.WalkDir(test.outputDir, func(path string, d fs.DirEntry, err error) error {
			// Skip directories.
			if d.IsDir() {
				return nil
			}

			fmt.Fprintf(os.Stderr, "[DEBUG-WALK] file=%q\n", path)

			// Skip got files.
			if strings.HasSuffix(d.Name(), ".got.js") || strings.HasSuffix(d.Name(), ".got.ts") || strings.HasSuffix(d.Name(), ".got.log") {
				return nil
			}

			// Record file. Normalize to forward slashes so the key
			// matches the paths the generator emits (which always use
			// '/' regardless of platform — they come from
			// golang.org/x/tools/go/packages PkgPath values, not from
			// the local filesystem).
			rel := "." + filepath.ToSlash(path[len(test.outputDir):])
			key := pathpkg.Clean(rel)
			if filepath.Base(path) == "eventdata.d.ts" {
				fmt.Fprintf(os.Stderr, "[DEBUG-EVENTDATA] walkfile=%q key=%q\n", path, key)
			}
			test.want[key] = false
			return nil
		})

		if err != nil {
			t.Fatal(err)
		}
	}

	// Run tests.
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			creator := outputCreator(t, test)

			generator := NewGenerator(
				test.options,
				creator,
				// Use NullLogger to suppress console output during tests.
				// Warnings are written to warnings.log for comparison instead.
				// This prevents GitHub Actions Go problem matcher from treating
				// warning output as errors.
				config.NullLogger,
			)

			_, err := generator.Generate(testcases)
			if report := (*ErrorReport)(nil); errors.As(err, &report) {
				if report.HasErrors() {
					t.Error(report)
				}

				// Log warnings and compare with reference output.
				if log, err := creator.Create("warnings.log"); err != nil {
					t.Error(err)
				} else {
					func() {
						defer log.Close()

						warnings := report.Warnings()
						slices.Sort(warnings)

						// Normalize paths in warnings to be relative to the testcases directory
						// This ensures consistent output across different development environments and CI
						for i, msg := range warnings {
							// Handle both Unix and Windows path separators
							msg = strings.ReplaceAll(msg, "\\", "/")
							
							// Check if this is a file path (contains line:column position)
							// File paths look like: /path/to/file.go:123:45: message
							// Package paths look like: package github.com/...: message
							if strings.HasPrefix(msg, "package ") {
								// Keep package warnings as-is
								warnings[i] = msg
							} else if idx := strings.Index(msg, "testcases/"); idx >= 0 {
								// Check if it's a file path by looking for :line:column pattern after testcases/
								testcasesEnd := idx + len("testcases/")
								colonIdx := strings.Index(msg[testcasesEnd:], ":")
								if colonIdx > 0 {
									// This looks like a file path, normalize it
									warnings[i] = "/testcases/" + msg[testcasesEnd:]
								} else {
									// Not a file path, keep as-is
									warnings[i] = msg
								}
							} else {
								// Keep other warnings as-is
								warnings[i] = msg
							}
						}

						for _, msg := range warnings {
							// Prefix with [warn] to prevent GitHub Actions Go problem matcher
							// from treating these as errors when diff output is shown
							fmt.Fprint(log, "[warn] "+msg, render.Newline)
						}
					}()
				}
			} else if err != nil {
				t.Error(err)
			}

			for path, present := range test.want {
				if !present {
					t.Errorf("Missing output file '%s'", path)
				}
			}
		})
	}
}

// configString computes a subtest name from the given configuration.
func configString(options *flags.GenerateBindingsOptions) string {
	lang := "JS"
	if options.TS {
		lang = "TS"
	}
	return fmt.Sprintf("lang=%s/UseInterfaces=%v/UseNames=%v", lang, options.UseInterfaces, options.UseNames)
}

// outputCreator returns a FileCreator that detects want/got pairs
	// and schedules them for comparison.
	//
	// If no corresponding want file exists, it is created and reported.
	func outputCreator(t *testing.T, params *testParams) config.FileCreator {
		var mu sync.Mutex
		return config.FileCreatorFunc(func(path string) (io.WriteCloser, error) {
			fmt.Fprintf(os.Stderr, "[DEBUG-CREATE] raw=%q\n", path)
			// Normalize the generator-supplied path to forward slashes
			// before consulting the want map. The generator builds
			// paths from golang.org/x/tools/go/packages PkgPath values,
			// which are always '/' on every platform; filepath.Clean
			// would rewrite them to '\' on Windows and the lookup
			// would always miss. The prefixedPath (filesystem path)
			// still uses filepath.Join so directory creation works
			// on every platform.
			key := pathpkg.Clean(filepath.ToSlash(path))
			prefixedPath := filepath.Join(params.outputDir, path)

			// Protect want map accesses. The want map is read and
			// written by every concurrent invocation of this creator
			// (the generator schedules one goroutine per service
			// package), so all access must be serialized.
			mu.Lock()
			defer mu.Unlock()

			fmt.Fprintf(os.Stderr, "[DEBUG-KEY] key=%q hasInWant=%v\n", key, params.want[key])

			if seen, ok := params.want[key]; ok {
				// File exists: mark as seen and compare.
				if seen {
					t.Errorf("Duplicate output file '%s'", path)
				}
				params.want[key] = true

				// Open want file.
				wf, err := os.Open(prefixedPath)
				if err != nil {
					return nil, err
				}

				// Create or truncate got file.
				ext := filepath.Ext(prefixedPath)
				gf, err := os.Create(fmt.Sprintf("%s.got%s", prefixedPath[:len(prefixedPath)-len(ext)], ext))
				if err != nil {
					return nil, err
				}

				// Initialise comparer.
				return &outputComparer{t, key, wf, gf}, nil
			} else {
				// File does not exist: create it.
				t.Errorf("Unexpected output file '%s'", path)
				params.want[key] = true

				if err := os.MkdirAll(filepath.Dir(prefixedPath), 0777); err != nil {
					return nil, err
				}

				return os.Create(prefixedPath)
			}
		})
	}

// outputComparer is a io.WriteCloser that writes to got.
//
// When Close is called, it compares want to got; if they are identical,
// it deletes got; otherwise it reports a testing error.
type outputComparer struct {
	t    *testing.T
	path string
	want *os.File
	got  *os.File
}

func (comparer *outputComparer) Write(data []byte) (int, error) {
	return comparer.got.Write(data)
}

func (comparer *outputComparer) Close() error {
	defer comparer.want.Close()
	defer comparer.got.Close()

	comparer.got.Seek(0, io.SeekStart)

	// Read want data.
	want, err := io.ReadAll(comparer.want)
	if err != nil {
		comparer.t.Error(err)
		return nil
	}

	got, err := io.ReadAll(comparer.got)
	if err != nil {
		comparer.t.Error(err)
		return nil
	}

	if diff := cmp.Diff(want, got); diff != "" {
		comparer.t.Errorf("Output file '%s' mismatch (-want +got):\n%s", comparer.path, diff)
	} else {
		// On success, delete got file.
		comparer.got.Close()
		if err := os.Remove(comparer.got.Name()); err != nil {
			comparer.t.Error(err)
		}
	}

	return nil
}
