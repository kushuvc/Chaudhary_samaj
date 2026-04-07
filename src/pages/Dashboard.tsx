export default function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-500 text-sm font-medium">Section {i}</div>
            <div className="text-3xl font-bold text-primary-600 mt-2">{i * 10}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
