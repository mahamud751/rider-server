import geolib from "geolib";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Ride from "../models/Ride.js";

const onDutyRiders = new Map();

/** Nearby radius: 200 km (meters) — matches previous filter */
const NEARBY_MAX_DISTANCE_M = 200_000;

function computeNearbyRidersForLocation(location) {
  return Array.from(onDutyRiders.values())
    .map((rider) => ({
      ...rider,
      distance: geolib.getDistance(rider.coords, location),
    }))
    .filter((rider) => rider.distance <= NEARBY_MAX_DISTANCE_M)
    .sort((a, b) => a.distance - b.distance);
}

function serializeRideForSocket(ride) {
  if (ride && typeof ride.toObject === "function") {
    return ride.toObject({ virtuals: true });
  }
  return ride;
}

/**
 * Emit ride offers to on-duty riders near pickup. Used by searchrider and HTTP createRide.
 */
function emitRideOffersToNearbyRiders(io, location, ride) {
  const nearbyriders = computeNearbyRidersForLocation(location);
  const payload = serializeRideForSocket(ride);
  let delivered = 0;
  for (const rider of nearbyriders) {
    const sock = io.sockets?.sockets?.get(rider.socketId);
    if (sock) {
      sock.emit("rideOffer", payload);
      delivered++;
    } else {
      io.to(rider.socketId).emit("rideOffer", payload);
      delivered++;
    }
  }
  console.log(
    `[socket] rideOffer: ${delivered} delivery attempt(s), ${nearbyriders.length} nearby, ${onDutyRiders.size} on-duty map size, rideId=${payload?._id}`,
  );
  return nearbyriders;
}

/**
 * Called after HTTP POST /ride/create so riders are notified even if the customer
 * socket emits searchrider late or misses it.
 */
export function notifyRidersAboutNewRide(io, ride) {
  if (!io || !ride?.pickup) return;
  const { latitude, longitude } = ride.pickup;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  emitRideOffersToNearbyRiders(io, { latitude, longitude }, ride);
}

export function getOnDutyRiderCount() {
  return onDutyRiders.size;
}

const normalizeCoords = (input) => {
  const raw = input?.coords ? input.coords : input;
  const latitude = Number(raw?.latitude);
  const longitude = Number(raw?.longitude);
  const heading = Number(raw?.heading || 0);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude, heading };
};

const normalizeRideId = (input) => {
  if (!input) return null;
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    return input.rideId || input.id || null;
  }
  return null;
};

const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      // React Native / browser WebSocket often does not send custom headers; support auth + query.
      const rawToken =
        socket.handshake.headers.access_token ||
        socket.handshake.auth?.access_token ||
        socket.handshake.query?.access_token;
      const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(payload.id);
      if (!user)
        return next(new Error("Authentication invalid: User not found"));

      socket.user = { id: payload.id, role: user.role };
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`User Joined: ${user.id} (${user.role})`);

    // If a rider reconnects (e.g. after server restart), ask them to re-register
    if (user.role === "rider" && !onDutyRiders.has(user.id)) {
      socket.emit("requestGoOnDuty");
    }

    if (user.role === "rider") {
      socket.on("goOnDuty", (coordsPayload) => {
        const coords = normalizeCoords(coordsPayload);
        if (!coords) {
          console.warn(
            `[socket] goOnDuty ignored: invalid coords from rider ${user.id}`,
            coordsPayload,
          );
          return;
        }
        onDutyRiders.set(user.id, { socketId: socket.id, coords });
        socket.join("onDuty");
        console.log(`rider ${user.id} is now on duty.`);
        updateNearbyriders();
      });

      socket.on("goOffDuty", () => {
        onDutyRiders.delete(user.id);
        socket.leave("onDuty");
        console.log(`rider ${user.id} is now off duty.`);
        updateNearbyriders();
      });

      socket.on("updateLocation", (coordsPayload) => {
        const coords = normalizeCoords(coordsPayload);
        if (!coords) return;
        if (onDutyRiders.has(user.id)) {
          onDutyRiders.get(user.id).coords = coords;
          console.log(`rider ${user.id} updated location.`);
          updateNearbyriders();
          socket.to(`rider_${user.id}`).emit("riderLocationUpdate", {
            riderId: user.id,
            coords,
          });
        }
      });
    }

    if (user.role === "customer") {
      socket.on("subscribeToZone", (customerCoords) => {
        socket.user.coords = customerCoords;
        sendNearbyRiders(socket, customerCoords);
      });

      socket.on("searchrider", async (rideIdPayload) => {
        try {
          const rideId = normalizeRideId(rideIdPayload);
          if (!rideId) {
            return socket.emit("error", { message: "Ride id missing" });
          }
          const ride = await Ride.findById(rideId).populate("customer rider");
          if (!ride) return socket.emit("error", { message: "Ride not found" });

          const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

          let retries = 0;
          let rideAccepted = false;
          let canceled = false;
          const MAX_RETRIES = 20;

          const retrySearch = async () => {
            if (canceled) return;
            retries++;

            const riders = sendNearbyRiders(
              socket,
              { latitude: pickupLat, longitude: pickupLon },
              ride,
            );
            if (riders.length > 0 || retries >= MAX_RETRIES) {
              clearInterval(retryInterval);
              if (!rideAccepted && retries >= MAX_RETRIES) {
                await Ride.findByIdAndDelete(rideId);
                socket.emit("error", {
                  message: "No riders found within 5 minutes.",
                });
              }
            }
          };

          const retryInterval = setInterval(retrySearch, 10000);
          retrySearch();

          // Create named handler functions so we can remove them later
          const handleRideAccepted = () => {
            rideAccepted = true;
            clearInterval(retryInterval);
            // Clean up listeners after acceptance
            socket.removeListener("rideAccepted", handleRideAccepted);
            socket.removeListener("cancelRide", handleCancelRide);
          };

          const handleCancelRide = async () => {
            canceled = true;
            clearInterval(retryInterval);
            await Ride.findByIdAndDelete(rideId);
            socket.emit("rideCanceled", { message: "Ride canceled" });

            if (ride.rider) {
              const riderSocket = getRiderSocket(ride.rider._id);
              riderSocket?.emit("rideCanceled", {
                message: `Customer ${user.id} canceled the ride.`,
              });
            }
            console.log(`Customer ${user.id} canceled ride ${rideId}`);
            // Clean up listeners after cancellation
            socket.removeListener("rideAccepted", handleRideAccepted);
            socket.removeListener("cancelRide", handleCancelRide);
          };

          socket.on("rideAccepted", handleRideAccepted);
          socket.on("cancelRide", handleCancelRide);
        } catch (error) {
          console.error("Error searching for rider:", error);
          socket.emit("error", { message: "Error searching for rider" });
        }
      });
    }

    socket.on("subscribeToriderLocation", (riderId) => {
      const rider = onDutyRiders.get(riderId);
      if (rider) {
        socket.join(`rider_${riderId}`);
        socket.emit("riderLocationUpdate", { riderId, coords: rider.coords });
        console.log(
          `User ${user.id} subscribed to rider ${riderId}'s location.`,
        );
      }
    });

    socket.on("subscribeRide", async (rideId) => {
      socket.join(`ride_${rideId}`);
      try {
        const rideData = await Ride.findById(rideId).populate("customer rider");
        socket.emit("rideData", rideData);
      } catch (error) {
        socket.emit("error", { message: "Failed to receive ride data" });
      }
    });

    socket.on("disconnect", () => {
      if (user.role === "rider") onDutyRiders.delete(user.id);
      console.log(`${user.role} ${user.id} disconnected.`);
    });

    function updateNearbyriders() {
      io.sockets.sockets.forEach((clientSocket) => {
        if (clientSocket.user?.role === "customer") {
          const customerCoords = clientSocket.user.coords;
          if (customerCoords) sendNearbyRiders(clientSocket, customerCoords);
        }
      });
    }

    function sendNearbyRiders(socket, location, ride = null) {
      const nearbyriders = computeNearbyRidersForLocation(location);

      socket.emit("nearbyriders", nearbyriders);

      if (ride) {
        emitRideOffersToNearbyRiders(io, location, ride);
      }

      return nearbyriders;
    }

    function getRiderSocket(riderId) {
      const rider = onDutyRiders.get(riderId);
      return rider ? io.sockets.sockets.get(rider.socketId) : null;
    }
  });
};

export default handleSocketConnection;
