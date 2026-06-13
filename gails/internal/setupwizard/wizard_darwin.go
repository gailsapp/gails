//go:build darwin

package setupwizard

import (
	"os/exec"
	"strconv"
	"strings"
)

func (w *Wizard) checkAllDependencies() []DependencyStatus {
	var deps []DependencyStatus

	// Check Xcode Command Line Tools
	deps = append(deps, checkXcode())

	// Check npm (common dependency)
	deps = append(deps, checkNpm())

	return deps
}

func checkXcode() DependencyStatus {
	dep := DependencyStatus{
		Name:     "Xcode Command Line Tools",
		Required: true,
	}

	path, err := execCommand("xcode-select", "-p")
	if err != nil {
		dep.Status = "not_installed"
		dep.Installed = false
		dep.Message = "Run: xcode-select --install"
		return dep
	}

	dep.Installed = true
	dep.Status = "installed"

	// Try to get version
	cmd := exec.Command("pkgutil", "--pkg-info=com.apple.pkg.CLTools_Executables")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(output), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "version:") {
				dep.Version = strings.TrimSpace(strings.TrimPrefix(line, "version:"))
				break
			}
		}
	}

	_ = path // suppress unused warning
	return dep
}

func checkNpm() DependencyStatus {
	dep := DependencyStatus{
		Name:     "npm",
		Required: true,
	}

	version, err := execCommand("npm", "-v")
	if err != nil {
		dep.Status = "not_installed"
		dep.Installed = false
		dep.Message = "npm is required. Install Node.js from https://nodejs.org/"
		return dep
	}

	dep.Version = version

	// Check minimum version (7.0.0)
	parts := strings.Split(version, ".")
	if len(parts) > 0 {
		major, _ := strconv.Atoi(parts[0])
		if major < 7 {
			dep.Status = "needs_update"
			dep.Installed = true
			dep.Message = "npm 7.0.0 or higher is required"
			return dep
		}
	}

	dep.Installed = true
	dep.Status = "installed"
	return dep
}
