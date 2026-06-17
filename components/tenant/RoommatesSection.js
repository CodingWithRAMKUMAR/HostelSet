import { formatDate } from '../../lib/utils'

export default function RoommatesSection({ roommates }) {
  if (roommates.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6 text-center py-12">
        <div className="text-5xl mb-3">👤</div>
        <p>You're the only person in this room</p>
        <p className="text-xs text-gray-400">Enjoy the privacy!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="font-semibold mb-4">👥 Your Roommates <span className="text-xs text-gray-400 ml-2">(Same Room Only)</span></h3>
      <div className="grid md:grid-cols-2 gap-4">
        {roommates.map((mate, idx) => (
          <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
              {mate.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold">{mate.name}</p>
              <p className="text-xs text-gray-500">📞 {mate.phone}</p>
              <p className="text-xs text-gray-400">Since {formatDate(mate.move_in_date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
