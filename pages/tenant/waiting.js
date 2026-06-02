import { useRouter } from 'next/router'
import { motion } from 'framer-motion'

export default function WaitingPage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-secondary rounded-2xl p-8 max-w-md w-full text-center border border-gray-800">
        <div className="text-6xl mb-4 animate-float">⏳</div>
        <h1 className="text-2xl font-bold text-gray-200 mb-2">Waiting for Room Assignment</h1>
        <p className="text-gray-400 mb-4">Your tenant account has been created successfully!</p>
        <p className="text-gray-400 mb-6">Please wait for the PG owner to assign you a room.</p>
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-yellow-400">📌 What to do next:</p>
          <ul className="text-sm text-gray-400 mt-2 space-y-1">
            <li>• Contact your PG owner with your registered phone number</li>
            <li>• Owner will assign you a room from their dashboard</li>
            <li>• You will see your room details here once assigned</li>
            <li>• Then you can pay rent and raise complaints</li>
          </ul>
        </div>
        <button onClick={handleLogout} className="btn-primary w-full">Logout</button>
      </motion.div>
    </div>
  )
}
