import { formatCurrency } from '../../lib/utils';
import DashboardIcon from '../dashboard/DashboardIcon';

export default function StatsCards({ stats, onSelect }) {
  const items = [
    { group: 'Property Overview', label: 'Total Rooms', value: stats?.totalRooms || 0, icon: 'rooms', color: 'bg-blue-100 text-blue-600', tab: 'rooms' },
    { group: 'Property Overview', label: 'Occupied', value: stats?.occupied || 0, icon: 'users', color: 'bg-emerald-100 text-emerald-600', tab: 'rooms' },
    { group: 'Property Overview', label: 'Available', value: stats?.vacant || 0, icon: 'home', color: 'bg-amber-100 text-amber-600', tab: 'rooms' },
    { group: 'Property Overview', label: 'Tenants', value: stats?.tenantCount || 0, icon: 'users', color: 'bg-indigo-100 text-indigo-600', tab: 'tenants' },
    { group: 'Rent & Payments', label: 'Collected', value: formatCurrency(stats?.totalCollected || 0), icon: 'payments', color: 'bg-orange-100 text-orange-600' },
    { group: 'Rent & Payments', label: 'Deposits', value: formatCurrency(stats?.depositCollected || 0), icon: 'payments', color: 'bg-slate-100 text-slate-600' },
    { group: 'Rent & Payments', label: 'Pending Rent', value: formatCurrency(stats?.pendingAmount || 0), icon: 'payments', color: 'bg-red-100 text-red-600', tab: 'rent-payments' },
    { group: 'Rent & Payments', label: 'This Month', value: formatCurrency(stats?.monthlyIncome || 0), icon: 'analytics', color: 'bg-green-100 text-green-600' },
    { group: 'Operations', label: 'Pending Payments', value: stats?.pendingRentConfirmations || 0, icon: 'payments', color: 'bg-purple-100 text-purple-600', tab: 'rent-payments' },
    { group: 'Operations', label: 'Active Notices', value: stats?.activeNotices || 0, icon: 'notices', color: 'bg-cyan-100 text-cyan-600', tab: 'notices' },
    { group: 'Operations', label: 'Complaints', value: stats?.totalComplaints || 0, icon: 'complaints', color: 'bg-rose-100 text-rose-600', tab: 'complaints' },
    { group: 'Requests', label: 'Applications', value: stats?.pendingApplications || 0, icon: 'requests', color: 'bg-fuchsia-100 text-fuchsia-600', tab: 'applications' },
    { group: 'Requests', label: 'Existing Imports', value: stats?.pendingImports || 0, icon: 'requests', color: 'bg-teal-100 text-teal-700', tab: 'existing-imports' },
    { group: 'Requests', label: 'Vacate Requests', value: stats?.pendingVacate || 0, icon: 'home', color: 'bg-yellow-100 text-yellow-700', tab: 'vacate' },
    { group: 'Requests', label: 'Room Changes', value: stats?.pendingRoomChanges || 0, icon: 'requests', color: 'bg-sky-100 text-sky-600', tab: 'room-change' },
  ];

  const groups = ['Property Overview', 'Rent & Payments', 'Operations', 'Requests'];

  const renderCard = (item) => {
    const clickable = Boolean(item.tab && onSelect);
    const Card = clickable ? 'button' : 'div';
    return (
      <Card
        key={item.label}
        type={clickable ? 'button' : undefined}
        onClick={clickable ? () => onSelect(item.tab) : undefined}
        className={`flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm ${clickable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400' : ''}`}
      >
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${item.color}`}>
          <DashboardIcon name={item.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
          <p className="truncate text-xl font-bold leading-tight text-gray-800">{item.value}</p>
        </div>
      </Card>
    );
  };

  return (
    <div className="mb-6 grid gap-5 lg:grid-cols-2">
      {groups.map(group => <section key={group} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby={`owner-stat-${group.replace(/\W+/g, '-').toLowerCase()}`}>
        <h2 id={`owner-stat-${group.replace(/\W+/g, '-').toLowerCase()}`} className="mb-3 text-sm font-bold text-slate-800">{group}</h2>
        <div className="grid grid-cols-2 gap-3">
      {items.filter(item => item.group === group).map(renderCard)}
        </div>
      </section>)}
    </div>
  );
}
