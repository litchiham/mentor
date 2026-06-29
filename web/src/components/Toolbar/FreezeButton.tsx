import { useState, useCallback } from 'react';
import { getDefaultStore } from 'jotai';
import { checkpointStore, useActiveCheckpoints } from '../../stores/checkpointStore';
import { kernelStore } from '../../stores/kernelStore';
import { cellIdsAtom, redLineCellIdAtom } from '../../stores/notebookStore';
import { createCheckpoint } from '../../services/api';
import type { ICheckpointNode } from '../../types';

export default function FreezeButton() {
  const [frozen, setFrozen] = useState(false);
  const checkpoints = useActiveCheckpoints();
  const status = kernelStore((s) => s.status);
  const kernelId = kernelStore((s) => s.kernelId);

  const handleFreeze = useCallback(async () => {
    if (!kernelId) return;
    try {
      const store = getDefaultStore();
      const ids = store.get(cellIdsAtom);
      const redLineId = store.get(redLineCellIdAtom);
      const cellIndex = redLineId ? Math.max(0, ids.indexOf(redLineId)) : 0;

      // Don't freeze if there's already a checkpoint at this cellIndex
      const activeCheckpoints = checkpointStore.getState().getActiveNodes();
      if (activeCheckpoints.some((cp) => cp.cellIndex === cellIndex)) return;

      const headName = checkpoints.length > 0
        ? checkpointStore.getState().nodes[checkpoints[checkpoints.length - 1].id]?.name
        : null;
      const idx = headName ? parseInt(headName.match(/\d+$/)?.[0] || '0') : 0;
      const name = `Checkpoint ${idx + 1}`;

      const result = await createCheckpoint({
        kernelId,
        name,
        cellIndex,
      });

      const prevId = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].id : null;

      const node: ICheckpointNode = {
        id: result.id,
        name: result.name,
        prev: prevId,
        timestamp: result.timestamp || Date.now(),
        cellIndex: result.cellIndex,
        kernelStateHash: result.kernelStateHash,
      };

      checkpointStore.getState().insertNode(node);
      setFrozen(true);
      setTimeout(() => setFrozen(false), 1500);
    } catch (err) {
      console.error('Freeze failed:', err);
    }
  }, [kernelId, checkpoints]);

  const disabled = status === 'disconnected' || status === 'connecting';

  return (
    <button
      className={`mentor-freeze-button ${frozen ? 'frozen' : ''}`}
      onClick={handleFreeze}
      disabled={disabled}
      title={disabled ? 'Kernel not connected' : 'Freeze current kernel state'}
    >
      {frozen ? '✓ Frozen' : '🔒 Freeze'}
    </button>
  );
}
