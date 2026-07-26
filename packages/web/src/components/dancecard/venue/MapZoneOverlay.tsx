import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { normalizeMapZonePin, type MapZonePin } from '@/lib/dancecard/mapPinZones'

type ResizeCorner = 'tl' | 'tr' | 'br' | 'bl'

type Props = HTMLAttributes<HTMLDivElement> & {
  pin?: MapZonePin
  displayName?: string
  variant?: 'edit' | 'drop'
  focused?: boolean
  highlighted?: boolean
  /** Called from corner handles when the user resizes a focused zone. */
  onResizeStart?: (corner: ResizeCorner, e: ReactPointerEvent<HTMLDivElement>) => void
  /** Called from the top handle when the user rotates a focused zone. */
  onRotateStart?: (e: ReactPointerEvent<HTMLDivElement>) => void
  children?: ReactNode
}

function shapeStyles(shape: string): CSSProperties {
  switch (shape) {
    case 'circle':
      return { borderRadius: '9999px' }
    case 'triangle':
      return {
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
        borderRadius: 0,
      }
    case 'rectangle':
    case 'square':
    default:
      return { borderRadius: '6px' }
  }
}

/**
 * Venue map zone - renders a sized, rotated bounding box on top of the floor
 * plan. Width / height are fractions of the container (0..1), rotation is in
 * degrees, shape selects between circle / square / rectangle / triangle.
 * The entire box is the pointer target so it can be dragged from anywhere; in
 * `edit` mode focused zones show a tinted fill + visible border with the label
 * centered inside.
 */
export function MapZoneOverlay({
  pin,
  displayName,
  variant = 'edit',
  focused = false,
  highlighted = false,
  onResizeStart,
  onRotateStart,
  className,
  style: extraStyle,
  children,
  ...rest
}: Props) {
  if (!pin) return null
  const z = normalizeMapZonePin(pin)
  const isEdit = variant === 'edit'

  const borderColor = focused
    ? 'rgb(34 211 238)'
    : highlighted
      ? 'rgb(250 204 21)'
      : 'rgba(255,255,255,0.75)'
  const fillColor = focused
    ? 'rgba(34, 211, 238, 0.18)'
    : highlighted
      ? 'rgba(250, 204, 21, 0.20)'
      : isEdit
        ? 'rgba(0, 0, 0, 0.25)'
        : 'rgba(255, 255, 255, 0.05)'

  // Outer container: positions + sizes + rotates the zone but does NOT carry
  // the clip-path/border/background, so the label and handles can render
  // outside the zone without being clipped by the shape itself.
  const baseStyle: CSSProperties = {
    position: 'absolute',
    left: `${z.x * 100}%`,
    top: `${z.y * 100}%`,
    width: `${z.width * 100}%`,
    height: `${z.height * 100}%`,
    transform: `translate(-50%, -50%) rotate(${z.rotation}deg)`,
    transformOrigin: 'center center',
    cursor: isEdit ? 'grab' : 'default',
    overflow: 'visible',
    touchAction: 'none',
    userSelect: 'none',
    ...extraStyle,
  }

  // Inner shape: this is the box people see. The clip-path for triangle only
  // applies here so it cannot crop the text/handles above it.
  const shapeStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    border: `2px ${focused ? 'solid' : 'dashed'} ${borderColor}`,
    background: fillColor,
    boxShadow: focused
      ? '0 0 0 1px rgba(0,0,0,0.6), 0 0 12px rgba(34,211,238,0.45)'
      : '0 0 0 1px rgba(0,0,0,0.45)',
    pointerEvents: 'none',
    ...shapeStyles(z.shape),
  }

  // Counter-rotate the inner label so text stays readable when the zone is rotated.
  // The label is allowed to extend beyond the zone's edges so short rooms keep
  // their full name visible - `position: absolute` + `width: max-content` keeps
  // it centered on the zone's centre without being constrained by the box width.
  const labelStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) rotate(${-z.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: 'none',
    width: 'max-content',
    maxWidth: 'none',
    textAlign: 'center',
    fontSize: '11px',
    lineHeight: 1.1,
    color: 'white',
    background: 'rgba(0,0,0,0.72)',
    padding: '2px 6px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    zIndex: 1,
  }

  const showHandles = isEdit && focused
  const handleBase: CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    background: 'white',
    border: '1.5px solid rgb(8, 145, 178)',
    borderRadius: 2,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    touchAction: 'none',
  }
  const cornerStyles: Record<ResizeCorner, CSSProperties> = {
    tl: { ...handleBase, left: -6, top: -6, cursor: 'nwse-resize' },
    tr: { ...handleBase, right: -6, top: -6, cursor: 'nesw-resize' },
    br: { ...handleBase, right: -6, bottom: -6, cursor: 'nwse-resize' },
    bl: { ...handleBase, left: -6, bottom: -6, cursor: 'nesw-resize' },
  }
  const rotateStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: -28,
    width: 14,
    height: 14,
    marginLeft: -7,
    background: 'rgb(34, 211, 238)',
    border: '1.5px solid white',
    borderRadius: '9999px',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
    cursor: 'grab',
    pointerEvents: 'auto',
    touchAction: 'none',
  }
  const rotateStemStyle: CSSProperties = {
    position: 'absolute',
    left: '50%',
    top: -16,
    width: 1.5,
    height: 16,
    marginLeft: -0.75,
    background: 'rgba(34,211,238,0.85)',
    pointerEvents: 'none',
  }

  return (
    <div className={className} style={baseStyle} {...rest}>
      <div style={shapeStyle} aria-hidden />
      <span style={labelStyle}>{displayName ?? pin.label ?? ''}</span>
      {showHandles && onRotateStart ? (
        <>
          <div style={rotateStemStyle} aria-hidden />
          <div
            role="slider"
            aria-label="Rotate zone"
            style={rotateStyle}
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRotateStart(e)
            }}
          />
        </>
      ) : null}
      {showHandles && onResizeStart
        ? (['tl', 'tr', 'br', 'bl'] as ResizeCorner[]).map((corner) => (
            <div
              key={corner}
              role="slider"
              aria-label={`Resize zone ${corner}`}
              style={cornerStyles[corner]}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onResizeStart(corner, e)
              }}
            />
          ))
        : null}
      {children}
    </div>
  )
}
