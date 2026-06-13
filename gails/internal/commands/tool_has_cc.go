package commands

import (
	"fmt"
	"os/exec"
)

// HasCCOptions holds options for the has-cc command.
type HasCCOptions struct{}

// ToolHasCC checks if a C compiler (gcc or clang) is available in PATH.
// Outputs "true" or "false" for use in Taskfile sh: variables, replacing the
// bash-only `command -v gcc` pattern which fails on Windows.
func ToolHasCC(_ *HasCCOptions) error {
	DisableFooter = true
	_, gccErr := exec.LookPath("gcc")
	_, clangErr := exec.LookPath("clang")
	if gccErr == nil || clangErr == nil {
		fmt.Print("true")
	} else {
		fmt.Print("false")
	}
	return nil
}
