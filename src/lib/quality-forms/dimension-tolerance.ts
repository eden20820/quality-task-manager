export type DimensionBounds = {
  minimum: string;
  maximum: string;
  mode: "iso-2768" | "symmetric" | "asymmetric";
};

function decimalPlaces(value: string) {
  return value.includes(".") ? value.length - value.indexOf(".") - 1 : 0;
}

function formatBounds(nominalText: string, lowerToleranceText: string, upperToleranceText: string, mode: DimensionBounds["mode"]): DimensionBounds {
  const precision = Math.max(decimalPlaces(nominalText), decimalPlaces(lowerToleranceText), decimalPlaces(upperToleranceText));
  const scale = 10 ** precision;
  const nominal = Number(nominalText);
  const lowerTolerance = Number(lowerToleranceText);
  const upperTolerance = Number(upperToleranceText);
  const minimum = Math.round((nominal - lowerTolerance) * scale) / scale;
  const maximum = Math.round((nominal + upperTolerance) * scale) / scale;
  return { minimum: minimum.toFixed(precision), maximum: maximum.toFixed(precision), mode };
}

function isoLinearTolerance(nominal: number) {
  if (nominal >= 0.5 && nominal <= 6) return "0.05";
  if (nominal > 6 && nominal <= 30) return "0.1";
  if (nominal > 30 && nominal <= 120) return "0.15";
  if (nominal > 120 && nominal <= 400) return "0.2";
  return null;
}

export function parseDimensionTolerance(value: string): DimensionBounds | null {
  const normalized = value.trim().replace(/,/g, ".").replace(/[−–—]/g, "-").replace(/\s+/g, "");
  if (!normalized) return null;

  const asymmetric = normalized.match(/^((?:\d+(?:\.\d*)?|\.\d+))\+((?:\d+(?:\.\d*)?|\.\d+))-((?:\d+(?:\.\d*)?|\.\d+))$/);
  if (asymmetric) return formatBounds(asymmetric[1], asymmetric[3], asymmetric[2], "asymmetric");

  const symmetric = normalized.match(/^((?:\d+(?:\.\d*)?|\.\d+))(?:±|\+\/-|\+-)((?:\d+(?:\.\d*)?|\.\d+))$/);
  if (symmetric) return formatBounds(symmetric[1], symmetric[2], symmetric[2], "symmetric");

  const nominal = normalized.match(/^((?:\d+(?:\.\d*)?|\.\d+))$/);
  if (!nominal) return null;
  const tolerance = isoLinearTolerance(Number(nominal[1]));
  return tolerance ? formatBounds(nominal[1], tolerance, tolerance, "iso-2768") : null;
}
