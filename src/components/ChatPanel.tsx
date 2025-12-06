import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/auth.store";
import { useChatStore } from "../store/chat.store";
import { Send } from "lucide-react";

export function ChatPanel() {
  const { user } = useAuthStore();
  const activeConversation = useChatStore((s) => s.activeConversation);
  const messages = useChatStore((s) => s.messages);
  const typingUsers = useChatStore((s) => s.typingUsers);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const startTyping = useChatStore((s) => s.startTyping);
  const stopTyping = useChatStore((s) => s.stopTyping);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);

    if (!isTyping && e.target.value) {
      setIsTyping(true);
      startTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
      stopTyping();
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage(input.trim());
    setInput("");
    setIsTyping(false);
    stopTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getConversationName = (): string => {
    if (!activeConversation) return "";
    if (activeConversation.type === "group" && activeConversation.name) {
      return activeConversation.name;
    }
    const otherMember = activeConversation.members.find((m) => m.id !== user?.id);
    return otherMember?.username || "Unknown";
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <p className="text-sm">select a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-neutral-200">
        <div>
          <span className="font-medium text-black">{getConversationName()}</span>
          {activeConversation.type === "group" && (
            <span className="ml-2 text-xs text-neutral-500">
              {activeConversation.members.length} members
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isOwn = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 ${
                  isOwn ? "bg-black text-white" : "bg-neutral-100 text-black"
                }`}
              >
                {!isOwn && (
                  <p className="text-xs mb-1 font-medium opacity-70">{msg.senderUsername}</p>
                )}
                <p className="text-sm m-0 break-all">{msg.content}</p>
                <p className="text-xs mt-1 m-0 opacity-50">{formatTime(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-xs text-neutral-500">
          {typingUsers.map((u) => u.username).join(", ")}{" "}
          {typingUsers.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 flex gap-3 items-center border-t border-neutral-200">
        <input
          type="text"
          placeholder="type a message..."
          value={input}
          onChange={handleInputChange}
          className="flex-1 bg-transparent border-0 py-2 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className={`p-2 bg-transparent border-0 cursor-pointer ${
            input.trim() ? "text-black" : "text-neutral-300"
          }`}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
