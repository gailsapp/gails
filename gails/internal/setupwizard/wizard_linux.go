//go:build linux

package setupwizard

import (
	"strconv"
	"strings"

	"github.com/gailsapp/gails/internal/doctor/packagemanager"
	"github.com/gailsapp/gails/internal/operatingsystem"
)

func (w *Wizard) checkAllDependencies() []DependencyStatus {
	var deps []DependencyStatus
	hasNpm := false

	// Get OS info for package manager detection
	info, _ := operatingsystem.Info()

	// Find the package manager
	pm := packagemanager.Find(info.ID)
	if pm != nil {
		// Get platform dependencies from the doctor package
		platformDeps, _ := packagemanager.Dependencies(pm)
		for _, dep := range platformDeps {
			if dep.Name == "npm" {
				hasNpm = true
			}
			status := DependencyStatus{
				Name:     dep.Name,
				Required: !dep.Optional,
			}

			if dep.Installed {
				status.Installed = true
				status.Status = "installed"
				status.Version = dep.Version
			} else {
				status.Installed = false
				status.Status = "not_installed"
				status.InstallCommand = dep.InstallCommand
			}

			deps = append(deps, status)
		}
	}

	// Check npm (common dependency) - only if not already added by package manager
	if !hasNpm {
		deps = append(deps, checkNpm())
	}

	return deps
}

func checkNpm() DependencyStatus {
	dep := DependencyStatus{
		Name:     "npm",
		Required: false, // Optional - not strictly required for Go-only projects
	}

	version, err := execCommand("npm", "-v")
	if err != nil {
		dep.Status = "not_installed"
		dep.Installed = false
		dep.Message = "Required for frontend development"
		dep.HelpURL = "https://nodejs.org/"
		dep.InstallCommand = "Install Node.js from https://nodejs.org/"
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
			dep.Message = "npm 7.0.0 or higher recommended"
			dep.HelpURL = "https://nodejs.org/"
			return dep
		}
	}

	dep.Installed = true
	dep.Status = "installed"
	return dep
}
