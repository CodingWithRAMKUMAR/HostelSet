import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { signOut } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { AdminProvider, useAdmin } from '../../context/AdminContext';
import BrandLogo from '../../components/BrandLogo';
import NotificationBell from '../../components/common/NotificationBell';
import ThemeToggle from '../../components/common/ThemeToggle';
import { useAdminProperties } from '../../hooks/useAdminProperties';
import { useAdminTenants } from '../../hooks/useAdminTenants';
import { useAdminOwners } from '../../hooks/useAdminOwners';
import { useAdminUsers } from '../../hooks/useAdminUsers';
import { useAdminPayments } from '../../hooks/useAdminPayments';
import { useAdminPreBookings } from '../../hooks/useAdminPreBookings';
import { useAdminApplications } from '../../hooks/useAdminApplications';
import { useAdminApprovedApplications } from '../../hooks/useAdminApprovedApplications';
import { useAdminComplaints } from '../../hooks/useAdminComplaints';
import { useAdminVacate } from '../../hooks/useAdminVacate';
import { useAdminRoomChange } from '../../hooks/useAdminRoomChange';
import { useAdminNotices } from '../../hooks/useAdminNotices';
import { useAdminMembershipManager } from '../../hooks/useAdminMembershipManager';
import { useAdminModals } from '../../hooks/useAdminModals';
import { useAdminAnalytics } from '../../hooks/useAdminAnalytics';
import { Skeleton, TableSkeletonRows } from '../../components/ui/Skeleton';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import AdminGlobalSearch from '../../components/admin/AdminGlobalSearch';
import { displayBloodGroup } from '../../lib/bloodGroups';
import DashboardSectionNav from '../../components/dashboard/DashboardSectionNav';
const MembershipManager = dynamic(() => import('../../components/admin/MembershipManager'));
const EnterpriseAdminConsole = dynamic(() => import('../../components/admin/EnterpriseAdminConsole'), { ssr: false });
const AdminAnalytics = dynamic(() => import('../../components/analytics/AdminAnalytics'));

// ----------------- UTILITY TABLE COMPONENT -----------------
const AdminTable = ({ headers, data, renderRow, emptyMessage, loading = false }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#1a1a1a] text-white/90 border-b border-orange-500/30">
          <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4 whitespace-nowrap font-medium tracking-wide">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && data.length === 0 ? (
            <TableSkeletonRows columns={headers.length} />
          ) : data.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-6 py-12 text-center text-gray-400 italic">{emptyMessage}</td></tr>
          ) : (
            data.map((item, index) => renderRow(item, index))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// ----------------- DETAIL MODAL COMPONENT -----------------
const DetailModal = ({ isOpen, onClose, title, data }) => {
  const dialogRef = useModalAccessibility(onClose, false, isOpen);
  if (!isOpen || !data) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="admin-detail-title" className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-orange-500/20 outline-none" onClick={event => event.stopPropagation()}>
        <div className="bg-[#1a1a1a] p-5 flex justify-between items-center border-b border-orange-500/30">
          <h3 id="admin-detail-title" className="text-white text-lg font-bold tracking-wide">{title}</h3>
          <button onClick={onClose} aria-label="Close details" className="text-gray-400 hover:text-white text-xl font-bold">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <pre className="text-sm bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-x-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-lg font-medium transition">Close</button>
        </div>
      </div>
    </div>
  );
};

// ----------------- MAIN DASHBOARD CONTENT -----------------
function AdminDashboardContent() {
  const router = useRouter();
  const { globalStats, statsLoading, realtimeConnected, refreshStats } = useAdmin();
  const [activeTab, setActiveTab] = useState('overview');
  const sectionRef = useRef(null);
  const openSection = (tab) => {
    setActiveTab(tab);
    window.requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  
  // Only the visible tab loads its dataset. This keeps login fast and reduces database traffic.
  const { properties, loading: propertiesLoading, deleteProperty } = useAdminProperties(activeTab === 'properties');
  const { tenants, loading: tenantsLoading, error: tenantsError, deleteTenant } = useAdminTenants(activeTab === 'tenants');
  const { owners, loading: ownersLoading, toggleOwnerStatus } = useAdminOwners(activeTab === 'owners');
  const { users, loading: usersLoading, searchTerm, setSearchTerm, roleFilter, setRoleFilter, toggleUserStatus, changeUserRole } = useAdminUsers(activeTab === 'users');
  const { payments, loading: paymentsLoading, confirmPayment, rejectPayment } = useAdminPayments(activeTab === 'payments');
  const { preBookings, loading: preBookingsLoading, approvePreBooking, rejectPreBooking } = useAdminPreBookings(activeTab === 'prebookings');
  const { applications, loading: applicationsLoading, approveApplication, rejectApplication } = useAdminApplications(activeTab === 'applications');
  const { approvedApps, loading: approvedAppsLoading } = useAdminApprovedApplications(activeTab === 'approvedapps');
  const { complaints, loading: complaintsLoading, resolveComplaint, deleteComplaint } = useAdminComplaints(activeTab === 'complaints');
  const { vacateRequests, loading: vacateLoading, approveVacate, rejectVacate } = useAdminVacate(activeTab === 'vacate');
  const { roomChanges, loading: roomChangesLoading, approveRoomChange, rejectRoomChange } = useAdminRoomChange(activeTab === 'roomchange');
  const { notices, loading: noticesLoading, postNotice, deleteNotice } = useAdminNotices(activeTab === 'notices');
  const { owners: membershipOwners, requests: membershipRequests, loading: membershipLoading, processingId: membershipProcessingId, getDaysLeft, sendRenewalEmail, grantMembership, revokeMembership, reviewRequest, refresh: refreshMemberships } = useAdminMembershipManager(activeTab === 'membership');
  const { selectedProperty, selectedOwner, viewPropertyDetails, viewOwnerDetails, closeModals } = useAdminModals();
  const adminAnalytics = useAdminAnalytics(activeTab === 'analytics');

  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchDetail, setSearchDetail] = useState(null);
  const [applicationProof, setApplicationProof] = useState(null);

  useEffect(() => {
    const tab = typeof router.query.tab === 'string' ? router.query.tab : ''
    const allowed = ['overview', 'analytics', 'properties', 'tenants', 'owners', 'users', 'payments', 'prebookings', 'applications', 'approvedapps', 'complaints', 'vacate', 'roomchange', 'notices', 'membership']
    if (allowed.includes(tab)) setActiveTab(tab)
  }, [router.query.tab])
  const [actionKey, setActionKey] = useState(null);

  const runAdminAction = async (key, action) => {
    if (actionKey) return;
    setActionKey(key);
    try { await action(); }
    finally { setActionKey(null); }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.replace('/login');
  };

  // STATS CARDS
  const statsData = [
    { label: 'Properties', value: statsLoading ? '—' : globalStats.totalProperties, icon: '🏢', color: 'bg-orange-100 text-orange-600' },
    { label: 'Active Tenants', value: statsLoading ? '—' : globalStats.totalTenants, icon: '👥', color: 'bg-blue-100 text-blue-600' },
    { label: 'Owners', value: statsLoading ? '—' : globalStats.totalOwners, icon: '👤', color: 'bg-violet-100 text-violet-600' },
    { label: 'Active Owners', value: statsLoading ? '—' : globalStats.activeOwners, icon: '✅', color: 'bg-green-100 text-green-600' },
    { label: 'Memberships', value: statsLoading ? '—' : globalStats.activeMemberships, icon: '📋', color: 'bg-amber-100 text-amber-600' },
    { label: 'Rent Revenue', value: statsLoading ? '—' : formatCurrency(globalStats.totalRevenue), icon: '💰', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Deposits', value: statsLoading ? '—' : formatCurrency(globalStats.totalDeposits), icon: '₹', color: 'bg-slate-100 text-slate-600' },
    { label: 'Pending Complaints', value: statsLoading ? '—' : globalStats.pendingComplaints, icon: '🔧', color: 'bg-red-100 text-red-600' },
    { label: 'Pending Vacates', value: statsLoading ? '—' : globalStats.pendingVacates, icon: '🚪', color: 'bg-amber-100 text-amber-600' },
  ];

  // TABS
  const tabs = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'overview', label: '📊 Overview' },
    { id: 'properties', label: '🏢 Properties' },
    { id: 'tenants', label: '👥 Tenants' },
    { id: 'owners', label: '👤 Owners' },
    { id: 'users', label: '👤 Users' },
    { id: 'payments', label: '💰 Payments' },
    { id: 'prebookings', label: '📋 Pre-Bookings' },
    { id: 'applications', label: '📝 Applications' },
    { id: 'approvedapps', label: '✅ Approved Apps' },
    { id: 'complaints', label: '🔧 Complaints' },
    { id: 'vacate', label: '🚪 Vacate' },
    { id: 'roomchange', label: '🔄 Room Change' },
    { id: 'notices', label: '📢 Notices' },
    { id: 'membership', label: '📋 Membership' },
  ];

  const tabForStat = (label) => ({
    Properties: 'properties',
    'Active Tenants': 'tenants',
    Owners: 'owners',
    'Active Owners': 'owners',
    'Rent Revenue': 'payments',
    Deposits: 'payments',
    'Pending Complaints': 'complaints',
    'Pending Vacates': 'vacate',
  })[label];

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans selection:bg-orange-500 selection:text-white">
      
      {/* ----- NAVBAR ----- */}
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-3 sm:px-6 py-3 sm:py-4 shadow-md border-b-2 border-orange-500/80">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo priority />
            <span className="text-[10px] sm:text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">Admin</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className={`hidden sm:inline-flex items-center gap-2 text-xs font-semibold ${realtimeConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {realtimeConnected ? 'Live' : 'Connecting'}
            </span>
            <ThemeToggle />
            <NotificationBell />
            <button onClick={() => refreshStats()} className="text-orange-400 hover:text-orange-300 text-sm font-medium transition">🔄 Refresh</button>
            <button onClick={handleLogout} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-3 sm:px-6 py-2 rounded-full text-sm font-semibold transition shadow-md">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3"><h1 className="text-lg font-bold text-slate-900">Platform management</h1><p className="text-sm text-slate-500">Search records or open a management section below.</p></div><AdminGlobalSearch onOpen={(group, item) => setSearchDetail({ group, item })} /></section>
        
        {/* ----- STATS CARDS ----- */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
          {statsData.map((stat, index) => {
            const targetTab = tabForStat(stat.label);
            const Card = targetTab ? 'button' : 'div';
            return (
            <Card key={index} type={targetTab ? 'button' : undefined} onClick={targetTab ? () => openSection(targetTab) : undefined} className={`bg-white rounded-xl p-3 shadow-sm border border-gray-200 hover:shadow-md hover:border-orange-200 transition flex items-center gap-3 min-w-0 text-left ${targetTab ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400' : ''}`}>
              <div className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center text-base sm:text-xl shadow-sm ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">{stat.label}</p>
                {statsLoading ? <Skeleton className="mt-2 h-6 w-16" /> : <p className="text-base sm:text-xl font-bold text-gray-800 tracking-tight truncate">{stat.value}</p>}
              </div>
            </Card>
          )})}
        </div>

        {/* ----- TABS ----- */}
        <DashboardSectionNav label="Admin dashboard sections" items={tabs} activeId={activeTab} onSelect={openSection} />
        <div ref={sectionRef} className="scroll-mt-28">
        {/* ----- OVERVIEW ----- */}
        {activeTab === 'overview' && <EnterpriseAdminConsole />}
        {activeTab === 'analytics' && <AdminAnalytics {...adminAnalytics} />}


        {/* ----- PROPERTIES ----- */}
        {activeTab === 'properties' && (
          <AdminTable
            loading={propertiesLoading}
            headers={['Property Name', 'Owner', 'Status', 'Property ID (UUID)', 'Actions']}
            data={properties}
            renderRow={(p) => (
              <tr key={p.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                <td className="px-6 py-4">{p.users?.full_name || 'N/A'}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-6 py-4 font-mono text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 inline-block">{p.id}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => viewPropertyDetails(p)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs uppercase tracking-wider">View</button>
                  <button onClick={() => deleteProperty(p.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No properties registered yet."
          />
        )}

        {/* ----- TENANTS ----- */}
        {activeTab === 'tenants' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-500"><span className="font-bold text-slate-800">{tenants.length}</span> tenant{tenants.length !== 1 ? 's' : ''} visible to this admin</p>
              {tenantsError && <p className="text-xs text-red-600">Database error: {tenantsError}</p>}
            </div>
            <AdminTable
              loading={tenantsLoading}
              headers={['Tenant', 'Email', 'Phone', 'Blood Group', 'Room', 'Property', 'Status', 'Tenant UUID', 'Actions']}
              data={tenants}
              renderRow={(t) => (
                <tr key={t.id} className="hover:bg-orange-50/50 transition">
                  <td className="px-6 py-4 font-semibold text-gray-800">{t.name}</td>
                  <td className="px-6 py-4 text-gray-500">{t.email || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-500">{t.phone}</td>
                  <td className="px-6 py-4 text-gray-500">{displayBloodGroup(t.blood_group)}</td>
                  <td className="px-6 py-4 text-gray-500">{t.rooms?.room_number || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-500">{t.property?.name || 'N/A'}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 capitalize">{(t.status || 'unknown').replaceAll('_', ' ')}</span></td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.id}</td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => setSearchDetail({ group: 'Tenant', item: t })} className="text-blue-600 hover:text-blue-800 font-semibold text-xs uppercase tracking-wider">View</button>
                    <button onClick={() => deleteTenant(t.id, t.user_id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button>
                  </td>
                </tr>
              )}
              emptyMessage="No tenant rows are visible. Apply the admin RLS migration if tenants exist in Supabase."
            />
          </div>
        )}

        {/* ----- OWNERS ----- */}
        {activeTab === 'owners' && (
          <AdminTable
            loading={ownersLoading}
            headers={['Owner Name', 'Email', 'Owner ID (UUID)', 'Status', 'Actions']}
            data={owners}
            renderRow={(o) => (
              <tr key={o.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{o.full_name}</td>
                <td className="px-6 py-4 text-gray-500">{o.email}</td>
                <td className="px-6 py-4 font-mono text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 inline-block">{o.id}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${o.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {o.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => viewOwnerDetails(o)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs uppercase tracking-wider">View</button>
                  <button onClick={() => toggleOwnerStatus(o.id, o.is_active)} className={`font-semibold text-xs uppercase tracking-wider ${o.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                    {o.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            )}
            emptyMessage="No owners registered yet."
          />
        )}

        {/* ----- USERS ----- */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-[#1a1a1a]">👤 User Management</h3>
              <div className="flex gap-4 w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="🔍 Search name, email, phone..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                </select>
              </div>
            </div>

            <AdminTable
              loading={usersLoading}
              headers={['Full Name', 'Email', 'Role', 'Status', 'Actions']}
              data={users}
              renderRow={(u) => (
                <tr key={u.id} className="hover:bg-orange-50/50 transition">
                  <td className="px-6 py-4 font-semibold text-gray-800">{u.full_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-gray-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-red-100 text-red-700' :
                      u.role === 'owner' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex flex-wrap gap-2">
                    <button 
                      onClick={() => toggleUserStatus(u.id, u.is_active)} 
                      className={`font-semibold text-xs uppercase tracking-wider ${u.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <select
                      onChange={(e) => changeUserRole(u.id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Change Role</option>
                      <option value="tenant">Tenant</option>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              )}
              emptyMessage="No users found matching your search."
            />
          </div>
        )}

        {/* ----- PAYMENTS ----- */}
        {activeTab === 'payments' && (
          <AdminTable
            loading={paymentsLoading}
            headers={['Tenant', 'Amount', 'Date', 'Status', 'Actions']}
            data={payments}
            renderRow={(p) => (
              <tr key={p.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{p.tenants?.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-emerald-600 font-bold">{formatCurrency(p.amount)}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${p.status === 'success' ? 'bg-emerald-100 text-emerald-700' : p.status === 'payment_pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {p.status === 'payment_pending' ? 'Pending' : p.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  {p.status === 'payment_pending' && (
                    <>
                      <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`payment:${p.id}`, () => confirmPayment(p.id))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `payment:${p.id}` ? 'Processing…' : 'Confirm'}</button>
                      <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`payment:${p.id}`, () => rejectPayment(p.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `payment:${p.id}` ? 'Processing…' : 'Reject'}</button>
                    </>
                  )}
                </td>
              </tr>
            )}
            emptyMessage="No payments found."
          />
        )}

        {/* ----- PRE-BOOKINGS ----- */}
        {activeTab === 'prebookings' && (
          <AdminTable
            loading={preBookingsLoading}
            headers={['Name', 'Room', 'Property', 'Fee', 'Actions']}
            data={preBookings}
            renderRow={(b) => (
              <tr key={b.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{b.name}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.properties?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{formatCurrency(b.pre_booking_fee_amount || 0)}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`prebooking:${b.id}`, () => approvePreBooking(b.id, b.user_id, b.room_id, b.property_id, b.name, b.phone, b.email, b.rooms?.monthly_rent))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `prebooking:${b.id}` ? 'Processing…' : 'Approve'}</button>
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`prebooking:${b.id}`, () => rejectPreBooking(b.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `prebooking:${b.id}` ? 'Processing…' : 'Reject'}</button>
                </td>
              </tr>
            )}
            emptyMessage="No pre-bookings found."
          />
        )}

        {/* ----- APPLICATIONS ----- */}
        {activeTab === 'applications' && (
          <AdminTable
            loading={applicationsLoading}
            headers={['Applicant', 'Room', 'Rent / Deposit', 'Payment Verification', 'Actions']}
            data={applications}
            renderRow={(a) => (
              <tr key={a.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4"><p className="font-semibold text-gray-800">{a.name}</p><p className="text-sm text-gray-500">{a.phone}</p></td>
                <td className="px-6 py-4 text-gray-500">{a.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500"><p>Rent: {formatCurrency(a.rooms?.monthly_rent || 0)}</p><p>Deposit: {formatCurrency(a.payment_amount || 0)}</p></td>
                <td className="px-6 py-4 text-sm text-gray-500"><p>UTR: <span className="font-medium text-slate-700">{a.payment_transaction_id || a.upi_transaction_id || 'Not provided'}</span></p><p>Submitted: {new Date(a.payment_date || a.created_at).toLocaleDateString()}</p><p className="capitalize">Status: {(a.payment_status || 'pending verification').replaceAll('_', ' ')}</p>{a.payment_screenshot ? <button type="button" onClick={() => setApplicationProof({ url: a.payment_screenshot, name: a.name })} className="mt-2 rounded-lg border border-blue-200 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">View payment proof</button> : <p className="mt-1 text-xs text-red-500">Proof unavailable</p>}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`application:${a.id}`, () => approveApplication(a, a.user_id))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `application:${a.id}` ? 'Processing…' : 'Approve'}</button>
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`application:${a.id}`, () => rejectApplication(a.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `application:${a.id}` ? 'Processing…' : 'Reject'}</button>
                </td>
              </tr>
            )}
            emptyMessage="No pending applications."
          />
        )}

        {/* ----- APPROVED APPLICATIONS ----- */}
        {activeTab === 'approvedapps' && (
          <AdminTable
            loading={approvedAppsLoading}
            headers={['Name', 'Room', 'Status', 'Processed']}
            data={approvedApps}
            renderRow={(a) => (
              <tr key={a.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{a.name}</td>
                <td className="px-6 py-4 text-gray-500">{a.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${a.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{a.processed_at ? new Date(a.processed_at).toLocaleDateString() : 'N/A'}</td>
              </tr>
            )}
            emptyMessage="No processed applications yet."
          />
        )}

        {/* ----- COMPLAINTS ----- */}
        {activeTab === 'complaints' && (
          <AdminTable
            loading={complaintsLoading}
            headers={['Title', 'Tenant', 'Status', 'Actions']}
            data={complaints}
            renderRow={(c) => (
              <tr key={c.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{c.title}</td>
                <td className="px-6 py-4 text-gray-500">{c.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`complaint:${c.id}`, () => resolveComplaint(c.id))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `complaint:${c.id}` ? 'Processing…' : 'Resolve'}</button>
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`complaint:${c.id}`, () => deleteComplaint(c.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `complaint:${c.id}` ? 'Processing…' : 'Delete'}</button>
                </td>
              </tr>
            )}
            emptyMessage="No complaints in the system."
          />
        )}

        {/* ----- VACATE ----- */}
        {activeTab === 'vacate' && (
          <AdminTable
            loading={vacateLoading}
            headers={['Tenant', 'Room', 'Checkout Date', 'Status', 'Actions']}
            data={vacateRequests}
            renderRow={(v) => (
              <tr key={v.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{v.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{v.tenants?.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(v.expected_check_out).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${v.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  {v.status === 'pending' && (
                    <>
                      <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`vacate:${v.id}`, () => approveVacate(v.id, v.tenant_id, v.expected_check_out))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `vacate:${v.id}` ? 'Processing…' : 'Approve'}</button>
                      <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`vacate:${v.id}`, () => rejectVacate(v.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `vacate:${v.id}` ? 'Processing…' : 'Reject'}</button>
                    </>
                  )}
                </td>
              </tr>
            )}
            emptyMessage="No vacate requests found."
          />
        )}

        {/* ----- ROOM CHANGE ----- */}
        {activeTab === 'roomchange' && (
          <AdminTable
            loading={roomChangesLoading}
            headers={['Tenant', 'Old Room', 'New Room', 'Actions']}
            data={roomChanges}
            renderRow={(r) => (
              <tr key={r.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{r.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.old_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.new_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`roomchange:${r.id}`, () => approveRoomChange(r.id, r.tenant_id, r.new_room_id, r.old_room_id))} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `roomchange:${r.id}` ? 'Processing…' : 'Approve'}</button>
                  <button disabled={Boolean(actionKey)} onClick={() => runAdminAction(`roomchange:${r.id}`, () => rejectRoomChange(r.id))} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider disabled:opacity-50">{actionKey === `roomchange:${r.id}` ? 'Processing…' : 'Reject'}</button>
                </td>
              </tr>
            )}
            emptyMessage="No room change requests found."
          />
        )}

        {/* ----- NOTICES ----- */}
        {activeTab === 'notices' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold text-[#1a1a1a] mb-4">📢 Post Global Notice</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" placeholder="Notice Title" value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <div className="flex gap-4 items-center">
                  <select value={noticeForm.type} onChange={(e) => setNoticeForm({ ...noticeForm, type: e.target.value })} className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="general">General</option>
                    <option value="urgent">Urgent</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={noticeForm.is_urgent} onChange={(e) => setNoticeForm({ ...noticeForm, is_urgent: e.target.checked })} className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    Urgent
                  </label>
                </div>
              </div>
              <textarea placeholder="Notice Content" rows="3" value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} className="w-full mt-4 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button onClick={async () => { if (isSubmitting) return; setIsSubmitting(true); try { const posted = await postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent); if (posted) setNoticeForm({ title:'', content:'', type:'general', is_urgent:false }); } finally { setIsSubmitting(false); } }} disabled={isSubmitting} className="mt-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2 rounded-full font-semibold transition shadow-md disabled:opacity-50">{isSubmitting ? 'Posting…' : 'Post Notice'}</button>
            </div>
            <AdminTable loading={noticesLoading} headers={['Title', 'Type', 'Date', 'Actions']} data={notices} renderRow={(n) => (
              <tr key={n.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{n.title} {n.is_urgent && <span className="ml-2 text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full">URGENT</span>}</td>
                <td className="px-6 py-4 capitalize text-gray-500">{n.type}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(n.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4"><button onClick={() => deleteNotice(n.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button></td>
              </tr>
            )} emptyMessage="No global notices posted." />
          </div>
        )}

        {/* ----- MEMBERSHIP MANAGEMENT (USING THE MODULAR COMPONENT) ----- */}
        {activeTab === 'membership' && (
          <MembershipManager 
            owners={membershipOwners}
            requests={membershipRequests}
            loading={membershipLoading}
            processingId={membershipProcessingId}
            getDaysLeft={getDaysLeft}
            sendRenewalEmail={sendRenewalEmail}
            grantMembership={grantMembership}
            revokeMembership={revokeMembership}
            reviewRequest={reviewRequest}
            onRefresh={() => refreshMemberships(false)}
          />
        )}
        </div>
      </div>

      {/* ----- DETAIL MODALS ----- */}
      <DetailModal 
        isOpen={!!selectedProperty} 
        onClose={closeModals} 
        title="Property Details" 
        data={selectedProperty} 
      />
      <DetailModal 
        isOpen={!!selectedOwner} 
        onClose={closeModals} 
        title="Owner Details" 
        data={selectedOwner} 
      />
      <DetailModal
        isOpen={!!searchDetail}
        onClose={() => setSearchDetail(null)}
        title={`${searchDetail?.group || 'Search'} Details`}
        data={searchDetail?.item}
      />
      {applicationProof && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-proof-title" onClick={() => setApplicationProof(null)}><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h2 id="admin-proof-title" className="font-bold text-slate-900">Payment proof · {applicationProof.name}</h2><button type="button" onClick={() => setApplicationProof(null)} className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400" aria-label="Close payment proof">Close</button></div><img src={applicationProof.url} alt={`Payment proof submitted by ${applicationProof.name}`} className="mx-auto max-h-[75vh] max-w-full rounded-xl border object-contain" /></div></div>}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminProvider>
      <AdminDashboardContent />
    </AdminProvider>
  );
}
