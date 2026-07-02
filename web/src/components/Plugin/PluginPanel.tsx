import { useEffect, useState } from 'react';
import { pluginStore } from '../../stores/pluginStore';
import { kernelStore } from '../../stores/kernelStore';
import { settingsStore } from '../../stores/settingsStore';
import PluginList from './PluginList';
import InstallDialog from './InstallDialog';

interface PluginPanelProps {
  onClose: () => void;
}

export default function PluginPanel({ onClose }: PluginPanelProps) {
  const { plugins, loading, expandedPlugin, loadPlugins, installPlugin, setExpanded, error, clearError } = pluginStore();
  const [showInstall, setShowInstall] = useState(false);

  const kernelStatus = kernelStore((s) => s.status);
  const kernelId = kernelStore((s) => s.kernelId);
  const kernelName = settingsStore((s) => s.kernel.kernelName);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const hasKernel = kernelId && kernelStatus !== 'disconnected' && kernelStatus !== 'dead';

  return (
    <div
      className="mentor-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="mentor-modal" style={{ maxWidth: 520, maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="mentor-modal-header">
          <h3>Plugins</h3>
          <button className="mentor-btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Kernel status bar */}
        <div style={{
          padding: '6px 20px',
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--color-secondary)',
          opacity: 0.85,
        }}>
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: hasKernel ? '#34c759' : '#ff3b30',
          }} />
          <span>
            Kernel: <strong>{kernelName}</strong>
            {hasKernel ? ` (${kernelStatus})` : ' — not connected'}
          </span>
        </div>

        <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--color-secondary)' }}>
            {loading ? 'Scanning...' : `${plugins.length} plugin${plugins.length !== 1 ? 's' : ''} installed`}
          </span>
          <button
            className="mentor-btn"
            onClick={() => setShowInstall(true)}
            disabled={loading || !hasKernel}
            title={!hasKernel ? 'Connect a kernel first' : undefined}
          >
            Install...
          </button>
        </div>

        {!hasKernel && !loading && (
          <div style={{ padding: '0 20px 8px', fontSize: 12, color: '#ff9500' }}>
            No kernel connected. Start a kernel to manage plugins.
          </div>
        )}

        {error && (
          <div style={{ padding: '0 20px 8px' }}>
            <span style={{ color: '#cc0000', fontSize: 12 }}>{error}</span>
            <button className="mentor-btn-sm" style={{ marginLeft: 8 }} onClick={clearError}>Dismiss</button>
          </div>
        )}

        <div style={{ padding: '0 20px 20px', overflowY: 'auto', maxHeight: 'calc(80vh - 200px)' }}>
          {loading && plugins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-secondary)', fontSize: 13 }}>
              Loading plugins...
            </div>
          ) : (
            <PluginList
              plugins={plugins}
              expandedPlugin={expandedPlugin}
              onToggleExpand={setExpanded}
            />
          )}
        </div>

        {showInstall && (
          <InstallDialog
            onClose={() => setShowInstall(false)}
            onInstall={async (path) => {
              await installPlugin(path);
              setShowInstall(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
