"use client";

import { useEffect, useState } from "react";
import brass from "../public/home/brass.jpg";
import carnatic from "../public/home/carnatic.jpg";
import fusion from "../public/home/fusion.jpg";
import rap from "../public/home/rap.jpg";
import rock from "../public/home/rock.jpg";

const images = [brass, carnatic, fusion, rap, rock];

export default function BackgroundSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
      {images.map((img, i) => (
        <div
          key={img.src}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          style={{
            backgroundImage: `url(${img.src})`,
            filter: i === index ? "blur(0px)" : "blur(8px)",
          }}
        />
      ))}

      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}
