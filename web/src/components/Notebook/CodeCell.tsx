import { useState, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { cellStateFamily, updateCellSourceAtom, activeCellIdAtom, redLineCellIdAtom } from '../../stores/notebookStore';
import { kernelStore } from '../../stores/kernelStore';
import CellEditor from './CellEditor';
import CellOutput from './CellOutput';
import CellContextMenu from './CellContextMenu';

interface CodeCellProps {
  cellId: string;
}

export default function CodeCell({ cellId }: CodeCellProps) {
  const cellState = useAtomValue(cellStateFamily(cellId));
  const updateSource = useSetAtom(updateCellSourceAtom);
  const setActiveCell = useSetAtom(activeCellIdAtom);
  const redLineId = useAtomValue(redLineCellIdAtom);
  const executeFromCheckpoint = kernelStore((s) => s.executeFromCheckpoint);
  const executeFromStart = kernelStore((s) => s.executeFromStart);
  const executeStep = kernelStore((s) => s.executeStep);
  const startKernel = kernelStore((s) => s.startKernel);
  const status = kernelStore((s) => s.status);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const isNextAfterRedLine = redLineId === cellId;

  const ensureKernel = useCallback(async () => {
    if (status === 'disconnected' || status === 'dead') {
      await startKernel();
    }
  }, [status, startKernel]);

  const handleExecuteToHere = useCallback(async () => {
    await ensureKernel();
    await executeFromCheckpoint(cellId);
  }, [cellId, executeFromCheckpoint, ensureKernel]);

  const handleExecuteFromStart = useCallback(async () => {
    await ensureKernel();
    await executeFromStart(cellId);
  }, [cellId, executeFromStart, ensureKernel]);

  const handleExecuteStep = useCallback(async () => {
    await ensureKernel();
    await executeStep(cellId);
  }, [cellId, executeStep, ensureKernel]);

  const handleChange = useCallback(
    (value: string) => updateSource({ cellId, source: value }),
    [cellId, updateSource],
  );

  const handleFocus = useCallback(() => {
    setActiveCell(cellId);
  }, [cellId, setActiveCell]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div
      className="mentor-cell"
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={handleFocus}
      onClick={handleFocus}
    >
      <div className="mentor-cell-input">
        <div className={`mentor-cell-actions${hovered ? ' visible' : ''}`}>
          {isNextAfterRedLine && (
            <button
              className="mentor-cell-run-btn"
              onClick={(e) => { e.stopPropagation(); handleExecuteStep(); }}
              disabled={cellState.isRunning}
              title="Step execute (one cell)"
            >
              ▶
            </button>
          )}
          <button
            className="mentor-cell-run-btn"
            onClick={(e) => { e.stopPropagation(); handleExecuteFromStart(); }}
            disabled={cellState.isRunning}
            title="Execute from start to here"
          >
            ▶▶
          </button>
          <button
            className="mentor-cell-run-btn"
            onClick={(e) => { e.stopPropagation(); handleExecuteToHere(); }}
            disabled={cellState.isRunning}
            title="Execute from last checkpoint to here"
          >
            ⏭
          </button>
        </div>
        <span className="mentor-cell-prompt">
          [{cellState.executionCount != null ? cellState.executionCount : ' '}]
        </span>
        <CellEditor
          value={cellState.source}
          onChange={handleChange}
          onExecute={handleExecuteToHere}
          readOnly={cellState.isRunning}
        />
      </div>
      <CellOutput outputs={cellState.outputs} />
      <CellContextMenu
        cellId={cellId}
        cellType={cellState.cellType}
        position={menuPos}
        onClose={() => setMenuPos(null)}
      />
    </div>
  );
}
