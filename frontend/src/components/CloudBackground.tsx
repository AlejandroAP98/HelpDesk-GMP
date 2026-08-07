"use client";
import React, { useMemo } from "react";
import nube from "@/app/assets/nube.webp";
import nube1 from "@/app/assets/nube1.webp";
import nube2 from "@/app/assets/nube2.webp";

const CLOUD_IMAGES = [nube, nube1, nube2];

const SPEEDS: { min: number; max: number }[] = [
  { min: 35, max: 55 },
  { min: 55, max: 75 },
  { min: 75, max: 100 },
];

const SPEEDS_LEFT: { min: number; max: number }[] = [
  { min: 30, max: 50 },
  { min: 50, max: 65 },
  { min: 65, max: 90 },
];

interface CloudConfig {
  id: number;
  img: (typeof CLOUD_IMAGES)[number];
  top: string;
  opacity: number;
  duration: number;
  delay: number;
  direction: "left" | "right";
  imgOffset: string;
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateClouds(): CloudConfig[] {
  const rand = seededRandom(42);
  const configs: CloudConfig[] = [];

  const verticalSlots = [
    { min: 2, max: 8 },
    { min: 20, max: 30 },
    { min: 35, max: 45 },
    { min: 50, max: 60 },
    { min: 10, max: 20 },
    { min: 60, max: 70 },
    { min: 25, max: 35 },
  ];

  for (let i = 0; i < 7; i++) {
    const goesLeft = i % 2 === 1;
    const pool = goesLeft ? SPEEDS_LEFT : SPEEDS;
    const speedTier = pool[Math.floor(rand() * pool.length)];
    const topRange = verticalSlots[i];

    configs.push({
      id: i,
      img: CLOUD_IMAGES[Math.floor(rand() * 3)],
      top: `${topRange.min + rand() * (topRange.max - topRange.min)}%`,
      opacity: 0.5 + rand() * 0.35,
      duration: speedTier.min + rand() * (speedTier.max - speedTier.min),
      delay: -(rand() * speedTier.max),
      direction: goesLeft ? "left" : "right",
      imgOffset: `${15 + i * 8}%`,
    });
  }

  return configs;
}

export default React.memo(function CloudBackground() {
  const clouds = useMemo(() => generateClouds(), []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute left-0 w-[110%] bg-repeat-x"
          style={{
            top: c.top,
            opacity: c.opacity,
            animation: `${c.direction === "left" ? "cloudsLeft" : "cloudsRight"} ${c.duration}s linear ${c.delay}s infinite`,
            willChange: "transform",
          }}
        >
          <img
            src={c.img.src}
            alt="nubes"
            className="w-auto h-auto absolute"
            style={{ [c.direction === "left" ? "left" : "right"]: c.imgOffset }}
            loading="eager"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
});
