import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export default function OccupancyChart({ data, colors }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-4">🏠 Occupancy Breakdown</h2>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
            {data.map((entry, idx) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
          </Pie>
          <Legend wrapperStyle={{ color: '#fff' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
