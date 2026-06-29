import type { INotebookContent, ICell, ICodeCell, IMarkdownCell } from '@jupyterlab/nbformat';

export type { INotebookContent, ICell, ICodeCell, IMarkdownCell };

export interface ICheckpointNode {
  id: string;
  name: string;
  prev: string | null;
  timestamp: number;
  cellIndex: number;
  kernelStateHash: string;
}

export interface IChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
}

export interface ICellState {
  id: string;
  cellType: 'code' | 'markdown' | 'raw';
  source: string;
  outputs: Record<string, unknown>[];
  executionCount: number | null;
  isRunning: boolean;
}
