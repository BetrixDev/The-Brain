import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerSocketEvents,
  ServerToClientSocketEvents,
} from "typings";

export const socket: Socket<
  ServerToClientSocketEvents,
  ClientToServerSocketEvents
> = io(`${window.location.protocol}//${window.location.hostname}:3001`);
