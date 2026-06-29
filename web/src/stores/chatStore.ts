import { create } from 'zustand';
import { getDefaultStore } from 'jotai';
import { chatWithAgent } from '../services/api';
import { settingsStore } from './settingsStore';
import { kernelStore } from './kernelStore';
import {
  cellIdsAtom,
  cellStateFamily,
  blueLineCellIdAtom,
  agentAppendCellAtom,
  updateCellSourceAtom,
} from './notebookStore';
import type { IChatMessage } from '../types';

interface ChatState {
  messages: IChatMessage[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  loadMessages: (msgs: IChatMessage[]) => void;
  getMessages: () => IChatMessage[];
}

function makeMsg(role: IChatMessage['role'], content: string): IChatMessage {
  return { role, content, timestamp: Date.now() };
}

/** Gather all cells, marking cells above the blue-line as read-only for the AI. */
function gatherCells(): { id: string; cellType: string; source: string; readOnly: boolean }[] {
  const store = getDefaultStore();
  const ids = store.get(cellIdsAtom);
  const blueLineId = store.get(blueLineCellIdAtom);
  // null = no blue line = all cells editable; non-null = blue line above that cell
  const blueIdx = blueLineId ? Math.max(0, ids.indexOf(blueLineId)) : 0;
  return ids.map((id, idx) => {
    const cell = store.get(cellStateFamily(id));
    return {
      id: cell.id,
      cellType: cell.cellType,
      source: cell.source,
      readOnly: idx < blueIdx,
    };
  });
}

/** Check whether a cell is below (or at) the blue line — i.e. editable by the AI. */
function isCellEditable(jotai: ReturnType<typeof getDefaultStore>, cellId: string): boolean {
  const ids = jotai.get(cellIdsAtom);
  const blueLineId = jotai.get(blueLineCellIdAtom);
  if (!blueLineId) return true; // no blue line → everything editable
  const blueIdx = ids.indexOf(blueLineId);
  if (blueIdx === -1) return true;
  const cellIdx = ids.indexOf(cellId);
  return cellIdx >= blueIdx;
}

/** Execute actions returned by the agent. Hard-enforced: actions targeting read-only cells are rejected. */
function executeActions(actions: unknown[]): string[] {
  const jotai = getDefaultStore();
  const results: string[] = [];

  for (const a of actions) {
    const action = a as Record<string, unknown>;
    const type = action.action as string;
    const source = action.source as string | undefined;

    switch (type) {
      case 'add_code_cell': {
        const cellId = jotai.set(agentAppendCellAtom);
        if (source) {
          jotai.set(updateCellSourceAtom, { cellId, source });
        }
        results.push(cellId);
        break;
      }
      case 'add_markdown_cell': {
        const cellId = jotai.set(agentAppendCellAtom);
        const cellAtom = cellStateFamily(cellId);
        jotai.set(cellAtom, (prev) => ({ ...prev, cellType: 'markdown', source: source || '' }));
        results.push(cellId);
        break;
      }
      case 'update_last_cell': {
        const ids = jotai.get(cellIdsAtom);
        const lastId = ids[ids.length - 1];
        if (!isCellEditable(jotai, lastId)) {
          console.warn('[blue-line] Rejected update_last_cell: cell is read-only', lastId);
          break;
        }
        if (source) {
          jotai.set(updateCellSourceAtom, { cellId: lastId, source });
        }
        results.push(lastId);
        break;
      }
      case 'run_last_cell': {
        const ids = jotai.get(cellIdsAtom);
        if (ids.length > 0) {
          const lastId = ids[ids.length - 1];
          if (!isCellEditable(jotai, lastId)) {
            console.warn('[blue-line] Rejected run_last_cell: cell is read-only', lastId);
            break;
          }
          const cell = jotai.get(cellStateFamily(lastId));
          if (cell.cellType === 'code' && cell.source) {
            kernelStore.getState().executeCell(lastId, cell.source);
          }
        }
        break;
      }
    }
  }

  return results;
}

export const chatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  sendMessage: async (content: string) => {
    const userMsg = makeMsg('user', content);
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    try {
      const apiConfig = settingsStore.getState().api;
      const cells = gatherCells();
      const result = await chatWithAgent(content, apiConfig, cells);
      const agentMsg = makeMsg('agent', result.reply);
      set((s) => ({ messages: [...s.messages, agentMsg], isLoading: false }));

      if (result.actions && result.actions.length > 0) {
        executeActions(result.actions);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorText = err?.message || 'Agent is currently unavailable.';
      set((s) => ({
        messages: [...s.messages, makeMsg('system', errorText)],
        isLoading: false,
      }));
    }
  },

  clearMessages: () => set({ messages: [] }),

  loadMessages: (msgs) => set({ messages: msgs }),

  getMessages: () => get().messages,
}));
