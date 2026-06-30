import type { IChatMessage } from '../../types';
import { renderMarkdown } from '../../services/markdown';

interface ChatBubbleProps {
  msg: IChatMessage;
}

export default function ChatBubble({ msg }: ChatBubbleProps) {
  const cls = msg.role === 'user' ? 'mentor-chat-user' : 'mentor-chat-agent';
  const sender = msg.role === 'user' ? 'You' : 'Mentor';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const html = renderMarkdown(msg.content);

  return (
    <div className={`mentor-chat-bubble ${cls}`}>
      <div className="mentor-chat-bubble-content" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mentor-chat-bubble-time">
        {sender} · {time}
      </div>
    </div>
  );
}
