import { defineContract, payload } from "verani/typed/shared";

export const chatContract = defineContract({
  serverEvents: {
    "chat.message": payload<{
      id: string;
      conversationId: string;
      from: string;
      fromUsername: string;
      text: string;
      timestamp: number;
    }>(),
    "typing.start": payload<{
      conversationId: string;
      userId: string;
      username: string;
    }>(),
    "typing.stop": payload<{
      conversationId: string;
      userId: string;
      username: string;
    }>(),
    "user.joined": payload<{
      userId: string;
      username: string;
    }>(),
    "user.left": payload<{
      userId: string;
      username: string;
    }>(),
    "conversation.joined": payload<{
      conversationId: string;
    }>(),
    "error": payload<{
      message: string;
      code?: string;
    }>(),
  },
  clientEvents: {
    "message.send": payload<{
      conversationId: string;
      text: string;
    }>(),
    "typing.start": payload<{
      conversationId: string;
    }>(),
    "typing.stop": payload<{
      conversationId: string;
    }>(),
    "conversation.join": payload<{
      conversationId: string;
    }>(),
  },
});

export type ChatContract = typeof chatContract;

