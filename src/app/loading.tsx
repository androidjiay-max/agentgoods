export default function Loading() {
  return (
    <main className="min-h-screen bg-dark-bg text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pb-16 animate-pulse">
        {/* Header skeleton */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-5 border-b border-gray-800/50">
          <div>
            <div className="h-8 w-48 bg-white/5 rounded-lg" />
            <div className="h-3 w-32 bg-white/5 rounded mt-2" />
          </div>
          <div className="flex gap-3">
            <div className="h-14 w-36 bg-white/5 rounded-xl" />
            <div className="h-14 w-36 bg-white/5 rounded-xl" />
          </div>
        </header>

        {/* Quick actions skeleton */}
        <div className="flex gap-3 py-4 border-b border-gray-800/50">
          <div className="h-9 w-24 bg-white/5 rounded-lg" />
          <div className="h-9 w-28 bg-white/5 rounded-lg" />
          <div className="h-9 w-24 bg-white/5 rounded-lg" />
        </div>

        {/* Tab bar skeleton */}
        <div className="flex gap-1 mt-6 mb-8">
          <div className="h-10 w-28 bg-white/5 rounded-xl" />
          <div className="h-10 w-36 bg-white/5 rounded-xl" />
          <div className="h-10 w-28 bg-white/5 rounded-xl" />
        </div>

        {/* Content cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-white/5 rounded" />
                  <div className="h-3 w-24 bg-white/5 rounded mt-2" />
                </div>
                <div className="h-4 w-32 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
