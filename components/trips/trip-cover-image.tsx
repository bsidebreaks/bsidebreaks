"use client";

import {
  FALLBACK_TRIP_IMAGE,
  isLikelyImageUrl,
} from "@/lib/trip-recommendation";
import { useEffect, useState } from "react";

type TripCoverImageProps = {
  imageUrl?: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function TripCoverImage({
  imageUrl,
  alt,
  className,
  priority,
}: TripCoverImageProps) {
  const [src, setSrc] = useState(() =>
    isLikelyImageUrl(imageUrl) ? imageUrl : FALLBACK_TRIP_IMAGE
  );
  useEffect(() => {
    setSrc(isLikelyImageUrl(imageUrl) ? imageUrl : FALLBACK_TRIP_IMAGE);
  }, [imageUrl]);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setSrc(FALLBACK_TRIP_IMAGE)}
    />
  );
}
