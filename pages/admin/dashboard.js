import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { AdminProvider, useAdmin } from '../../context/AdminContext';
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
import toast from 'react-hot-toast';

// ----------------- UTILITY TABLE COMPONENT -----------------
const AdminTable = ({ headers, data, renderRow, emptyMessage }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#1a1a1a] text-white/90 border-b border-orange-500/30">
          <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4 whitespace-nowrap font-medium tracking-wide">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
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
  if (!isOpen || !data) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-orange-500/20">
        <div className="bg-[#1a1a1a] p-5 flex justify-between items-center border-b border-orange-500/30">
          <h3 className="text-white text-lg font-bold tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold">&times;</button>
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
  const { globalStats, refreshStats } = useAdmin();
  
  // ALL HOOKS
  const { properties, deleteProperty } = useAdminProperties();
  const { tenants, deleteTenant } = useAdminTenants();
  const { owners, toggleOwnerStatus } = useAdminOwners();
  const { users, loading: usersLoading, searchTerm, setSearchTerm, roleFilter, setRoleFilter, toggleUserStatus, changeUserRole } = useAdminUsers();
  const { payments, confirmPayment, rejectPayment } = useAdminPayments();
  const { preBookings, approvePreBooking, rejectPreBooking } = useAdminPreBookings();
  const { applications, approveApplication, rejectApplication } = useAdminApplications();
  const { approvedApps } = useAdminApprovedApplications();
  const { complaints, resolveComplaint, deleteComplaint } = useAdminComplaints();
  const { vacateRequests, approveVacate, rejectVacate } = useAdminVacate();
  const { roomChanges, approveRoomChange, rejectRoomChange } = useAdminRoomChange();
  const { notices, postNotice, deleteNotice } = useAdminNotices();
  const { owners: membershipOwners, loading: membershipLoading, getDaysLeft, sendRenewalEmail } = useAdminMembershipManager();
  const { selectedProperty, selectedOwner, viewPropertyDetails, viewOwnerDetails, closeModals } = useAdminModals();

  const [activeTab, setActiveTab] = useState('overview');
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  // STATS CARDS
  const statsData = [
    { label: 'Properties', value: globalStats.totalProperties, icon: '🏢', color: 'bg-orange-100 text-orange-600' },
    { label: 'Active Tenants', value: globalStats.totalTenants, icon: '👥', color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Revenue', value: formatCurrency(globalStats.totalRevenue), icon: '💰', color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Pending Complaints', value: globalStats.pendingComplaints, icon: '🔧', color: 'bg-red-100 text-red-600' },
    { label: 'Pending Vacates', value: globalStats.pendingVacates, icon: '🚪', color: 'bg-amber-100 text-amber-600' },
  ];

  // TABS
  const tabs = [
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans selection:bg-orange-500 selection:text-white">
      
      {/* ----- NAVBAR ----- */}
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-6 py-4 shadow-md border-b-2 border-orange-500/80">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">🏠 HOSTELSET</h1>
            <span className="text-xs bg-[#2a2a2a] text-orange-400/90 border border-orange-500/30 px-3 py-1 rounded-full ml-2">Admin Control</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => refreshStats()} className="text-orange-400 hover:text-orange-300 text-sm font-medium transition">🔄 Refresh</button>
            <button onClick={handleLogout} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-1.5 rounded-full font-semibold transition shadow-md">Logout</button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        
        {/* ----- STATS CARDS ----- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statsData.map((stat, index) => (
            <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-gray-200/50 hover:shadow-md hover:border-orange-200 transition duration-200 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold">{stat.label}</p>
                <p className="text-xl font-bold text-gray-800 tracking-tight">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ----- TABS ----- */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#1a1a1a] text-white shadow-sm border-b-2 border-orange-500'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ----- OVERVIEW ----- */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-50 to-transparent rounded-full -mr-20 -mt-20 opacity-50" />
            <div className="text-6xl mb-4 relative z-10">🚀</div>
            <h2 className="text-3xl font-bold text-[#1a1a1a] mb-2 relative z-10">Welcome to the Control Center</h2>
            <p className="text-gray-500 relative z-10">All data is live. <span className="text-orange-500 font-semibold">Real-time updates</span> active.</p>
          </div>
        )}

        {/* ----- PROPERTIES ----- */}
        {activeTab === 'properties' && (
          <AdminTable
            headers={['Property Name', 'Owner', 'Property ID (UUID)', 'Actions']}
            data={properties}
            renderRow={(p) => (
              <tr key={p.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{p.name}</td>
                <td className="px-6 py-4">{p.users?.full_name || 'N/A'}</td>
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
          <AdminTable
            headers={['Tenant Name', 'Phone', 'Room', 'Property', 'Actions']}
            data={tenants}
            renderRow={(t) => (
              <tr key={t.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{t.name}</td>
                <td className="px-6 py-4 text-gray-500">{t.phone}</td>
                <td className="px-6 py-4 text-gray-500">{t.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{t.property?.name || 'N/A'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => deleteTenant(t.id, t.user_id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No tenants in the system yet."
          />
        )}

        {/* ----- OWNERS ----- */}
        {activeTab === 'owners' && (
          <AdminTable
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

        {/* ----- USERS (Fully Modular with Search, Filter, and Role Controls) ----- */}
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
                      <button onClick={() => confirmPayment(p.id, p.tenant_id, p.amount)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Confirm</button>
                      <button onClick={() => rejectPayment(p.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Reject</button>
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
            headers={['Name', 'Room', 'Property', 'Fee', 'Actions']}
            data={preBookings}
            renderRow={(b) => (
              <tr key={b.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{b.name}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.properties?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{formatCurrency(b.pre_booking_fee_amount || 0)}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approvePreBooking(b.id, b.user_id, b.room_id, b.property_id, b.name, b.phone, b.email, b.rooms?.monthly_rent)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Approve</button>
                  <button onClick={() => rejectPreBooking(b.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Reject</button>
                </td>
              </tr>
            )}
            emptyMessage="No pre-bookings found."
          />
        )}

        {/* ----- APPLICATIONS ----- */}
        {activeTab === 'applications' && (
          <AdminTable
            headers={['Name', 'Phone', 'Room', 'Actions']}
            data={applications}
            renderRow={(a) => (
              <tr key={a.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{a.name}</td>
                <td className="px-6 py-4 text-gray-500">{a.phone}</td>
                <td className="px-6 py-4 text-gray-500">{a.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approveApplication(a, a.user_id)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Approve</button>
                  <button onClick={() => rejectApplication(a.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Reject</button>
                </td>
              </tr>
            )}
            emptyMessage="No pending applications."
          />
        )}

        {/* ----- APPROVED APPLICATIONS ----- */}
        {activeTab === 'approvedapps' && (
          <AdminTable
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
                  <button onClick={() => resolveComplaint(c.id)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Resolve</button>
                  <button onClick={() => deleteComplaint(c.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No complaints in the system."
          />
        )}

        {/* ----- VACATE ----- */}
        {activeTab === 'vacate' && (
          <AdminTable
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
                      <button onClick={() => approveVacate(v.id, v.tenant_id, v.expected_check_out)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Approve</button>
                      <button onClick={() => rejectVacate(v.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Reject</button>
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
            headers={['Tenant', 'Old Room', 'New Room', 'Actions']}
            data={roomChanges}
            renderRow={(r) => (
              <tr key={r.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{r.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.old_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.new_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approveRoomChange(r.id, r.tenant_id, r.new_room_id, r.old_room_id)} className="text-emerald-600 hover:text-emerald-800 font-semibold text-xs uppercase tracking-wider">Approve</button>
                  <button onClick={() => rejectRoomChange(r.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Reject</button>
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
              <button onClick={async () => { setIsSubmitting(true); await postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent); setNoticeForm({ title:'', content:'', type:'general', is_urgent:false }); setIsSubmitting(false); }} disabled={isSubmitting} className="mt-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2 rounded-full font-semibold transition shadow-md disabled:opacity-50">Post Notice</button>
            </div>
            <AdminTable headers={['Title', 'Type', 'Date', 'Actions']} data={notices} renderRow={(n) => (
              <tr key={n.id} className="hover:bg-orange-50/50 transition">
                <td className="px-6 py-4 font-semibold text-gray-800">{n.title} {n.is_urgent && <span className="ml-2 text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full">URGENT</span>}</td>
                <td className="px-6 py-4 capitalize text-gray-500">{n.type}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(n.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4"><button onClick={() => deleteNotice(n.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Delete</button></td>
              </tr>
            )} emptyMessage="No global notices posted." />
          </div>
        )}

        {/* ----- MEMBERSHIP MANAGEMENT ----- */}
        {activeTab === 'membership' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 border-b border-gray-100 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">📋 Membership Overview</h3>
                <p className="text-sm text-gray-500">View active/expired memberships and send renewal alerts.</p>
              </div>
              <button onClick={() => window.location.reload()} className="text-orange-500 hover:text-orange-600 text-sm font-medium">🔄 Refresh</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#1a1a1a] text-white/90 border-b border-orange-500/30">
                  <tr>
                    <th className="px-6 py-4 font-medium tracking-wide">Owner Name</th>
                    <th className="px-6 py-4 font-medium tracking-wide">Email</th>
                    <th className="px-6 py-4 font-medium tracking-wide">Membership Status</th>
                    <th className="px-6 py-4 font-medium tracking-wide">Days Left</th>
                    <th className="px-6 py-4 font-medium tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {membershipLoading ? (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400">Loading membership data...</td></tr>
                  ) : membershipOwners.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400">No owners found.</td></tr>
                  ) : (
                    membershipOwners.map((owner) => {
                      const property = owner.properties?.[0];
                      const isActive = property?.membership_active;
                      const daysLeft = getDaysLeft(property?.membership_expiry);
                      
                      let statusColor = 'bg-gray-100 text-gray-700';
                      let statusText = 'Inactive';

                      if (isActive && daysLeft > 7) {
                        statusColor = 'bg-emerald-100 text-emerald-700';
                        statusText = 'Active';
                      } else if (isActive && daysLeft <= 7 && daysLeft > 0) {
                        statusColor = 'bg-amber-100 text-amber-700';
                        statusText = `Expires in ${daysLeft} days`;
                      } else if (isActive && daysLeft <= 0) {
                        statusColor = 'bg-red-100 text-red-700';
                        statusText = 'Expired';
                      }

                      return (
                        <tr key={owner.id} className="hover:bg-orange-50/50 transition">
                          <td className="px-6 py-4 font-semibold text-gray-800">{owner.full_name}</td>
                          <td className="px-6 py-4 text-gray-500">{owner.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {isActive && daysLeft !== null ? `${daysLeft} days` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => sendRenewalEmail(owner.id, owner.email, owner.full_name)}
                              className="text-orange-600 hover:text-orange-800 font-semibold text-xs uppercase tracking-wider"
                            >
                              Send Renewal
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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