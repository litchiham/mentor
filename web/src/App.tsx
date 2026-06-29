import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { cellIdsAtom } from './stores/notebookStore';
import { workspaceStore } from './stores/workspaceStore';
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
