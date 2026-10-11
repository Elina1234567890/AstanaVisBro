import type { Module } from "@idosgames/module-sdk";
import { profileModule } from "./modules/profile";
import { storeModule } from "./modules/store";
import { collectionsModule } from "./modules/collections";
import { orbMergeModule } from "./modules/orb-merge";
import { colorFlowModule } from "./modules/color-flow";
import { cakeSortModule } from "./modules/cake-sort";

export const modules: Module[] = [
  profileModule,
  storeModule,
  collectionsModule,
  orbMergeModule,
  colorFlowModule,
  cakeSortModule,
];
