import { useState, useRef, useEffect } from 'react';
import { getDefaultStore } from 'jotai';
import { kernelStore } from '../../stores/kernelStore';
import { workspaceStore } from '../../stores/workspaceStore';
import { settingsStore } from '../../stores/settingsStore';
import { cellIdsAtom, activeCellIdAtom } from '../../stores/notebookStore';
import WorkspaceDialog from './WorkspaceDialog';

interface MenuDef {
  label: string;
  items: { label: string; shortcut?: string; action: () => void | Promise<void> }[];
}

/** Fire a keyboard shortcut on the active element (CodeMirror handles it). */
function dispatchKeys(keys: string) {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return;
  const parts = keys.split('+');
  const opts: KeyboardEventInit = {
    key: parts[parts.length - 1],
    bubbles: true,
    cancelable: true,
  };
  if (parts.includes('Ctrl')) opts.ctrlKey = true;
  if (parts.includes('Shift')) opts.shiftKey = true;
  if (parts.includes('Alt')) opts.altKey = true;
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
}

interface MenuBarProps {
  onOpenPlugins: () => void;
}

export default function MenuBar({ onOpenPlugins }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const startKernel = kernelStore((s) => s.startKernel);
  const shutdownKernel = kernelStore((s) => s.shutdownKernel);

  const handleSave = () => {
    const { workspacePath } = workspaceStore.getState();
    if (!workspacePath) {
      setWsDialogOpen(true);
      return;
    }
    workspaceStore.getState().saveWorkspace().catch((err) => console.error('Save failed:', err));
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.altKey && e.key === 'o') {
        e.preventDefault();
        setWsDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'Open Workspace...', shortcut: 'Alt+O', action: () => setWsDialogOpen(true) },
        { label: 'Save', shortcut: 'Alt+S', action: () => handleSave() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Alt+Z', action: () => dispatchKeys('Ctrl+z') },
        { label: 'Redo', shortcut: 'Alt+Shift+Z', action: () => dispatchKeys('Ctrl+Shift+z') },
        { label: 'Cut', shortcut: 'Alt+X', action: () => dispatchKeys('Ctrl+x') },
        { label: 'Copy', shortcut: 'Alt+C', action: () => dispatchKeys('Ctrl+c') },
        { label: 'Paste', shortcut: 'Alt+V', action: () => dispatchKeys('Ctrl+v') },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Agent Panel', shortcut: 'Alt+\\', action: () => {} },
        { label: 'Zoom In', shortcut: 'Alt+=', action: () => dispatchKeys('Ctrl+=') },
        { label: 'Zoom Out', shortcut: 'Alt+-', action: () => dispatchKeys('Ctrl+-') },
      ],
    },
    {
      label: 'Kernel',
      items: [
        { label: 'Interrupt Kernel', action: () => shutdownKernel().then(() => startKernel()) },
        { label: 'Restart Kernel', action: () => shutdownKernel().then(() => startKernel()) },
      ],
    },
    {
      label: 'Mentor',
      items: [
        { label: 'Plugins...', action: () => onOpenPlugins() },
        { label: 'Settings...', action: () => settingsStore.getState().openSettings() },
        { label: 'About Mentor', action: () => {} },
      ],
    },
  ];

  return (
    <>
      <div className="mentor-menubar">
        {menus.map((menu) => (
          <MenuDropdown
            key={menu.label}
            menu={menu}
            isOpen={openMenu === menu.label}
            onOpen={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            onClose={() => setOpenMenu(null)}
          />
        ))}
      </div>
      <WorkspaceDialog
        isOpen={wsDialogOpen}
        onClose={() => setWsDialogOpen(false)}
        onSelect={(path) => {
          workspaceStore.getState().openWorkspace(path).catch((err) => console.error('Open workspace failed:', err));
          setWsDialogOpen(false);
        }}
      />
    </>
  );
}

function MenuDropdown({
  menu,
  isOpen,
  onOpen,
  onClose,
}: {
  menu: MenuDef;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="mentor-menu-item" onClick={onOpen}>
      {menu.label}
      {isOpen && (
        <div className="mentor-menu-dropdown">
          {menu.items.map((item) => (
            <div
              key={item.label}
              className="mentor-menu-dropdown-item"
              onClick={(e) => {
                e.stopPropagation();
                item.action();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="mentor-menu-shortcut">{item.shortcut}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
