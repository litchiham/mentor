import type { IPluginManifest } from '../../services/api';

interface PluginDetailProps {
  plugin: IPluginManifest;
}

export default function PluginDetail({ plugin }: PluginDetailProps) {
  return (
    <div className="mentor-plugin-detail">
      {plugin.guidelines && (
        <div className="mentor-plugin-section">
          <h4>Guidelines</h4>
          <p>{plugin.guidelines}</p>
        </div>
      )}

      {plugin.tools && plugin.tools.length > 0 && (
        <div className="mentor-plugin-section">
          <h4>Tools</h4>
          {plugin.tools.map((tool) => (
            <div key={tool.name} className="mentor-plugin-tool-card">
              <div className="mentor-plugin-tool-name">{tool.name}</div>
              <p className="mentor-plugin-tool-desc">{tool.description}</p>
              {tool.guidelines && (
                <p className="mentor-plugin-tool-guidelines">{tool.guidelines}</p>
              )}
              <div className="mentor-plugin-params">
                {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                  <>
                    <span className="mentor-plugin-params-label">Parameters:</span>
                    <table className="mentor-plugin-params-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Unit</th>
                          <th>Required</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(tool.parameters).map(([name, info]) => (
                          <tr key={name}>
                            <td><code>{name}</code></td>
                            <td>{info.type}</td>
                            <td>{info.unit || '-'}</td>
                            <td>{info.required !== false ? 'Yes' : 'No'}</td>
                            <td>{info.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              {tool.returns && (
                <div className="mentor-plugin-returns">
                  Returns: <code>{tool.returns.type}</code>
                  {tool.returns.unit ? ` (${tool.returns.unit})` : ''}
                  {' — '}{tool.returns.description}
                </div>
              )}
              {tool.model && (
                <div className="mentor-plugin-model">
                  Model: {tool.model.format} ({tool.model.path})
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {plugin.data && plugin.data.length > 0 && (
        <div className="mentor-plugin-section">
          <h4>Data Sources</h4>
          {plugin.data.map((data) => (
            <div key={data.name} className="mentor-plugin-tool-card">
              <div className="mentor-plugin-tool-name">{data.name}</div>
              <p className="mentor-plugin-tool-desc">{data.description}</p>
              {data.guidelines && (
                <p className="mentor-plugin-tool-guidelines">{data.guidelines}</p>
              )}
              <div className="mentor-plugin-params">
                <span className="mentor-plugin-params-label">Loader: <code>{data.loader}</code></span>
                {data.parameters && Object.keys(data.parameters).length > 0 && (
                  <table className="mentor-plugin-params-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.parameters).map(([name, info]) => (
                        <tr key={name}>
                          <td><code>{name}</code></td>
                          <td>{info.type}</td>
                          <td>{info.required !== false ? 'Yes' : 'No'}</td>
                          <td>{info.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {data.returns && (
                <div className="mentor-plugin-returns">
                  Returns: <code>{data.returns.type}</code> — {data.returns.description}
                </div>
              )}
              {data.metadata && Object.keys(data.metadata).length > 0 && (
                <div className="mentor-plugin-metadata">
                  {Object.entries(data.metadata).map(([k, v]) => (
                    <span key={k} className="mentor-plugin-metadata-item">{k}: {v}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {plugin.requires && plugin.requires.length > 0 && (
        <div className="mentor-plugin-section">
          <h4>Dependencies</h4>
          <div className="mentor-plugin-deps">
            {plugin.requires.map((dep) => (
              <code key={dep} className="mentor-plugin-dep-tag">{dep}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
