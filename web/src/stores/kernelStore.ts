import { create } from 'zustand';
import { getDefaultStore } from 'jotai';
import { startKernel, shutdownKernel, executeCode, getKernel } from '../services/kernel';
import type { IOutput } from '../services/kernel';
import { Kernel } from '@jupyterlab/services';
import type * as KernelMessage from '@jupyterlab/services/lib/kernel/messages';
import { settingsStore } from './settingsStore';

type IKernelConnection = Kernel.IKernelConnection;
import {
  cellIdsAtom,
  cellStateFamily,
  redLineCellIdAtom,
  appendCellOutputAtom,
  setCellExecutionCountAtom,
  setCellRunningAtom,
  clearCellOutputsAtom,
} from './notebookStore';
import { checkpointStore } from './checkpointStore';
import { restoreCheckpoint } from '../services/api';

export type KernelStatus = 'disconnected' | 'connecting' | 'idle' | 'busy' | 'dead';

interface KernelState {
  status: KernelStatus;
  kernelId: string | null;
  startKernel: () => Promise<void>;
  shutdownKernel: () => Promise<void>;
  executeCell: (cellId: string, code: string) => Promise<void>;
  executeFromCheckpoint: (targetCellId: string) => Promise<void>;
  executeFromStart: (targetCellId: string) => Promise<void>;
  executeStep: (cellId: string) => Promise<void>;
}

export const kernelStore = create<KernelState>((set, get) => ({
  status: 'disconnected',
  kernelId: null,

  startKernel: async () => {
    if (get().status === 'connecting' || get().status === 'busy') return;
    const kernelName = settingsStore.getState().kernel.kernelName;
    const current = getKernel();
    if (current && current.name === kernelName && current.status === 'idle') return;
    set({ status: 'connecting' });
    try {
      const kernel: IKernelConnection = await startKernel(kernelName);
      kernel.statusChanged.connect((_sender: IKernelConnection, newStatus: KernelMessage.Status) => {
        const mapped: KernelStatus =
          newStatus === 'idle' ? 'idle' :
          newStatus === 'busy' ? 'busy' :
          newStatus === 'dead' ? 'dead' : 'disconnected';
        set({ status: mapped });
      });
      set({ kernelId: kernel.id, status: kernel.status === 'idle' ? 'idle' : 'busy' });
    } catch (err) {
      console.error('Failed to start kernel:', err);
      set({ status: 'disconnected' });
      throw err;
    }
  },

  shutdownKernel: async () => {
    await shutdownKernel();
    set({ status: 'disconnected', kernelId: null });
  },

  executeCell: async (cellId: string, code: string) => {
    const kernel = getKernel();
    if (!kernel) throw new Error('No kernel connected');

    const jotai = getDefaultStore();

    jotai.set(clearCellOutputsAtom, cellId);
    jotai.set(setCellRunningAtom, { cellId, isRunning: true });

    let execCount: number | null = null;

    const onOutput = (output: IOutput) => {
      jotai.set(appendCellOutputAtom, { cellId, output });
      if (output.outputType === 'execute_input' && output.executionCount != null) {
        execCount = output.executionCount;
      }
    };

    try {
      await executeCode(kernel, code, onOutput);
      if (execCount != null) {
        jotai.set(setCellExecutionCountAtom, { cellId, count: execCount });
      }
    } finally {
      jotai.set(setCellRunningAtom, { cellId, isRunning: false });
    }
  },

  executeFromCheckpoint: async (targetCellId: string) => {
    const kernel = getKernel();
    if (!kernel) throw new Error('No kernel connected');
    const jotai = getDefaultStore();
    const ids = jotai.get(cellIdsAtom);
    const targetIdx = ids.indexOf(targetCellId);
    if (targetIdx === -1) return;

    // Get last checkpoint
    const activeCheckpoints = checkpointStore.getState().getActiveNodes();
    const lastCp = activeCheckpoints.length > 0 ? activeCheckpoints[activeCheckpoints.length - 1] : null;

    // Restore from last checkpoint if it exists
    let startIdx: number;
    if (lastCp) {
      const kernelId = get().kernelId;
      if (kernelId) {
        await restoreCheckpoint(kernelId, lastCp.id);
      }
      startIdx = lastCp.cellIndex + 1;
    } else {
      startIdx = 0;
    }

    if (targetIdx < startIdx) return;

    // Execute code cells sequentially from startIdx to targetIdx
    for (let i = startIdx; i <= targetIdx; i++) {
      const id = ids[i];
      const cell = jotai.get(cellStateFamily(id));
      if (cell.cellType !== 'code' || !cell.source.trim()) continue;
      await get().executeCell(id, cell.source);
    }

    // Advance red-line to next cell after target
    const nextIdx = targetIdx + 1;
    if (nextIdx < ids.length) {
      jotai.set(redLineCellIdAtom, ids[nextIdx]);
    } else {
      jotai.set(redLineCellIdAtom, null);
    }
  },

  executeFromStart: async (targetCellId: string) => {
    const kernel = getKernel();
    if (!kernel) throw new Error('No kernel connected');
    const jotai = getDefaultStore();
    const ids = jotai.get(cellIdsAtom);
    const targetIdx = ids.indexOf(targetCellId);
    if (targetIdx === -1) return;

    for (let i = 0; i <= targetIdx; i++) {
      const id = ids[i];
      const cell = jotai.get(cellStateFamily(id));
      if (cell.cellType !== 'code' || !cell.source.trim()) continue;
      await get().executeCell(id, cell.source);
    }

    const nextIdx = targetIdx + 1;
    if (nextIdx < ids.length) {
      jotai.set(redLineCellIdAtom, ids[nextIdx]);
    } else {
      jotai.set(redLineCellIdAtom, null);
    }
  },

  executeStep: async (cellId: string) => {
    const kernel = getKernel();
    if (!kernel) throw new Error('No kernel connected');
    const jotai = getDefaultStore();
    const ids = jotai.get(cellIdsAtom);
    const idx = ids.indexOf(cellId);
    if (idx === -1) return;

    const cell = jotai.get(cellStateFamily(cellId));
    if (cell.cellType === 'code' && cell.source.trim()) {
      await get().executeCell(cellId, cell.source);
    }

    // Advance red-line past this cell
    const nextIdx = idx + 1;
    if (nextIdx < ids.length) {
      jotai.set(redLineCellIdAtom, ids[nextIdx]);
    } else {
      jotai.set(redLineCellIdAtom, null);
    }
  },
}));

export function useKernelStatus(): KernelStatus {
  return kernelStore((s) => s.status);
}
