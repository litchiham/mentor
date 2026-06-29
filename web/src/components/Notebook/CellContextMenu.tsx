import { useEffect, useRef, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import {
  insertCellAboveAtom,
  insertCellBelowAtom,
  removeCellAtom,
  clearCellOutputsAtom,
  setCellTypeAtom,
  blueLineCellIdAtom,
} from '../../stores/notebookStore';
import type { ICellState } from '../../stores/notebookStore';

interface CellContextMenuProps {
  cellId: string;
  cellType: ICellState['cellType'];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export default function CellContextMenu({ cellId, cellType, position, onClose }: CellContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const insertAbove = useSetAtom(insertCellAboveAtom);
  const insertBelow = useSetAtom(insertCellBelowAtom);
  const removeCell = useSetAtom(removeCellAtom);
  const clearOutputs = useSetAtom(clearCellOutputsAtom);
  const setCellType = useSetAtom(setCellTypeAtom);
  const setBlueLine = useSetAtom(blueLineCellIdAtom);

  const handleClick = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!position) return null;

  return (
    <div
      ref={ref}
      className="mentor-menu-dropdown"
      style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 200 }}
    >
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => insertAbove(cellId))}>
        Insert Cell Above
      </div>
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => insertBelow(cellId))}>
        Insert Cell Below
      </div>
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => setBlueLine(cellId))}>
        Move Blue-line Here
      </div>
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => clearOutputs(cellId))}>
        Clear Outputs
      </div>
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => setCellType({ cellId, cellType: cellType === 'code' ? 'markdown' : 'code' }))}>
        {cellType === 'code' ? 'Switch to Markdown' : 'Switch to Code'}
      </div>
      <div className="mentor-menu-dropdown-item" onClick={() => handleClick(() => removeCell(cellId))}>
        Delete Cell
      </div>
    </div>
  );
}
