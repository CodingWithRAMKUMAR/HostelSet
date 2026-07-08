import { useEffect } from 'react'
import BrandLogo from '../BrandLogo'

const DEFAULT_GROUP = 'Menu'

function groupItems(items = []) {
  return items.reduce((groups, item) => {
    const name = item.group || DEFAULT_GROUP
    const existing = groups.find(group => group.name === name)
    if (existing) existing.items.push(item)
    else groups.push({ name, items: [item] })
    return groups
  }, [])
}

export default function DashboardMoreMenu({ open, title = 'More', subtitle, items = [], onClose }) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined

    const previousOverflow = document.body.style.overflow
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose?.()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const groups = groupItems(items)

  const selectItem = item => {
    onClose?.()
    window.requestAnimationFrame(() => {
      item.onClick?.()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <div className="dashboard-more-overlay lg:hidden" role="presentation">
      <button type="button" className="dashboard-more-backdrop" onClick={onClose} aria-label="Close menu" />
      <aside role="dialog" aria-modal="true" aria-labelledby="dashboard-more-title" className="dashboard-more-drawer">
        <header className="dashboard-more-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="dashboard-more-logo"><BrandLogo size="mobile" priority /></div>
            <div className="min-w-0">
              <h2 id="dashboard-more-title" className="truncate text-base font-black text-slate-950">{title}</h2>
              <p className="truncate text-xs font-medium text-slate-500">{subtitle || 'HostelSet dashboard'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="dashboard-more-close" aria-label="Close menu">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="dashboard-more-groups">
          {groups.map(group => (
            <section key={group.name} className="dashboard-more-group" aria-label={group.name}>
              <p className="dashboard-more-group-title">{group.name}</p>
              <div className="dashboard-more-list">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`dashboard-more-item ${item.danger ? 'danger' : ''}`}
                  >
                    <span className="dashboard-more-item-dot" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  )
}
