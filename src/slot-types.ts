import type { ComponentType } from "react";

export type SlotRoute = "home" | "launch" | "callback" | "demo" | "logout-complete" | "unknown";

export type SlotAppProps = {
  appBasePath: string;
  fullPath: string;
  query: URLSearchParams;
  route: SlotRoute;
  slotId: string;
};

export type SlotConfig = {
  description: string;
  slotId: string;
  title: string;
};

export type SlotModule = {
  default: ComponentType<SlotAppProps>;
  slotConfig: SlotConfig;
};
