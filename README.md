# vchats - Verani Showcase

A real-time chat application showcasing [Verani](https://github.com/v0id-user/verani/) - a simple, focused realtime SDK for Cloudflare Actors with Socket.io-like semantics.

## About Verani

[Verani](https://github.com/v0id-user/verani/) brings the familiar developer experience of Socket.io to Cloudflare's Durable Objects (Actors), with proper hibernation support and minimal overhead.

**Key Features:**
- **Familiar API**: Socket.io-like semantics you already know
- **Hibernation Support**: Properly handles Cloudflare Actor hibernation out of the box
- **Type Safe**: Built with TypeScript, full type safety throughout
- **Simple Mental Model**: Rooms, channels, and broadcast semantics

## This Showcase

This chat application demonstrates Verani's capabilities in a production-like environment:

### Features Demonstrated

- **Real-time Messaging**: WebSocket-based chat with instant message delivery
- **Private 1-to-1 Chats**: Direct conversations between friends
- **Group Chats**: Multi-user group conversations
- **Friend System**: Friend requests with accept/reject workflow
- **Authentication**: JWT-based auth with secure password hashing
- **Queue-based Persistence**: Async message saving via Cloudflare Queues
- **Type-safe WebSocket**: Zod-validated request/response schemas
- **Connection Lifecycle**: Proper WebSocket connection management across route changes

### Tech Stack

- **Backend**: Cloudflare Workers + Durable Objects (Verani Actors)
- **Database**: Cloudflare D1 (SQLite)
- **Queue**: Cloudflare Queues for async writes
- **ORM**: Drizzle ORM with type-safe queries
- **Frontend**: React 19 + TanStack Router
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Validation**: Zod schemas for type-safe parsing
- **Server Functions**: TanStack `createServerFn` for type-safe API calls

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js)
- Cloudflare account (for D1 database and Queues)

### Installation

```bash
bun install
```

### Database Setup

1. Create a D1 database:
```bash
bunx wrangler d1 create vchats_db
```

2. Update `wrangler.jsonc` with your database binding name

3. Run migrations:
```bash
bunx drizzle-kit push
```

### Queue Setup

1. Create a Queue:
```bash
bunx wrangler queues create vchats_queue
```

2. Update `wrangler.jsonc` with your queue binding

### Environment Variables

Create a `.env` file:
```env
# JWT Secret (generate a secure random string)
JWT_SECRET=your-secret-key-here
```

### Running Locally

```bash
bun dev
```

The app will be available at `http://localhost:3000`

## Architecture

### Server-Side (Cloudflare Worker)

**Actor (`src/actors/chat.actor.ts`)**
- WebSocket connection handling via Verani
- Real-time message broadcasting
- Typing indicators
- Connection lifecycle management

**Service Layer (`src/service/`)**
- `auth.ts` - User registration and authentication
- `conversations.ts` - Conversation management
- `friends.ts` - Friend request system
- `messages.ts` - Message persistence
- `queue.ts` - Queue message handling

**Server Functions (`src/server/`)**
- Type-safe API endpoints using `createServerFn`
- Zod validation for all inputs
- JWT authentication middleware

### Client-Side

**State Management (`src/store/`)**
- `auth.store.ts` - Authentication state
- `chat.store.ts` - Chat state and WebSocket connection
- `friends.store.ts` - Friends and requests state

**Hooks (`src/hooks/`)**
- `useChat.ts` - WebSocket connection lifecycle
- `useAuth.ts` - Authentication helpers

**Components (`src/components/`)**
- `Sidebar.tsx` - Conversation list
- `ChatPanel.tsx` - Message display and input
- `NewChatModal.tsx` - Create new conversations
- `AuthenticatedLayout.tsx` - Layout wrapper with connection management

### WebSocket Flow

1. **Connection**: Client connects via Verani client with JWT token
2. **Authentication**: Actor extracts user info from JWT in `extractMeta`
3. **Channel Subscription**: User automatically joins conversation channels
4. **Message Flow**:
   - Client sends message via `client.sendMessage()`
   - Actor validates with Zod schema
   - Message queued for async DB write
   - Message broadcast immediately to all channel members
   - Queue worker persists to D1 database

### Queue Architecture

Messages are persisted asynchronously via Cloudflare Queues:

1. Actor receives message → validates → queues for save
2. Queue worker processes batch → saves to D1
3. Real-time delivery happens immediately (before DB write)

This ensures low latency while maintaining data persistence.

## Key Verani Patterns Demonstrated

### 1. Room Definition with Lifecycle Hooks

```typescript
export const chat = defineRoom({
  name: "chat",
  websocketPath: "/chat",
  
  async extractMeta(req) {
    // Extract user from JWT token
    const token = url.searchParams.get("token");
    const payload = await verifyJWT(token);
    return { userId: payload.sub, username: payload.username };
  },
  
  onConnect(ctx) {
    // User connected - join their conversation channels
  },
  
  onDisconnect(ctx) {
    // User disconnected - cleanup
  }
});
```

### 2. Event Handlers (Socket.io-like)

```typescript
chat.on("message.send", async (ctx, rawData) => {
  // Validate with Zod
  const parsed = parseRequest(MessageSendSchema, rawData);
  
  // Broadcast to conversation channel
  ctx.actor.emit.to(`conversation:${conversationId}`).emit("chat.message", data);
});
```

### 3. Wrapping the Verani Client in a Type-Safe Client

```typescript
const client = new ChatClient(wsUrl, options);

// Type-safe emit
client.sendMessage({ conversationId, text });

// Type-safe listeners with Zod-validated data
client.onMessage((data: ChatMessageResponse) => {
  // data is fully typed and validated
});
```

## Project Structure

```
src/
├── actors/          # Verani actor definitions
├── components/      # React components
├── hooks/           # React hooks for lifecycle management
├── lib/             # Utilities (logger, auth, chat client)
├── routes/          # TanStack Router routes
├── schemas/         # Zod schemas (DB, WS, Queue)
├── server/          # createServerFn API handlers
├── service/         # Business logic layer
└── store/           # Zustand state stores
```

## Logging

The application includes comprehensive logging with sensitive data redaction:

- All passwords, tokens, and secrets are automatically redacted
- Scoped loggers for each service (`auth`, `conversations`, `friends`, etc.)
- Log levels: `info`, `warn`, `error`, `debug`

See `src/lib/logger.ts` for the logger implementation.

## Learn More

- [Verani Documentation](https://github.com/v0id-user/verani/)
- [Verani Examples](https://github.com/v0id-user/verani/tree/canary/examples)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [TanStack Router](https://tanstack.com/router)
- [Drizzle ORM](https://orm.drizzle.team/)

## License

ISC
