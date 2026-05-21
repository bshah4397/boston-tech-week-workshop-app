import type { SlotConfig, SlotModule } from "./slot-types";

const modules = import.meta.glob<SlotModule>("./apps/app-*/index.tsx", { eager: true });

function slotFromPath(path: string) {
  const match = path.match(/\.\/apps\/(app-\d+)\/index\.tsx$/);
  return match?.[1] ?? "";
}

export const slotModules = Object.fromEntries(
  Object.entries(modules)
    .map(([path, module]) => [slotFromPath(path), module] as const)
    .filter(([slotId]) => Boolean(slotId)),
) as Record<string, SlotModule>;

export const availableSlots: SlotConfig[] = Object.values(slotModules)
  .map((module) => module.slotConfig)
  .sort((a, b) => a.slotId.localeCompare(b.slotId));

export function isValidSlotId(slotId: string) {
  return /^app-\d{3,4}$/.test(slotId);
}

export function getRoutePathParts(pathname: string) {
  return pathname.split("/").filter(Boolean);
}
