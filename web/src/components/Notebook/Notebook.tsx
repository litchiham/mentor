import { useEffect, useCallback, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { cellIdsAtom, addCellAtom, cellStateFamily, blueLineCellIdAtom, redLineCellIdAtom } from '../../stores/notebookStore';
import { useActiveCheckpoints } from '../../stores/checkpointStore';
import CodeCell from './CodeCell';
import MarkdownCell from './MarkdownCell';
import CheckpointMarker from './CheckpointMarker';

export default function Notebook() {
  const cellIds = useAtomValue(cellIdsAtom);
  const addCell = useSetAtom(addCellAtom);
  const checkpoints = useActiveCheckpoints();
  const blueLineId = useAtomValue(blueLineCellIdAtom);
  const redLineId = useAtomValue(redLineCellIdAtom);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addCell();
      }
    },
    [addCell],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const cpByIndex = new Map(checkpoints.map((cp) => [cp.cellIndex, cp]));

  const blueIdx = blueLineId ? cellIds.indexOf(blueLineId) : -1;
  const redIdx = redLineId ? cellIds.indexOf(redLineId) : -1;

  // Collect cell DOM elements for drag snapping
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  return (
    <div className="mentor-notebook">
      {cellIds.length === 0 ? (
        <p style={{ color: 'var(--color-secondary)', textAlign: 'center', marginTop: 60, fontSize: 14 }}>
          New notebook — press <kbd>Alt+N</kbd> to add a cell
        </p>
      ) : (
        cellIds.map((id, idx) => (
          <div key={id} ref={(el) => { if (el) cellRefs.current.set(id, el); else cellRefs.current.delete(id); }}>
            {cpByIndex.has(idx) && <CheckpointMarker node={cpByIndex.get(idx)!} />}
            {redIdx === idx && <div className="mentor-redline" />}
            {blueIdx === idx && <BlueLine cellRefs={cellRefs} />}
            <CellRenderer cellId={id} />
          </div>
        ))
      )}
      {/* Lines positioned after the last cell */}
      {cellIds.length > 0 && redLineId === null && <div className="mentor-redline" />}
      {cellIds.length > 0 && blueLineId === null && <BlueLine cellRefs={cellRefs} />}
    </div>
  );
}

function BlueLine({ cellRefs }: { cellRefs: React.MutableRefObject<Map<string, HTMLDivElement>> }) {
  const setBlueLine = useSetAtom(blueLineCellIdAtom);
  const cellIds = useAtomValue(cellIdsAtom);
  const [dragging, setDragging] = useState(false);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxPos) return;
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxPos]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxPos({ x: e.clientX, y: e.clientY });
  };

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);

    const handleMouseMove = (ev: MouseEvent) => {
      ev.preventDefault();
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDragging(false);

      let lastCellBottom = 0;
      cellRefs.current.forEach((el) => {
        const bottom = el.getBoundingClientRect().bottom;
        if (bottom > lastCellBottom) lastCellBottom = bottom;
      });
      if (lastCellBottom > 0 && ev.clientY > lastCellBottom + 8) {
        setBlueLine(null as any);
        return;
      }

      let closestId: string | null = null;
      let closestDist = Infinity;
      cellRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const cellTop = rect.top;
        const dist = Math.abs(ev.clientY - cellTop);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });
      if (closestId) {
        setBlueLine(closestId);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [setBlueLine, cellRefs]);

  return (
    <div className={`mentor-bluenile${dragging ? ' dragging' : ''}`} onContextMenu={handleContextMenu}>
      <div className="mentor-bluenile-handle" onMouseDown={handleDragStart} title="Drag to reposition">
        <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="9" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/></svg>
      </div>
      <span className="mentor-bluenile-label">blue-line</span>

      {ctxPos && (
        <div ref={ctxRef} className="mentor-menu-dropdown" style={{ position: 'fixed', top: ctxPos.y, left: ctxPos.x, zIndex: 200 }}>
          <div className="mentor-menu-dropdown-item" onClick={() => { setBlueLine(cellIds[0]); setCtxPos(null); }}>
            Move to Top
          </div>
          <div className="mentor-menu-dropdown-item" onClick={() => { setBlueLine(null as any); setCtxPos(null); }}>
            Move to Bottom
          </div>
        </div>
      )}
    </div>
  );
}

function CellRenderer({ cellId }: { cellId: string }) {
  const cellState = useAtomValue(cellStateFamily(cellId));
  if (cellState.cellType === 'markdown') {
    return <MarkdownCell cellId={cellId} />;
  }
  return <CodeCell cellId={cellId} />;
}
