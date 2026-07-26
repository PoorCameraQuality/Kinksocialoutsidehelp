import SettingsMutedSections from '@/components/settings/SettingsMutedSections'

import SettingsMutedSidebar from '@/components/settings/SettingsMutedSidebar'

import { useApiMutes } from '@/hooks/useApiMutes'

import { useSettingsContext } from '../SettingsContext'



export default function SettingsMutedPage() {

  const ctx = useSettingsContext()

  const mutedMembers = useApiMutes(ctx.settingsEnabled, 'USER')

  const mutedGroups = useApiMutes(ctx.settingsEnabled, 'GROUP')



  return (

    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8 lg:items-start">

      <SettingsMutedSections

        mutedTags={ctx.mutedTags}

        mutedTagsLoading={ctx.mutedTagsStatus === 'loading' || ctx.mutedTagsStatus === 'idle'}

        mutedTagsError={ctx.mutedTagsError}

        onMuteTag={ctx.muteTag}

        onUnmuteTag={(muteId) => void ctx.unmuteTag(muteId)}

        muteTagBusy={ctx.muteTagBusy}

        unmuteTagBusy={ctx.unmuteTagBusy}

        mutedMembers={mutedMembers}

        mutedGroups={mutedGroups}

      />

      <aside className="mt-8 lg:mt-0">

        <SettingsMutedSidebar />

      </aside>

    </div>

  )

}


