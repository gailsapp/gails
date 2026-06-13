//go:build race

package doctor

import "testing"

// TestRun is skipped when the race detector is enabled because
// pterm@v0.12.82 has a known data race inside SpinnerPrinter:
//
//   - pterm.SpinnerPrinter.Start launches a goroutine that reads
//     s.IsActive in a tight loop.
//   - pterm.SpinnerPrinter.Stop writes s.IsActive = false.
//
// The race is in the third-party pterm library, not in this package.
// Once pterm is upgraded past the version that fixes the race, this
// stub can be removed and the !race test restored.
func TestRun(t *testing.T) {
	t.Skip("pterm@v0.12.82 SpinnerPrinter has a data race under -race; see doctor_race_test.go")
}
