import { create } from 'zustand';
import type { IPluginManifest } from '../services/api';
import { listPlugins, installPlugin, uninstallPlugin } from '../services/api';
import { kernelStore } from './kernelStore';

interface PluginState {
  plugins: IPluginManifest[];
  loading: boolean;
  expandedPlugin: string | null;
  error: string | null;

  loadPlugins: () => Promise<void>;
  installPlugin: (pathOrPackage: string) => Promise<void>;
  removePlugin: (name: string) => Promise<void>;
  setExpanded: (name: string | null) => void;
  clearError: () => void;
}

export const pluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loading: false,
  expandedPlugin: null,
  error: null,

  loadPlugins: async () => {
    const kernelId = kernelStore.getState().kernelId;
    if (!kernelId) {
      set({ plugins: [], loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const plugins = await listPlugins(kernelId);
      set({ plugins, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to load plugins' });
    }
  },

  installPlugin: async (pathOrPackage: string) => {
    const kernelId = kernelStore.getState().kernelId;
    if (!kernelId) {
      set({ error: 'No kernel connected' });
      return;
    }
    set({ loading: true, error: null });
    try {
      await installPlugin(kernelId, pathOrPackage);
      await get().loadPlugins();
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to install plugin' });
    }
  },

  removePlugin: async (name: string) => {
    const kernelId = kernelStore.getState().kernelId;
    if (!kernelId) {
      set({ error: 'No kernel connected' });
      return;
    }
    set({ loading: true, error: null });
    try {
      await uninstallPlugin(name, kernelId);
      set((s) => ({
        plugins: s.plugins.filter((p) => p.name !== name),
        expandedPlugin: s.expandedPlugin === name ? null : s.expandedPlugin,
        loading: false,
      }));
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to uninstall plugin' });
    }
  },

  setExpanded: (name) => set({ expandedPlugin: name }),

  clearError: () => set({ error: null }),
}));
