import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthenticatedLayout } from "../components/AuthenticatedLayout";
import { Sidebar } from "../components/Sidebar";
import { ChatPanel } from "../components/ChatPanel";
import { NewChatModal } from "../components/NewChatModal";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [showNewChat, setShowNewChat] = useState(false);

  return (
    <AuthenticatedLayout>
      <div className="flex h-screen bg-white">
        <Sidebar />
        <div className="flex-1 relative">
          <ChatPanel />

          {/* New chat button */}
          <button
            className="absolute bottom-24 right-6 w-12 h-12 rounded-full flex items-center justify-center bg-black hover:bg-neutral-800 transition-colors"
            onClick={() => setShowNewChat(true)}
          >
            <Plus size={20} color="white" />
          </button>
        </div>

        <NewChatModal isOpen={showNewChat} onClose={() => setShowNewChat(false)} />
      </div>
    </AuthenticatedLayout>
  );
}
