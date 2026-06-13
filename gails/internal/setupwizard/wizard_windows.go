//go:build windows

package setupwizard

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func (w *Wizard) checkAllDependencies() []DependencyStatus {
	var deps []DependencyStatus

	// Check WebView2 Runtime
	deps = append(deps, checkWebView2())

	// Check npm (common dependency)
	deps = append(deps, checkNpm())

	return deps
}

func checkWebView2() DependencyStatus {
	dep := DependencyStatus{
		Name:     "WebView2 Runtime",
		Required: true,
	}

	// Check common installation paths
	paths := []string{
		filepath.Join(os.Getenv("PROGRAMFILES(X86)"), "Microsoft", "EdgeWebView", "Application"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "EdgeWebView", "Application"),
		filepath.Join(os.Getenv("PROGRAMFILES"), "Microsoft", "EdgeWebView", "Application"),
	}

	for _, path := range paths {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			dep.Installed = true
			dep.Status = "installed"

			// Try to get version from directory name
			entries, _ := os.ReadDir(path)
			for _, entry := range entries {
				if entry.IsDir() {
					name := entry.Name()
					// Version directories look like "120.0.2210.91"
					if len(name) > 0 && name[0] >= '0' && name[0] <= '9' {
						dep.Version = name
						break
					}
				}
			}
			return dep
		}
	}

	dep.Status = "not_installed"
	dep.Installed = false
	dep.Message = "Download from Microsoft Edge WebView2"
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
