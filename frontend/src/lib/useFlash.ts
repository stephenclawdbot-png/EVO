import { useEffect, useRef, useState } from 'react';

export function useFlash<T extends string | number>(value: T): { className: string; key: number } {
  const prev = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(value > prev.current ? 'up' : 'down');
      setTick(t => t + 1);
      prev.current = value;
      const timer = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const className = flash === 'up'
    ? 'flash-up'
    : flash === 'down'
      ? 'flash-down'
      : '';

  return { className, key: tick };
}