import { useState, useEffect, useCallback, useRef } from 'react';
import { browseDirectory, createDirectory } from '../../services/api';
import type { IDirectoryBrowseResponse } from '../../services/api';

interface InstallDialogProps {
  onClose: () => void;
  onInstall: (path: string) => Promise<void>;
}

export default function InstallDialog({ onClose, onInstall }: InstallDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [data, setData] = useState<IDirectoryBrowseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState(false);
  const [makingDir, setMakingDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const newDirInputRef = useRef<HTMLInputElement>(null);

  const loadDir = useCallback(async (path?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await browseDirectory(path, true);
      setData(result);
      setCurrentPath(result.path);
    } catch (e: any) {
      setError(e?.message || 'Failed to browse directory');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDir(currentPath || undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const breadcrumbs: { name: string; path: string }[] = [];
  if (data) {
    const parts = data.path.replace(/\\/g, '/').split('/').filter(Boolean);
    let accumulated = '';
    for (const part of parts) {
      if (accumulated && !accumulated.endsWith('/')) {
        accumulated += '/' + part;
      } else if (!accumulated) {
        accumulated = part + (part.endsWith(':') ? '/' : '');
      } else {
        accumulated += part;
      }
      breadcrumbs.push({ name: part, path: accumulated });
    }
  }

  const navigateTo = (path: string) => loadDir(path);

  const hasParent = data?.parent != null;
  const showEntries = !loading && !error && data;
  const isEmpty = data && data.directories.length === 0 && data.files.length === 0;
  const isPluginDir = data?.files.some((f) => f.name === 'pyproject.toml' || f.name === 'setup.py' || f.name === 'setup.cfg');

  const handleInstall = async () => {
    if (!currentPath) return;
    setInstalling(true);
    setError('');
    try {
      await onInstall(currentPath);
    } catch (e: any) {
      setError(e?.message || 'Install failed');
    }
    setInstalling(false);
  };

  const startMakeDir = () => {
    setMakingDir(true);
    setNewDirName('');
    setTimeout(() => newDirInputRef.current?.focus(), 50);
  };

  const handleCreateDir = async () => {
    const name = newDirName.trim();
    if (!name || !data) return;
    try {
      await createDirectory(data.path, name);
      setMakingDir(false);
      setNewDirName('');
      loadDir(data.path);
    } catch (e: any) {
      setError(e?.message || 'Failed to create directory');
    }
  };

  const handleDirKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreateDir();
    else if (e.key === 'Escape') { setMakingDir(false); setNewDirName(''); }
  };

  return (
    <div className="mentor-modal-overlay" onClick={onClose}>
      <div className="mentor-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="mentor-modal-header">
          <span className="mentor-modal-title">Install Plugin</span>
          <button className="mentor-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="mentor-modal-content" style={{ padding: 20 }}>
          {/* Breadcrumbs */}
          <div className="mentor-ws-breadcrumbs">
            {breadcrumbs.length === 0 ? (
              <span className="mentor-ws-breadcrumb" onClick={() => loadDir()}>/</span>
            ) : (
              <>
                <span className="mentor-ws-breadcrumb" onClick={() => loadDir()}>/</span>
                {breadcrumbs.map((bc, i) => (
                  <span key={bc.path}>
                    <span className="mentor-ws-breadcrumb-sep">▸</span>
                    <span
                      className={`mentor-ws-breadcrumb ${i === breadcrumbs.length - 1 ? 'mentor-ws-breadcrumb--active' : ''}`}
                      onClick={() => navigateTo(bc.path)}
                    >
                      {bc.name}
                    </span>
                  </span>
                ))}
              </>
            )}
          </div>

          {/* New Folder */}
          {makingDir ? (
            <div className="mentor-ws-newdir">
              <input
                ref={newDirInputRef}
                className="mentor-input"
                style={{ flex: 1 }}
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                onKeyDown={handleDirKeyDown}
                onBlur={() => { setMakingDir(false); setNewDirName(''); }}
                placeholder="Folder name"
              />
              <button className="mentor-agent-send" style={{ padding: '6px 12px', fontSize: 12 }} onMouseDown={handleCreateDir}>
                Create
              </button>
            </div>
          ) : (
            <button className="mentor-ws-newdir-btn" onClick={startMakeDir} disabled={loading}>
              + New Folder
            </button>
          )}

          {/* Directory listing */}
          <div className="mentor-ws-list">
            {loading && <div className="mentor-ws-list-status">Loading...</div>}
            {error && <div className="mentor-ws-list-status" style={{ color: '#cc0000' }}>{error}</div>}

            {showEntries && (
              <>
                {hasParent && (
                  <div className="mentor-ws-entry" onDoubleClick={() => navigateTo(data!.parent!)}>
                    <span className="mentor-ws-entry-icon">📁</span>
                    <span className="mentor-ws-entry-name" style={{ color: 'var(--color-secondary)' }}>{'..'}</span>
                  </div>
                )}
                {data!.directories.map((d) => (
                  <div key={d.path} className="mentor-ws-entry" onDoubleClick={() => navigateTo(d.path)}>
                    <span className="mentor-ws-entry-icon">📁</span>
                    <span className="mentor-ws-entry-name">{d.name}</span>
                  </div>
                ))}
                {data!.files.map((f) => (
                  <div key={f.path} className="mentor-ws-entry mentor-ws-entry--file">
                    <span className="mentor-ws-entry-icon">📄</span>
                    <span className="mentor-ws-entry-name">{f.name}</span>
                  </div>
                ))}
                {isEmpty && (
                  <div className="mentor-ws-list-status">Empty directory</div>
                )}
              </>
            )}
          </div>

          {/* Selection indicator */}
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-secondary)' }}>
            Selected: <span style={{ color: isPluginDir ? '#34c759' : 'var(--color-text)', fontWeight: 500 }}>{currentPath || '—'}</span>
            {isPluginDir && ' ✓ Plugin detected (pyproject.toml)'}
            {currentPath && !isPluginDir && ' (no pyproject.toml found)'}
          </div>
        </div>

        <div className="mentor-modal-footer">
          <button className="mentor-agent-send" style={{ background: '#8e8e93' }} onClick={onClose} disabled={installing}>
            Cancel
          </button>
          <button className="mentor-agent-send" onClick={handleInstall} disabled={loading || installing || !currentPath}>
            {installing ? 'Installing...' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
