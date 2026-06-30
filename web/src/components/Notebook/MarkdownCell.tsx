import { useState, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { cellStateFamily, updateCellSourceAtom, activeCellIdAtom } from '../../stores/notebookStore';
import { renderMarkdown } from '../../services/markdown';
import CellEditor from './CellEditor';
import CellContextMenu from './CellContextMenu';

interface MarkdownCellProps {
  cellId: string;
}

export default function MarkdownCell({ cellId }: MarkdownCellProps) {
  const cellState = useAtomValue(cellStateFamily(cellId));
  const updateSource = useSetAtom(updateCellSourceAtom);
  const setActiveCell = useSetAtom(activeCellIdAtom);
  const [editing, setEditing] = useState(!cellState.source.trim());
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const handleChange = useCallback(
    (value: string) => updateSource({ cellId, source: value }),
    [cellId, updateSource],
  );

  const handleRender = useCallback(() => {
    if (cellState.source.trim()) {
      setEditing(false);
    }
  }, [cellState.source]);

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

  const html = renderMarkdown(cellState.source);

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
            <button
              className="mentor-cell-run-btn"
              onClick={(e) => { e.stopPropagation(); handleRender(); }}
              title="Render markdown"
            >
              ▶
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
          <button
            className="mentor-cell-run-btn"
            onClick={(e) => { e.stopPropagation(); handleRender(); }}
            title="Edit markdown"
          >
            ▶
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
