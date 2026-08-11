import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { soundEffects } from "./tools/effects";
import { MdCancel, MdToggleOn } from 'react-icons/md';
import { useActiveAccount } from "thirdweb/react";

/**
 * Landing + intro.
 * Plays Cashcats vs Money Mice intro.mp4 (standoff → parting),
 * with image-sequence fallback if the video fails to load.
 */
export default function FlipBoxGallery({ setComponent }) {
  const [playIntro, setPlayIntro] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [useVideo, setUseVideo] = useState(true);
  const [introPhase, setIntroPhase] = useState(0); // fallback: 0 idle, 1 standoff, 2 parting
  const [errorMessage, setErrorMessage] = useState("");
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0.8);
  const [soundEffectUrl, setSoundEffectUrl] = useState(null);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false);
  const [visualEffect, setVisualEffect] = useState({playbox: false});

  let account = useActiveAccount();

  const playSoundEffect = (effect) => {
    setSoundEffectUrl(effect);
    setIsEffectPlaying(true);
  };

  const playWrong = () => {
    playSoundEffect(soundEffects.Wrong);
    setVisualEffect({playbox: true});
  };

  const stopSoundEffect = () => {
    setIsEffectPlaying(false);
  };

  const goToLegends = () => {
    setIntroFinished(true);
    setPlayIntro(false);
    setComponent("legends");
  };

  // When intro finishes (video or fallback), switch to Legends
  useEffect(() => {
    if (introFinished) {
      setComponent("legends");
    }
  }, [introFinished, setComponent]);

  // Image-sequence fallback if video path is unavailable
  useEffect(() => {
    if (!playIntro || useVideo) return undefined;
    setIntroPhase(1);
    const t1 = setTimeout(() => setIntroPhase(2), 4200);
    const t2 = setTimeout(() => goToLegends(), 9000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [playIntro, useVideo]);

  const verifyConnection = () => {
    if (!account) {
      setErrorMessage("Connect Wallet To Play");
      setErrorMessageVisible(true);
      playWrong();
      return false;
    }
    return true;
  };

  const handlePlay = () => {
    if (!verifyConnection()) return;
    setPlayIntro(true);
  };

  return (
    <div className={!playIntro ? 'fullcover' : 'nofullcover'} >
      <ReactPlayer
        url={soundEffectUrl}
        playing={isEffectPlaying}
        volume={volumeLevel}
        onEnded={stopSoundEffect}
        style={{ display: 'none' }}
        controls={false}
      />

      {playIntro && useVideo && (
        <div className="intro-cinematic intro-video-wrap" onClick={goToLegends}>
          <ReactPlayer
            url="/videos/intro.mp4"
            playing={true}
            muted={false}
            width="100vw"
            height="100vh"
            onEnded={goToLegends}
            onError={() => {
              // Fall back to image sequence if the video fails
              setUseVideo(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
            config={{
              file: {
                attributes: {
                  style: {
                    width: "100vw",
                    height: "100vh",
                    objectFit: "cover",
                  },
                },
              },
            }}
          />
          <div className="intro-vignette" />
          <button type="button" className="intro-skip" onClick={goToLegends}>
            Skip
          </button>
        </div>
      )}

      {playIntro && !useVideo && (
        <div
          className="intro-cinematic"
          role="dialog"
          aria-label="Cashcat versus Money Mouse intro"
          onClick={goToLegends}
        >
          <div
            className={`intro-frame intro-standoff ${introPhase >= 1 ? 'is-shown' : ''} ${introPhase >= 2 ? 'is-exit' : ''}`}
            style={{ backgroundImage: "url(/images/cashcat-vs-mice-banner.jpg)" }}
          />
          <div
            className={`intro-frame intro-parted ${introPhase >= 2 ? 'is-shown' : ''}`}
            style={{ backgroundImage: "url(/images/cashcat-vs-mice-parted.jpg)" }}
          />
          <div className="intro-vignette" />
          <div className="intro-caption">
            {introPhase < 2 ? "Cash Cats 'n' Money Mice" : "Part ways… hunt begins"}
          </div>
          <button type="button" className="intro-skip" onClick={goToLegends}>
            Skip
          </button>
        </div>
      )}

      {!playIntro && (
        <button
          className="starter"
          onClick={handlePlay}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform =
              "translateX(-50%) translateY(-6px) scale(1.05)";
            e.currentTarget.style.boxShadow =
              "0 0 24px rgba(0, 255, 255, 0.6), inset 0 0 16px rgba(0, 255, 255, 0.35)";
          }}
        >
          START
        </button>
      )}
      {errorMessageVisible && (
        <div className={`notify notifyText cancelled ${visualEffect.playbox ? 'denied-shake' : ''}`}>
          <MdCancel /> {errorMessage}
          <MdToggleOn onClick={() => setErrorMessageVisible(false)} style={{cursor: 'pointer', margin: '0vh 1vh'}}/>
        </div>
      )}
    </div>
  );
}
