import { useAuthStore } from "../store/auth.store";
import { useChatStore, type Conversation } from "../store/chat.store";
import { useLogout } from "../hooks";
import { Link } from "@tanstack/react-router";

export function Sidebar() {
  const { user } = useAuthStore();
  const { conversations, activeConversation, setActiveConversation, connected } = useChatStore();
  const logout = useLogout();

  const getConversationName = (conv: Conversation): string => {
    if (conv.type === "group" && conv.name) {
      return conv.name;
    }
    const otherMember = conv.members.find((m) => m.id !== user?.id);
    return otherMember?.username || "Unknown";
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="h-screen flex flex-col w-72 border-r border-neutral-200 bg-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-neutral-200">
        <div>
          <span className="font-semibold text-black">{user?.username}</span>
          <span className={`ml-2 text-xs ${connected ? "text-green-600" : "text-neutral-400"}`}>
            {connected ? "online" : "offline"}
          </span>
        </div>
        <button className="btn-ghost text-xs" onClick={logout}>
          logout
        </button>
      </div>

      {/* Navigation */}
      <div className="p-2 flex gap-2 border-b border-neutral-200">
        <Link to="/" className="text-xs px-3 py-2 text-black hover:bg-neutral-100 rounded">
          chats
        </Link>
        <Link to="/requests" className="text-xs px-3 py-2 text-neutral-500 hover:bg-neutral-100 rounded">
          requests
        </Link>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">no conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-4 cursor-pointer transition-colors border-b border-neutral-100 ${
                activeConversation?.id === conv.id ? "bg-neutral-100" : "hover:bg-neutral-50"
              }`}
              onClick={() => setActiveConversation(conv)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm text-black truncate">
                  {getConversationName(conv)}
                </span>
                {conv.lastMessage && (
                  <span className="text-xs text-neutral-400">
                    {formatTime(conv.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className="text-xs text-neutral-500 truncate m-0">
                  {conv.lastMessage.senderUsername}: {conv.lastMessage.content}
                </p>
              )}
              {conv.type === "group" && (
                <span className="text-xs text-neutral-400">{conv.members.length} members</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
