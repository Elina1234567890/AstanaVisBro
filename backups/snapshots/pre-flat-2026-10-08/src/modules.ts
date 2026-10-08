import type { Module } from "@idosgames/module-sdk";
import { friendsModule } from "./modules/friends";
import { profileModule } from "./modules/profile";
import { miniGameModule } from "./modules/mini-game";
import { astanavisShellModule } from "./modules/astanavis-shell";

export const modules: Module[] = [
  friendsModule, profileModule, miniGameModule, astanavisShellModule,
];
