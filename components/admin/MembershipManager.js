import { useState } from 'react';
import toast from 'react-hot-toast';

export default function MembershipManager({
  owners,
  loading,
  getDaysLeft,
  sendRenewalEmail,
  grantMembership,
  revokeMembership,
  onRefresh,
}) {
  const [manualGrantId, setManualGrantId] = useState('');
  const [manualGrantDays, setManualGrantDays] = useState('');
  const [manualRevokeId, setManualRevokeId] = useState('');

  const copyOwnerId = async (ownerId) => {
    try {
      await navigator.clipboard.writeText(ownerId);
      toast.success('Owner UUID copied');
    } catch (error) {
      toast.error('Could not copy UUID');
    }
  };

  const handleGrant = () => {
    // Trim whitespace just in case
    const id = manualGrantId.trim();
    const days = parseInt(manualGrantDays);

    if (!id) {
      toast.error('Please paste an Owner UUID.');
      return;
    }
    if (!days || days < 1) {
      toast.error('Please enter a valid number of days (minimum 1).');
      return;
    }

    grantMembership(id, days);
    
    // Clear inputs on success
    setManualGrantId('');
    setManualGrantDays('');
  };

  const handleRevoke = () => {
    const id = manualRevokeId.trim();

    if (!id) {
      toast.error('Please paste an Owner UUID.');
      return;
    }

    revokeMembership(id);
    
    setManualRevokeId('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6 border-b border-gray-100 pb-4 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">📋 Membership Overview</h3>
          <p className="text-sm text-gray-500">View active/expired memberships, send renewal alerts, or grant/revoke manually.</p>
        </div>
        <button onClick={onRefresh} className="text-orange-500 hover:text-orange-600 text-sm font-medium">🔄 Refresh</button>
      </div>

      <div className="mb-8 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="font-semibold text-gray-800 mb-3 text-sm">🔧 Manual Membership Control</h4>
        <div className="grid md:grid-cols-2 gap-4">
          {/* GRANT SECTION */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                id="manualGrantId"
                type="text"
                placeholder="Paste Owner UUID here"
                value={manualGrantId}
                onChange={(e) => setManualGrantId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <input
                id="manualGrantDays"
                type="number"
                placeholder="Days"
                value={manualGrantDays}
                onChange={(e) => setManualGrantDays(e.target.value)}
                className="w-24 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={handleGrant}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Grant Membership
            </button>
          </div>

          {/* REVOKE SECTION */}
          <div className="flex flex-col gap-2">
            <input
              id="manualRevokeId"
              type="text"
              placeholder="Paste Owner UUID here"
              value={manualRevokeId}
              onChange={(e) => setManualRevokeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            <button
              onClick={handleRevoke}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Revoke Membership
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#1a1a1a] text-white/90 border-b border-orange-500/30">
            <tr>
              <th className="px-6 py-4 font-medium tracking-wide">Owner Name</th>
              <th className="px-6 py-4 font-medium tracking-wide">Email</th>
              <th className="px-6 py-4 font-medium tracking-wide">Owner UUID</th>
              <th className="px-6 py-4 font-medium tracking-wide">Membership Status</th>
              <th className="px-6 py-4 font-medium tracking-wide">Days Left</th>
              <th className="px-6 py-4 font-medium tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">Loading membership data...</td></tr>
            ) : owners.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400">No owners found.</td></tr>
            ) : (
              owners.map((owner) => {
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
                      <div className="flex items-center gap-2 min-w-[250px]">
                        <code className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 select-all">{owner.id}</code>
                        <button
                          type="button"
                          onClick={() => copyOwnerId(owner.id)}
                          className="text-xs font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1.5 rounded-lg"
                          title="Copy owner UUID"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
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
  );
}
