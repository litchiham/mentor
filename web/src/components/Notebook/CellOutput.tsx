import { useMemo } from 'react';
import { AnsiUp } from 'ansi_up';
import type { IOutput } from '../../services/kernel';

const ansiUp = new AnsiUp();

interface CellOutputProps {
  outputs: IOutput[];
}

export default function CellOutput({ outputs }: CellOutputProps) {
  if (outputs.length === 0) return null;

  return (
    <div className="mentor-cell-output">
      {outputs.map((out, i) => (
        <OutputBlock key={i} output={out} />
      ))}
    </div>
  );
}

function OutputBlock({ output }: { output: IOutput }) {
  switch (output.outputType) {
    case 'stream':
      return (
        <pre
          className={`mentor-output-stream ${output.name === 'stderr' ? 'stderr' : ''}`}
          dangerouslySetInnerHTML={{ __html: ansiUp.ansi_to_html(output.text || '') }}
        />
      );
    case 'error':
      return (
        <div className="mentor-output-error">
          {output.traceback?.map((line, i) => (
            <div key={i}>{ansiUp.ansi_to_html(line)}</div>
          ))}
        </div>
      );
    case 'display_data':
    case 'execute_result':
      return <RichOutput data={output.data} />;
    default:
      return null;
  }
}

function RichOutput({ data }: { data?: Record<string, unknown> }) {
  if (!data) return null;

  // Render the richest available MIME type
  const mimeOrder = ['text/html', 'image/png', 'image/jpeg', 'image/svg+xml', 'text/markdown', 'text/plain'];

  const best = mimeOrder.find((m) => data[m] != null);
  if (!best) return null;

  const content = data[best];

  // text/html MIME bundle value can be a string or an array of strings
  const html = Array.isArray(content) ? content.join('\n') : String(content);

  switch (best) {
    case 'text/html':
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    case 'image/png':
    case 'image/jpeg':
    case 'image/svg+xml':
      return <img className="mentor-output-image" src={`data:${best};base64,${html}`} alt="output" />;
    case 'text/markdown':
    case 'text/plain':
      return <pre className="mentor-output-stream">{html}</pre>;
    default:
      return null;
  }
}
