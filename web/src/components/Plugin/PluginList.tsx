import type { IPluginManifest } from '../../services/api';
import PluginDetail from './PluginDetail';
import { pluginStore } from '../../stores/pluginStore';

interface PluginListProps {
  plugins: IPluginManifest[];
  expandedPlugin: string | null;
  onToggleExpand: (name: string | null) => void;
}

export default function PluginList({ plugins, expandedPlugin, onToggleExpand }: PluginListProps) {
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return (
      <div className="mentor-plugin-empty">
        {!Array.isArray(plugins) ? 'Failed to load plugins.' : 'No plugins installed. Click "Install..." to add one.'}
      </div>
    );
  }

  return (
    <div className="mentor-plugin-list">
      {plugins.map((plugin) => {
        const isExpanded = expandedPlugin === plugin.name;
        const toolCount = plugin.tools?.length || 0;
        const dataCount = plugin.data?.length || 0;

        return (
          <div key={plugin.name} className="mentor-plugin-card">
            <div className="mentor-plugin-card-header">
              <div className="mentor-plugin-card-info">
                <span className="mentor-plugin-name">{plugin.name}</span>
                <span className="mentor-plugin-version">v{plugin.version}</span>
                <span className="mentor-plugin-desc">{plugin.description}</span>
                <span className="mentor-plugin-meta">
                  {toolCount} tool{toolCount !== 1 ? 's' : ''} · {dataCount} data source{dataCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="mentor-plugin-card-actions">
                <button
                  className="mentor-btn-sm"
                  onClick={() => onToggleExpand(isExpanded ? null : plugin.name)}
                >
                  {isExpanded ? '▼ Collapse' : '▶ Expand'}
                </button>
                <button
                  className="mentor-btn-sm mentor-btn-danger"
                  onClick={() => {
                    if (window.confirm(`Uninstall plugin "${plugin.name}"? This will delete its files.`)) {
                      pluginStore.getState().removePlugin(plugin.name);
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            {isExpanded && <PluginDetail plugin={plugin} />}
          </div>
        );
      })}
    </div>
  );
}
