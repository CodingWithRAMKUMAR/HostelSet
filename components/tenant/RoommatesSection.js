import { memo, useState } from 'react';
import { formatDate } from '../../lib/utils';

const statusStyles = {
  active: 'bg-emerald-100 text-emerald-700',
  notice_period: 'bg-amber-100 text-amber-700',
  payment_pending: 'bg-blue-100 text-blue-700',
};

const RoommatesSection = ({ roommates = [], room = null }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (roommates.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
        <div className="text-5xl mb-3">👤</div>
        <p className="font-semibold text-slate-800">You&apos;re currently the only tenant in this room</p>
        <p className="text-sm text-gray-400 mt-1">New roommates will appear here automatically.</p>
      </div>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-bold text-lg text-slate-800">👥 Your Roommates</h3>
          <p className="text-sm text-gray-500">Room {room?.room_number || '—'} · {roommates.length} roommate{roommates.length !== 1 ? 's' : ''}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {roommates.map((mate) => {
          const expanded = expandedId === mate.id;
          const initials = (mate.name || 'Roommate').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
          return (
            <article key={mate.id} className="border border-gray-200 rounded-2xl overflow-hidden transition hover:border-orange-200 hover:shadow-sm">
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-slate-700 to-slate-500 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-sm">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 truncate">{mate.name || 'Unnamed roommate'}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusStyles[mate.status] || 'bg-gray-100 text-gray-600'}`}>
                      {(mate.status || 'active').replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Joined {formatDate(mate.move_in_date)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : mate.id)}
                  aria-expanded={expanded}
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-50"
                >
                  {expanded ? 'Hide' : 'Details'}
                </button>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/70 p-5 grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Phone</p>
                    {mate.phone ? <a href={`tel:${mate.phone}`} className="font-medium text-slate-700 hover:text-orange-600">{mate.phone}</a> : <p className="text-gray-500">Not provided</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Email</p>
                    {mate.email ? <a href={`mailto:${mate.email}`} className="font-medium text-slate-700 hover:text-orange-600 break-all">{mate.email}</a> : <p className="text-gray-500">Not provided</p>}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Room</p>
                    <p className="font-medium text-slate-700">{room?.room_number || 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Move-in date</p>
                    <p className="font-medium text-slate-700">{formatDate(mate.move_in_date)}</p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default memo(RoommatesSection);
