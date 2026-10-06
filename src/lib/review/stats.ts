/** Statistics used by the habit detectors. All tests are one-sided. */

function logGamma(x: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const logChoose = (n: number, k: number) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);

/** P(X >= k) for X ~ Binomial(n, p). Exact. */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let sum = 0;
  for (let i = k; i <= n; i++) sum += Math.exp(logChoose(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, sum);
}

/** P(X >= k) for X ~ Poisson(lambda). */
export function poissonUpperTail(k: number, lambda: number): number {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let below = 0;
  for (let i = 0; i < k; i++) below += Math.exp(i * Math.log(lambda) - lambda - logGamma(i + 1));
  return Math.max(0, Math.min(1, 1 - below));
}

/** Standard normal upper tail P(Z >= z). */
export function normalUpperTail(z: number): number {
  // Abramowitz–Stegun 7.1.26 via erfc
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  const upper = erfc / 2;
  return z >= 0 ? upper : 1 - upper;
}

/**
 * Mann–Whitney U test that values in `a` tend to be larger than values in `b`.
 * Normal approximation with tie correction; returns the one-sided p-value.
 */
export function mannWhitneyGreater(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  if (!n1 || !n2) return 1;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(all.length);
  let tieTerm = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = r;
    const tn = j - i + 1;
    tieTerm += tn ** 3 - tn;
    i = j + 1;
  }
  let r1 = 0;
  all.forEach((x, i) => {
    if (x.g === 0) r1 += ranks[i];
  });
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const n = n1 + n2;
  const mean = (n1 * n2) / 2;
  const variance = ((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1)));
  if (variance <= 0) return 1;
  const z = (u1 - mean - 0.5) / Math.sqrt(variance); // continuity correction
  return normalUpperTail(z);
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
