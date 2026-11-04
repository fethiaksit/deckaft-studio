export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}
export const createHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
});
export const commit = <T>(h: History<T>, present: T): History<T> =>
  present === h.present
    ? h
    : { past: [...h.past.slice(-99), h.present], present, future: [] };
export function undo<T>(h: History<T>): History<T> {
  const p = h.past.at(-1);
  return p === undefined
    ? h
    : {
        past: h.past.slice(0, -1),
        present: p,
        future: [h.present, ...h.future],
      };
}
export function redo<T>(h: History<T>): History<T> {
  const n = h.future[0];
  return n === undefined
    ? h
    : { past: [...h.past, h.present], present: n, future: h.future.slice(1) };
}
