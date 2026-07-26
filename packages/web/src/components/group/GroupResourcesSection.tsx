import { Link } from 'react-router-dom'
import Card from '@/components/ui/Card'
import { useGroupDetailContext } from '@/contexts/GroupDetailContext'
import type { MockResource } from '@/data/mock-data'

interface GroupResourcesSectionProps {
  resources: MockResource[]
  addResourceOpen: boolean
  setAddResourceOpen: (open: boolean) => void
  newResourceName: string
  setNewResourceName: (value: string) => void
  newResourceLink: string
  setNewResourceLink: (value: string) => void
  newResourceType: string
  setNewResourceType: (value: string) => void
  onAddResource: () => void
  onRemoveResource: (id: string) => void
}

export default function GroupResourcesSection({
  resources,
  addResourceOpen,
  setAddResourceOpen,
  newResourceName,
  setNewResourceName,
  newResourceLink,
  setNewResourceLink,
  newResourceType,
  setNewResourceType,
  onAddResource,
  onRemoveResource,
}: GroupResourcesSectionProps) {
  const { canManage } = useGroupDetailContext()
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-dc-muted uppercase">Shared Resources</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => setAddResourceOpen(true)}
            className="px-3 py-1.5 text-sm bg-dc-accent hover:bg-dc-accent-hover text-dc-text rounded-lg font-medium"
          >
            Add resource
          </button>
        ) : (
          <button
            type="button"
            className="px-3 py-1.5 text-sm text-dc-accent/70 cursor-not-allowed"
            disabled
            title="Owner/admin only"
          >
            Add resource
          </button>
        )}
      </div>
      {addResourceOpen && canManage && (
        <div className="mb-4 p-4 bg-dc-surface-muted rounded-xl border border-dc-border space-y-2">
          <input
            value={newResourceName}
            onChange={(e) => setNewResourceName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 bg-dc-elevated-solid border border-dc-border rounded text-sm text-dc-text"
          />
          <input
            value={newResourceLink}
            onChange={(e) => setNewResourceLink(e.target.value)}
            placeholder="Link (e.g. https://...)"
            className="w-full px-3 py-2 bg-dc-elevated-solid border border-dc-border rounded text-sm text-dc-text"
          />
          <select
            value={newResourceType}
            onChange={(e) => setNewResourceType(e.target.value)}
            className="px-3 py-2 bg-dc-elevated-solid border border-dc-border rounded text-sm text-dc-text"
          >
            <option value="Link">Link</option>
            <option value="Document">Document</option>
            <option value="PDF">PDF</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAddResource}
              className="px-3 py-1.5 text-sm bg-dc-accent text-dc-text rounded"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddResourceOpen(false)
                setNewResourceName('')
                setNewResourceLink('')
              }}
              className="px-3 py-1.5 text-sm text-dc-muted hover:text-dc-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {resources.map((resource) => (
          <li key={resource.id} className="flex items-center justify-between gap-4 py-2 border-b border-dc-border-subtle last:border-0">
            <Link to={resource.link} className="font-medium text-dc-text hover:text-dc-accent">
              {resource.name}
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-dc-muted">{resource.type}</span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onRemoveResource(resource.id)}
                  className="text-xs text-dc-danger hover:text-dc-danger/90"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {resources.length === 0 && !addResourceOpen && (
        <p className="text-sm text-dc-muted py-4">No resources yet.</p>
      )}
    </Card>
  )
}
