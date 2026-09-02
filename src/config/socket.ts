import { Server as HTTPServer } from "http";
import { Server, ServerOptions } from "socket.io";

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:3001",
];

export function initSocketIO(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: {
      // TEMP: Allow all origins for local development testing only.
      // TODO: Restrict this to the real frontend origin before production deployment.
      origin: "*",
      methods: ["GET", "POST"],
      credentials: false,
    },
  } as Partial<ServerOptions>);

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join a show room for real-time seat updates
    socket.on("join_show", ({ showId }) => {
      const room = `show:${showId}`;
      socket.join(room);
      console.log(`🔌 ${socket.id} joined room ${room}`);
    });

    socket.on("leave_show", ({ showId }) => {
      const room = `show:${showId}`;
      socket.leave(room);
      console.log(`🔌 ${socket.id} left room ${room}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Socket.io initialized");
  return io;
}

export default initSocketIO;
