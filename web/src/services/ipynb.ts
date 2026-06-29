import type { INotebookContent, ICodeCell, IMarkdownCell } from '@jupyterlab/nbformat';
import type { ICellState } from '../stores/notebookStore';
import type { IOutput } from './kernel';

export function cellStateToNbformat(cell: ICellState): ICodeCell | IMarkdownCell {
  if (cell.cellType === 'markdown') {
    return {
      cell_type: 'markdown',
      id: cell.id,
      source: cell.source,
      metadata: {},
    } as IMarkdownCell;
  }
  return {
    cell_type: 'code',
    id: cell.id,
    source: cell.source,
    metadata: {},
    outputs: cell.outputs.map((o) => {
      const base: Record<string, unknown> = { output_type: o.outputType };
      if (o.name) base.name = o.name;
      if (o.text) base.text = o.text;
      if (o.data) base.data = o.data;
      if (o.executionCount != null) base.execution_count = o.executionCount;
      if (o.ename) base.ename = o.ename;
      if (o.evalue) base.evalue = o.evalue;
      if (o.traceback) base.traceback = o.traceback;
      return base;
    }),
    execution_count: cell.executionCount,
  } as unknown as ICodeCell;
}

export function nbformatToCellState(nb: INotebookContent): ICellState[] {
  return nb.cells.map((cell, _i) => {
    const id = (cell as any).id || `cell-${Date.now()}-${_i}-${Math.random().toString(36).slice(2, 7)}`;
    if (cell.cell_type === 'markdown') {
      return {
        id,
        cellType: 'markdown',
        source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
        outputs: [],
        executionCount: null,
        isRunning: false,
      };
    }
    const cc = cell as ICodeCell;
    return {
      id,
      cellType: 'code',
      source: Array.isArray(cc.source) ? cc.source.join('') : cc.source,
      outputs: (cc.outputs || []).map((o) => {
        const base: IOutput = { outputType: o.output_type as IOutput['outputType'] };
        if ('name' in o && o.name) base.name = o.name as IOutput['name'];
        if ('text' in o && o.text) base.text = o.text as string;
        if ('data' in o && o.data) base.data = o.data as Record<string, unknown>;
        if ('execution_count' in o && o.execution_count != null) base.executionCount = o.execution_count as number;
        if ('ename' in o && o.ename) base.ename = o.ename as string;
        if ('evalue' in o && o.evalue) base.evalue = o.evalue as string;
        if ('traceback' in o && o.traceback) base.traceback = o.traceback as string[];
        return base;
      }),
      executionCount: cc.execution_count as number | null,
      isRunning: false,
    };
  });
}

export function makeNotebookContent(cells: ICellState[]): INotebookContent {
  // Filter out execute_input outputs — nbformat rejects them as invalid output_type
  const cleanCells = cells.map((cell) => {
    if (cell.cellType === 'code' && cell.outputs.some((o) => o.outputType === 'execute_input')) {
      return {
        ...cell,
        outputs: cell.outputs.filter((o) => o.outputType !== 'execute_input'),
      };
    }
    return cell;
  });

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3' },
    },
    cells: cleanCells.map(cellStateToNbformat),
  };
}
