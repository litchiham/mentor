import { create } from 'zustand';
import type { ICheckpointNode } from '../types';

interface CheckpointState {
  head: string | null;
  nodes: Record<string, ICheckpointNode>;
  insertNode: (node: ICheckpointNode) => void;
  deleteNode: (id: string) => void;
  moveHeadTo: (id: string) => void;
  getActiveNodes: () => ICheckpointNode[];
  clear: () => void;
}

// Builds the linked list from root → ... → head
function buildList(headId: string | null, nodes: Record<string, ICheckpointNode>): ICheckpointNode[] {
  if (!headId) return [];
  const result: ICheckpointNode[] = [];
  let current: string | null = headId;
  while (current) {
    const node: ICheckpointNode | undefined = nodes[current];
    if (!node) break;
    result.unshift(node);
    current = node.prev;
  }
  return result;
}

export const checkpointStore = create<CheckpointState>((set, get) => ({
  head: null,
  nodes: {},

  insertNode: (node: ICheckpointNode) =>
    set((state) => {
      // Truncate all nodes after the new node's position
      // and any nodes at or beyond the cellIndex
      const newNodes = { ...state.nodes };

      // Collect nodes in the current chain from root to head
      const chain = buildList(state.head, newNodes);
      const truncateIdx = chain.findIndex((n) => n.cellIndex > node.cellIndex);

      if (truncateIdx >= 0) {
        // Remove truncated nodes
        const toRemove = chain.slice(truncateIdx);
        for (const n of toRemove) {
          delete newNodes[n.id];
        }
      }

      newNodes[node.id] = node;
      return { head: node.id, nodes: newNodes };
    }),

  deleteNode: (id) =>
    set((state) => {
      const node = state.nodes[id];
      if (!node) return state;
      const newNodes = { ...state.nodes };
      delete newNodes[id];

      // Fix the chain: link prev to the node that pointed to the deleted one
      let newHead = state.head;
      if (newHead === id) {
        newHead = node.prev;
      }

      // Find any node whose prev points to the deleted one and fix it
      for (const n of Object.values(newNodes)) {
        if (n.prev === id) {
          n.prev = node.prev;
        }
      }

      return { head: newHead, nodes: newNodes };
    }),

  moveHeadTo: (id) =>
    set((state) => {
      const chain = buildList(state.head, state.nodes);
      const idx = chain.findIndex((n) => n.id === id);
      if (idx < 0) return state;

      // Remove all nodes after target
      const newNodes = { ...state.nodes };
      const toRemove = chain.slice(idx + 1);
      for (const n of toRemove) {
        delete newNodes[n.id];
      }

      return { head: id, nodes: newNodes };
    }),

  getActiveNodes: () => {
    const { head, nodes } = get();
    return buildList(head, nodes);
  },

  clear: () => set({ head: null, nodes: {} }),
}));

/** Returns active checkpoint chain as a derived value for React */
export function useActiveCheckpoints(): ICheckpointNode[] {
  return checkpointStore((s) => buildList(s.head, s.nodes));
}
