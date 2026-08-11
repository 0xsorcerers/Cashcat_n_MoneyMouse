import React, { useEffect, useState } from 'react';
import './HowTo.css';
import comicCashcatClub from './assets/images/howto/comic-cashcat-club.jpg';
import comicPickBounty from './assets/images/howto/comic-pick-bounty.jpg';
import comicMakeCash from './assets/images/howto/comic-make-cash.jpg';

/**
 * In-app comic How To guide.
 * Each page: header → description → comic strip → golden hint.
 * Flashy arrow moves between comic pages.
 */
const HOW_TO_SECTIONS = [
  {
    id: 'cashcat',
    header: 'The Hunt feels better with a Cashcat',
    description:
      'Players hunting with a Cash Cat NFT pay the least. Holders benefit hugely from gameplay discounts and winning incentives that non-holders simply do not get.',
    comic: comicCashcatClub,
    comicAlt:
      'Comic strip: a suited cat arm at a neon nightclub door points at a crew of anthropomorphic cat bounty hunters — some drunk, some fighting, some relaxed, some gambling — and calls out “You.”',
    goldenHint:
      'Click the SPAWN button to mint one or more Cash Cats. There will never be more than 5,000 Cash Cat Bounty Hunters.',
  },
  {
    id: 'pick-bounty',
    header: 'Pick a bounty off the tray',
    description:
      'Every hunt starts with a mark. Click any target in the mouse selector tray along the bottom of the arena — that rodent becomes your bounty for the round.',
    comic: comicPickBounty,
    comicAlt:
      'Comic strip: sniper-scope POV with crosshairs locked on a wealthy anthropomorphic mouse kingpin on a tropical ranch, surrounded by other elite mice, luxury cars, and champagne.',
    goldenHint:
      'Click on any of the 18 targets on display in the selection tray.',
  },
  {
    id: 'hunt',
    header: 'All the best in your hunt!',
    description:
      'Simply push the Hunt button to begin your draw. Two fully on-chain draws are requested — if they match, the bounty is secured and an autopayment is sent to you. If not, part of your hunting fee goes to fatten the pot for the next cat.',
    comic: comicMakeCash,
    comicAlt:
      'Comic strip: a cigar-smoking Cashcat holds a framed photo of a crew of anthropomorphic cat bounty hunters, with an anonymous saying beneath the frame about money mice gone rogue and making cash Cat.',
    goldenHint: 'All you need to do is push it. Click Hunt!',
  },
];

const HowTo = ({ open, onClose }) => {
  const [page, setPage] = useState(0);
  const total = HOW_TO_SECTIONS.length;
  const section = HOW_TO_SECTIONS[page];
  const isFirst = page <= 0;
  const isLast = page >= total - 1;

  useEffect(() => {
    if (!open) return undefined;
    setPage(0);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setPage((p) => Math.min(total - 1, p + 1));
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, total]);

  if (!open || !section) return null;

  const goNext = () => setPage((p) => Math.min(total - 1, p + 1));
  const goPrev = () => setPage((p) => Math.max(0, p - 1));

  return (
    <div
      className="howto-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How To Play"
    >
      <div
        className="howto-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="howto-toolbar">
          <div className="howto-brand">
            <span className="howto-kicker">
              Cashcats · Lesson {page + 1}/{total}
            </span>
            <h1 className="howto-title">How To Play</h1>
          </div>
          <button
            type="button"
            className="howto-close"
            onClick={onClose}
            aria-label="Close How To"
            title="Close"
          >
            ×
          </button>
        </header>

        <div className="howto-scroll" key={section.id}>
          <article className="howto-section howto-section--page">
            <h2 className="howto-section-header">{section.header}</h2>
            <p className="howto-section-desc">{section.description}</p>
            {section.comic && (
              <figure className="howto-comic">
                <img
                  src={section.comic}
                  alt={section.comicAlt || section.header}
                  className="howto-comic-img"
                  draggable={false}
                />
              </figure>
            )}
            {section.goldenHint && (
              <aside className="howto-golden-hint" aria-label="Golden hint">
                <span className="howto-golden-label">Golden hint</span>
                <p className="howto-golden-text">{section.goldenHint}</p>
              </aside>
            )}
          </article>
        </div>

        <nav className="howto-pager" aria-label="How To page navigation">
          <div className="howto-dots" role="tablist" aria-label="Lessons">
            {HOW_TO_SECTIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={`Go to lesson ${i + 1}: ${s.header}`}
                className={`howto-dot${i === page ? ' is-active' : ''}`}
                onClick={() => setPage(i)}
              />
            ))}
          </div>

          <div className="howto-arrows">
            {!isFirst && (
              <button
                type="button"
                className="howto-arrow howto-arrow--up"
                onClick={goPrev}
                aria-label="Previous lesson"
                title="Previous"
              >
                <span className="howto-arrow-glyph" aria-hidden>▲</span>
                <span className="howto-arrow-label">Back</span>
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                className="howto-arrow howto-arrow--down howto-arrow--flashy"
                onClick={goNext}
                aria-label="Next lesson"
                title="Next comic"
              >
                <span className="howto-arrow-label">Next</span>
                <span className="howto-arrow-glyph" aria-hidden>▼</span>
                <span className="howto-arrow-pulse" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="howto-arrow howto-arrow--done"
                onClick={onClose}
                aria-label="Close How To and start hunting"
                title="Got it"
              >
                <span className="howto-arrow-label">Got it</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default HowTo;
