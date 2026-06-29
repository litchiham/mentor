import { useState, useEffect, useCallback } from 'react';
import { settingsStore } from '../../stores/settingsStore';
import { testAgentConnection } from '../../services/api';
import type { KernelSettings, ApiSettings, ThemeSettings, DebugSettings, ShortcutDef } from '../../stores/settingsStore';

type Tab = 'kernel' | 'api' | 'theme' | 'shortcuts' | 'debug';

const TABS: { key: Tab; label: string }[] = [
  { key: 'kernel', label: '内核' },
  { key: 'api', label: 'API' },
  { key: 'theme', label: '主题' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'debug', label: 'Debug' },
];

export default function SettingsModal() {
  const open = settingsStore((s) => s.open);
  const close = settingsStore((s) => s.closeSettings);
  const store = settingsStore.getState();

  // Local temp state — snapshotted on open
  const [kernel, setKernel] = useState<KernelSettings>(store.kernel);
  const [api, setApi] = useState<ApiSettings>(store.api);
  const [theme, setTheme] = useState<ThemeSettings>(store.theme);
  const [shortcuts, setShortcuts] = useState(store.shortcuts.bindings);
  const [debug, setDebug] = useState<DebugSettings>(store.debug);
  const [tab, setTab] = useState<Tab>('kernel');

  // Re-snapshot when modal opens
  useEffect(() => {
    if (open) {
      const s = settingsStore.getState();
      setKernel({ ...s.kernel });
      setApi({ ...s.api });
      setTheme({ ...s.theme });
      setShortcuts(s.shortcuts.bindings.map((b) => ({ ...b })));
      setDebug({ ...s.debug });
    }
  }, [open]);

  const handleSave = useCallback(() => {
    settingsStore.getState().setKernel(kernel);
    settingsStore.getState().setApi(api);
    settingsStore.getState().setTheme(theme);
    settingsStore.getState().setDebug(debug);
    // Set all shortcuts at once
    for (const s of shortcuts) {
      settingsStore.getState().setShortcut(s.id, s.keys);
    }
    close();
  }, [kernel, api, theme, shortcuts, debug, close]);

  const handleCancel = useCallback(() => {
    close();
  }, [close]);

  if (!open) return null;

  return (
    <div className="mentor-modal-overlay" onClick={handleCancel}>
      <div className="mentor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mentor-modal-header">
          <span className="mentor-modal-title">设置</span>
          <button className="mentor-modal-close" onClick={handleCancel}>✕</button>
        </div>
        <div className="mentor-modal-body">
          <div className="mentor-modal-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`mentor-modal-tab ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mentor-modal-content">
            {tab === 'kernel' && <KernelTab kernel={kernel} setKernel={setKernel} />}
            {tab === 'api' && <ApiTab api={api} setApi={setApi} />}
            {tab === 'theme' && <ThemeTab theme={theme} setTheme={setTheme} />}
            {tab === 'shortcuts' && <ShortcutsTab shortcuts={shortcuts} setShortcuts={setShortcuts} />}
            {tab === 'debug' && <DebugTab debug={debug} setDebug={setDebug} />}
          </div>
        </div>
        <div className="mentor-modal-footer">
          <button className="mentor-agent-send" style={{ background: '#8e8e93' }} onClick={handleCancel}>
            取消
          </button>
          <button className="mentor-agent-send" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Kernel Tab ========== */
function KernelTab({
  kernel,
  setKernel,
}: {
  kernel: KernelSettings;
  setKernel: (fn: (prev: KernelSettings) => KernelSettings) => void;
}) {
  const specs = settingsStore((s) => s.availableKernels);
  const loading = settingsStore((s) => s.kernelsLoading);

  return (
    <div className="mentor-settings-form">
      <Field label="内核" hint="选择 Jupyter kernel">
        {loading ? (
          <span className="mentor-field-hint">加载中...</span>
        ) : specs.length > 0 ? (
          <select
            className="mentor-input"
            value={kernel.kernelName}
            onChange={(e) => setKernel((prev) => ({ ...prev, kernelName: e.target.value }))}
          >
            {specs.map((s) => (
              <option key={s.name} value={s.name}>
                {s.displayName} ({s.language})
              </option>
            ))}
          </select>
        ) : (
          <input
            className="mentor-input"
            value={kernel.kernelName}
            onChange={(e) => setKernel((prev) => ({ ...prev, kernelName: e.target.value }))}
            placeholder="python3"
          />
        )}
        <span className="mentor-field-hint">需要 jupyter_server 运行中才能列出可用内核</span>
      </Field>
    </div>
  );
}

/* ========== API Tab ========== */
function ApiTab({
  api,
  setApi,
}: {
  api: ApiSettings;
  setApi: (fn: (prev: ApiSettings) => ApiSettings) => void;
}) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTest = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await testAgentConnection({
        apiKey: api.apiKey,
        baseUrl: api.baseUrl,
        model: api.model,
      });
      if (result.ok) {
        setTestStatus('ok');
        setTestMessage(`✓ 连接成功: ${result.reply}`);
      } else {
        setTestStatus('fail');
        setTestMessage(`✗ ${result.error}`);
      }
    } catch (err: any) {
      setTestStatus('fail');
      setTestMessage(`✗ ${err?.message || '连接失败'}`);
    }
  }, [api.apiKey, api.baseUrl, api.model]);

  return (
    <div className="mentor-settings-form">
      <Field label="Provider">
        <select
          className="mentor-input"
          value={api.provider}
          onChange={(e) => setApi((prev) => ({ ...prev, provider: e.target.value as ApiSettings['provider'] }))}
        >
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Field label="模型" hint="模型 ID，如 deepseek-v4-pro">
        <input
          className="mentor-input"
          value={api.model}
          onChange={(e) => setApi((prev) => ({ ...prev, model: e.target.value }))}
        />
      </Field>
      <Field label="API Base URL">
        <input
          className="mentor-input"
          value={api.baseUrl}
          onChange={(e) => setApi((prev) => ({ ...prev, baseUrl: e.target.value }))}
        />
      </Field>
      <Field label="API Key" hint="密钥仅保存在本地浏览器中">
        <input
          className="mentor-input"
          type="password"
          value={api.apiKey}
          onChange={(e) => setApi((prev) => ({ ...prev, apiKey: e.target.value }))}
          placeholder="sk-..."
        />
      </Field>
      <Field label="Temperature" hint="0 = 确定性，1 = 随机性">
        <input
          className="mentor-input"
          type="number"
          min={0}
          max={2}
          step={0.05}
          value={api.temperature}
          onChange={(e) => setApi((prev) => ({ ...prev, temperature: Number(e.target.value) }))}
        />
      </Field>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="mentor-agent-send"
          onClick={handleTest}
          disabled={testStatus === 'testing'}
          style={{ background: testStatus === 'testing' ? '#8e8e93' : undefined }}
        >
          {testStatus === 'testing' ? '测试中...' : '测试连接'}
        </button>
        {testStatus !== 'idle' && (
          <span
            style={{
              fontSize: 12,
              color: testStatus === 'ok' ? '#34c759' : '#cc0000',
            }}
          >
            {testMessage}
          </span>
        )}
      </div>
    </div>
  );
}

/* ========== Theme Tab ========== */
function ThemeTab({
  theme,
  setTheme,
}: {
  theme: ThemeSettings;
  setTheme: (fn: (prev: ThemeSettings) => ThemeSettings) => void;
}) {
  return (
    <div className="mentor-settings-form">
      <Field label="主题模式">
        <div className="mentor-radio-group">
          {(['light', 'dark', 'system'] as const).map((m) => (
            <label key={m} className="mentor-radio">
              <input
                type="radio"
                name="theme-mode"
                checked={theme.mode === m}
                onChange={() => setTheme((prev) => ({ ...prev, mode: m }))}
              />
              {m === 'light' ? '☀ 浅色' : m === 'dark' ? '🌙 深色' : '💻 跟随系统'}
            </label>
          ))}
        </div>
      </Field>
      <Field label="界面字体">
        <input
          className="mentor-input"
          value={theme.fontFamily}
          onChange={(e) => setTheme((prev) => ({ ...prev, fontFamily: e.target.value }))}
        />
      </Field>
      <Field label="界面字号 (px)">
        <input
          className="mentor-input"
          type="number"
          min={11}
          max={20}
          value={theme.fontSize}
          onChange={(e) => setTheme((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
        />
      </Field>
      <Field label="代码字体">
        <input
          className="mentor-input"
          value={theme.codeFontFamily}
          onChange={(e) => setTheme((prev) => ({ ...prev, codeFontFamily: e.target.value }))}
        />
      </Field>
      <Field label="代码字号 (px)">
        <input
          className="mentor-input"
          type="number"
          min={10}
          max={18}
          value={theme.codeFontSize}
          onChange={(e) => setTheme((prev) => ({ ...prev, codeFontSize: Number(e.target.value) }))}
        />
      </Field>
      <Field label="显示行号">
        <label className="mentor-toggle">
          <input
            type="checkbox"
            checked={theme.showLineNumbers}
            onChange={(e) => setTheme((prev) => ({ ...prev, showLineNumbers: e.target.checked }))}
          />
          <span className="mentor-toggle-slider" />
        </label>
      </Field>
    </div>
  );
}

/* ========== Shortcuts Tab ========== */
function ShortcutsTab({
  shortcuts,
  setShortcuts,
}: {
  shortcuts: ShortcutDef[];
  setShortcuts: (fn: (prev: ShortcutDef[]) => ShortcutDef[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');

  const startEdit = (s: ShortcutDef) => {
    setEditing(s.id);
    setValue(s.keys);
  };

  const commit = () => {
    if (editing && value.trim()) {
      setShortcuts((prev) => prev.map((s) => (s.id === editing ? { ...s, keys: value.trim() } : s)));
    }
    setEditing(null);
    setValue('');
  };

  return (
    <div className="mentor-settings-form">
      <p className="mentor-settings-hint">点击快捷键进入编辑，按 Esc 取消，按 Enter 保存。</p>
      <table className="mentor-shortcut-table">
        <thead>
          <tr>
            <th>操作</th>
            <th>快捷键</th>
          </tr>
        </thead>
        <tbody>
          {shortcuts.map((s) => (
            <tr key={s.id}>
              <td>{s.label}</td>
              <td>
                {editing === s.id ? (
                  <input
                    className="mentor-input mentor-shortcut-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit();
                      if (e.key === 'Escape') {
                        setEditing(null);
                        setValue('');
                      }
                    }}
                    onBlur={commit}
                    autoFocus
                  />
                ) : (
                  <span className="mentor-shortcut-keys" onClick={() => startEdit(s)}>
                    {s.keys.split(', ').map((k, i) => (
                      <kbd key={i}>{k}</kbd>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========== Debug Tab ========== */
const DEBUG_LEVELS: { key: DebugSettings['level']; label: string; desc: string }[] = [
  { key: 'off', label: 'Off', desc: '不输出任何调试信息' },
  { key: 'error', label: 'Error', desc: '仅输出错误' },
  { key: 'warn', label: 'Warn', desc: '输出警告和错误' },
  { key: 'info', label: 'Info', desc: '输出一般信息、警告和错误' },
  { key: 'debug', label: 'Debug', desc: '输出所有调试信息' },
];

function DebugTab({
  debug,
  setDebug,
}: {
  debug: DebugSettings;
  setDebug: (fn: (prev: DebugSettings) => DebugSettings) => void;
}) {
  return (
    <div className="mentor-settings-form">
      <Field label="调试级别" hint="控制前端 console 和后端日志的详细程度">
        <div className="mentor-radio-group">
          {DEBUG_LEVELS.map((lvl) => (
            <label key={lvl.key} className="mentor-radio">
              <input
                type="radio"
                name="debug-level"
                checked={debug.level === lvl.key}
                onChange={() => setDebug((prev) => ({ ...prev, level: lvl.key }))}
              />
              {lvl.label}
              <span style={{ fontSize: 11, color: 'var(--color-secondary)', marginLeft: 4 }}>{lvl.desc}</span>
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

/* ========== Shared Field Wrapper ========== */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="mentor-field">
      <span className="mentor-field-label">{label}</span>
      {children}
      {hint && <span className="mentor-field-hint">{hint}</span>}
    </label>
  );
}
