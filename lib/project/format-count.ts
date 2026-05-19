export function formatCount(value: number) {
  if (value >= 10000) {
    const rounded = value / 10000
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}w`
  }
  if (value >= 1000) {
    const rounded = value / 1000
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k`
  }
  return String(value)
}
