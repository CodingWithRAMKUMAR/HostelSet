import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function WaitingPage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.clear()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-white to-secondary/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center"
      >
        <div className="text-6xl mb-4 animate-float">⏳</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Waiting for Room Assignment</h1>
        <p className="text-gray-500 mb-6">
          Your account has been created! Your PG owner will assign you a room soon.
          You will be able to see your room details once assigned.
        </p>
        <div className="bg-yellow-50 rounded-xl p-4 mb-6 text-left">
          <p className="text-sm text-yellow-700">📌 What to do next:</p>
          <ul className="text-sm text-gray-600 mt-2 space-y-1">
            <li>• Contact your PG owner with your registered phone number</li>
            <li>• Owner will assign you a room from their dashboard</li>
            <li>• Once assigned, you can pay rent and raise complaints</li>
          </ul>
        </div>
        <button
          onClick={handleLogout}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-opacity-90 transition"
        >
          Logout
        </button>
      </motion.div>
    </div>
  )
}
