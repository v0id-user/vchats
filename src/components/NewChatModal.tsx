import { useState } from "react";
import { X } from "lucide-react";
import { useFriendsStore } from "../store/friends.store";
import { useChatStore } from "../store/chat.store";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const { friends } = useFriendsStore();
  const { createDirectConversation, createGroupConversation } = useChatStore();
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const toggleFriend = (friendId: string) => {
    if (mode === "direct") {
      setSelectedFriends([friendId]);
    } else {
      setSelectedFriends((prev) =>
        prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
      );
    }
  };

  const handleCreate = async () => {
    setError("");
    setLoading(true);

    try {
      if (mode === "direct") {
        if (selectedFriends.length !== 1) {
          setError("Select a friend");
          return;
        }
        const result = await createDirectConversation(selectedFriends[0]);
        if (!result.success) {
          setError(result.error || "Failed to create conversation");
          return;
        }
      } else {
        if (!groupName.trim()) {
          setError("Enter a group name");
          return;
        }
        if (selectedFriends.length < 1) {
          setError("Select at least one friend");
          return;
        }
        const result = await createGroupConversation(groupName.trim(), selectedFriends);
        if (!result.success) {
          setError(result.error || "Failed to create group");
          return;
        }
      }
      onClose();
      setSelectedFriends([]);
      setGroupName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 w-full max-w-sm border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium m-0 text-black">new chat</h2>
          <button className="btn-ghost p-1" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            className={`btn ${mode === "direct" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setMode("direct");
              setSelectedFriends([]);
            }}
          >
            direct
          </button>
          <button
            className={`btn ${mode === "group" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => {
              setMode("group");
              setSelectedFriends([]);
            }}
          >
            group
          </button>
        </div>

        {/* Group name input */}
        {mode === "group" && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input"
            />
          </div>
        )}

        {/* Friends list */}
        <div className="mb-6">
          <p className="text-xs mb-2 text-neutral-500">
            {mode === "direct" ? "select a friend" : "select friends"}
          </p>
          {friends.length === 0 ? (
            <p className="text-sm text-neutral-500">no friends yet</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-neutral-200">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className={`flex items-center gap-3 p-3 cursor-pointer border-b border-neutral-100 last:border-0 ${
                    selectedFriends.includes(friend.id) ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                  onClick={() => toggleFriend(friend.id)}
                >
                  <span className="text-sm text-black">{friend.username}</span>
                  {selectedFriends.includes(friend.id) && (
                    <span className="ml-auto text-xs text-neutral-500">selected</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm mb-4 text-red-600">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || selectedFriends.length === 0}
          className="btn btn-primary w-full"
        >
          {loading ? "..." : "create"}
        </button>
      </div>
    </div>
  );
}
