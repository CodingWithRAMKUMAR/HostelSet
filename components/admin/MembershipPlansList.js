export default function MembershipPlansList({ plans, onEdit }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {plans.map(plan => (
        <div key={plan.id} className="bg-gray-900 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold">{plan.name}</h2>
          <p className="text-3xl font-bold text-purple-400">₹{plan.price}<span className="text-sm text-gray-400">/{plan.id === 'monthly' ? 'month' : 'year'}</span></p>
          <ul className="mt-4 space-y-1 text-gray-300">
            {plan.features?.map((f, i) => <li key={i}>✓ {f}</li>)}
          </ul>
          <button onClick={() => onEdit(plan)} className="mt-4 bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">Edit Plan</button>
        </div>
      ))}
    </div>
  )
}
