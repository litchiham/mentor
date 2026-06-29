import { useState, useCallback } from 'react';
import { getDefaultStore } from 'jotai';
import type { ICheckpointNode } from '../../types';
import { checkpointStore } from '../../stores/checkpointStore';
import { kernelStore } from '../../stores/kernelStore';
import { cellIdsAtom, redLineCellIdAtom } from '../../stores/notebookStore';
import { restoreCheckpoint, deleteCheckpoint } from '../../services/api';

interface CheckpointMarkerProps {
  node: ICheckpointNode;
}

export default function CheckpointMarker({ node }: CheckpointMarkerProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(async () => {
    const kernelId = kernelStore.getState().kernelId;
    if (!kernelId) return;
    try {
      // Collect IDs of checkpoints that will be orphaned by truncation
      const activeCheckpoints = checkpointStore.getState().getActiveNodes();
      const targetIdx = activeCheckpoints.findIndex((cp) => cp.id === node.id);
      const orphanIds = targetIdx >= 0
        ? activeCheckpoints.slice(targetIdx + 1).map((cp) => cp.id)
        : [];

      await restoreCheckpoint(kernelId, node.id);
      checkpointStore.getState().moveHeadTo(node.id);

      // Delete orphaned .dill files from disk
      for (const id of orphanIds) {
        try { await deleteCheckpoint(id); } catch { /* best-effort */ }
      }

      // Move red-line back to this checkpoint's cellIndex
      const jotai = getDefaultStore();
      const ids = jotai.get(cellIdsAtom);
      const nextIdx = node.cellIndex;
      if (nextIdx >= 0 && nextIdx < ids.length) {
        jotai.set(redLineCellIdAtom, ids[nextIdx]);
      }
    } catch (err) {
      console.error('Failed to restore checkpoint:', err);
    }
  }, [node.id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDelete = useCallback(async () => {
    setMenuPos(null);
    try {
      await deleteCheckpoint(node.id);
      checkpointStore.getState().deleteNode(node.id);
    } catch (err) {
      console.error('Failed to delete checkpoint:', err);
    }
  }, [node.id]);

  const handleRestore = useCallback(async () => {
    setMenuPos(null);
    await handleClick();
  }, [handleClick]);

  const time = new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div
        className="mentor-checkpoint-marker"
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={`Restore to: ${node.name}`}
      >
        {node.name} ({time})
      </div>
      {menuPos && (
        <div
          className="mentor-menu-dropdown"
          style={{ display: 'block', position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 1000 }}
          onMouseLeave={() => setMenuPos(null)}
        >
          <div className="mentor-menu-dropdown-item" onClick={handleRestore}>Restore</div>
          <div className="mentor-menu-dropdown-item" style={{ color: '#cc0000' }} onClick={handleDelete}>Delete</div>
        </div>
      )}
    </>
  );
}
