import React, { useRef, useState } from 'react';

interface TiltFrame3DProps {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
  onClick?: () => void;
}

export const TiltFrame3D: React.FC<TiltFrame3DProps> = ({
  children,
  className = '',
  maxTiltDeg = 5.5,
  onClick,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 2 * maxTiltDeg;
    const rotateX = (0.5 - py) * 2 * maxTiltDeg;
    setTransform(`perspective(1100px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(6px)`);
    setGlare({ x: px * 100, y: py * 100, opacity: 0.12 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0px)');
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={frameRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative will-change-transform transition-transform duration-200 ease-out ${className}`}
      style={{ transform }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(236, 234, 228, 0.35), transparent 62%)`,
        }}
      />
      {children}
    </div>
  );
};
