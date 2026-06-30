import type { ApiSettings } from '../stores/settingsStore';

const BASE = '/mentor/api';

export interface ICheckpointItem {
  id: string;
  name: string;
  prev: string | null;
  timestamp: number;
  cellIndex: number;
  kernelStateHash: string;
  kernelStatePath?: string;
}

interface ICheckpointListResponse {
  head: string | null;
  nodes: Record<string, ICheckpointItem>;
}

export interface IKernelSpec {
  name: string;
  displayName: string;
  language: string;
}

export async function fetchCheckpoints(): Promise<ICheckpointListResponse> {
  const res = await fetch(`${BASE}/checkpoints`);
  if (!res.ok) throw new Error(`Failed to fetch checkpoints: ${res.status}`);
  return res.json();
}

export async function createCheckpoint(data: {
  kernelId: string;
  name: string;
  cellIndex: number;
}): Promise<ICheckpointItem> {
  const res = await fetch(`${BASE}/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create checkpoint: ${res.status}`);
  return res.json();
}

export async function restoreCheckpoint(kernelId: string, checkpointId: string): Promise<void> {
  const res = await fetch(`${BASE}/kernel/${kernelId}/restore/${checkpointId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to restore checkpoint: ${res.status}`);
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  const res = await fetch(`${BASE}/checkpoint/${checkpointId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete checkpoint: ${res.status}`);
}

export interface IAgentAction {
  action: 'add_code_cell' | 'add_markdown_cell' | 'update_cell' | 'delete_cell' |
         'insert_cell_above' | 'insert_cell_below' |
         'execute_from_start' | 'execute_from_checkpoint' | 'execute_step';
  source?: string;
  cellId?: string;
  cellType?: 'code' | 'markdown';
  afterId?: string;
}

export async function chatWithAgent(
  message: string,
  apiConfig: ApiSettings,
  context: Record<string, unknown>,
): Promise<{ reply: string; actions: IAgentAction[] }> {
  const res = await fetch(`${BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      context,
      apiConfig,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ reply: 'Agent request failed' }));
    throw new Error(err.reply || `Agent chat failed: ${res.status}`);
  }
  return res.json();
}

export async function testAgentConnection(apiConfig: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<{ ok: boolean; error?: string; reply?: string }> {
  const res = await fetch(`${BASE}/agent/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiConfig),
  });
  if (!res.ok) return { ok: false, error: `Server error: ${res.status}` };
  return res.json();
}

export async function fetchKernelSpecs(): Promise<IKernelSpec[]> {
  const res = await fetch(`${BASE}/kernelspecs`);
  if (!res.ok) throw new Error(`Failed to fetch kernel specs: ${res.status}`);
  return res.json();
}

/* ---------- Workspace APIs ---------- */

export interface IWorkspaceOpenResponse {
  workspace: string;
  notebook: unknown | null;
  workspaceState: { blueLineCellId: string | null; redLineCellId: string | null } | null;
  chat: { role: string; content: string; timestamp: number }[];
  checkpoints: { head: string | null; nodes: Record<string, ICheckpointItem> };
}

export async function openWorkspace(path: string): Promise<IWorkspaceOpenResponse> {
  const res = await fetch(`${BASE}/workspace/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Failed to open workspace: ${res.status}`);
  return res.json();
}

export interface IWorkspaceSaveRequest {
  path: string;
  notebook: unknown;
  workspaceState: { blueLineCellId: string | null; redLineCellId: string | null };
  chat: { role: string; content: string; timestamp: number }[];
}

export async function saveWorkspace(data: IWorkspaceSaveRequest): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/workspace/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save workspace: ${res.status}`);
  return res.json();
}

export interface IWorkspaceStateResponse {
  lastWorkspace: string | null;
  exists: boolean;
}

export async function fetchWorkspaceState(): Promise<IWorkspaceStateResponse> {
  const res = await fetch(`${BASE}/workspace/state`);
  if (!res.ok) throw new Error(`Failed to fetch workspace state: ${res.status}`);
  return res.json();
}

export interface IDirectoryBrowseResponse {
  path: string;
  parent: string | null;
  directories: { name: string; path: string }[];
  files: { name: string; path: string }[];
}

export async function browseDirectory(path?: string): Promise<IDirectoryBrowseResponse> {
  const params = path ? `?path=${encodeURIComponent(path)}` : '';
  const res = await fetch(`${BASE}/dir/browse${params}`);
  if (!res.ok) throw new Error(`Failed to browse directory: ${res.status}`);
  return res.json();
}

export async function createDirectory(parentPath: string, name: string): Promise<{ name: string; path: string }> {
  const res = await fetch(`${BASE}/dir/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, name }),
  });
  if (!res.ok) throw new Error(`Failed to create directory: ${res.status}`);
  return res.json();
}
