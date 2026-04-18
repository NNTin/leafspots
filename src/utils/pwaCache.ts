const LEAFSPOTS_RUNTIME_CACHE_PREFIXES = [
  'leafspots-osm-tiles-',
  'leafspots-images-',
  'leafspots-data-',
  'leafspots-api-',
] as const

const LEAFSPOTS_ALL_CACHE_PREFIXES = [
  'leafspots-precache',
  ...LEAFSPOTS_RUNTIME_CACHE_PREFIXES,
] as const

function matchesPrefix(name: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => name.startsWith(prefix))
}

async function deleteMatchingCaches(prefixes: readonly string[]): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) return []

  const cacheNames = await caches.keys()
  const toDelete = cacheNames.filter((name) => matchesPrefix(name, prefixes))

  await Promise.all(toDelete.map((name) => caches.delete(name)))
  return toDelete
}

export async function clearLeafspotsRuntimeCaches(): Promise<string[]> {
  return deleteMatchingCaches(LEAFSPOTS_RUNTIME_CACHE_PREFIXES)
}

export async function resetLeafspotsPwa(
  options: { hard?: boolean; reload?: boolean } = {},
): Promise<{ deletedCaches: string[] }> {
  const hard = options.hard ?? false
  const reload = options.reload ?? true
  const deletedCaches = await deleteMatchingCaches(
    hard ? LEAFSPOTS_ALL_CACHE_PREFIXES : LEAFSPOTS_RUNTIME_CACHE_PREFIXES,
  )

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()

    if (hard) {
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } else {
      await Promise.all(
        registrations.map((registration) =>
          registration.update().catch(() => undefined),
        ),
      )
    }
  }

  if (reload) {
    window.location.reload()
  }

  return { deletedCaches }
}
