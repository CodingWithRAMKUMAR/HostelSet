import DashboardMoreMenu from '../../dashboard/DashboardMoreMenu'

export default function TenantMobileMore({ open, title = 'Tenant menu', subtitle, items, onClose }) {
  return <DashboardMoreMenu open={open} title={title} subtitle={subtitle} items={items} onClose={onClose} />
}
