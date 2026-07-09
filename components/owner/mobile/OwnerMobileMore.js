import DashboardMoreMenu from '../../dashboard/DashboardMoreMenu'

export default function OwnerMobileMore({ open, onClose, subtitle, items }) {
  return <DashboardMoreMenu open={open} title="Owner tools" subtitle={subtitle} onClose={onClose} items={items} />
}
