import { create } from 'zustand';
import { getDefaultStore } from 'jotai';
import { openWorkspace, saveWorkspace, fetchWorkspaceState } from '../services/api';
import { makeNotebookContent, nbformatToCellState } from '../services/ipynb';
import { cellIdsAtom, cellStateFamily, loadNotebookAtom, gatherWorkspaceState, blueLineCellIdAtom, redLineCellIdAtom } from './notebookStore';
import { chatStore } from './chatStore';
import { checkpointStore } from './checkpointStore';

interface WorkspaceState {
  workspacePath: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;

  openWorkspace: (path: string) => Promise<void>;
  saveWorkspace: () => Promise<void>;
  fetchLastWorkspace: () => Promise<string | null>;
  markDirty: () => void;
}

export const workspaceStore = create<WorkspaceState>((set, get) => ({
  workspacePath: null,
  isDirty: false,
  lastSavedAt: null,

  openWorkspace: async (path: string) => {
    const result = await openWorkspace(path);

    const jotai = getDefaultStore();

    // Load notebook cells
    if (result.notebook) {
      const cells = nbformatToCellState(result.notebook as any);
      jotai.set(loadNotebookAtom, cells);
    } else {
      // Fresh workspace: clear existing cells and lines
      const ids = jotai.get(cellIdsAtom);
      for (const id of ids) {
        cellStateFamily.remove(id);
      }
      jotai.set(cellIdsAtom, []);
      jotai.set(blueLineCellIdAtom, null);
      jotai.set(redLineCellIdAtom, null);
    }

    // Load workspace state (blueLine, redLine)
    if (result.workspaceState) {
      jotai.set(blueLineCellIdAtom, result.workspaceState.blueLineCellId);
      jotai.set(redLineCellIdAtom, result.workspaceState.redLineCellId);
    }

    // Validate: if blueLine/redLine reference non-existent cells, reset to defaults
    const ids = jotai.get(cellIdsAtom);
    if (ids.length > 0) {
      const blueId = jotai.get(blueLineCellIdAtom);
      if (!blueId || !ids.includes(blueId)) {
        jotai.set(blueLineCellIdAtom, ids[0]);
      }
      const redId = jotai.get(redLineCellIdAtom);
      if (!redId || !ids.includes(redId)) {
        jotai.set(redLineCellIdAtom, ids[0]);
      }
    }

    // Load chat history
    if (result.chat) {
      chatStore.getState().loadMessages(result.chat as any);
    }

    // Load checkpoint metadata
    if (result.checkpoints) {
      checkpointStore.setState({
        head: result.checkpoints.head,
        nodes: result.checkpoints.nodes,
      });
    }

    set({ workspacePath: result.workspace, isDirty: false, lastSavedAt: Date.now() });
  },

  saveWorkspace: async () => {
    const { workspacePath } = get();
    if (!workspacePath) return;

    const jotai = getDefaultStore();
    const ids = jotai.get(cellIdsAtom);
    const cells = ids.map((id) => jotai.get(cellStateFamily(id)));

    const notebook = makeNotebookContent(cells);
    const wsState = gatherWorkspaceState();
    const chat = chatStore.getState().getMessages();

    await saveWorkspace({
      path: workspacePath,
      notebook,
      workspaceState: wsState,
      chat,
    });

    set({ isDirty: false, lastSavedAt: Date.now() });
  },

  fetchLastWorkspace: async () => {
    try {
      const state = await fetchWorkspaceState();
      if (state.lastWorkspace && state.exists) {
        return state.lastWorkspace;
      }
    } catch {
      // Server not available or config missing
    }
    return null;
  },

  markDirty: () => set({ isDirty: true }),
}));
