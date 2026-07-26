import { useId, useState } from 'react'

type Props = {
  accept: string
  maxSize?: number
  multiple?: boolean
  disabled?: boolean
  compact?: boolean
  label: string
  hint?: string
  onFiles: (files: File[]) => void
}

export default function MediaDropzone({
  accept,
  maxSize = 50 * 1024 * 1024,
  multiple = false,
  disabled = false,
  compact = false,
  label,
  hint,
  onFiles,
}: Props) {
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateAndEmit = (fileList: FileList | null) => {
    setError(null)
    if (!fileList?.length) return
    const files = Array.from(fileList)
    const valid: File[] = []
    for (const file of files) {
      if (maxSize && file.size > maxSize) {
        setError(`"${file.name}" exceeds ${Math.round(maxSize / 1024 / 1024)}MB.`)
        continue
      }
      valid.push(file)
    }
    if (valid.length) onFiles(multiple ? valid : [valid[0]!])
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'} data-testid="media-upload-dropzone">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (disabled) return
          validateAndEmit(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 text-center transition-colors ${
          compact ? 'min-h-[120px] py-4' : 'min-h-[160px] py-8'
        } ${
          disabled ? 'cursor-not-allowed opacity-50'
          : isDragging ? 'border-dc-accent bg-dc-accent/5'
          : 'border-dc-border bg-dc-surface-muted/50 hover:border-dc-accent-border/60'
        }`}
      >
        <span className="text-sm font-medium text-dc-text">{label}</span>
        {hint ?
          <span className="mt-1 max-w-sm text-xs text-dc-text-muted">{hint}</span>
        : null}
        <span className="mt-2 text-xs text-dc-muted">Drag and drop or tap to browse</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          validateAndEmit(e.target.files)
          e.target.value = ''
        }}
      />
      {error ?
        <p className="text-xs text-dc-danger" role="alert">
          {error}
        </p>
      : null}
    </div>
  )
}
