export const MAP_ZONE_SHAPES = ['circle', 'square', 'rectangle', 'triangle'] as const
export type MapZoneShape = (typeof MAP_ZONE_SHAPES)[number]

export type MapZonePin = {
  locationId: string
  x: number
  y: number
  label: string | null
  shape?: MapZoneShape | string | null
  width?: number | null
  height?: number | null
  rotation?: number | null
}

const DEFAULT_WIDTH = 0.12
const DEFAULT_HEIGHT = 0.12

export function isMapZoneShape(v: unknown): v is MapZoneShape {
  return typeof v === 'string' && (MAP_ZONE_SHAPES as readonly string[]).includes(v)
}

export function defaultZoneSizeForShape(shape: MapZoneShape): { width: number; height: number } {
  switch (shape) {
    case 'rectangle':
      return { width: 0.18, height: 0.1 }
    case 'triangle':
      return { width: 0.14, height: 0.12 }
    case 'square':
      return { width: 0.1, height: 0.1 }
    default:
      return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  }
}

function clampFrac(n: number, min = 0.04, max = 0.75) {
  return Math.min(max, Math.max(min, n))
}

function clampRotation(deg: number) {
  return Math.min(180, Math.max(-180, Math.round(deg * 10) / 10))
}

export type NormalizedMapZonePin = Omit<MapZonePin, 'shape' | 'width' | 'height' | 'rotation'> & {
  shape: MapZoneShape
  width: number
  height: number
  rotation: number
}

export function normalizeMapZonePin(pin: MapZonePin): NormalizedMapZonePin {
  const shape: MapZoneShape = isMapZoneShape(pin.shape) ? pin.shape : 'circle'
  const defaults = defaultZoneSizeForShape(shape)
  return {
    ...pin,
    shape,
    width: clampFrac(Number(pin.width) || defaults.width),
    height: clampFrac(Number(pin.height) || defaults.height),
    rotation: clampRotation(Number(pin.rotation) || 0),
  }
}

export function mapZoneShapeLabel(shape: MapZoneShape) {
  switch (shape) {
    case 'circle':
      return 'Circle'
    case 'square':
      return 'Square'
    case 'rectangle':
      return 'Rectangle'
    case 'triangle':
      return 'Triangle'
  }
}
