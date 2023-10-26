import { Server } from "socket.io";
import {
  ClientToServerSocketEvents,
  ServerToClientSocketEvents,
} from "typings";

export const io = new Server<
  ClientToServerSocketEvents,
  ServerToClientSocketEvents
>({
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("new io connection");

  socket.on("sendChatMessage", () => {});
});
