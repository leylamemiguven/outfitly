declare module "delta-e" {
    export type LabColor = { L: number; A: number; B: number };
  
    export function getDeltaE00(labA: LabColor, labB: LabColor): number;
    export function getDeltaE76(labA: LabColor, labB: LabColor): number;
    export function getDeltaE94(labA: LabColor, labB: LabColor): number;
  }
  