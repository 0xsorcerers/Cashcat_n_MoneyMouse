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
      setSoundtrack(backgroundMusic.Darkness);
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

    <div className="header">
      <img src={visualEffects.logo} alt="Logo" className={`logo Introduce`}/>  
      {/* Mobile dropdown */}
      <div className="mobile-nav pulsar">
        <button 
          className="mobile-nav-button" 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          Menu {isDropdownOpen ? <BiChevronUp /> : <BiChevronDown />}
        </button>
        {isDropdownOpen && (
          <div className="mobile-dropdown">
            {/* <a 
              className="nav-link" 
              href="https://" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Buy $CASHCATS
            </a> */}
            {component !== 'legends' ? 
            <div className={`nav-link ${account ? '' : 'opacity2'}`}  onClick={handleStart}>
              PLAY
            </div> : <div className="nav-link" onClick={() => setComponent('mint')}>
              Spawn
            </div>
            }
            
            <div style={{fontFamily: "BabyVintage"}}>
              <Connector style={{width: "50%"}}/>
            </div>
          </div>
        )}
      </div>

      {/* Desktop navigation */}
      <div className="desktop-nav">
        {/* <a className="nav-link" href="https://" target="_blank" rel="noopener noreferrer">Buy $CASHCATS</a> */}
        {component !== 'legends' ? 
            <div className={`nav-link ${account ? '' : 'opacity2'}`} onClick={handleStart}>
              PLAY
            </div> : <div className="nav-link" onClick={() => setComponent('mint')}>
              SPAWN
            </div>
        }
        {/* {component === 'home' && (
          <>
            <div className="nav-link" onClick={getPartners}>Partners</div>
            <div className="nav-link" onClick={getAudits}>Audits</div>
          </>
        )} */}
        <div style={{fontFamily: "BabyVintage"}}>
          <Connector style={{width: "50%"}}/>
        </div>
      </div>
    </div> 
    {activeData.type === "audits" && (
      <Audits className="audits" images={activeData.images} visible={activeData.visible} />
    )}
    {activeData.type === "partners" && (
      <Partners className="audits" images={activeData.images} visible={activeData.visible} />
    )}
    
    {component === 'home' && <FlipBoxGallery setComponent={setComponent}/>}
    
    
      <nav className="footer">
        <div className="footer-link">  
          {audioPlaying ? <BiSolidVolumeMute style={{ width: "4vh", height: "4vh" }} onClick={handlePlay}/> 
          : <BiSolidVolumeFull style={{ width: "4vh", height: "4vh" }} onClick={handlePlay}/>}
              
          <a className="hyper-link nav-gold" href="" target="_blank" rel="noopener noreferrer" title="Docs">
          <GrDocumentText style={{ width: "4vh", height: "4vh" }}/>
          </a>            
          <a className="hyper-link nav-gold" href="" target="_blank" rel="noopener noreferrer" title="Telegram">
            <FaTelegram style={{ width: "4vh", height: "4vh" }}/>
          </a>       
          <a className="hyper-link nav-gold" href="https://x.com/cashcats_base" target="_blank" rel="noopener noreferrer" title="Twitter">
            <FaSquareXTwitter style={{ width: "4vh", height: "4vh" }}/>
          </a>
        </div>
      </nav>
    </div>
    {component === 'mint' && <Mint setComponent={setComponent} />}
    {component === 'legends' && <Legends setComponent={setComponent} />}
    </>
  );
};

export default App;