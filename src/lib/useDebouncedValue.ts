import { useEffect, useState } from "react";

/**
 * `value`, but only once it has stopped changing for `delay` ms. Search boxes
 * feed their query through this so typing "5CG1234XYZ" costs one request
 * rather than ten, and the table doesn't flicker through nine interim
 * results on the way.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
