export type CreateFlowType = 'event' | 'convention'

export type OpenCreateFlowOptions = {
  type: CreateFlowType
  prefillOrgId?: string
  prefillGroupId?: string
  kind?: 'munch'
}

export const CREATE_FLOW_OPEN_EVENT = 'c2k:open-create-flow'

export function openCreateFlow(options: OpenCreateFlowOptions) {
  window.dispatchEvent(new CustomEvent<OpenCreateFlowOptions>(CREATE_FLOW_OPEN_EVENT, { detail: options }))
}

const UUID_RE = /^[0-9a-f-]{36}$/i

export function readCreateFlowDataset(el: HTMLElement): OpenCreateFlowOptions {
  const type = el.dataset.createFlow === 'convention' ? 'convention' : 'event'
  const prefillOrgId =
    el.dataset.prefillOrgId && UUID_RE.test(el.dataset.prefillOrgId) ? el.dataset.prefillOrgId : undefined
  const prefillGroupId =
    el.dataset.prefillGroupId && UUID_RE.test(el.dataset.prefillGroupId) ? el.dataset.prefillGroupId : undefined
  const kind = el.dataset.kind === 'munch' ? 'munch' : undefined
  return { type, prefillOrgId, prefillGroupId, kind }
}
