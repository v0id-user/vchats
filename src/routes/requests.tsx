import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useEffectEvent } from "react";
import { useAuthStore } from "../store/auth.store";
import { useFriendsStore } from "../store/friends.store";
import { useChatStore } from "../store/chat.store";
import { searchUsers as searchUsersFn } from "../server/users";
import { AuthenticatedLayout } from "../components/AuthenticatedLayout";
import { useLogout, useRefreshData } from "../hooks";
import { Search, Check, X, ArrowLeft, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/requests")({
  component: RequestsPage,
});

interface UserResult {
  id: string;
  username: string;
}

function RequestsPage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const logout = useLogout();
  const { refreshConversations } = useRefreshData();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    fetchFriends,
    fetchIncomingRequests,
    fetchOutgoingRequests,
    acceptRequest,
    rejectRequest,
    sendRequest,
  } = useFriendsStore();
  const { createDirectConversation } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Effect Event - stable, always reads latest values, NOT a dependency
  const onMount = useEffectEvent(() => {
    fetchIncomingRequests();
    fetchOutgoingRequests();
    fetchFriends();
  });

  // Fetch on mount - empty deps, onMount is NOT included (it's an Effect Event)
  useEffect(() => {
    onMount();
  }, []);

  // Search for users
  useEffect(() => {
    if (searchQuery.length < 2 || !token) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setSearching(true);
      try {
        const result = await searchUsersFn({ data: { query: searchQuery, token } });
        if (result.users) {
          setSearchResults(result.users);
        }
      } finally {
        setSearching(false);
      }
    };

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, token]);

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    await sendRequest(userId);
    setSendingTo(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    const result = await acceptRequest(requestId);
    if (result.success) {
      // Refresh friends list
      await fetchFriends();
      // Refresh conversations so new friend appears
      await refreshConversations();
    }
    setProcessingId(null);
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    await rejectRequest(requestId);
    setProcessingId(null);
  };

  const handleStartChat = async (friendId: string) => {
    const result = await createDirectConversation(friendId);
    if (result.success) {
      navigate({ to: "/" });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen flex bg-white">
        {/* Sidebar */}
        <div className="h-screen flex flex-col w-72 border-r border-neutral-200 bg-white">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-neutral-200">
            <span className="font-semibold text-black">{user?.username}</span>
            <button className="btn-ghost text-xs" onClick={logout}>
              logout
            </button>
          </div>

          {/* Navigation */}
          <div className="p-2 flex gap-2 border-b border-neutral-200">
            <Link to="/" className="text-xs px-3 py-2 text-neutral-500 hover:bg-neutral-100 rounded">
              chats
            </Link>
            <Link to="/requests" className="text-xs px-3 py-2 text-black hover:bg-neutral-100 rounded">
              requests
            </Link>
          </div>

          {/* Friends list in sidebar */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 text-xs text-neutral-500 uppercase tracking-wide">
              friends ({friends.length})
            </div>
            {friends.length === 0 ? (
              <div className="px-4 text-sm text-neutral-400">no friends yet</div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 cursor-pointer"
                  onClick={() => handleStartChat(friend.id)}
                >
                  <span className="text-sm text-black">{friend.username}</span>
                  <MessageCircle size={14} className="text-neutral-400" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-8 max-w-2xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm mb-8 text-neutral-500 hover:text-black">
            <ArrowLeft size={16} />
            back to chats
          </Link>

          <h1 className="text-2xl font-semibold mb-8 text-black">friend requests</h1>

          {/* Search for users */}
          <div className="mb-12">
            <h2 className="text-sm font-medium mb-4 text-neutral-500">find people</h2>
            <div className="relative">
              <Search size={16} className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-6"
              />
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mt-4 border border-neutral-200">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-4 border-b border-neutral-200 last:border-0"
                  >
                    <span className="text-sm text-black">{result.username}</span>
                    <button
                      className="btn btn-primary text-xs py-2 px-4"
                      onClick={() => handleSendRequest(result.id)}
                      disabled={sendingTo === result.id}
                    >
                      {sendingTo === result.id ? "..." : "add"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searching && <p className="mt-4 text-sm text-neutral-500">searching...</p>}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="mt-4 text-sm text-neutral-500">no users found</p>
            )}
          </div>

          {/* Incoming requests */}
          <div className="mb-12">
            <h2 className="text-sm font-medium mb-4 text-neutral-500">
              incoming requests ({incomingRequests.length})
            </h2>

            {incomingRequests.length === 0 ? (
              <p className="text-sm text-neutral-400">no incoming requests</p>
            ) : (
              <div className="border border-neutral-200">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-4 border-b border-neutral-200 last:border-0"
                  >
                    <span className="text-sm text-black">{req.fromUsername}</span>
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost p-2"
                        onClick={() => handleAccept(req.id)}
                        disabled={processingId === req.id}
                        title="Accept"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        className="btn-ghost p-2"
                        onClick={() => handleReject(req.id)}
                        disabled={processingId === req.id}
                        title="Reject"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing requests */}
          <div>
            <h2 className="text-sm font-medium mb-4 text-neutral-500">
              outgoing requests ({outgoingRequests.length})
            </h2>

            {outgoingRequests.length === 0 ? (
              <p className="text-sm text-neutral-400">no outgoing requests</p>
            ) : (
              <div className="border border-neutral-200">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-4 border-b border-neutral-200 last:border-0"
                  >
                    <span className="text-sm text-black">{req.toUsername}</span>
                    <span className="text-xs text-neutral-500">pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
