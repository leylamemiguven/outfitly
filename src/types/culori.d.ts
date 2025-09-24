declare module "culori" {
    // Let TS accept any export from culori without typing errors
    export function converter(mode: string): (color: any) => any;
    export const formatHex: any;
    export const formatRgb: any;
    export const parse: any;
    export const interpolate: any;
    export const differenceCiede2000: any;
    export * from "culori"; // fallback for other exports
  }
  