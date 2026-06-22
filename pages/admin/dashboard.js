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
import toast from 'react-hot-toast';

// Reusable Table Component for the Admin UI
const AdminTable = ({ headers, data, renderRow, emptyMessage }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold">
          <tr>{headers.map((h, i) => <th key={i} className="px-6 py-4 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-6 py-12 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : (
            data.map((item, index) => renderRow(item, index))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

function AdminDashboardContent() {
  const router = useRouter();
  const { globalStats, refreshStats } = useAdmin();
  const { properties, deleteProperty } = useAdminProperties();
  const { tenants, deleteTenant } = useAdminTenants();
  const { owners, toggleOwnerStatus } = useAdminOwners();
  const { users, toggleUserStatus } = useAdminUsers();
  const { payments, confirmPayment, rejectPayment } = useAdminPayments();
  const { preBookings, approvePreBooking, rejectPreBooking } = useAdminPreBookings();
  const { applications, approveApplication, rejectApplication } = useAdminApplications();
  const { approvedApps } = useAdminApprovedApplications();
  const { complaints, resolveComplaint, deleteComplaint } = useAdminComplaints();
  const { vacateRequests, approveVacate, rejectVacate } = useAdminVacate();
  const { roomChanges, approveRoomChange, rejectRoomChange } = useAdminRoomChange();
  const { notices, postNotice, deleteNotice } = useAdminNotices();

  const [activeTab, setActiveTab] = useState('overview');
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', type: 'general', is_urgent: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  // Stats Cards Data
  const statsData = [
    { label: 'Total Properties', value: globalStats.totalProperties, icon: '🏢', color: 'bg-orange-100 text-orange-600' },
    { label: 'Active Tenants', value: globalStats.totalTenants, icon: '👥', color: 'bg-blue-100 text-blue-600' },
    { label: 'Total Revenue', value: formatCurrency(globalStats.totalRevenue), icon: '💰', color: 'bg-green-100 text-green-600' },
    { label: 'Pending Complaints', value: globalStats.pendingComplaints, icon: '🔧', color: 'bg-red-100 text-red-600' },
    { label: 'Pending Vacates', value: globalStats.pendingVacates, icon: '🚪', color: 'bg-yellow-100 text-yellow-600' },
  ];

  // Tab definitions
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
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navbar - Onyx Black with Golden Orange Accent */}
      <nav className="bg-[#1a1a1a] text-white sticky top-0 z-50 px-6 py-4 shadow-lg border-b-2 border-orange-500">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">🏠 <span className="text-orange-500">HOSTELSET</span> <span className="text-xs bg-gray-700 text-orange-400 px-2 py-1 rounded-full ml-2">Admin</span></h1>
          </div>
          <button onClick={handleLogout} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-full font-semibold transition shadow-md">Logout</button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards - Golden Orange Accent */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statsData.map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                <p className="text-lg font-bold text-gray-800">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs - Styled Onyx & Orange */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-[#1a1a1a] text-white border-b-2 border-orange-500'
                  : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to the Admin Control Center</h2>
            <p className="text-gray-500">Everything is updating in <span className="text-orange-500 font-semibold">real-time</span>.</p>
            <button onClick={refreshStats} className="mt-4 text-orange-600 hover:text-orange-700 text-sm font-semibold underline">Refresh Global Stats</button>
          </div>
        )}

        {/* ---------- TABULAR DATA TABLES ---------- */}
        {activeTab === 'properties' && (
          <AdminTable
            headers={['Property Name', 'Owner', 'Location', 'Rooms', 'Actions']}
            data={properties}
            renderRow={(p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                <td className="px-6 py-4">{p.users?.full_name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{p.address || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{p.total_rooms || 0}</td>
                <td className="px-6 py-4">
                  <button onClick={() => deleteProperty(p.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No properties registered yet."
          />
        )}

        {activeTab === 'tenants' && (
          <AdminTable
            headers={['Tenant Name', 'Phone', 'Room', 'Property', 'Actions']}
            data={tenants}
            renderRow={(t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{t.name}</td>
                <td className="px-6 py-4 text-gray-500">{t.phone}</td>
                <td className="px-6 py-4 text-gray-500">{t.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{t.property?.name || 'N/A'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => deleteTenant(t.id, t.user_id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No tenants in the system yet."
          />
        )}

        {activeTab === 'owners' && (
          <AdminTable
            headers={['Owner Name', 'Email', 'Phone', 'Status', 'Actions']}
            data={owners}
            renderRow={(o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{o.full_name}</td>
                <td className="px-6 py-4 text-gray-500">{o.email}</td>
                <td className="px-6 py-4 text-gray-500">{o.phone || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {o.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => toggleOwnerStatus(o.id, o.is_active)} className={`font-semibold text-xs ${o.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                    {o.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </td>
              </tr>
            )}
            emptyMessage="No owners registered yet."
          />
        )}

        {activeTab === 'users' && (
          <AdminTable
            headers={['User Name', 'Email', 'Role', 'Status', 'Actions']}
            data={users}
            renderRow={(u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{u.full_name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{u.email}</td>
                <td className="px-6 py-4 capitalize text-gray-500">{u.role}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => toggleUserStatus(u.id, u.is_active)} className={`font-semibold text-xs ${u.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            )}
            emptyMessage="No users found."
          />
        )}

        {activeTab === 'payments' && (
          <AdminTable
            headers={['Tenant', 'Amount', 'Date', 'Status', 'Actions']}
            data={payments}
            renderRow={(p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{p.tenants?.name || 'Unknown'}</td>
                <td className="px-6 py-4 text-green-600 font-semibold">{formatCurrency(p.amount)}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.status === 'success' ? 'bg-green-100 text-green-700' : p.status === 'payment_pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {p.status === 'payment_pending' ? 'Pending' : p.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  {p.status === 'payment_pending' && (
                    <>
                      <button onClick={() => confirmPayment(p.id, p.tenant_id, p.amount)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Confirm</button>
                      <button onClick={() => rejectPayment(p.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            )}
            emptyMessage="No payments found."
          />
        )}

        {activeTab === 'prebookings' && (
          <AdminTable
            headers={['Name', 'Room', 'Property', 'Fee', 'Actions']}
            data={preBookings}
            renderRow={(b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{b.name}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{b.rooms?.properties?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{formatCurrency(b.pre_booking_fee_amount || 0)}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approvePreBooking(b.id, b.user_id, b.room_id, b.property_id, b.name, b.phone, b.email, b.rooms?.monthly_rent)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Approve</button>
                  <button onClick={() => rejectPreBooking(b.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Reject</button>
                </td>
              </tr>
            )}
            emptyMessage="No pre-bookings found."
          />
        )}

        {activeTab === 'applications' && (
          <AdminTable
            headers={['Name', 'Phone', 'Room', 'Actions']}
            data={applications}
            renderRow={(a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{a.name}</td>
                <td className="px-6 py-4 text-gray-500">{a.phone}</td>
                <td className="px-6 py-4 text-gray-500">{a.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approveApplication(a, a.user_id)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Approve</button>
                  <button onClick={() => rejectApplication(a.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Reject</button>
                </td>
              </tr>
            )}
            emptyMessage="No pending applications."
          />
        )}

        {activeTab === 'approvedapps' && (
          <AdminTable
            headers={['Name', 'Room', 'Status', 'Processed Date']}
            data={approvedApps}
            renderRow={(a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{a.name}</td>
                <td className="px-6 py-4 text-gray-500">{a.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${a.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{a.processed_at ? new Date(a.processed_at).toLocaleDateString() : 'N/A'}</td>
              </tr>
            )}
            emptyMessage="No processed applications yet."
          />
        )}

        {activeTab === 'complaints' && (
          <AdminTable
            headers={['Title', 'Tenant', 'Status', 'Actions']}
            data={complaints}
            renderRow={(c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{c.title}</td>
                <td className="px-6 py-4 text-gray-500">{c.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.status === 'open' ? 'bg-red-100 text-red-700' : c.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => resolveComplaint(c.id)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Resolve</button>
                  <button onClick={() => deleteComplaint(c.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Delete</button>
                </td>
              </tr>
            )}
            emptyMessage="No complaints in the system."
          />
        )}

        {activeTab === 'vacate' && (
          <AdminTable
            headers={['Tenant', 'Room', 'Checkout Date', 'Status', 'Actions']}
            data={vacateRequests}
            renderRow={(v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{v.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{v.tenants?.rooms?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(v.expected_check_out).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${v.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  {v.status === 'pending' && (
                    <>
                      <button onClick={() => approveVacate(v.id, v.tenant_id, v.expected_check_out)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Approve</button>
                      <button onClick={() => rejectVacate(v.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            )}
            emptyMessage="No vacate requests found."
          />
        )}

        {activeTab === 'roomchange' && (
          <AdminTable
            headers={['Tenant', 'Old Room', 'New Room', 'Actions']}
            data={roomChanges}
            renderRow={(r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{r.tenants?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.old_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-500">{r.new_room?.room_number || 'N/A'}</td>
                <td className="px-6 py-4 flex gap-2">
                  <button onClick={() => approveRoomChange(r.id, r.tenant_id, r.new_room_id, r.old_room_id)} className="text-green-600 hover:text-green-800 font-semibold text-xs">Approve</button>
                  <button onClick={() => rejectRoomChange(r.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Reject</button>
                </td>
              </tr>
            )}
            emptyMessage="No room change requests found."
          />
        )}

        {activeTab === 'notices' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">📢 Post Global Notice</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Notice Title"
                  value={noticeForm.title}
                  onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex gap-4 items-center">
                  <select
                    value={noticeForm.type}
                    onChange={(e) => setNoticeForm({ ...noticeForm, type: e.target.value })}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="general">General</option>
                    <option value="urgent">Urgent</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={noticeForm.is_urgent}
                      onChange={(e) => setNoticeForm({ ...noticeForm, is_urgent: e.target.checked })}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    Urgent
                  </label>
                </div>
              </div>
              <textarea
                placeholder="Notice Content"
                rows="3"
                value={noticeForm.content}
                onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })}
                className="w-full mt-4 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={async () => {
                  setIsSubmitting(true);
                  await postNotice(noticeForm.title, noticeForm.content, noticeForm.type, noticeForm.is_urgent);
                  setNoticeForm({ title: '', content: '', type: 'general', is_urgent: false });
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting}
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-semibold transition shadow-md"
              >
                {isSubmitting ? 'Posting...' : 'Post Notice'}
              </button>
            </div>

            {/* Notice List */}
            <AdminTable
              headers={['Title', 'Type', 'Date', 'Actions']}
              data={notices}
              renderRow={(n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{n.title} {n.is_urgent && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Urgent</span>}</td>
                  <td className="px-6 py-4 capitalize text-gray-500">{n.type}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(n.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => deleteNotice(n.id)} className="text-red-500 hover:text-red-700 font-semibold text-xs">Delete</button>
                  </td>
                </tr>
              )}
              emptyMessage="No global notices posted."
            />
          </div>
        )}
      </div>
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
