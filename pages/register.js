import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Register() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    propertyName: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    propertyType: 'Boys',
    totalRooms: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      alert('Registration submitted! We will contact you within 24 hours.')
      router.push('/login')
      setLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-primary p-6 text-white text-center">
            <h1 className="text-2xl font-bold">Register Your Property</h1>
            <p className="text-white/80 mt-1">Join India's fastest-growing PG network</p>
          </div>

          <div className="p-8">
            {/* Progress Steps */}
            <div className="flex justify-between mb-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-1 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto font-bold ${
                    step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {s}
                  </div>
                  <p className="text-xs mt-2 text-gray-500">
                    {s === 1 ? 'Property' : s === 2 ? 'Owner' : 'Submit'}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <div className="space-y-4">
                  <input
                    type="text"
                    name="propertyName"
                    placeholder="Property Name"
                    className="input"
                    value={formData.propertyName}
                    onChange={handleChange}
                    required
                  />
                  <input
                    type="text"
                    name="address"
                    placeholder="Full Address"
                    className="input"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="city"
                      placeholder="City"
                      className="input"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                    <input
                      type="text"
                      name="pincode"
                      placeholder="Pincode"
                      className="input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      name="propertyType"
                      className="input"
                      value={formData.propertyType}
                      onChange={handleChange}
                    >
                      <option>Boys PG</option>
                      <option>Girls PG</option>
                      <option>Co-ed PG</option>
                    </select>
                    <input
                      type="number"
                      name="totalRooms"
                      placeholder="Total Rooms"
                      className="input"
                      value={formData.totalRooms}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <input
                    type="text"
                    name="ownerName"
                    placeholder="Owner Name"
                    className="input"
                    value={formData.ownerName}
                    onChange={handleChange}
                    required
                  />
                  <div className="flex gap-2">
                    <span className="bg-gray-100 px-4 py-3 rounded-lg border">+91</span>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="9876543210"
                      className="input flex-1"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <input
                    type="email"
                    name="email"
                    placeholder="Email Address"
                    className="input"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-primary/10 rounded-xl p-4">
                    <h3 className="font-semibold text-primary mb-2">✨ Benefits of registering</h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li>✓ Free listing for 30 days</li>
                      <li>✓ Priority support</li>
                      <li>✓ Verified badge after KYC</li>
                      <li>✓ Access to tenant applications</li>
                      <li>✓ Marketing on social media</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600">Summary:</p>
                    <p className="font-semibold mt-2">{formData.propertyName || 'Property Name'}</p>
                    <p className="text-sm text-gray-500">{formData.city || 'City'}</p>
                    <p className="text-sm text-gray-500">{formData.totalRooms} rooms • {formData.propertyType} PG</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="flex-1 border-2 border-primary text-primary py-3 rounded-xl font-semibold hover:bg-primary hover:text-white transition"
                  >
                    ← Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-opacity-90 transition"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Complete Registration →'}
                  </button>
                )}
              </div>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-primary hover:underline">
                Already have an account? Login here
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
