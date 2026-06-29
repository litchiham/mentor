import type { IChatMessage } from '../../types';

interface ChatBubbleProps {
  msg: IChatMessage;
}

export default function ChatBubble({ msg }: ChatBubbleProps) {
  const cls = msg.role === 'user' ? 'mentor-chat-user' : 'mentor-chat-agent';
  const sender = msg.role === 'user' ? 'You' : 'Mentor';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`mentor-chat-bubble ${cls}`}>
      <div className="mentor-chat-bubble-content">{msg.content}</div>
      <div className="mentor-chat-bubble-time">
        {sender} · {time}
      </div>
    </div>
  );
}
