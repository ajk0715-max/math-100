// 시드 기반 난수. 같은 시드면 같은 문제가 나와서 테스트와 이어하기가 가능하다.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(...parts: (string | number)[]): Rng {
  return mulberry32(hashSeed(...parts));
}

/** min 이상 max 이하의 정수 */
export function int(r: Rng, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1));
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: 빈 배열');
  return arr[Math.floor(r() * arr.length)] as T;
}

export function shuffle<T>(r: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function sample<T>(r: Rng, arr: readonly T[], n: number): T[] {
  return shuffle(r, arr).slice(0, n);
}

export function chance(r: Rng, p: number): boolean {
  return r() < p;
}

/** min~max 범위에서 서로 다른 정수 n개 (exclude 제외). 후보가 모자라면 가능한 만큼만 돌려준다. */
export function distinctInts(r: Rng, min: number, max: number, n: number, exclude: readonly number[] = []): number[] {
  const pool: number[] = [];
  for (let v = min; v <= max; v++) if (!exclude.includes(v)) pool.push(v);
  return sample(r, pool, n);
}
