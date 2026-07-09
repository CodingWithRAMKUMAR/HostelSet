const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  rooms: <><path d="M3 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M9 21v-6h6v6M7 8h.01M12 8h.01M17 8h.01"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2"/></>,
  notices: <><path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.1 13 21H7l-1.7-6"/></>,
  complaints: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/><path d="M12 7v4M12 15h.01"/></>,
  analytics: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a2 2 0 0 0 .4 2l-2.8 2.8a2 2 0 0 0-2-.4 2 2 0 0 0-1.4 1.6h-4A2 2 0 0 0 8 19.4a2 2 0 0 0-2 .4L3.2 17a2 2 0 0 0 .4-2A2 2 0 0 0 2 13.6v-4A2 2 0 0 0 3.6 8a2 2 0 0 0-.4-2L6 3.2a2 2 0 0 0 2 .4A2 2 0 0 0 9.6 2h4A2 2 0 0 0 15 3.6a2 2 0 0 0 2-.4L19.8 6a2 2 0 0 0-.4 2A2 2 0 0 0 21 9.6v4a2 2 0 0 0-1.6 1.4Z"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-6h6v6"/></>,
  requests: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
}
export default function DashboardIcon({ name, className = 'h-5 w-5' }) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name] || paths.dashboard}</svg> }
