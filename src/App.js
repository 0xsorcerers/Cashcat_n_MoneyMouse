import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import './Flip.css';
import Audits from "./Audits";
import Partners from "./Partners";
import { soundEffects } from "./tools/effects";
import { useActiveAccount } from "thirdweb/react";
import ReactPlayer from 'react-player';
import { FaTelegram, FaSquareXTwitter } from 'react-icons/fa6';
import { images,  documents  } from "./tools/effects";
import { BiSolidVolumeMute, BiSolidVolumeFull, BiChevronDown, BiChevronUp } from "react-icons/bi";
import FlipBoxGallery from './FlipBoxGallery';
import Mint from "./Mint";
import Legends from "./Legends";
import HowTo from "./HowTo";
import { foregroundStoryboards, LegendaryHeroes, LegendaryChoices, foregroundStoryboardsMobile, backgroundMusic, visualEffects, auditArray, partnerArray} from "./tools/effects";
import { Connector } from "./tools/utils";
import { GrDocumentText } from "react-icons/gr";
import { sdk } from '@farcaster/miniapp-sdk';

function App () {
  const [soundtrack, setSoundtrack] = useState(backgroundMusic.Soundtrack);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0.4);
  const [soundEffectUrl, setSoundEffectUrl] = useState(null);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false); 
  const [request, setRequest] = useState(null);
  const [story, setStory] = useState(null);
  const [component, setComponent] = useState("home");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [visualEffect, setVisualEffect] = useState({playbox: false}); 
  const [errorMessage, setErrorMessage] = useState("");
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  
  let account = useActiveAccount(); 

  const handleStart = () => {
    if (!verifyConnection()) return;
    setComponent('legends')
  }

  const verifyConnection = () => {
    if (!account) {
      setErrorMessage("Connect Wallet To Play");
      setErrorMessageVisible(true);
      playWrong();
      return false
    }
    return true;
  }
    
  //soundeffects
  
  const handlePlay = () => {
    setAudioPlaying(!audioPlaying);
  };

  const playSoundEffect = (effect) => {
    setSoundEffectUrl(effect);
    setIsEffectPlaying(true);
  };

  const playWrong = () => {
    playSoundEffect(soundEffects.Wrong);
    setVisualEffect({playbox: true});
  }

  const [activeData, setActiveData] = useState({ type: null, images: [] });
  const timerRef = useRef(null);

  const stopSoundEffect = () => {
    setIsEffectPlaying(false);
  };

  const triggerWithTimeout = (type, images) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Show carousel
    setActiveData({ type, images, visible: true });

    // Hide with fade after 15 sec
    timerRef.current = setTimeout(() => {
      setActiveData((prev) => ({ ...prev, visible: false }));
      // Remove component after fade-out (0.5s delay)
      setTimeout(() => {
        setActiveData({ type: null, images: [] });
      }, 500);
    }, 20000);
  };

  const getAudits = () => {
    triggerWithTimeout("audits", auditArray);
  };

  const getPartners = () => {
    triggerWithTimeout("partners", partnerArray);
  };

  
  useEffect(() => {
    // Preload when app first loads
    const preloadImages = () => {
      const allImages = [
        ...Object.values(foregroundStoryboards),
        ...Object.values(LegendaryHeroes),
        ...Object.values(LegendaryChoices),
        ...Object.values(foregroundStoryboardsMobile),
        ...Object.values(backgroundMusic),
        ...Object.values(visualEffects)
      ];
      
      allImages.forEach(src => {
        new Image().src = typeof src === 'string' ? src : src.default;
      });
    };

    // Delay slightly to avoid competing with critical assets
    const preloadTimer = setTimeout(preloadImages, 3000);
    
    return () => clearTimeout(preloadTimer);
  }, []);

  const dropDownChecker = () => {
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
    }
  }

  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => {
        dropDownChecker();
      }, 40000);
    }
  }, [isDropdownOpen]); 
  
  useEffect(() => {
    if (component === 'legends') {
      setSoundtrack(backgroundMusic.Soundtrack);
      setVolumeLevel(0.7);
    } else {
      setSoundtrack(backgroundMusic.SneakyAdventure);
      setVolumeLevel(0.4);
    }
  },[component]);


  // base mini app 
    useEffect(() => {
        sdk.actions.ready();
    }, []);

  return (
    <>
    <div align="center" onClick={() => {audioPlaying === null && setAudioPlaying(true)}}>
    <ReactPlayer
        url={soundtrack}
        playing={audioPlaying}
        volume={volumeLevel}
        loop={true} 
        style={{ display: 'none' }}
        controls={false}
      />     

    <ReactPlayer
      url={soundEffectUrl}
      playing={isEffectPlaying}
      volume={0.8}
      onEnded={stopSoundEffect} 
      style={{ display: 'none' }}
      controls={false}
    />

    <header className={`app-header ${component === 'legends' ? 'app-header--arena' : ''}`}>
      <div className="app-header__brand">
        <img src={visualEffects.logo} alt="Cashcats" className="logo" />
        <nav className="app-header__socials" aria-label="Social links">
          <button
            type="button"
            className="social-btn"
            onClick={() => setHowToOpen(true)}
            title="How To Play"
          >
            <GrDocumentText aria-hidden />
            <span className="social-btn__label">How To</span>
          </button>
          <a
            className="social-btn"
            href="https://t.me/cashcatnetwork"
            target="_blank"
            rel="noopener noreferrer"
            title="Telegram"
          >
            <FaTelegram aria-hidden />
            <span className="social-btn__label">Telegram</span>
          </a>
          <a
            className="social-btn"
            href="https://x.com/cashcatnetwork"
            target="_blank"
            rel="noopener noreferrer"
            title="X"
          >
            <FaSquareXTwitter aria-hidden />
            <span className="social-btn__label">X</span>
          </a>
        </nav>
      </div>

      <div className="app-header__actions">
        <button
          type="button"
          className="icon-btn"
          onClick={handlePlay}
          title={audioPlaying ? 'Mute music' : 'Play music'}
          aria-label={audioPlaying ? 'Mute music' : 'Play music'}
        >
          {audioPlaying
            ? <BiSolidVolumeMute />
            : <BiSolidVolumeFull />}
        </button>

        <div className="desktop-nav">
          {component !== 'legends' ? (
            <div className={`nav-link ${account ? '' : 'opacity2'}`} onClick={handleStart}>
              PLAY
            </div>
          ) : (
            <div className="nav-link" onClick={() => setComponent('mint')}>
              SPAWN
            </div>
          )}
          <div className="app-header__wallet">
            <Connector />
          </div>
        </div>

        <div className="mobile-nav">
          <button
            type="button"
            className="mobile-nav-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
          >
            Menu {isDropdownOpen ? <BiChevronUp /> : <BiChevronDown />}
          </button>
          {isDropdownOpen && (
            <div className="mobile-dropdown">
              {component !== 'legends' ? (
                <div className={`nav-link ${account ? '' : 'opacity2'}`} onClick={() => { handleStart(); setIsDropdownOpen(false); }}>
                  PLAY
                </div>
              ) : (
                <div className="nav-link" onClick={() => { setComponent('mint'); setIsDropdownOpen(false); }}>
                  Spawn
                </div>
              )}
              <div className="app-header__wallet">
                <Connector />
              </div>
              <div className="mobile-socials">
                <button
                  type="button"
                  className="social-btn"
                  onClick={() => { setHowToOpen(true); setIsDropdownOpen(false); }}
                  title="How To Play"
                >
                  <GrDocumentText /><span>How To</span>
                </button>
                <a className="social-btn" href="https://t.me/cashcatsnetwork" target="_blank" rel="noopener noreferrer" title="Telegram">
                  <FaTelegram /><span>Telegram</span>
                </a>
                <a className="social-btn" href="https://x.com/cashcatsnetwork" target="_blank" rel="noopener noreferrer" title="X">
                  <FaSquareXTwitter /><span>X</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    {activeData.type === "audits" && (
      <Audits className="audits" images={activeData.images} visible={activeData.visible} />
    )}
    {activeData.type === "partners" && (
      <Partners className="audits" images={activeData.images} visible={activeData.visible} />
    )}
    
    {component === 'home' && <FlipBoxGallery setComponent={setComponent}/>}
    </div>
    {component === 'mint' && <Mint setComponent={setComponent} />}
    {component === 'legends' && <Legends setComponent={setComponent} />}
    <HowTo open={howToOpen} onClose={() => setHowToOpen(false)} />
    </>
  );
};

export default App;