import { createActor } from "declarations/backend";
import { canisterId } from "declarations/backend/index.js";

export const backendActor = createActor(canisterId, {
  agentOptions: {
    host: process.env.DFX_NETWORK === "ic" ? "https://ic0.app" : "http://localhost:4943",
  },
});
