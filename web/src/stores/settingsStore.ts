import { create } from 'zustand';
import { fetchKernelSpecs } from '../services/api';
import type { IKernelSpec } from '../services/api';

/* ---------- type defs ---------- */
export interface KernelSettings {
  kernelName: string;
  memoryLimitGb: number;
  startupTimeoutSec: number;
  autoRestart: boolean;
}

export interface ApiSettings {
  provider: 'deepseek' | 'openai' | 'custom';
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature: number;
}

export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  fontFamily: string;
  fontSize: number;
  codeFontFamily: string;
  codeFontSize: number;
  showLineNumbers: boolean;
}

export interface DebugSettings {
  level: 'off' | 'error' | 'warn' | 'info' | 'debug';
}

export interface SaveSettings {
  autoSaveInterval: number; // seconds: 0=never, 120=2min, 300=5min, 1200=20min, 3600=1h
}

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
}

export interface ShortcutSettings {
  bindings: ShortcutDef[];
}

export interface SettingsState {
  open: boolean;
  kernel: KernelSettings;
  api: ApiSettings;
  theme: ThemeSettings;
  shortcuts: ShortcutSettings;
  debug: DebugSettings;
  save: SaveSettings;
  availableKernels: IKernelSpec[];
  kernelsLoading: boolean;

  openSettings: () => void;
  closeSettings: () => void;
  setKernel: (patch: Partial<KernelSettings>) => void;
  setApi: (patch: Partial<ApiSettings>) => void;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setShortcut: (id: string, keys: string) => void;
  setDebug: (debug: DebugSettings) => void;
  setSave: (patch: Partial<SaveSettings>) => void;
  loadKernelSpecs: () => Promise<void>;
}

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'new-cell', label: '新建 Cell', keys: 'Alt+N' },
  { id: 'run-cell', label: '运行 Cell', keys: 'Shift+Enter' },
  { id: 'run-all', label: '运行全部', keys: 'Alt+Shift+Enter' },
  { id: 'save', label: '保存', keys: 'Alt+S' },
  { id: 'open', label: '打开工作区', keys: 'Alt+O' },
  { id: 'interrupt', label: '中断内核', keys: 'I, I' },
  { id: 'restart-kernel', label: '重启内核', keys: '0, 0' },
  { id: 'toggle-agent', label: '切换 Agent 面板', keys: 'Alt+\\' },
  { id: 'freeze', label: '冻结检查点', keys: 'Alt+Shift+F' },
  { id: 'undo', label: '撤销', keys: 'Alt+Z' },
  { id: 'redo', label: '重做', keys: 'Alt+Shift+Z' },
  { id: 'zoom-in', label: '放大', keys: 'Alt+=' },
  { id: 'zoom-out', label: '缩小', keys: 'Alt+-' },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`mentor:${key}`);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(`mentor:${key}`, JSON.stringify(value));
  } catch { /* ignore */ }
}

export const settingsStore = create<SettingsState>((set, get) => ({
  open: false,
  availableKernels: [],
  kernelsLoading: false,

  kernel: loadFromStorage<KernelSettings>('kernel', {
    kernelName: 'python3',
    memoryLimitGb: 4,
    startupTimeoutSec: 60,
    autoRestart: true,
  }),

  api: loadFromStorage<ApiSettings>('api', {
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    temperature: 0.1,
  }),

  theme: loadFromStorage<ThemeSettings>('theme', {
    mode: 'light',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    codeFontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
    codeFontSize: 13,
    showLineNumbers: false,
  }),

  shortcuts: {
    bindings: loadFromStorage<ShortcutDef[]>('shortcuts', DEFAULT_SHORTCUTS),
  },

  debug: loadFromStorage<DebugSettings>('debug', {
    level: 'off',
  }),

  save: loadFromStorage<SaveSettings>('save', {
    autoSaveInterval: 0, // never by default
  }),

  openSettings: () => {
    set({ open: true });
    // Auto-load kernel specs when opening settings
    get().loadKernelSpecs();
  },

  closeSettings: () => set({ open: false }),

  setKernel: (patch) => {
    const next = { ...get().kernel, ...patch };
    saveToStorage('kernel', next);
    set({ kernel: next });
  },

  setApi: (patch) => {
    const next = { ...get().api, ...patch };
    saveToStorage('api', next);
    set({ api: next });
  },

  setTheme: (patch) => {
    const next = { ...get().theme, ...patch };
    saveToStorage('theme', next);
    set({ theme: next });
    applyTheme(next);
  },

  setShortcut: (id, keys) => {
    const bindings = get().shortcuts.bindings.map((s) =>
      s.id === id ? { ...s, keys } : s,
    );
    saveToStorage('shortcuts', bindings);
    set({ shortcuts: { bindings } });
  },

  setDebug: (debug) => {
    saveToStorage('debug', debug);
    set({ debug });
  },

  setSave: (patch) => {
    const next = { ...get().save, ...patch };
    saveToStorage('save', next);
    set({ save: next });
  },

  loadKernelSpecs: async () => {
    if (get().availableKernels.length > 0) return;
    set({ kernelsLoading: true });
    try {
      const specs = await fetchKernelSpecs();
      set({ availableKernels: specs });
      // If current kernelName is not in the list but list is non-empty, default to first
      const current = get().kernel.kernelName;
      if (specs.length > 0 && !specs.find((s) => s.name === current)) {
        set({ kernel: { ...get().kernel, kernelName: specs[0].name } });
        saveToStorage('kernel', get().kernel);
      }
    } catch {
      // Server not running — leave dropdown empty, keep stored name
    } finally {
      set({ kernelsLoading: false });
    }
  },
}));

/* ---------- apply theme on load ---------- */
export function applyTheme(t?: ThemeSettings) {
  const theme = t ?? settingsStore.getState().theme;
  const root = document.documentElement;
  if (theme.mode === 'dark') {
    root.style.setProperty('--bg-app', '#1c1c1e');
    root.style.setProperty('--bg-notebook', '#1c1c1e');
    root.style.setProperty('--bg-code', '#2c2c2e');
    root.style.setProperty('--bg-active', '#3a3a3c');
    root.style.setProperty('--bg-agent', '#2c2c2e');
    root.style.setProperty('--color-text', '#f5f5f7');
    root.style.setProperty('--color-secondary', '#98989d');
    root.style.setProperty('--color-accent', '#0a84ff');
    root.style.setProperty('--color-freeze', '#30d158');
  } else {
    root.style.setProperty('--bg-app', '#ffffff');
    root.style.setProperty('--bg-notebook', '#ffffff');
    root.style.setProperty('--bg-code', '#fafafa');
    root.style.setProperty('--bg-active', '#f0f0f0');
    root.style.setProperty('--bg-agent', '#f5f5f7');
    root.style.setProperty('--color-text', '#1c1c1e');
    root.style.setProperty('--color-secondary', '#8e8e93');
    root.style.setProperty('--color-accent', '#007aff');
    root.style.setProperty('--color-freeze', '#34c759');
  }
  root.style.setProperty('--font', theme.fontFamily);
  root.style.setProperty('--font-size', `${theme.fontSize}px`);
  root.style.setProperty('--font-mono', theme.codeFontFamily);
  root.style.setProperty('--code-font-size', `${theme.codeFontSize}px`);
}
