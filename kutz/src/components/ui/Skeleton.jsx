/**
 * Shimmer skeleton for loading states.
 * Usage: <Skeleton h="h-4" w="w-32" /> or <Skeleton className="h-20 w-full rounded-xl" />
 */
export default function Skeleton({ className = '', h = 'h-4', w = 'w-full', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`${h} ${w} ${rounded} animate-pulse ${className}`}
      style={{ background: 'linear-gradient(90deg, #0a0f1a 25%, #1e293b 50%, #0a0f1a 75%)', backgroundSize: '200% 100%' }}
    />
  );
}

/** Pre-built skeleton for a MealGroup row */
export function FoodRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: '#1e293b' }}>
      <div className="flex-1 space-y-1.5">
        <Skeleton h="h-3" w="w-40" />
        <Skeleton h="h-2.5" w="w-28" />
      </div>
    </div>
  );
}

/** Pre-built skeleton for the Cockpit */
export function CockpitSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <Skeleton h="h-40" w="w-40" rounded="rounded-full" />
      <div className="flex gap-8">
        {[0,1,2].map(i => <Skeleton key={i} h="h-20" w="w-20" rounded="rounded-full" />)}
      </div>
    </div>
  );
}
