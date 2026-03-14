import { createRoomHandler } from "verani";

export const ChatRoom = createRoomHandler({
  name: "ChatRoom",
  connectionBinding: "UserConnection",
  maxDeliveryFailures: 3,
});
