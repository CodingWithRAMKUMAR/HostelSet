import AdminGlobalSearch from '../AdminGlobalSearch'
import { AdminMobilePage } from './AdminMobileShell'

export default function AdminMobileSearch({ avatar = 'A', onBack, onProfile, onOpen }) {
  return (
    <AdminMobilePage title="Global search" subtitle="Search platform records" avatar={avatar} onBack={onBack} onProfile={onProfile}>
      <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <p className="mb-2 text-xs font-black text-slate-900">Find anything</p>
        <AdminGlobalSearch onOpen={onOpen} />
      </section>
    </AdminMobilePage>
  )
}
