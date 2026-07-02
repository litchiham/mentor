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

export interface IPluginToolDef {
  name: string;
  description: string;
  guidelines?: string;
  function: string;
  parameters: Record<string, { type: string; description: string; unit?: string; required?: boolean }>;
  returns: { type: string; description: string; unit?: string };
  model?: { format: string; path: string };
}

export interface IPluginDataDef {
  name: string;
  description: string;
  guidelines?: string;
  loader: string;
  loader_type: string;
  parameters: Record<string, { type: string; description: string; unit?: string; required?: boolean }>;
  returns: { type: string; description: string };
  metadata?: Record<string, string>;
}

export interface IPluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  python_module: string;
  requires: string[];
  guidelines?: string;
  tools: IPluginToolDef[];
  data: IPluginDataDef[];
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

export async function browseDirectory(path?: string, allFiles?: boolean): Promise<IDirectoryBrowseResponse> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (allFiles) params.set('all', '1');
  const qs = params.toString();
  const res = await fetch(`${BASE}/dir/browse${qs ? '?' + qs : ''}`);
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

/* ---------- Plugin APIs ---------- */

export async function listPlugins(kernelId: string): Promise<IPluginManifest[]> {
  const res = await fetch(`${BASE}/plugins?kernelId=${encodeURIComponent(kernelId)}`);
  if (!res.ok) throw new Error(`Failed to list plugins: ${res.status}`);
  return res.json();
}

export async function installPlugin(kernelId: string, packageName: string): Promise<{ status: string; packageName: string }> {
  const res = await fetch(`${BASE}/plugins/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kernelId, packageName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Install failed' }));
    throw new Error(err.error || `Failed to install plugin: ${res.status}`);
  }
  return res.json();
}

export async function uninstallPlugin(name: string, kernelId: string): Promise<void> {
  const res = await fetch(`${BASE}/plugins/uninstall/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kernelId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Uninstall failed' }));
    throw new Error(err.error || `Failed to uninstall plugin: ${res.status}`);
  }
}
