export default function MobileBottomNav({ items, activeId, onSelect }) {
  return <nav aria-label="Mobile dashboard navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
    <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">{items.map(item => <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={activeId === item.id ? 'page' : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${activeId === item.id ? 'bg-orange-50 text-orange-700' : 'text-slate-500'}`}><span aria-hidden="true" className="text-base leading-none">{item.icon}</span><span className="w-full truncate">{item.label}</span></button>)}</div>
  </nav>
}
