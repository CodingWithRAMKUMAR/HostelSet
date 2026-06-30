import dynamic from 'next/dynamic'
export default dynamic(() => import('./InteractiveLocationPicker'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-100" /> })
