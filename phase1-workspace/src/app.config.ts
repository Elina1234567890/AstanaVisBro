import { defineAppConfig } from "./base/app-config";

export default defineAppConfig({
  start: "lobby",
  lobby: { order: ["play", "cards", "store", "marketplace", "profile", "friends"] },
});
