import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DependencyStatus, SystemInfo, GlobalDefaults } from './types';
import { checkDependencies, getState, close, getDefaults, saveDefaults } from './api';
import WailsLogo from './components/WailsLogo';

type Step = 'welcome' | 'dependencies' | 'defaults' | 'complete';
type Theme = 'light' | 'dark';

// Theme context
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({
  theme: 'dark',
  toggleTheme: () => {}
});

const useTheme = () => useContext(ThemeContext);

// Theme toggle button component
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        // Sun icon for dark mode (click to switch to light)
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon icon for light mode (click to switch to dark)
        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

// Classic wizard page slide animation
const pageVariants = {
  initial: { opacity: 0, x: 50 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 }
};

// Wizard step indicator
function StepIndicator({ steps, currentStep }: { steps: { id: Step; label: string }[]; currentStep: Step }) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center">
          <span className={i <= currentIndex ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}>
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="mx-1.5 text-gray-400 dark:text-gray-600">&rsaquo;</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Wizard footer with navigation buttons
function WizardFooter({
  onBack,
  onNext,
  onCancel,
  nextLabel = 'Next',
  backLabel = 'Back',
  showBack = true,
  nextDisabled = false,
  showRetry = false,
  onRetry
}: {
  onBack?: () => void;
  onNext: () => void;
  onCancel?: () => void;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
  nextDisabled?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
      <div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-xs rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {backLabel}
          </button>
        )}
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
            nextDisabled
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// Welcome Page
function WelcomePage({ system, onNext, onCancel, checking }: { system: SystemInfo | null; onNext: () => void; onCancel: () => void; checking: boolean }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div className="text-center mb-4">
        <p className="text-xs text-gray-500 dark:text-gray-300">
          This wizard will help you set up your development environment.
        </p>
      </div>

      {system && (
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 mb-4">
          <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">System Information</h3>
          <div className="grid grid-cols-2 gap-y-1.5 text-xs">
            <span className="text-gray-400 dark:text-gray-500">Operating System</span>
            <span className="text-gray-700 dark:text-gray-200">{system.osName || system.os} ({system.arch})</span>
            <span className="text-gray-400 dark:text-gray-500">Wails Version</span>
            <span className="text-gray-700 dark:text-gray-200">{system.gailsVersion.replace(/^v+/, '')}</span>
            <span className="text-gray-400 dark:text-gray-500">Go Version</span>
            <span className="text-gray-700 dark:text-gray-200">{system.goVersion.replace(/^go/, '')}</span>
          </div>
        </div>
      )}

      {checking ? (
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-gray-400 dark:border-gray-600 border-t-red-500 rounded-full animate-spin" />
            <span className="text-xs text-gray-500 dark:text-gray-300">Checking dependencies...</span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3">
          <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Setup will check:</h3>
          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500">•</span>
              Required build dependencies (GTK, WebKit, GCC)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500">•</span>
              Optional tools (npm)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500">•</span>
              Cross-compilation capabilities
            </li>
          </ul>
        </div>
      )}

      <WizardFooter
        onNext={onNext}
        onCancel={onCancel}
        nextLabel="Check Dependencies"
        showBack={false}
        nextDisabled={checking}
      />
    </motion.div>
  );
}

// Dependency row component
function DependencyRow({
  dep
}: {
  dep: DependencyStatus;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-200/50 dark:border-gray-800/50 last:border-0">
      {/* Status icon */}
      <div className="mt-0.5">
        {dep.installed ? (
          <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : dep.required ? (
          <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full bg-gray-400/20 dark:bg-gray-600/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${dep.installed ? 'text-gray-900 dark:text-white' : dep.required ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
            {dep.name}
          </span>
          {!dep.required && (
            <span className="text-[10px] text-gray-500">(optional)</span>
          )}
          <span className="flex-1" />
          {dep.version && (
            <span className="text-[10px] text-gray-500 font-mono">{dep.version}</span>
          )}
        </div>
        {dep.message && (
          <p className="text-[11px] text-gray-500 mt-0.5">{dep.message}</p>
        )}

        {/* Help URL link for non-system installs */}
        {!dep.installed && dep.helpUrl && (
          <div className="mt-1">
            <a
              href={dep.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
            >
              Install from {new URL(dep.helpUrl).hostname}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Dependencies Page
function DependenciesPage({
  dependencies,
  onNext,
  onBack,
  onCancel,
  onRetry,
  checking
}: {
  dependencies: DependencyStatus[];
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onRetry: () => void;
  checking: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const missingRequired = dependencies.filter(d => d.required && !d.installed);
  const allRequiredInstalled = missingRequired.length === 0;
  const missingDeps = dependencies.filter(d => !d.installed);

  // Build combined install command from all missing deps that have system commands (starting with sudo)
  const combinedInstallCommand = (() => {
    const systemCommands = missingDeps
      .filter(d => d.installCommand?.startsWith('sudo '))
      .map(d => d.installCommand!);

    if (systemCommands.length === 0) return null;

    // Extract package names from "sudo pacman -S pkg" style commands
    // Group by package manager
    const pacmanPkgs: string[] = [];
    const aptPkgs: string[] = [];
    const dnfPkgs: string[] = [];

    for (const cmd of systemCommands) {
      if (cmd.includes('pacman -S')) {
        const match = cmd.match(/pacman -S\s+(.+)/);
        if (match) pacmanPkgs.push(...match[1].split(/\s+/));
      } else if (cmd.includes('apt install')) {
        const match = cmd.match(/apt install\s+(.+)/);
        if (match) aptPkgs.push(...match[1].split(/\s+/));
      } else if (cmd.includes('dnf install')) {
        const match = cmd.match(/dnf install\s+(.+)/);
        if (match) dnfPkgs.push(...match[1].split(/\s+/));
      }
    }

    if (pacmanPkgs.length > 0) {
      return `sudo pacman -S ${pacmanPkgs.join(' ')}`;
    } else if (aptPkgs.length > 0) {
      return `sudo apt install ${aptPkgs.join(' ')}`;
    } else if (dnfPkgs.length > 0) {
      return `sudo dnf install ${dnfPkgs.join(' ')}`;
    }

    return null;
  })();

  const copyCommand = () => {
    if (combinedInstallCommand) {
      navigator.clipboard.writeText(combinedInstallCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {/* Loading overlay for retry */}
      {checking && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 rounded-lg flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-gray-400 dark:border-gray-600 border-t-red-500 rounded-full"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Checking dependencies...</span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">System Dependencies</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          The following dependencies are needed to build Wails applications.
        </p>
      </div>

      {/* All Dependencies */}
      <div className="mb-4">
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg px-4">
          {dependencies.map(dep => (
            <DependencyRow
              key={dep.name}
              dep={dep}
            />
          ))}
        </div>
      </div>

      {/* Combined Install Command */}
      {combinedInstallCommand && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
          <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">Install all missing dependencies:</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-200 dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-3 py-2 rounded font-mono overflow-x-auto">
              {combinedInstallCommand}
            </code>
            <button
              onClick={copyCommand}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-2"
              title="Copy command"
            >
              {copied ? (
                <svg className="w-5 h-5 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Status Summary - only show when all required are installed */}
      {allRequiredInstalled && (
        <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            All required dependencies are installed. You can proceed.
          </div>
        </div>
      )}

      <WizardFooter
        onBack={onBack}
        onNext={onNext}
        onCancel={onCancel}
        nextLabel="Next"
        showRetry={!allRequiredInstalled}
        onRetry={onRetry}
      />
    </motion.div>
  );
}

// Defaults Page - Configure global defaults for new projects
function DefaultsPage({
  defaults,
  onDefaultsChange,
  onNext,
  onBack,
  onCancel,
  saving
}: {
  defaults: GlobalDefaults;
  onDefaultsChange: (defaults: GlobalDefaults) => void;
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <div className="mb-3">
        <h2 className="text-lg font-bold mb-0.5 text-gray-900 dark:text-white">Project Defaults</h2>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Configure defaults for new Wails projects.
        </p>
      </div>

      {/* Author Information */}
      <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
        <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Author Information</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Your Name</label>
            <input
              type="text"
              value={defaults.author.name}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                author: { ...defaults.author, name: e.target.value }
              })}
              placeholder="John Doe"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Company</label>
            <input
              type="text"
              value={defaults.author.company}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                author: { ...defaults.author, company: e.target.value }
              })}
              placeholder="My Company"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Project Defaults */}
      <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
        <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">Project Settings</h3>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Bundle ID Prefix</label>
              <input
                type="text"
                value={defaults.project.productIdentifierPrefix}
                onChange={(e) => onDefaultsChange({
                  ...defaults,
                  project: { ...defaults.project, productIdentifierPrefix: e.target.value }
                })}
                placeholder="com.mycompany"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Default Version</label>
              <input
                type="text"
                value={defaults.project.defaultVersion}
                onChange={(e) => onDefaultsChange({
                  ...defaults,
                  project: { ...defaults.project, defaultVersion: e.target.value }
                })}
                placeholder="0.1.0"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Default Template</label>
            <select
              value={defaults.project.defaultTemplate}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                project: { ...defaults.project, defaultTemplate: e.target.value }
              })}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 focus:border-red-500 focus:outline-none"
            >
              <option value="vanilla">Vanilla (JavaScript)</option>
              <option value="vanilla-ts">Vanilla (TypeScript)</option>
              <option value="react">React</option>
              <option value="react-ts">React (TypeScript)</option>
              <option value="react-swc">React + SWC</option>
              <option value="react-swc-ts">React + SWC (TypeScript)</option>
              <option value="preact">Preact</option>
              <option value="preact-ts">Preact (TypeScript)</option>
              <option value="svelte">Svelte</option>
              <option value="svelte-ts">Svelte (TypeScript)</option>
              <option value="solid">Solid</option>
              <option value="solid-ts">Solid (TypeScript)</option>
              <option value="lit">Lit</option>
              <option value="lit-ts">Lit (TypeScript)</option>
              <option value="vue">Vue</option>
              <option value="vue-ts">Vue (TypeScript)</option>
            </select>
          </div>
        </div>
      </div>

      {/* macOS Signing */}
      <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400">macOS Code Signing</h3>
          <span className="text-[9px] text-gray-400 dark:text-gray-500">(optional)</span>
        </div>
        <p className="text-[9px] text-gray-400 dark:text-gray-500 mb-2 ml-6">These are public identifiers. App-specific passwords are stored securely in your Keychain.</p>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Developer ID</label>
            <input
              type="text"
              value={defaults.signing?.macOS?.developerID || ''}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                signing: {
                  ...defaults.signing,
                  macOS: { ...defaults.signing?.macOS, developerID: e.target.value, appleID: defaults.signing?.macOS?.appleID || '', teamID: defaults.signing?.macOS?.teamID || '' },
                  windows: defaults.signing?.windows || { certificatePath: '', timestampServer: '' }
                }
              })}
              placeholder="Developer ID Application: John Doe (TEAMID)"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Apple ID</label>
              <input
                type="email"
                value={defaults.signing?.macOS?.appleID || ''}
                onChange={(e) => onDefaultsChange({
                  ...defaults,
                  signing: {
                    ...defaults.signing,
                    macOS: { ...defaults.signing?.macOS, appleID: e.target.value, developerID: defaults.signing?.macOS?.developerID || '', teamID: defaults.signing?.macOS?.teamID || '' },
                    windows: defaults.signing?.windows || { certificatePath: '', timestampServer: '' }
                  }
                })}
                placeholder="you@example.com"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-0.5">Team ID</label>
              <input
                type="text"
                value={defaults.signing?.macOS?.teamID || ''}
                onChange={(e) => onDefaultsChange({
                  ...defaults,
                  signing: {
                    ...defaults.signing,
                    macOS: { ...defaults.signing?.macOS, teamID: e.target.value, developerID: defaults.signing?.macOS?.developerID || '', appleID: defaults.signing?.macOS?.appleID || '' },
                    windows: defaults.signing?.windows || { certificatePath: '', timestampServer: '' }
                  }
                })}
                placeholder="ABCD1234EF"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Windows Signing */}
      <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
          </svg>
          <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Windows Code Signing</h3>
          <span className="text-[9px] text-gray-400 dark:text-gray-500">(optional)</span>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Certificate Path (.pfx)</label>
            <input
              type="text"
              value={defaults.signing?.windows?.certificatePath || ''}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                signing: {
                  ...defaults.signing,
                  macOS: defaults.signing?.macOS || { developerID: '', appleID: '', teamID: '' },
                  windows: { ...defaults.signing?.windows, certificatePath: e.target.value, timestampServer: defaults.signing?.windows?.timestampServer || '' }
                }
              })}
              placeholder="/path/to/certificate.pfx"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Timestamp Server</label>
            <input
              type="text"
              value={defaults.signing?.windows?.timestampServer || ''}
              onChange={(e) => onDefaultsChange({
                ...defaults,
                signing: {
                  ...defaults.signing,
                  macOS: defaults.signing?.macOS || { developerID: '', appleID: '', teamID: '' },
                  windows: { ...defaults.signing?.windows, timestampServer: e.target.value, certificatePath: defaults.signing?.windows?.certificatePath || '' }
                }
              })}
              placeholder="http://timestamp.digicert.com"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:border-red-500 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Info about where this is stored */}
      <div className="text-[10px] text-gray-500 dark:text-gray-600 mb-3">
        <span className="text-gray-400 dark:text-gray-500">Stored in:</span> ~/.config/gails/defaults.yaml
      </div>

      <WizardFooter
        onBack={onBack}
        onNext={onNext}
        onCancel={onCancel}
        nextLabel={saving ? "Saving..." : "Finish"}
        nextDisabled={saving}
      />
    </motion.div>
  );
}

// Copyable command component
function CopyableCommand({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-green-600 dark:text-green-400 font-mono text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
          {command}
        </code>
        <button
          onClick={copyCommand}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-1"
          title="Copy command"
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// Complete Page
function CompletePage({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="text-center py-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
      >
        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>

      <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Setup Complete</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Your development environment is ready to use.
      </p>

      <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4 text-left mb-6 max-w-sm mx-auto">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Next Steps</h3>
        <div className="space-y-3 text-sm">
          <CopyableCommand command="gails init -n myapp" label="Create a new project:" />
          <CopyableCommand command="gails dev" label="Start development server:" />
          <CopyableCommand command="gails build" label="Build for production:" />
        </div>
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
      >
        Close
      </button>
    </motion.div>
  );
}

// Main App
export default function App() {
  const [step, setStep] = useState<Step>('welcome');
  const [dependencies, setDependencies] = useState<DependencyStatus[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [buildingImage, setBuildingImage] = useState(false);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [defaults, setDefaults] = useState<GlobalDefaults>({
    author: { name: '', company: '' },
    project: {
      productIdentifierPrefix: 'com.example',
      defaultTemplate: 'vanilla',
      copyrightTemplate: '© {year}, {company}',
      descriptionTemplate: 'A {name} application',
      defaultVersion: '0.1.0'
    }
  });
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [backgroundDockerStarted, setBackgroundDockerStarted] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    // Default to dark, but check for saved preference or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gails-setup-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    }
    return 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('gails-setup-theme', next);
      return next;
    });
  };

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const steps: { id: Step; label: string }[] = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'docker', label: 'Docker' },
    { id: 'defaults', label: 'Defaults' },
    { id: 'complete', label: 'Complete' },
  ];

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const state = await getState();
    setSystem(state.system);
  };

  const handleNext = async () => {
    if (step === 'welcome') {
      setCheckingDeps(true);
      const deps = await checkDependencies();
      setDependencies(deps);
      setCheckingDeps(false);
      setStep('dependencies');
    } else if (step === 'dependencies') {
      // Check docker status and start background build if available
      const dockerDep = dependencies.find(d => d.name === 'docker');
      if (dockerDep?.installed) {
        const docker = await getDockerStatus();
        setDockerStatus(docker);
        // Start background Docker build (so it downloads while user configures defaults)
        startBackgroundDockerBuild(dependencies);
      }
      setStep('docker');
    } else if (step === 'docker') {
      // Load existing defaults when entering defaults page
      const loadedDefaults = await getDefaults();
      setDefaults(loadedDefaults);
      setStep('defaults');
    } else if (step === 'defaults') {
      // Save defaults before proceeding
      setSavingDefaults(true);
      await saveDefaults(defaults);
      setSavingDefaults(false);
      setStep('complete');
    }
  };

  const handleRetryDeps = async () => {
    setCheckingDeps(true);
    const deps = await checkDependencies();
    setDependencies(deps);
    setCheckingDeps(false);
  };

  const handleBack = () => {
    if (step === 'dependencies') setStep('welcome');
    else if (step === 'docker') setStep('dependencies');
    else if (step === 'defaults') setStep('docker');
  };

  const handleBuildImage = async () => {
    setBuildingImage(true);
    await buildDockerImage();

    const poll = async () => {
      const status = await getDockerStatus();
      setDockerStatus(status);
      if (status.pullStatus === 'pulling') {
        setTimeout(poll, 1000);
      } else {
        setBuildingImage(false);
      }
    };
    poll();
  };

  // Start background Docker build after dependencies check
  const startBackgroundDockerBuild = async (deps: DependencyStatus[]) => {
    const dockerDep = deps.find(d => d.name === 'docker');
    if (!dockerDep?.installed || backgroundDockerStarted) return;

    setBackgroundDockerStarted(true);

    // Try to start background build
    const result = await startDockerBuildBackground();
    setDockerStatus(result.status);

    // If build started, poll for status
    if (result.started && result.status.pullStatus === 'pulling') {
      setBuildingImage(true);
      const poll = async () => {
        const status = await getDockerStatus();
        setDockerStatus(status);
        if (status.pullStatus === 'pulling') {
          setTimeout(poll, 1000);
        } else {
          setBuildingImage(false);
        }
      };
      setTimeout(poll, 1000);
    }
  };

  const handleClose = async () => {
    await close();
    window.close();
  };

  const handleCancel = handleClose;

  // Show Docker indicator on defaults page when Docker build is in progress (Docker now downloads while user configures)
  const showDockerIndicator = backgroundDockerStarted && step === 'defaults';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center p-4 transition-colors">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Persistent Docker status indicator */}
        <AnimatePresence>
          {showDockerIndicator && (
            <DockerStatusIndicator
              status={dockerStatus}
              visible={showDockerIndicator}
            />
          )}
        </AnimatePresence>

        <div className="w-full max-w-lg">
          {/* Header with logo and step indicator */}
          <div className="flex flex-col items-center mb-4">
            <WailsLogo size={160} theme={theme} />
            <div className="mt-3">
              <StepIndicator steps={steps} currentStep={step} />
            </div>
          </div>

          {/* Wizard container */}
          <div className="bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-2xl max-h-[70vh] overflow-y-auto">

          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <WelcomePage
                key="welcome"
                system={system}
                onNext={handleNext}
                onCancel={handleCancel}
                checking={checkingDeps}
              />
            )}
            {step === 'dependencies' && (
              <DependenciesPage
                key="dependencies"
                dependencies={dependencies}
                onNext={handleNext}
                onBack={handleBack}
                onCancel={handleCancel}
                onRetry={handleRetryDeps}
                checking={checkingDeps}
              />
            )}
            {step === 'defaults' && (
              <DefaultsPage
                key="defaults"
                defaults={defaults}
                onDefaultsChange={setDefaults}
                onNext={handleNext}
                onBack={handleBack}
                onCancel={handleCancel}
                saving={savingDefaults}
              />
            )}
            {step === 'docker' && (
              <DockerPage
                key="docker"
                dockerStatus={dockerStatus}
                buildingImage={buildingImage}
                onBuildImage={handleBuildImage}
                onNext={handleNext}
                onBack={handleBack}
                onCancel={handleCancel}
              />
            )}
            {step === 'complete' && (
              <CompletePage key="complete" onClose={handleClose} />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-xs text-gray-500 dark:text-gray-600">
          Wails • Build cross-platform apps with Go
        </div>
      </div>
      </div>
    </ThemeContext.Provider>
  );
}
