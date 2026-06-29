import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { keymap } from '@codemirror/view';
import { acceptCompletion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';

interface CellEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  readOnly?: boolean;
  language?: 'python' | 'markdown';
  placeholder?: string;
}

export default function CellEditor({ value, onChange, onExecute, readOnly, language, placeholder }: CellEditorProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        onExecute();
      }
    },
    [onExecute],
  );

  const langExt: Extension = language === 'markdown' ? markdown() : python();

  return (
    <div className="mentor-cell-editor" onKeyDown={handleKeyDown}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[
          langExt,
          keymap.of([{ key: 'Tab', run: acceptCompletion }]),
        ]}
        theme="light"
        height="auto"
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          autocompletion: true,
        }}
        placeholder={placeholder || (language === 'markdown' ? 'Write markdown...' : 'Write Python code...')}
        readOnly={readOnly}
      />
    </div>
  );
}
