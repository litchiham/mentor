import { KernelManager, Kernel, ServerConnection } from '@jupyterlab/services';
import type * as KernelMessage from '@jupyterlab/services/lib/kernel/messages';

type IKernelConnection = Kernel.IKernelConnection;

let _manager: KernelManager | null = null;
let _kernel: IKernelConnection | null = null;

export function createServerSettings(): ServerConnection.ISettings {
  return ServerConnection.makeSettings({
    baseUrl: '',
    wsUrl: '',
    token: '',
    appendToken: false,
  });
}

export function getKernelManager(): KernelManager {
  if (!_manager) {
    _manager = new KernelManager({ serverSettings: createServerSettings() });
  }
  return _manager;
}

export function getKernel(): IKernelConnection | null {
  return _kernel;
}

export async function startKernel(kernelName?: string): Promise<IKernelConnection> {
  if (_kernel && _kernel.status !== 'dead') {
    return _kernel;
  }
  const manager = getKernelManager();
  _kernel = await manager.startNew({ name: kernelName || 'python3' });
  return _kernel;
}

export async function shutdownKernel(): Promise<void> {
  if (!_kernel) return;
  try {
    await _kernel.shutdown();
  } catch {
    // kernel may already be dead
  }
  _kernel = null;
}

export interface IOutput {
  outputType: 'stream' | 'display_data' | 'execute_result' | 'error' | 'execute_input';
  name?: 'stdout' | 'stderr';
  text?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  executionCount?: number | null;
  ename?: string;
  evalue?: string;
  traceback?: string[];
  code?: string;
}

export type OutputCallback = (output: IOutput) => void;

export function executeCode(
  kernel: IKernelConnection,
  code: string,
  onOutput: OutputCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const future = kernel.requestExecute({ code });

    future.onIOPub = (msg: KernelMessage.IIOPubMessage) => {
      switch (msg.header.msg_type) {
        case 'stream': {
          const c = (msg as KernelMessage.IStreamMsg).content;
          onOutput({ outputType: 'stream', name: c.name, text: c.text });
          break;
        }
        case 'display_data': {
          const c = (msg as KernelMessage.IDisplayDataMsg).content;
          onOutput({ outputType: 'display_data', data: c.data as Record<string, unknown>, metadata: c.metadata as Record<string, unknown> });
          break;
        }
        case 'execute_result': {
          const c = (msg as KernelMessage.IExecuteResultMsg).content;
          onOutput({ outputType: 'execute_result', data: c.data as Record<string, unknown>, metadata: c.metadata as Record<string, unknown>, executionCount: c.execution_count as number });
          break;
        }
        case 'error': {
          const c = (msg as KernelMessage.IErrorMsg).content;
          onOutput({ outputType: 'error', ename: c.ename, evalue: c.evalue, traceback: c.traceback });
          break;
        }
        case 'execute_input': {
          const c = (msg as KernelMessage.IExecuteInputMsg).content;
          onOutput({ outputType: 'execute_input', code: c.code, executionCount: c.execution_count as number });
          break;
        }
      }
    };

    future.onReply = () => {
      resolve();
    };

    future.done.catch(reject);
  });
}
