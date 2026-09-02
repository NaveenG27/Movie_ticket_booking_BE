import express from "express";
import cors from "cors";
import morgan from "morgan";
import { errorHandler } from "./middleware/errorHandler";

// Route imports
import authRoutes from "./modules/auth/auth.routes";
import movieRoutes from "./modules/movies/movie.routes";
import theaterRoutes from "./modules/theaters/theater.routes";
import screenRoutes from "./modules/screens/screen.routes";
import showRoutes from "./modules/shows/show.routes";
import bookingRoutes from "./modules/booking/booking.routes";
import paymentRoutes from "./modules/payments/payment.routes";

const app = express();

// ─── Global Middleware ──────────────────────────────────────
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ───────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Movie Ticket Booking API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/theaters", theaterRoutes);
app.use("/api/theaters/:theaterId/screens", screenRoutes);
app.use("/api/shows", showRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

// ─── 404 Handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ─── Global Error Handler (must be last) ────────────────────
app.use(errorHandler);

export default app;
