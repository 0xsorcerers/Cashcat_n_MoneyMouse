import React from "react";
import "./Carousel.css";

export default function Audits({ images, visible }) {
  const loopImages = [...images, ...images];
  const fadeClass = visible ? "fade-in" : "fade-out";
  const links = [
    "https://sparta.my/assets/docs/audits/audit_agent_report_soul_of_sparta.pdf",
    "https://sparta.my/assets/docs/audits/audit_agent_report_tales_of_sparta.pdf",
    "https://sparta.my/assets/docs/audits/audit_agent_report_legends_of_sparta.pdf",
  ];

  return (
    <div className={`carousel-container ${fadeClass}`}>
      <div className="carousel-track">
        {loopImages.map((src, i) => (
          <a href={links[i]} style={{cursor: "pointer"}} target="_blank" rel="noopener noreferrer"><img key={i} src={src} alt={`audit-${i}`} /></a>
        ))}
      </div>
    </div>
  );
}
