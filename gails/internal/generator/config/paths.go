package config

// GailsAppPkgPath is the official import path of Gails' application package.
const GailsAppPkgPath = "github.com/gailsapp/gails/pkg/application"

// GailsInternalPkgPath is the official import path of Gails' internal package.
const GailsInternalPkgPath = "github.com/gailsapp/gails/internal"

// SystemPaths holds resolved paths of required system packages.
type SystemPaths struct {
	ContextPackage     string
	ApplicationPackage string
	InternalPackage    string
}
