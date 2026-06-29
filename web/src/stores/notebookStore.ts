import { atom, getDefaultStore } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { IOutput } from '../services/kernel';

export interface ICellState {
  id: string;
  cellType: 'code' | 'markdown';
  source: string;
  outputs: IOutput[];
  executionCount: number | null;
  isRunning: boolean;
}

function makeCellId(): string {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const cellIdsAtom = atom<string[]>([]);

/** The currently focused cell. */
export const activeCellIdAtom = atom<string | null>(null);

/** Blue line divider: cells before this line are AI read-only, cells at/after are AI read-write.
    Stores the cell ID that the blue line sits above (null = blue line at very bottom, all cells editable). */
export const blueLineCellIdAtom = atom<string | null>(null);

/** Red line: shows current execution position. Non-draggable, minimal style.
    Sits above the cell that hasn't been executed yet. null = all cells executed or no cells. */
export const redLineCellIdAtom = atom<string | null>(null);

export const cellStateFamily = atomFamily<string, ReturnType<typeof atom<ICellState>>>((id) =>
  atom<ICellState>({
    id,
    cellType: 'code',
    source: '',
    outputs: [],
    executionCount: null,
    isRunning: false,
  }),
);

export const addCellAtom = atom(null, (get, set, afterId?: string) => {
  const id = makeCellId();
  set(cellStateFamily(id), {
    id,
    cellType: 'code',
    source: '',
    outputs: [],
    executionCount: null,
    isRunning: false,
  });
  const ids = get(cellIdsAtom);
  if (afterId) {
    const idx = ids.indexOf(afterId);
    set(cellIdsAtom, [...ids.slice(0, idx + 1), id, ...ids.slice(idx + 1)]);
  } else {
    set(cellIdsAtom, [...ids, id]);
  }
  // Move blue line to above the newly added cell
  set(blueLineCellIdAtom, id);
  return id;
});

/** Agent-only cell append: always appends at notebook end. Sets blue line to first cell if not yet set. */
export const agentAppendCellAtom = atom(null, (get, set) => {
  const id = makeCellId();
  set(cellStateFamily(id), {
    id,
    cellType: 'code',
    source: '',
    outputs: [],
    executionCount: null,
    isRunning: false,
  });
  const ids = get(cellIdsAtom);
  set(cellIdsAtom, [...ids, id]);
  // Set blue line to first cell if not yet set
  if (!get(blueLineCellIdAtom)) {
    set(blueLineCellIdAtom, ids.length > 0 ? ids[0] : id);
  }
  // Red line starts at first cell
  if (!get(redLineCellIdAtom)) {
    set(redLineCellIdAtom, ids.length > 0 ? ids[0] : id);
  }
  return id;
});

export const removeCellAtom = atom(null, (get, set, cellId: string) => {
  const ids = get(cellIdsAtom);
  const idx = ids.indexOf(cellId);
  set(cellIdsAtom, ids.filter((id) => id !== cellId));
  cellStateFamily.remove(cellId);
  // If the blue line was on the removed cell, move it to the next one
  if (get(blueLineCellIdAtom) === cellId) {
    const remaining = ids.filter((id) => id !== cellId);
    if (idx < remaining.length) {
      set(blueLineCellIdAtom, remaining[idx]); // next cell at same index
    } else if (remaining.length > 0) {
      set(blueLineCellIdAtom, remaining[remaining.length - 1]);
    } else {
      set(blueLineCellIdAtom, null);
    }
  }
});

export const updateCellSourceAtom = atom(null, (_get, set, update: { cellId: string; source: string }) => {
  const cellAtom = cellStateFamily(update.cellId);
  set(cellAtom, (prev) => ({ ...prev, source: update.source }));
});

export const setCellRunningAtom = atom(null, (_get, set, update: { cellId: string; isRunning: boolean }) => {
  const cellAtom = cellStateFamily(update.cellId);
  set(cellAtom, (prev) => ({ ...prev, isRunning: update.isRunning }));
});

export const clearCellOutputsAtom = atom(null, (_get, set, cellId: string) => {
  const cellAtom = cellStateFamily(cellId);
  set(cellAtom, (prev) => ({ ...prev, outputs: [] }));
});

export const appendCellOutputAtom = atom(null, (_get, set, update: { cellId: string; output: IOutput }) => {
  const cellAtom = cellStateFamily(update.cellId);
  set(cellAtom, (prev) => ({ ...prev, outputs: [...prev.outputs, update.output] }));
});

export const setCellExecutionCountAtom = atom(null, (_get, set, update: { cellId: string; count: number | null }) => {
  const cellAtom = cellStateFamily(update.cellId);
  set(cellAtom, (prev) => ({ ...prev, executionCount: update.count }));
});

export const insertCellAboveAtom = atom(null, (get, set, cellId: string) => {
  const ids = get(cellIdsAtom);
  const idx = ids.indexOf(cellId);
  if (idx === -1) return;
  const id = makeCellId();
  set(cellStateFamily(id), {
    id,
    cellType: 'code',
    source: '',
    outputs: [],
    executionCount: null,
    isRunning: false,
  });
  set(cellIdsAtom, [...ids.slice(0, idx), id, ...ids.slice(idx)]);
  set(blueLineCellIdAtom, id);
});

export const insertCellBelowAtom = atom(null, (get, set, cellId: string) => {
  const ids = get(cellIdsAtom);
  const idx = ids.indexOf(cellId);
  if (idx === -1) return;
  const id = makeCellId();
  set(cellStateFamily(id), {
    id,
    cellType: 'code',
    source: '',
    outputs: [],
    executionCount: null,
    isRunning: false,
  });
  set(cellIdsAtom, [...ids.slice(0, idx + 1), id, ...ids.slice(idx + 1)]);
  set(blueLineCellIdAtom, id);
});

export const setCellTypeAtom = atom(null, (_get, set, update: { cellId: string; cellType: 'code' | 'markdown' }) => {
  const cellAtom = cellStateFamily(update.cellId);
  set(cellAtom, (prev) => ({ ...prev, cellType: update.cellType }));
});

/** Extract current workspace state for persistence. */
export function gatherWorkspaceState(): { blueLineCellId: string | null; redLineCellId: string | null } {
  const store = getDefaultStore();
  return {
    blueLineCellId: store.get(blueLineCellIdAtom),
    redLineCellId: store.get(redLineCellIdAtom),
  };
}

export const loadNotebookAtom = atom(null, (get, set, cells: ICellState[]) => {
  const ids: string[] = [];
  for (const cell of cells) {
    set(cellStateFamily(cell.id), cell);
    ids.push(cell.id);
  }
  set(cellIdsAtom, ids);
  // Blue line defaults to top (above first cell → all cells editable)
  if (ids.length > 0 && !get(blueLineCellIdAtom)) {
    set(blueLineCellIdAtom, ids[0]);
  }
  // Red line starts at first cell
  if (ids.length > 0 && !get(redLineCellIdAtom)) {
    set(redLineCellIdAtom, ids[0]);
  }
});
