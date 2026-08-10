import React from "react";
import "./Carousel.css";

export default function Audits({ images }) {
  const loopImages = [...images, ...images]; // duplicate for seamless loop

  return (
    <div className="carousel-container">
      <div className="carousel-track">
        {loopImages.map((src, i) => (
          <img key={i} src={src} alt={`audit-${i}`} />
        ))}
      </div>
    </div>
  );
}
