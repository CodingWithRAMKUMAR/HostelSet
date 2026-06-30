import dynamic from 'next/dynamic'
export default dynamic(() => import('./NearbyHostelMapClient'), { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" /> })
