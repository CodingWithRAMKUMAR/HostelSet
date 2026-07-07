export default function DashboardSectionNav({ label, items, activeId, onSelect, disabled = false }) {
  return (
    <nav aria-label={label} className="mb-6 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            disabled={disabled || item.disabled}
            aria-current={activeId === item.id ? 'page' : undefined}
            onClick={() => onSelect(item.id)}
            className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-50 ${activeId === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
