/**
 * Gate region screen registry — single source of truth for /map/gate and construction maps.
 * Screen names must stay aligned with the master scene map (BLOCKS).
 */
export const GATE_SCREEN = { w: 3840, h: 2160 } as const;

export type GateScreenId =
  | "s01" | "s02" | "s03" | "s04" | "s05" | "s06"
  | "s07" | "s08" | "s09" | "s10" | "s11" | "s12";

export type GateScreenMeta = {
  id: GateScreenId;
  index: string;
  name: string;
};

/** Ordered west → east. Construction maps must use these names verbatim. */
export const GATE_SCREENS: readonly GateScreenMeta[] = [
  { id: "s01", index: "01", name: "破庙残院" },
  { id: "s02", index: "02", name: "竹雾村缘" },
  { id: "s03", index: "03", name: "山门缓坡" },
  { id: "s04", index: "04", name: "竹篱小径" },
  { id: "s05", index: "05", name: "石狮甬道" },
  { id: "s06", index: "06", name: "雨廊石阶" },
  { id: "s07", index: "07", name: "演武坪" },
  { id: "s08", index: "08", name: "守门校场" },
  { id: "s09", index: "09", name: "雨亭箭廊" },
  { id: "s10", index: "10", name: "山门前庭" },
  { id: "s11", index: "11", name: "城楼闸口" },
  { id: "s12", index: "12", name: "山门驿道" },
] as const;

export const GATE_SCREEN_NAMES = GATE_SCREENS.map((screen) => screen.name);

export const gateScreenOriginX = (indexZeroBased: number) => GATE_SCREEN.w * indexZeroBased;
