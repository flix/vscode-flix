/**
 * A version of the form `major.minor.patch`.
 */
export interface SemVer {
  major: number
  minor: number
  patch: number
}

/**
 * Returns `true` if the given `value` is a {@link SemVer}.
 */
export function isSemVer(value: any): value is SemVer {
  return Number.isInteger(value?.major) && Number.isInteger(value?.minor) && Number.isInteger(value?.patch)
}

/**
 * Parses the given string `s` as a {@link SemVer}.
 *
 * Returns `undefined` if `s` does not start with a version of the form `major.minor.patch`.
 */
export function parseSemVer(s: string): SemVer | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(s)
  if (match === null) {
    return undefined
  }
  const [major, minor, patch] = match.slice(1).map(n => parseInt(n))
  return { major, minor, patch }
}

/**
 * Compares the version `v1` to the version `v2`.
 *
 * Returns a negative number if `v1` is older than `v2`, zero if they are the same version, and a
 * positive number if `v1` is newer than `v2`.
 *
 * A component only counts when every component before it is equal: 0.76.3 is older than 0.77.0.
 */
export function compareSemVer(v1: SemVer, v2: SemVer): number {
  if (v1.major !== v2.major) {
    return v1.major - v2.major
  }
  if (v1.minor !== v2.minor) {
    return v1.minor - v2.minor
  }
  return v1.patch - v2.patch
}

/**
 * Returns the version `v` as a string of the form `major.minor.patch`.
 */
export function showSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`
}
