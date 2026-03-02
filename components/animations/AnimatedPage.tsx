"use client";

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

export default function AnimatedPage({ children }: { children: React.ReactNode }) {
  const pageRef = useRef(null);

  useEffect(() => {
    gsap.fromTo(pageRef.current,
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }
    );
  }, []);

  return (
    <div ref={pageRef}>
      {children}
    </div>
  );
}
