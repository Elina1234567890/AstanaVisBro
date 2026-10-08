import type { Module } from "@idosgames/module-sdk";
import { friendsModule } from "./modules/friends";
import { marketplaceModule } from "./modules/marketplace";
import { profileModule } from "./modules/profile";
import { miniGameModule } from "./modules/mini-game";
import { astanavisShellModule } from "./modules/astanavis-shell";
import { astanavisProgressModule } from "./modules/astanavis-progress";

export const modules: Module[] = [
  friendsModule, profileModule, miniGameModule, astanavisShellModule, astanavisProgressModule, marketplaceModule,
];
