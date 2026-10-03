/** Minimal complex arithmetic for the state-vector simulator. */
export interface Complex {
  readonly re: number;
  readonly im: number;
}

export const c = (re: number, im = 0): Complex => ({ re, im });
export const ZERO = c(0);
export const ONE = c(1);

export const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a: Complex, k: number): Complex => c(a.re * k, a.im * k);
export const conj = (a: Complex): Complex => c(a.re, -a.im);
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
export const abs = (a: Complex): number => Math.sqrt(abs2(a));
export const div = (a: Complex, b: Complex): Complex => {
  const d = abs2(b);
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};

export const approxEq = (a: Complex, b: Complex, eps = 1e-9): boolean =>
  Math.abs(a.re - b.re) < eps && Math.abs(a.im - b.im) < eps;

/** Human-readable number, e.g. "0.707", "−0.707", "0.707i", "0.5 − 0.5i". */
export function fmt(a: Complex, digits = 3): string {
  const r = (x: number) => {
    const v = Number(x.toFixed(digits));
    return (Object.is(v, -0) ? 0 : v).toString().replace('-', '−');
  };
  const re = Math.abs(a.re) < 1e-12 ? 0 : a.re;
  const im = Math.abs(a.im) < 1e-12 ? 0 : a.im;
  if (im === 0) return r(re);
  if (re === 0) return `${r(im)}i`;
  return `${r(re)} ${im < 0 ? '−' : '+'} ${r(Math.abs(im))}i`;
}
