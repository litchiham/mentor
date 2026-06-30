import { useEffect, useRef } from 'react';
import { workspaceStore } from './stores/workspaceStore';
import { settingsStore } from './stores/settingsStore';
import Notebook from './components/Notebook/Notebook';
import AgentPanel from './components/Agent/AgentPanel';
import MenuBar from './components/Toolbar/MenuBar';
import KernelStatusBar from './components/Toolbar/KernelStatusBar';
import SettingsModal from './components/Settings/SettingsModal';

export default function App() {
  // Auto-restore last workspace on mount
  useEffect(() => {
    workspaceStore.getState().fetchLastWorkspace().then((path) => {
      if (path) {
        workspaceStore.getState().openWorkspace(path).catch((err) => {
          console.error('Auto-restore workspace failed:', err);
        });
      }
    });
  }, []);

  // Suppress browser-native Alt/Ctrl shortcuts that conflict with ours
  useEffect(() => {
    const SYSTEM_KEYS = new Set(['Tab', 'F4', 'Escape', 'Home', 'End', 'PageUp', 'PageDown',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ']);
    const handler = (e: KeyboardEvent) => {
      if ((e.altKey || e.ctrlKey) && !SYSTEM_KEYS.has(e.key)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  // Auto-save timer
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const { autoSaveInterval } = settingsStore.getState().save;
      if (autoSaveInterval <= 0) return;
      const ws = workspaceStore.getState();
      if (!ws.workspacePath || !ws.isDirty) return;
      ws.saveWorkspace().catch((err) => console.error('Auto-save failed:', err));
    };

    autoSaveRef.current = setInterval(tick, 15000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  return (
    <div className="mentor-app">
      <MenuBar />
      <div className="mentor-body">
        <main className="mentor-notebook-panel">
          <Notebook />
        </main>
        <aside className="mentor-agent-panel">
          <AgentPanel />
        </aside>
      </div>
      <KernelStatusBar />
      <SettingsModal />
    </div>
  );
}
