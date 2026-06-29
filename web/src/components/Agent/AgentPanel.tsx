import { useState, useRef, useEffect, useCallback } from 'react';
import { chatStore } from '../../stores/chatStore';
import ChatBubble from './ChatBubble';

export default function AgentPanel() {
  const messages = chatStore((s) => s.messages);
  const isLoading = chatStore((s) => s.isLoading);
  const sendMessage = chatStore((s) => s.sendMessage);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <>
      <div className="mentor-agent-header">Mentor</div>
      <div className="mentor-agent-messages">
        {messages.length === 0 && (
          <p className="mentor-agent-empty">Ask Mentor anything about your data.</p>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== 'agent' && (
          <div className="mentor-chat-bubble mentor-chat-agent">
            <div className="mentor-chat-bubble-content">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="mentor-agent-input-area">
        <textarea
          className="mentor-agent-input"
          rows={2}
          placeholder="Tell Mentor what to do..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="mentor-agent-send" onClick={handleSend} disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </div>
    </>
  );
}
