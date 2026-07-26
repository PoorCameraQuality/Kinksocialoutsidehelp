import VendorManagedShopsSection from '@/components/settings/VendorManagedShopsSection'
import VendorShopSection from '@/components/settings/VendorShopSection'

export default function SettingsVendorPage() {
  return (
    <div className="space-y-6">
      <VendorManagedShopsSection />
      <VendorShopSection />
    </div>
  )
}
