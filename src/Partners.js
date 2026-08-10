import React from "react";
import "./Carousel.css";

export default function Partners({ images, visible }) {
  const loopImages = [...images, ...images];
  const fadeClass = visible ? "fade-in" : "fade-out";
  const links = [
    "https://perq.finance/projects/SONIC",
    "https://paintswap.io/sonic/collections/tales-of-sparta/nfts",
    "https://brainonsonic.xyz",
    "https://my.soniclabs.com/apps/b8b6b9d8-b90b-4c81-a904-09363f829311",
    "https://amped.finance",
    "https://vibe.trading",
    "https://magicsquare.io/store/app/sparta-on-sonic",
    "https://mothvslamp.com",
  ];

  return (
    <div className={`carousel-container ${fadeClass}`}>
      <div className="carousel-track">
        {loopImages.map((src, i) => (
          <a href={links[i]} style={{cursor: "pointer"}} target="_blank" rel="noopener noreferrer"><img key={i} src={src} alt={`partner-${i}`} /></a>
        ))}
      </div>
    </div>
  );
}
