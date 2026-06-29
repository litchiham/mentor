import { useState, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { cellStateFamily, updateCellSourceAtom, activeCellIdAtom, redLineCellIdAtom } from '../../stores/notebookStore';
import { kernelStore } from '../../stores/kernelStore';
import CellEditor from './CellEditor';
import CellContextMenu from './CellContextMenu';

interface MarkdownCellProps {
  cellId: string;
}

export default function MarkdownCell({ cellId }: MarkdownCellProps) {
  const cellState = useAtomValue(cellStateFamily(cellId));
  const updateSource = useSetAtom(updateCellSourceAtom);
  const setActiveCell = useSetAtom(activeCellIdAtom);
  const redLineId = useAtomValue(redLineCellIdAtom);
  const executeFromCheckpoint = kernelStore((s) => s.executeFromCheckpoint);
  const executeFromStart = kernelStore((s) => s.executeFromStart);
  const startKernel = kernelStore((s) => s.startKernel);
  const status = kernelStore((s) => s.status);
  const [editing, setEditing] = useState(!cellState.source.trim());
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const isNextAfterRedLine = redLineId === cellId;

  const ensureKernel = useCallback(async () => {
    if (status === 'disconnected' || status === 'dead') {
      await startKernel();
    }
  }, [status, startKernel]);

  const handleChange = useCallback(
    (value: string) => updateSource({ cellId, source: value }),
    [cellId, updateSource],
  );

  const handleRender = useCallback(() => {
    if (cellState.source.trim()) {
      setEditing(false);
    }
  }, [cellState.source]);

  const handleExecuteToHere = useCallback(async () => {
    await ensureKernel();
    await executeFromCheckpoint(cellId);
  }, [cellId, executeFromCheckpoint, ensureKernel]);

  const handleExecuteFromStart = useCallback(async () => {
    await ensureKernel();
    await executeFromStart(cellId);
  }, [cellId, executeFromStart, ensureKernel]);

  const handleDoubleClick = useCallback(() => {
    setActiveCell(cellId);
    setEditing(true);
  }, [cellId, setActiveCell]);

  const handleFocus = useCallback(() => {
    setActiveCell(cellId);
  }, [cellId, setActiveCell]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const html = DOMPurify.sanitize(marked.parse(cellState.source, { async: false }) as string);

  if (editing) {
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
                onClick={(e) => { e.stopPropagation(); handleRender(); }}
                title="Render markdown (step)"
              >
                ▶
              </button>
            )}
            <button
              className="mentor-cell-run-btn"
              onClick={(e) => { e.stopPropagation(); handleExecuteFromStart(); }}
              title="Execute from start to here"
            >
              ▶▶
            </button>
            <button
              className="mentor-cell-run-btn"
              onClick={(e) => { e.stopPropagation(); handleExecuteToHere(); }}
              title="Execute from last checkpoint to here"
            >
              ⏭
            </button>
          </div>
          <span className="mentor-cell-prompt">[M]</span>
          <CellEditor
            value={cellState.source}
            onChange={handleChange}
            onExecute={handleRender}
            readOnly={false}
            language="markdown"
          />
        </div>
        <CellContextMenu
          cellId={cellId}
          cellType={cellState.cellType}
          position={menuPos}
          onClose={() => setMenuPos(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="mentor-cell"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={handleFocus}
    >
      <div className="mentor-cell-input">
        <div className={`mentor-cell-actions${hovered ? ' visible' : ''}`}>
          {isNextAfterRedLine && (
            <button
              className="mentor-cell-run-btn"
              onClick={(e) => { e.stopPropagation(); handleRender(); }}
              title="Render markdown (step)"
            >
              ▶
            </button>
          )}
          <button
            className="mentor-cell-run-btn"
            onClick={(e) => { e.stopPropagation(); handleExecuteFromStart(); }}
            title="Execute from start to here"
          >
            ⏮
          </button>
          <button
            className="mentor-cell-run-btn"
            onClick={(e) => { e.stopPropagation(); handleExecuteToHere(); }}
            title="Execute from last checkpoint to here"
          >
            ⏭
          </button>
        </div>
        <div className="mentor-markdown-rendered" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <CellContextMenu
        cellId={cellId}
        cellType={cellState.cellType}
        position={menuPos}
        onClose={() => setMenuPos(null)}
      />
    </div>
  );
}
