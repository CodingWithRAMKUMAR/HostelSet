import BrandLogo from '../BrandLogo'
import DashboardIcon from './DashboardIcon'
export default function DashboardSidebar({ role, items, activeId, onSelect, footer }) {
  return <aside className="dashboard-sidebar"><div className="dashboard-sidebar-brand"><BrandLogo priority /><span>{role}</span></div><nav aria-label={`${role} dashboard navigation`} className="dashboard-sidebar-nav">{items.map(item => <button key={item.id} type="button" disabled={item.disabled} aria-current={activeId === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)} className={activeId === item.id ? 'active' : ''}><DashboardIcon name={item.icon}/><span>{item.label.replace(/ \(.*\)$/, '')}</span>{item.badge > 0 && <b>{item.badge > 99 ? '99+' : item.badge}</b>}</button>)}</nav>{footer && <div className="dashboard-sidebar-footer">{footer}</div>}</aside>
}
