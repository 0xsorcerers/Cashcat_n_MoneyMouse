import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { soundEffects } from "./tools/effects";
import { MdCancel, MdToggleOn } from 'react-icons/md';
import { useActiveAccount } from "thirdweb/react";

export default function FlipBoxGallery({ setComponent }) {
  const [playIntro, setPlayIntro] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0.8);
  const [soundEffectUrl, setSoundEffectUrl] = useState(null);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false);
  const [visualEffect, setVisualEffect] = useState({playbox: false}); 

  let account = useActiveAccount(); 
  
  //soundeffects
  const playSoundEffect = (effect) => {
    setSoundEffectUrl(effect);
    setIsEffectPlaying(true);
  };

  const playWrong = () => {
    playSoundEffect(soundEffects.Wrong);
    setVisualEffect({playbox: true});
  }
  
  const stopSoundEffect = () => {
    setIsEffectPlaying(false);
    };

  // When intro video finishes, switch to Legends
  useEffect(() => {
    if (introFinished) {
      setComponent("legends");
    }
  }, [introFinished, setComponent]);

  const verifyConnection = () => {
    if (!account) {
      setErrorMessage("Connect Wallet To Play");
      setErrorMessageVisible(true);
      playWrong();
      return false
    }
    return true;
  }

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
      {playIntro && ( 
        <ReactPlayer
          url="/videos/intro.mp4"     
          playing={true}
          muted={false}
          width="100vw"
          height="100vh"
          onEnded={() => setIntroFinished(true)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none"
          }}
        />
      )}

      {/* ----- Play Button (only when intro isn't playing) ----- */}
      {!playIntro && (
        <button className="starter" onClick={handlePlay}
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
