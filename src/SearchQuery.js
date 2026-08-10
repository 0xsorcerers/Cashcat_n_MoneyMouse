import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import './Flip.css';
import { visualEffects, documents } from "./tools/effects";

const SearchQuery = ({ setComponent, setRequest, setStory }) => {
  const [localQuery, setLocalQuery] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [hideLogo, setHideLogo] = useState(false);
  const [view, setView] = useState('flex');
  const [visualEffect, setVisualEffect] = useState({
    one: false,
    two: false,
    three: false,
    input: false,
    caption: false,
  });
  const typingTimeout = useRef(null);

  useEffect(() => {
    setTimeout(() => {
      setView("none");
    }, 30000);
  }, []); 

  const setupStory = (index) => {
    setStory(searchResults[index]); // Set the specific story
    setComponent('story');
  };  

  const creditViewer = () => {
    const viewer = {display: view};
    return viewer;
  }


  const handleInputChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
    
    // Reset the inactivity timer on any input
    resetInactivityTimer();
  };

  const resetInactivityTimer = () => {
    // Clear any existing timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    // Set new timeout only if input is empty
    if (localQuery === '') {
      typingTimeout.current = setTimeout(() => {
        setComponent('home');
      }, 15000); // 15 seconds
    }
  };

  // Set initial timer and clean up on unmount
  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);

  // Reset timer whenever localQuery changes
  useEffect(() => {
    resetInactivityTimer();
  }, [localQuery]);

  useEffect(() => {
    setTimeout(() => setVisualEffect({input: true, one: false, two: false, three: false, caption: false}), 5000);
    setTimeout(() => setVisualEffect({input: true, one: true, two: false, three: false, caption: false}), 7000);
    setTimeout(() => setVisualEffect({input: true, two: true, one: true, three: false, caption: false}), 10000);
    setTimeout(() => setVisualEffect({input: true, three: true, one: true, two: true, caption: false}), 15000);
    setTimeout(() => setVisualEffect({input: true, one: true, two: true, three: true, caption: true}), 20500);
  }, []);

  
  useEffect(() => {
    if (localQuery && searchResults.length > 0) {
      setVisualEffect({input: true, one: false, two: false, three: false, caption: false});
    }
  }, [localQuery]);

  useEffect(() => { 
    setTimeout(() => setHideLogo(true), 6000);
  }, []);

  // ===== SEARCH ENGINE =====
  class SpartaSearch {
    constructor(metadata) {
      // Index all trait values for O(1) lookups
      this.valueIndex = new Map(); // { value => Set(editions) }
      
      metadata.forEach(item => {
        item.attributes.forEach(attr => {
          const value = attr.value.toLowerCase();
          if (!this.valueIndex.has(value)) {
            this.valueIndex.set(value, new Set());
          }
          this.valueIndex.get(value).add(item.edition);
        });
      });
      
      // Store full metadata by edition
      this.editionMap = new Map(metadata.map(item => [item.edition, item]));
    }
  
    parseQuery(query) {
      const tokens = query.toLowerCase()
        .split(/\s+(AND|OR|NOT)\s+|(?<!\w)(\bAND\b|\bOR\b|\bNOT\b)(?!\w)/i)
        .filter(Boolean);
      
      const parsed = [];
      let current = { type: 'value', value: '' };
      
      tokens.forEach(token => {
        if (['and', 'or', 'not'].includes(token)) {
          if (current.value) parsed.push(current);
          parsed.push({ type: 'operator', value: token });
          current = { type: 'value', value: '' };
        } else {
          current.value += (current.value ? ' ' : '') + token;
        }
      });
      if (current.value) parsed.push(current);
      
      return parsed;
    }
  
    search(query) {
      // Handle edition numbers (unchanged)
      if (/^\d+$/.test(query)) {
        const edition = parseInt(query);
        if (edition < 1 || edition > 3333) {
          return { error: 'Out of bounds (1-3333)' };
        }
        return this.editionMap.has(edition)
          ? { results: [this.editionMap.get(edition)] }
          : { error: 'No match found' };
      }
  
      // Parse advanced query
      const parsed = this.parseQuery(query);
      if (parsed.length === 0) return { results: [] };
      
      // First token must be a value
      if (parsed[0].type !== 'value') {
        return { error: 'Query must start with a search term' };
      }
      
      let results = this.getEditionsForValue(parsed[0].value);
      
      for (let i = 1; i < parsed.length; i += 2) {
        const operator = parsed[i];
        const nextValue = parsed[i+1];
        
        if (operator?.type !== 'operator' || nextValue?.type !== 'value') {
          continue; // Skip malformed sequences
        }
        
        const nextEditions = this.getEditionsForValue(nextValue.value);
        
        switch (operator.value) {
          case 'and':
            results = new Set([...results].filter(ed => nextEditions.has(ed)));
            break;
          case 'or':
            nextEditions.forEach(ed => results.add(ed));
            break;
          case 'not':
            nextEditions.forEach(ed => results.delete(ed));
            break;
        }
      }
      
      return {
        results: [...results].map(ed => this.editionMap.get(ed)),
        matchCount: results.size
      };
    }
  
    getEditionsForValue(searchValue) {
      const results = new Set();
      for (const [value, editions] of this.valueIndex.entries()) {
        if (value.includes(searchValue)) {
          editions.forEach(ed => results.add(ed));
        }
      }
      return results;
    }
  }

const spartaMetadata = documents.Metadata; 
const searchEngine = new SpartaSearch(spartaMetadata);

const Lookup = (_localQuery) => {
  const searchResults = searchEngine.search(_localQuery);
  
  if (searchResults.error) {
      return [{name: searchResults.error, isError: true}]; // Add isError flag
  } else if (!searchResults.results || searchResults.results.length === 0) {
      return [{name: "No match found", isError: true}]; // Explicit empty case
  } else {
      setRequest(searchResults.results);
      return searchResults.results.map(item => ({...item, isError: false}));
  }
}

useEffect(() => {
    if (localQuery) {
      const searchResults = Lookup(localQuery);
      setSearchResults(searchResults);      
    }
  }, [localQuery]);

  useEffect(() => {
    if (searchResults.length === 0) return;
    // Add check for existence of first item and its name property
    if (!searchResults[0] || !searchResults[0].name) return;
    
    const results = searchResults[0].name;
    if (results.includes("Out of bounds") || 
       results.includes("No match found") || 
       results.includes("error")) {
      return;
    }
    setComponent('story');
  }, [searchResults]);

  return (
    <div>
        {visualEffect.one && searchResults.length === 0  && <img src={visualEffects.gulp} alt="Visual Effect"  className={"visualEffect1 introduce"}/>}
        {visualEffect.two && searchResults.length === 0  && <img src={visualEffects.zap} alt="Visual Effect"  className= {"visualEffect2 introduce"}/>}
        {visualEffect.three && searchResults.length === 0  &&<img src={visualEffects.sigh} alt="Visual Effect" className={"visualEffect3 introduce"}/>}
        
        <div style={{opacity: 0.4}}>
          <img src={visualEffects.soniclogo} alt="Visual Effect" className={`visualEffect4 ${hideLogo ? 'hideLogo' : 'revealLogo'}`}/>
        </div>
        
        {visualEffect.input && <input className={`inputbox ${visualEffect.input ? 'inputAnimation' : ''}`}            
          value={localQuery}
          onChange={handleInputChange}
          placeholder="Search through NFTs, Heroes, Gods, Villains, Locations for lore..."
        />}

        {searchResults.length > 0 && localQuery && 
        <>
          <div className='hintbox introduce'>...use AND, OR, NOT for epic lore lookups</div>
          <div className='displaybox'>
            {searchResults.map((result, index) => (
              <div 
                key={index} 
                className={`results ${result.error ? 'error' : ''}`}
                onClick={() => setupStory(index)} // Now properly sets the story
              >
                {result.error ? result.name : result.name}
              </div>
            ))}
          </div>
        </>
        }

        {visualEffect.caption && <div className={`caption ${visualEffect.caption ? 'captionAnimation' : ''}`} style={creditViewer()} align="left">
        <span className="title">Now Playing: Deal by AudioCoffee  <br /></span>


        Credits: www.audiocoffee.net |
        Music promoted by https://www.chosic.com/free-music/all |
        Creative Commons CC BY-SA 3.0
        https://creativecommons.org/licenses/by-sa/3.0/

        </div>}
    </div>
  );
};

export default SearchQuery;
