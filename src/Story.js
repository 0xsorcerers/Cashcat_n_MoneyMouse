import React, { useState, useEffect } from 'react';
import './App.css';
import './Story.css'; // New dedicated stylesheet
import { useMediaQuery } from 'react-responsive';
import { foregroundStoryboards, foregroundHeroes, foregroundVillains, foregroundPatrons, foregroundArtifacts, 
  foregroundStoryboardsMobile, foregroundHeroesMobile, foregroundVillainsMobile, foregroundPatronsMobile, 
  foregroundArtifactsMobile, literaryData} from "./tools/effects";
import { MdToggleOn } from "react-icons/md";


const Story = ({ setComponent, entry, story }) => {
  const [currentStory, setCurrentStory] = useState(null);
  const [foregrounds, setForegrounds] = useState(null);
  const [literaryContent, setLiteraryContent] = useState(null);
  const [storyboardColor, setStoryboardColor] = useState('magenta');
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [displayOff, setDisplayOff] = useState({
    hero: 'block', villain: 'block', patron: 'block', artifact: 'block'
  });
  const [animations, setAnimations] = useState({
    storyboard: false,
    hero: false,
    villain: false,
    patron: false,
    artifact: false,
    literaryHero: false,
    literaryVillain: false,
    literaryPatron: false,
    literaryArtifact: false
  });
  const [attributes, setAttributes] = useState({
    storyboard: null,
    hero: null,
    villain: null,
    patron: null,
    artifact: null
  });
  
  const processColors = (_str) => {
    if (_str.includes('Gates')) return 'magenta';
    if (_str.includes('Ruins')) return 'cyan';
    if (_str.includes('Forest')) return 'white';
    if (_str.includes('Banks')) return 'pink';
    if (_str.includes('Cave')) return 'goldenrod';
    return 'magenta';
  };
  
  // Reset all animations when story changes
  const resetAnimations = () => {
    setAnimations({
      storyboard: false,
      hero: false,
      villain: false,
      patron: false,
      artifact: false
    });
  };

  // Select appropriate image set based on device
  const imageLibs = {
    storyboard: isMobile ? foregroundStoryboardsMobile : foregroundStoryboards,
    heroes: isMobile ? foregroundHeroesMobile : foregroundHeroes,
    villains: isMobile ? foregroundVillainsMobile : foregroundVillains,
    patrons: isMobile ? foregroundPatronsMobile : foregroundPatrons,
    artifacts: isMobile ? foregroundArtifactsMobile : foregroundArtifacts
  };

  const processAttributes = (attributes) => {
    const matchImage = (value, library) => {
      if (!value) return null;
      const words = value.split(' ');
      const match = words.find(word => library[word]);
      return match ? library[match] : library.Default || null;
    };

    return {
      storyboard: matchImage(attributes.storyboard, imageLibs.storyboard),
      hero: matchImage(attributes.hero, imageLibs.heroes),
      villain: matchImage(attributes.villain, imageLibs.villains),
      patron: matchImage(attributes.patron, imageLibs.patrons),
      artifact: matchImage(attributes.artifact, imageLibs.artifacts)
    };
  };

  const processLiteraryContent = (attributes, literaryData) => {
    const getContent = (value, category) => {
      if (!value) return null;
      
      // Convert "Gates of Olympus" → ["Gates", "of", "Olympus"]
      const words = value.split(' ');
      
      // Find first matching word
      const match = words.find(word => 
        literaryData[category]?.[word] !== undefined
      );
      
      return match ? literaryData[category][match] : null;
    };
  
    return {
      hero: getContent(attributes.hero, 'heroes'),
      patron: getContent(attributes.patron, 'patrons'),
      villain: getContent(attributes.villain, 'villains'),
      artifact: getContent(attributes.artifact, 'artifacts')
    };
  };

  useEffect(() => {
    if (story || entry?.[0]) {
      const targetStory = story || entry[0];
      setCurrentStory(targetStory);
      resetAnimations();
      
      // Sequence animations with delays
      setTimeout(() => setAnimations(a => ({ ...a, storyboard: true })), 300);
      setTimeout(() => setAnimations(a => ({ ...a, hero: true })), 600);
      setTimeout(() => setAnimations(a => ({ ...a, villain: true })), 900);
      setTimeout(() => setAnimations(a => ({ ...a, patron: true })), 1200);
      setTimeout(() => setAnimations(a => ({ ...a, artifact: true })), 1500);
      
      // Literary content animations
      setTimeout(() => setAnimations(a => ({ ...a, literaryHero: true })), 1800);
      setTimeout(() => setAnimations(a => ({ ...a, literaryVillain: true })), 2100);
      setTimeout(() => setAnimations(a => ({ ...a, literaryPatron: true })), 2400);
      setTimeout(() => setAnimations(a => ({ ...a, literaryArtifact: true })), 2700);
    }
  }, [entry, story]);

  useEffect(() => {
    if (currentStory?.attributes) {
      const attributes = {
        storyboard: currentStory.attributes.find(a => a.trait_type === 'STORYBOARD')?.value,
        hero: currentStory.attributes.find(a => a.trait_type === 'HERO')?.value,
        villain: currentStory.attributes.find(a => a.trait_type === 'VILLAIN')?.value,
        patron: currentStory.attributes.find(a => a.trait_type === 'GRAND PATRON')?.value,
        artifact: currentStory.attributes.find(a => a.trait_type === 'ARTIFACT')?.value,
      };

      // Set the current storyboard color
      const color = processColors(attributes.storyboard);
      setStoryboardColor(color); 
      
      setForegrounds(processAttributes(attributes));
      
      const content = processLiteraryContent(attributes, literaryData);
      setLiteraryContent(content);
    }
  }, [currentStory, isMobile]);

  return (
    <div className="story-container">
      {story ? (
        <>
          <div className="storyTitle" style={{color: storyboardColor}}>
            {story.name}
          </div>
        </>
      ) : (
        <>
          <div className="storyTitle" style={{color: storyboardColor}}>
            {entry[0].name}
          </div>
        </>
      )}

      {currentStory && (
        <>
              {/* Storyboard - Fade in */}
              {foregrounds?.storyboard && (
                <img 
                  src={foregrounds.storyboard} 
                  className={`hero z10 ${animations.storyboard ? 'foreground-storyboard' : ''} ${isMobile ? 'mobile-img' : 'desktop-img'}`}
                />
              )}
              
              {/* Hero - Slide from right */}
              {foregrounds?.hero && (
                <>
                  <img 
                    src={foregrounds.hero} 
                    className={`hero z20 ${animations.hero ? 'foreground-hero' : ''} ${isMobile ? 'mobile-img' : 'desktop-img'}`}
                  />
                  {literaryContent?.hero && (
                  <div style={{display: `${displayOff.hero}`}}>
                    <div className={`literary-content-hero ${animations.literaryHero ? 'animate-in' : ''}`}>
                      <img src={require('./assets/images/diya.gif')} className="candle" />
                      <span className="waveanimator quote literary-content-title">{literaryContent.hero.name}</span>
                      <span className="literary-content-phonetic">{literaryContent.hero.phonetic}</span>
                      <span className="literary-content-text" style={{ color: storyboardColor }}>{literaryContent.hero.text}</span>
                      <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, hero: 'none' })} style={{cursor: 'pointer'}}/>
                    </div>
                  </div>
                  )}  
                </>
              )}
              
              {/* Villain - Different slide effect */}
              {foregrounds?.villain && (
                <>
                  <img 
                    src={foregrounds.villain} 
                    className={`hero z30 ${animations.villain ? 'foreground-villain' : ''} ${isMobile ? 'mobile-img' : 'desktop-img'}`}
                  />
                  {literaryContent?.villain && (
                    <div style={{display: `${displayOff.villain}`}}>
                    <div className={`literary-content-villain ${animations.literaryVillain ? 'animate-in' : ''}`}>
                      <img src={require('./assets/images/candle-bowl.gif')} className="candle" />
                      <span className="waveanimator forest literary-content-title">{literaryContent.villain.name}</span>
                      <span className="literary-content-phonetic">{literaryContent.villain.phonetic}</span>
                      <span className="literary-content-text" style={{ color: storyboardColor }}>{literaryContent.villain.text}</span>
                      <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, villain: 'none' })} style={{cursor: 'pointer'}}/>
                    </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Patron - Another variation */}
              {foregrounds?.patron && (
                <>
                  <img 
                    src={foregrounds.patron} 
                    className={`hero z40 ${animations.patron ? 'foreground-patron' : ''} ${isMobile ? 'mobile-img' : 'desktop-img'}`}
                  />
                  {literaryContent?.patron && (
                    <div style={{display: `${displayOff.patron}`}}>
                    <div className={`literary-content-patron ${animations.literaryPatron ? 'animate-in' : ''}`}>
                      <img src={require('./assets/images/scented-candle.gif')} className="candle" />
                      <span className="waveanimator regal literary-content-title">{literaryContent.patron.name}</span>
                      <span className="literary-content-phonetic">{literaryContent.patron.phonetic}</span>
                      <span className="literary-content-text" style={{ color: storyboardColor }}>{literaryContent.patron.text}</span>
                      <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, patron: 'none' })} style={{cursor: 'pointer'}}/>
                    </div>
                    </div>  
                  )}
                </>
              )}
              
              {/* Artifact - Final dramatic entrance */}
              {foregrounds?.artifact && (
                <>
                  <img 
                    src={foregrounds.artifact} 
                    className={`hero z50 ${animations.artifact ? 'foreground-artifact' : ''} ${isMobile ? 'mobile-img' : 'desktop-img'}`}
                  />
                  {literaryContent?.artifact && (
                    <div style={{display: `${displayOff.artifact}`}}>
                    <div className={`literary-content-artifact ${animations.literaryArtifact ? 'animate-in' : ''}`}>
                      <img src={require('./assets/images/oil-lamp.gif')} className="candle" />
                      <span className="waveanimator liberty literary-content-title">{literaryContent.artifact.name}</span>
                      <span className="literary-content-phonetic">{literaryContent.artifact.phonetic}</span>
                      <span className="literary-content-text" style={{ color: storyboardColor }}>{literaryContent.artifact.text}</span>
                      <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, artifact: 'none' })} style={{cursor: 'pointer'}}/>
                    </div>
                    </div>
                  )}
                </>
              )}
        </>
      )}
    </div>
  );
};

export default Story;