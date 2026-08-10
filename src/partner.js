import React, { useState, useEffect} from 'react';
import { MdToggleOn } from 'react-icons/md';

const Partner = () => {
 const [visualEffect, setVisualEffect] = useState({partner: true});
    
  useEffect(() => {
    if (visualEffect.partner) {
      setTimeout(() => setVisualEffect({...visualEffect, partner: false}), 6000);
    }
  }, [visualEffect.partner]);

  return (
    <>      
    {visualEffect.partner && <a className="partner floating-3d" href="https://perq.finance/projects/SONIC" style={{cursor: 'pointer'}} target="_blank"><>Earn <span style={{color: 'gold'}}>$SOS</span> tokens before the official launch with perks from <span style={{color: 'blue'}}> Perq Finance </span><MdToggleOn onClick={() => setVisualEffect({ ...visualEffect, partner: false })} /></></a> }
    </>
  );
};

export default Partner;
