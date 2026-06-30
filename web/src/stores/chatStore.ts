import { create } from 'zustand';
import { getDefaultStore } from 'jotai';
import { chatWithAgent } from '../services/api';
import type { IAgentAction } from '../services/api';
import { settingsStore } from './settingsStore';
import { kernelStore } from './kernelStore';
import { checkpointStore } from './checkpointStore';
import {
  cellIdsAtom,
  cellStateFamily,
  blueLineCellIdAtom,
  redLineCellIdAtom,
  agentAppendCellAtom,
  updateCellSourceAtom,
  insertCellAboveAtom,
  insertCellBelowAtom,
  removeCellAtom,
  setCellTypeAtom,
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

/** Gather full notebook context: cells (with text outputs), blue-line, red-line, checkpoints. */
function gatherNotebookContext(): Record<string, unknown> {
  const store = getDefaultStore();
  const ids = store.get(cellIdsAtom);
  const blueLineId = store.get(blueLineCellIdAtom);
  const redLineId = store.get(redLineCellIdAtom);
  const blueIdx = blueLineId ? Math.max(0, ids.indexOf(blueLineId)) : 0;

  const cells = ids.map((id, idx) => {
    const cell = store.get(cellStateFamily(id));
    return {
      id: cell.id,
      index: idx,
      cellType: cell.cellType,
      source: cell.source,
      executionCount: cell.executionCount,
      isRunning: cell.isRunning,
      readOnly: idx < blueIdx,
      outputs: cell.outputs
        .filter((o) => o.outputType === 'stream' || o.outputType === 'error')
        .map((o) => {
          const out: Record<string, unknown> = { outputType: o.outputType };
          if (o.name) out.name = o.name;
          if (o.text) out.text = o.text.slice(0, 1000);
          if (o.ename) out.ename = o.ename;
          if (o.evalue) out.evalue = o.evalue;
          return out;
        }),
    };
  });

  const activeCheckpoints = checkpointStore.getState().getActiveNodes();
  const checkpoints = activeCheckpoints.map((cp) => ({
    id: cp.id,
    name: cp.name,
    cellIndex: cp.cellIndex,
  }));

  return {
    cells,
    blueLineCellId: blueLineId,
    redLineCellId: redLineId,
    checkpoints,
    cellCount: ids.length,
  };
}

/** Check whether a cell is below (or at) the blue line — i.e. editable by the AI. */
function isCellEditable(jotai: ReturnType<typeof getDefaultStore>, cellId: string): boolean {
  const ids = jotai.get(cellIdsAtom);
  const blueLineId = jotai.get(blueLineCellIdAtom);
  if (!blueLineId) return true;
  const blueIdx = ids.indexOf(blueLineId);
  if (blueIdx === -1) return true;
  const cellIdx = ids.indexOf(cellId);
  return cellIdx >= blueIdx;
}

/** Execute actions returned by the agent. Hard-enforced: actions targeting read-only cells are rejected. */
function executeActions(actions: IAgentAction[]): string[] {
  const jotai = getDefaultStore();
  const results: string[] = [];

  for (const a of actions) {
    const type = a.action;

    switch (type) {
      case 'add_code_cell': {
        const cellId = jotai.set(agentAppendCellAtom);
        if (a.source) {
          jotai.set(updateCellSourceAtom, { cellId, source: a.source });
        }
        results.push(cellId);
        break;
      }
      case 'add_markdown_cell': {
        const cellId = jotai.set(agentAppendCellAtom);
        const cellAtom = cellStateFamily(cellId);
        jotai.set(cellAtom, (prev) => ({ ...prev, cellType: 'markdown', source: a.source || '' }));
        results.push(cellId);
        break;
      }
      case 'update_cell': {
        if (!a.cellId) break;
        if (!isCellEditable(jotai, a.cellId)) {
          console.warn('[blue-line] Rejected update_cell: cell is read-only', a.cellId);
          break;
        }
        if (a.source !== undefined) {
          jotai.set(updateCellSourceAtom, { cellId: a.cellId, source: a.source });
        }
        if (a.cellType) {
          jotai.set(setCellTypeAtom, { cellId: a.cellId, cellType: a.cellType });
        }
        results.push(a.cellId);
        break;
      }
      case 'delete_cell': {
        if (!a.cellId) break;
        if (!isCellEditable(jotai, a.cellId)) {
          console.warn('[blue-line] Rejected delete_cell: cell is read-only', a.cellId);
          break;
        }
        jotai.set(removeCellAtom, a.cellId);
        results.push(a.cellId);
        break;
      }
      case 'insert_cell_above': {
        if (!a.cellId) break;
        const ids = jotai.get(cellIdsAtom);
        const idx = ids.indexOf(a.cellId);
        if (idx === -1) break;
        // Check blue-line: can only insert at or after blue-line
        const blueLineId = jotai.get(blueLineCellIdAtom);
        if (blueLineId) {
          const blueIdx = ids.indexOf(blueLineId);
          if (idx < blueIdx) {
            console.warn('[blue-line] Rejected insert_cell_above: above blue-line', a.cellId);
            break;
          }
        }
        jotai.set(insertCellAboveAtom, a.cellId);
        // Get the newly created cell (it's now at the same index)
        const newIds = jotai.get(cellIdsAtom);
        const newCellId = newIds[idx];
        if (a.source) {
          jotai.set(updateCellSourceAtom, { cellId: newCellId, source: a.source });
        }
        if (a.cellType === 'markdown') {
          jotai.set(setCellTypeAtom, { cellId: newCellId, cellType: 'markdown' });
        }
        results.push(newCellId);
        break;
      }
      case 'insert_cell_below': {
        if (!a.cellId) break;
        const ids = jotai.get(cellIdsAtom);
        const idx = ids.indexOf(a.cellId);
        if (idx === -1) break;
        const blueLineId = jotai.get(blueLineCellIdAtom);
        if (blueLineId) {
          const blueIdx = ids.indexOf(blueLineId);
          if (idx < blueIdx) {
            console.warn('[blue-line] Rejected insert_cell_below: above blue-line', a.cellId);
            break;
          }
        }
        jotai.set(insertCellBelowAtom, a.cellId);
        const newIds = jotai.get(cellIdsAtom);
        const newCellId = newIds[idx + 1];
        if (a.source) {
          jotai.set(updateCellSourceAtom, { cellId: newCellId, source: a.source });
        }
        if (a.cellType === 'markdown') {
          jotai.set(setCellTypeAtom, { cellId: newCellId, cellType: 'markdown' });
        }
        results.push(newCellId);
        break;
      }
      case 'execute_from_start': {
        if (!a.cellId) break;
        if (!isCellEditable(jotai, a.cellId)) {
          console.warn('[blue-line] Rejected execute_from_start: cell is read-only', a.cellId);
          break;
        }
        kernelStore.getState().executeFromStart(a.cellId);
        results.push(a.cellId);
        break;
      }
      case 'execute_from_checkpoint': {
        if (!a.cellId) break;
        if (!isCellEditable(jotai, a.cellId)) {
          console.warn('[blue-line] Rejected execute_from_checkpoint: cell is read-only', a.cellId);
          break;
        }
        kernelStore.getState().executeFromCheckpoint(a.cellId);
        results.push(a.cellId);
        break;
      }
      case 'execute_step': {
        if (!a.cellId) break;
        if (!isCellEditable(jotai, a.cellId)) {
          console.warn('[blue-line] Rejected execute_step: cell is read-only', a.cellId);
          break;
        }
        kernelStore.getState().executeStep(a.cellId);
        results.push(a.cellId);
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
      const context = gatherNotebookContext();
      const result = await chatWithAgent(content, apiConfig, context);
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
