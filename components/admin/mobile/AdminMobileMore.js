import DashboardMoreMenu from '../../dashboard/DashboardMoreMenu'

export default function AdminMobileMore({ open, onClose, items }) {
  return (
    <DashboardMoreMenu
      open={open}
      title="Admin tools"
      subtitle="Platform administration"
      onClose={onClose}
      items={items}
    />
  )
}
