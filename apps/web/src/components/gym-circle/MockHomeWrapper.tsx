"use client";

import { GymCirclePreview } from "./GymCirclePreview";
import { useGymCircleSocial } from "./social/useGymCircleSocial";

export function MockHomeWrapper() {
  const social = useGymCircleSocial();
  return <GymCirclePreview social={social} />;
}
