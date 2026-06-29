import { useState, useEffect } from 'react';
import { kernelStore, useKernelStatus } from '../../stores/kernelStore';
import { settingsStore } from '../../stores/settingsStore';
import FreezeButton from './FreezeButton';

const STATUS_COLORS: Record<string, string> = {
  disconnected: '#8e8e93',
  connecting: '#ff9f0a',
  idle: '#34c759',
  busy: '#0a84ff',
  dead: '#cc0000',
};

const STATUS_LABELS: Record<string, string> = {
  disconnected: '未连接',
  connecting: '连接中...',
  idle: '就绪',
  busy: '忙碌',
  dead: '已死',
};

export default function KernelStatusBar() {
  const status = useKernelStatus();
  const specs = settingsStore((s) => s.availableKernels);
  const kernelName = settingsStore((s) => s.kernel.kernelName);
  const [selectedKernel, setSelectedKernel] = useState(kernelName);

  useEffect(() => {
    settingsStore.getState().loadKernelSpecs();
  }, []);

  const handleConnect = async () => {
    try {
      settingsStore.getState().setKernel({ kernelName: selectedKernel });
      await kernelStore.getState().startKernel();
    } catch {
      // error already logged
    }
  };

  const handleDisconnect = async () => {
    await kernelStore.getState().shutdownKernel();
  };

  const isConnected = status === 'idle' || status === 'busy';
  const isLoading = status === 'connecting';

  return (
    <div className="mentor-statusbar">
      <div className="mentor-statusbar-left">
        <span
          className="mentor-status-dot"
          style={{ background: STATUS_COLORS[status] || '#8e8e93' }}
        />
        <span className="mentor-status-label">{STATUS_LABELS[status] || status}</span>

        <select
          className="mentor-kernel-select"
          value={selectedKernel}
          onChange={(e) => {
            setSelectedKernel(e.target.value);
            settingsStore.getState().setKernel({ kernelName: e.target.value });
          }}
        >
          {specs.length > 0
            ? specs.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.displayName} ({s.language})
                </option>
              ))
            : (
                <option value={kernelName}>{kernelName}</option>
              )}
        </select>
      </div>

      <div className="mentor-statusbar-right">
        <FreezeButton />
        {isConnected || isLoading ? (
          <button
            className="mentor-kernel-btn mentor-kernel-btn-disconnect"
            onClick={handleDisconnect}
            disabled={isLoading}
          >
            断开
          </button>
        ) : (
          <button
            className="mentor-kernel-btn mentor-kernel-btn-connect"
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? '连接中...' : '连接'}
          </button>
        )}
      </div>
    </div>
  );
}
