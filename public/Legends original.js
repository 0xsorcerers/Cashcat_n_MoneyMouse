import React, { useState, useEffect } from 'react';
import { useMemo } from "react";
import './App.css';
import "./Legends.css";
import "./Story.css";
import "./Mint.css";
import { useMediaQuery } from 'react-responsive';
import { ethers } from "ethers";
import { contract, blockchain, provider, legendaryContract, formatNumber, client, abi,
  jesseContract, randomShuffle, truncateAddress, sendHash, fetchScores, postActiveScores } from "./tools/utils";
import { RxDividerVertical } from "react-icons/rx";
import { MdToggleOn, MdCancel } from 'react-icons/md';
import { BsEmojiHeartEyesFill, BsEmojiDizzyFill } from 'react-icons/bs';
import { miscImages, LegendaryHeroes, LegendaryChoices,
  soundEffects, foregroundStoryboards, foregroundStoryboardsMobile, cacheStoryboards } from "./tools/effects";
import ReactPlayer from 'react-player';
import Partner from './partner';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { base } from 'viem/chains';
import { loadAsset } from './tools/idbAssetManager';


// Media Screen Resolution
const Desktop = ({ children }) => {
const isDesktop = useMediaQuery({ minWidth: 769 });
  return isDesktop ? children : null;
};

const Mobile = ({ children }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  return isMobile ? children : null;
};

let account, publicClient, walletClient, isWalletParameter = false, isWalletRead = false, isNftRead = false;

const age = 120; // age of price update | set to 60;

const Legends = ({setComponent}) => {
  account = useAccount();
  const { data: readClient} = usePublicClient();
  const { data: writeClient } = useWalletClient(); 
  const [loading, setLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0.8);
  const [soundEffectUrl, setSoundEffectUrl] = useState(null);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false); 
  const [randomNumberHex, setRandomNumberHex] = useState(null);
  const [sequenceNumber, setSequenceNumber] = useState(null);
  const [randomResult, setRandomResult] = useState(null);
  const [matchImage, setMatchImage] = useState(null);
  const [heroMappings, setHeroMappings] = useState({
    byNumber: {},
    bySrc: {}
  });
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [hideNotifications, setHideNotifications] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [tokenBalance, setTokenBalance] = useState({Wei: null, Mil: null, K: null, Data: null});
  const [nft, setNFT] = useState(null);
  const [transactionResult, setTransactionResult] = useState(null);
  const [txError, setTxError] = useState(null);
  const [heroImage, setHeroImage] = useState(null);
  const [names, setNames] = useState({hero: null, villain: null});
  const [choiceImage, setChoiceImage] = useState(null);
  const [nftDisplay, setNFTDisplay] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [feeType, setFeeType] = useState(null);
  const [playId, setPlayId] = useState(null);
  const [animations, setAnimations] = useState({
    literaryHero: false,
    literaryVillain: false,
    literaryPatron: false,
    literaryArtifact: false
  });
  const [displayOff, setDisplayOff] = useState({
    hero: 'block', villain: 'block', patron: 'block', artifact: 'block'
  });
  const [visualEffect, setVisualEffect] = useState({playbox: false, funds: false, 
    nft: false, partner: true, dissolve1: false, dissolve2: false, dissolve3: false, dissolve4: false});
  const [background, setBackground] = useState(null);
  const [prizePot, setPrizePot] = useState({jesse: null, era: null});
  const [seasonPot, setSeasonPot] = useState(null);
  const [lastWinner, setLastWinner] = useState({address: null, pot: null, timestamp: null})
  const [recentCost, setRecentCost] = useState(null);
  const [speechBubble, setSpeechBubble] = useState({hero: null, nohero: null});
  const [replyBubble, setReplyBubble] = useState({hero: null, nohero: null});
  const [speeches, setSpeeches] = useState({
    nftSpeech: null,
    nftReplySpeech: null,
    noNftSpeech: null,
    noNftReplySpeech: null
  });
  const [heroSpeech, setHeroSpeech] = useState({hero: null, nohero: null});
  const [replySpeech, setReplySpeech] = useState({hero: null, nohero: null});
  const [userRandomNumero, setUserRandomNumero] = useState(null);
  const [imageIndex, setImageIndex] = useState(null);
  const [leadingPlayers, setLeadingPlayers] = useState(fetchScores());

  function seasonSelector () {
    const cachedCounter = localStorage.getItem('seasonCounter');
    if (cachedCounter !== null && !isNaN(parseInt(cachedCounter))) {
      return parseInt(cachedCounter);
    }    
    return 1;
  }
  const [counter, setCounter] = useState(seasonSelector());

  const quickBanter = () => {
    if (choiceImage && nft > 0) {
      const bubbleIndex = randomShuffle(6);
      setSpeechBubble({hero: bubbleIndex + 1, nohero: null});
      const heroSpeechIndex = randomShuffle(speeches.nftSpeech.length - 1);
      const heroReplySpeechIndex = randomShuffle(speeches.nftReplySpeech.length - 1);
      setHeroSpeech({hero: speeches.nftSpeech[heroSpeechIndex], nohero: null});
    } else if (choiceImage && nft < 1) {
      const bubbleIndex = randomShuffle(6);
      setSpeechBubble({hero: null, nohero: bubbleIndex + 1});
      const heroSpeechIndex = randomShuffle(speeches.noNftSpeech.length - 1);
      const heroReplySpeechIndex = randomShuffle(speeches.noNftReplySpeech.length - 1);
      setHeroSpeech({hero: null, nohero: speeches.noNftSpeech[heroSpeechIndex]});
    }
  }

  const verifyConnection = () => {
    if (!account.isConnected) {
      setErrorMessage("Connect Wallet To Play");
      setErrorMessageVisible(true);
      playWrong();
      return false;
    }
    return true;
  }

  const handlePlay = () => {    
    if (loading) return;
    if (!verifyConnection()) return;
    sendToCyber();
  }
  
  const balanceVerificationCheck = () => {
    if (!tokenBalance.Wei) {
      setErrorMessage("You Need $JESSE To Play");
      setErrorMessageVisible(true);
      noPlayFunds();
      fetchAllJesseBalance();
      setLoading(false);
      return true;
    }
    return false;
  }

  const fetchETHbalance = async () => {
    let call1 = await provider.getBalance(account.address);
    let balance = ethers.formatEther(call1?.toString());
    setWalletBalance(Number(balance).toFixed(10));
  };

  const fetchAmenities = () => {
    if (isNftRead) return;
    const allSources = Object.values(foregroundStoryboards);
    const imageIndex = randomShuffle(allSources.length - 1);
    const background = allSources[imageIndex];
    setImageIndex(imageIndex);
    setBackground(background);
    setTimeout(() => {
      fetchNFT()
    }, 3100);
    quickBanter(); 
    setLeadingPlayers(fetchScores());
    isNftRead = false;
  }

  let isUnread;
  useEffect(() => {
    if (!imageIndex || isUnread) return;
    isUnread = true;
    let allSources;
    if (isMobile) {     
      allSources = Object.values(foregroundStoryboardsMobile);
      setBackground(allSources[imageIndex]);
    } else {      
      allSources = Object.values(foregroundStoryboards);
      setBackground(allSources[imageIndex]);
    }
    isUnread = false;
  }, [isMobile])

  //sounds
  const playSoundEffect = (effect) => {
    setSoundEffectUrl(effect);
    setIsEffectPlaying(true);
  };

  const playThunder = () => {
    playSoundEffect(soundEffects.Thunder);
  }

  const playButton = () => {
    playSoundEffect(soundEffects.Button);
  }

  const playRumble = () => {
    playSoundEffect(soundEffects.Rumble);
  }

  const playWrong = () => {
    playSoundEffect(soundEffects.Wrong);
  }

  const stopSoundEffect = () => {
    setIsEffectPlaying(false);
  };

  // functions
  const noPlay = () => {
    setDisplayOff({ ...displayOff, patron: 'block' });
    setVisualEffect({...visualEffect, playbox: true});
    playWrong();
  }

  const noPlayFunds = () => {
    setVisualEffect({...visualEffect, funds: true});
    playWrong();
  }

  const noPlayNFT = () => {
    setVisualEffect({...visualEffect, nft: true});
    playWrong();    
  }

  const assignRandomNumbers = (_choice, _result, _choiceImage) => {
    // 1. Extract all image sources and keys from LegendaryChoices
    const sources = Object.values(LegendaryChoices);
    const keys = Object.keys(LegendaryChoices);

    // 2. Initialize mappings
    const byNumber = {};
    const bySrc = {};

    // 3. Manually assign _choice to _choiceImage (always)
    byNumber[_choice] = _choiceImage;
    bySrc[_choiceImage] = _choice;

    // 4. Handle _result (if different from _choice)
    if (_result !== _choice) {
      // Find a random image that isn't _choiceImage
      const availableSources = sources.filter(src => src !== _choiceImage);
      const randomIndex = randomShuffle(availableSources.length - 1);
      const resultImage = availableSources[randomIndex];

      byNumber[_result] = resultImage;
      bySrc[resultImage] = _result;
    }

    // 5. Assign random numbers to remaining images (excluding assigned ones)
    const usedNumbers = new Set([_choice, _result]);
    const usedImages = new Set([_choiceImage, byNumber[_result]]);

    sources.forEach((src) => {
      if (!usedImages.has(src)) {
        let randomNum;
        do {
          randomNum = randomShuffle(50); // Generate 0-50
        } while (usedNumbers.has(randomNum));

        byNumber[randomNum] = src;
        bySrc[src] = randomNum;
        usedNumbers.add(randomNum);
      }
    });

    // 6. Update state
    setHeroMappings({ byNumber, bySrc });
  };

  useEffect(() => {
    if (heroMappings.byNumber[randomResult]) {
    const getMatch = heroMappings.byNumber[randomResult];
    setMatchImage(getMatch);
    }
  }, [heroMappings.byNumber]);

  const closeDisplay = () => {
    setNFTDisplay(false);
  }

  const selectChoice = (_key, _choice) => {
    if (loading) return;
    if (!verifyConnection()) return;
    setChoiceImage(_choice);
    setNames({...names, villain: _key});
    playThunder();
  }

  const fetchHero = async() => {
    console.log('running fetch hero...');
    try {  
      if (nft > 0 ) {
        const response = await fetch(`https://cybernauts.fun/ipfsCache/${nft}.json`, {
          method: "GET",
        });
    
        if (!response.ok) {
          console.log("Network response was not ok");
          return; // Exit if response is not ok
        }
    
        const heroData = await response.json();

        // Find the HERO trait
        const heroTrait = heroData.attributes.find(
          attr => attr.trait_type === "Cybernaut"
        );
        
        if (heroTrait) {
          const heroName = heroTrait.value;
          
          // Remove any numbering or titles from the hero name (like "Androcles Kronjenidas I" -> "Androcles")
          const baseHeroName = heroName.split(' ')[0];
          
          // Find matching image in foregroundHeroes
          const matchedHeroImage = LegendaryHeroes[baseHeroName];
          
          if (matchedHeroImage) {
            setHeroImage(matchedHeroImage);
            setNames({...names, hero: heroName});
          }
        }
      } else {
          setNames({...names, hero: "Unidentified"});
          setHeroImage(miscImages.noHeroFound);
      }

      fetchAllJesseBalance();
      setTimeout(() => fetchETHbalance(), 2100);
      
    } catch (err) {
      console.log("Error fetching NFT data: ", err);
    }
  };

  const fetchNFT = async() => {
    try {      
     const call1 = await contract.balanceOf(account.address);
     const token = Number(call1);
     console.log("token: ", token)
     let platformfee = await legendaryContract.platformFee();
     const platformFee = Number(platformfee);
     console.log("platformFee: ", platformFee);

     if (token > 0) {
      const index = randomShuffle(token);
      console.log("index: ", index);
      const call2 = await contract.tokenOfOwnerByIndex(account.address, index);
      const tokenId = Number(call2);
      console.log("tokenId: ", tokenId);

      const call3 = await contract.blacklisted(tokenId);
        if (call3) { 
          setNFT(0);
        } else {
          setNFT(tokenId);
        }
      
      console.log(call3);
      const call4 = await legendaryContract.powerIndex(tokenId);
      let winfee = Number(call4);
      console.log("winfee: ", winfee);
      const feetype = platformFee - winfee;
      const totalFee = platformFee + 5;

      const discount = ((totalFee - feetype) / (totalFee)) * 100;
      setFeeType(discount);

      console.log("Discount: ", discount);

     } else {

      setNFT(0);
      setFeeType(0);

    }

    } catch (err) {
      console.log("error fetching NFTs: ", err);
    }
  }

  const refreshState = () => {
    isWalletParameter = false;
    setError(null);
    setPlayId(null);
    setFeeType(null);
    setTxError(null);
    setErrorMessage("");
    setRandomResult(null);
    setSequenceNumber(null);
    setRandomNumberHex(null);
    setUserRandomNumero(null);
    setTransactionResult(null);
    setErrorMessageVisible(false);
    setHeroMappings({byNumber: {}, bySrc: {}});
  }

  const fetchAllJesseBalance = async() => { 
    // fetch JESSE balance   
    const call = await jesseContract.balanceOf(account.address);
    //Also fetch prize pot
    const pot = await jesseContract.balanceOf(blockchain.legend_contract_address);
    const era = await legendaryContract.era();
    const formattedCall = ethers.formatEther(call);
    const formattedPot = ethers.formatEther(pot);
    const tokenBalMil = Number(formattedCall) / 10**6;
    const tokenBalK = Number(formattedCall) / 10**3;
    const tokenBalData = Number(formattedCall);
    setPrizePot({...prizePot, jesse: Number(formattedPot).toFixed(1), era: Number(era)});
    if (tokenBalMil > 0.1) {
      setTokenBalance({Wei: call, Mil: tokenBalMil, K: null, Data: null});
    } else if (tokenBalK > 0.998) {
      setTokenBalance({Wei: call, Mil: null, K: tokenBalK, Data: null});
    } else if (tokenBalData > 0) {
      setTokenBalance({Wei: call, Mill: null, K: null, Data: tokenBalData});
    } else return;
  }
  
  useEffect(() => {
    if (account.isConnected && !walletBalance) {
      if (isWalletRead) return;
      isWalletRead = true;
      fetchETHbalance();
      setTimeout(() => fetchAllJesseBalance(), 2100);
      fetchAmenities();
      isWalletRead = false;
    }
  }, [account]);

  let unRead;
  useEffect(() => {
    if (nft !== null && !unRead)  {
      if (unRead) return;
      unRead = true;
      fetchHero();
      unRead = false;
    }
  }, [nft]);

  useEffect(() => {
    if (playId) {
      fetchHero();
    }
  },[playId]);

// Listeners
  const playListener = (_userRandomNumber) => {
      legendaryContract.once("proofOfNumber", (from, number, proof) => {
      let resultdata = {
        from: from.toString(),
        number: number.toString(), 
        proof: proof.toString(), 
        timestamp: Date.now(), 
      };
      if (from.toLowerCase() === account.address.toLowerCase() && number === _userRandomNumber) {
        const playid = Number(resultdata.proof);
        setPlayId(playid);
      } 
    });
  }

  const randomNumberListener = (_userRandomNumberHex) => {
      legendaryContract.once("RandomNumberRequest", (randomNumber, sender, sequenceNumber) => {
      let randomdata = {
        randomNumberHex: randomNumber.toString(),
        sender: sender.toString(),
        sequenceId: sequenceNumber.toString(), 
        timestamp: Date.now(), 
      };
      if (_userRandomNumberHex === randomdata.randomNumberHex 
        && account.address.toLowerCase() === sender.toLowerCase()) {
        const sequence = randomdata.sequenceId;
        setSequenceNumber(sequence);
      } 
    });
  }

  const resultListener = () => {
      legendaryContract.once("RandomNumberResult", (sequenceNumber, result) => {
      let resultdata = {
        sequenceNumber: sequenceNumber.toString(),
        result: result.toString(), 
        timestamp: Date.now(), 
      };
      const sequenceId = resultdata.sequenceNumber;
      if (sequenceNumber > 0 && sequenceNumber == sequenceId) {
        const result = Number(resultdata.result);
        setRandomResult(result);
        isWalletParameter = false;
      } 
    });
  }

  const saveEreCounter = () => {
    setCounter(prizePot.era);
    localStorage.setItem('seasonCounter', prizePot.era.toString());
  }

  const sendToCyber = async () => {
    if (!choiceImage) {
      noPlay();
      return;
    };

    if (balanceVerificationCheck()) return;

    isWalletParameter = false;

    setLoading(true);
    
      // Generate needed random number
      const userRandomNumber = ethers.hexlify(ethers.randomBytes(32));
      playListener(userRandomNumber);

    try {

      publicClient = createPublicClient({
        chain: base,
        transport: http(),
      })

      walletClient = createWalletClient({
        account: account.address, 
        chain: base, 
        transport: custom(writeClient.transport)
      });

      // fetch needed request fee for Entropy call
      const requestFee = await legendaryContract.getRequestFee();
      const requestFeeInEth = ethers.formatEther(requestFee);  
      // console.log("requestFeeInEth: ", requestFeeInEth.toString());
      

      let totalValue = ethers.parseEther(requestFeeInEth.toString());
      if (Number(requestFeeInEth) >= Number(walletBalance)) {
        setErrorMessage(`Insufficient Gas (req. ${(formatNumber(requestFeeInEth))} $ETH)`);
        setErrorMessageVisible(true);
        noPlayFunds();      
        fetchETHbalance();
        setLoading(false);
        return;
      }
      
      const approvalAllowance = await jesseContract.allowance(account.address, blockchain.legend_contract_address);
      //fetch Multiple required
      let multiple;
        if (nft > 0) {
          multiple = 1;
        } else {
          const jm = await legendaryContract.multiple();
          multiple = Number(jm);
        }
      const reqAmount = await legendaryContract.requiredFee();
      const requiredfee = ethers.formatEther(reqAmount.toString())
      
      const requiredAmount = Number(requiredfee) * multiple;
      const requiredAmountInWei = ethers.parseEther(requiredAmount.toString());

        //Check if tokenBalance is sufficient
        if (requiredAmountInWei > tokenBalance.Wei) {
          setErrorMessage(`requires ${(formatNumber(requiredAmount.toFixed(0)))} $JESSE`);
          setErrorMessageVisible(true);
          noPlayFunds();
          setLoading(false);
          return;
        }

        //initiate token approval if permissions not met
        const approvalAllowanceInETH = ethers.formatEther(approvalAllowance);
        
        if (approvalAllowance < requiredAmountInWei) {
          console.log("Initiating approval...")
          setIsApproving(true);
          setErrorMessage("Requesting $JESSE Approval...");
          setErrorMessageVisible(true);
                    
          const txHash = await walletClient.writeContract({
            address: blockchain.jesse_contract_address,          // cybernaut contract
            abi: abi.jesse,
            functionName: "approve",
            args: [blockchain.legend_contract_address, tokenBalance.Wei]
          });
          
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          
          if (receipt.status !== 'success') {
              setErrorMessage("Request Cancelled!");
              setErrorMessageVisible(true);
              console.log("Approval denied");
              setTxError("Approval denied.");
              setLoading(false);
              return;
          } else {
              setTransactionResult(txHash);
              setErrorMessage("Approved!");
              setErrorMessageVisible(true);
          }
          
        } 

      // Refresh states
      refreshState();
      // Start the listener
      resultListener();
      quickBanter();

      // 4. Prepare contract call with viem)
        //viem        
          const txHash = await walletClient.writeContract({
            address: blockchain.legend_contract_address,          // cybernaut contract
            abi: abi.legend,
            functionName: "sendToCyber",
            args: [!nft ? 1 : nft, userRandomNumber],
            value: requestFee
          });
      
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
          if (receipt.status !== 'success') {
              setLoading(false);
              setErrorMessage("Dropped.");
              setErrorMessageVisible(true);
              isWalletParameter = false;
            return;
          } else { 
              setTransactionResult(txHash);
              sendHash(txHash);
              postActiveScores(account.address, leadingPlayers, 1); // point system by value spent
              setLoading(false);
              isWalletParameter = false;
              fetchAmenities();
          }

      randomNumberListener(userRandomNumber);
      setUserRandomNumero(userRandomNumber);
      setRecentCost(requestFeeInEth);

      console.log("Transaction sent successfully.");
    } catch (error) {
      console.error("Error in sendToCyber:", error);
      setLoading(false);
    }
  };

  let isNew;

  useEffect(() => {
    if (!account.isConnected && (walletBalance || tokenBalance)) {
      if (isNew) return;
      isNew = true;
      refreshState();      
      setWalletBalance();
      setTokenBalance({Wei: null, Mil: null, K: null, Data: null});
      setHeroImage(null);
      fetchAmenities();
      isNew = false;
    }
  },[account.isConnected])
  
  useEffect(() => {
    if (account.isConnected) {        
      // Literary content animations
      setTimeout(() => setAnimations(a => ({ ...a, literaryHero: true })), 1800);
      setTimeout(() => setAnimations(a => ({ ...a, literaryVillain: true })), 2100);
      setTimeout(() => setAnimations(a => ({ ...a, literaryPatron: true })), 2400);
      setTimeout(() => setAnimations(a => ({ ...a, literaryArtifact: true })), 2700);
    }
  }, [account]);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => playRumble(), 6000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  let isKickStart
  useEffect(() => {
    if (playId && randomResult && choiceImage) {
      if (isKickStart) return;
      isKickStart = true;
      assignRandomNumbers(playId, randomResult, choiceImage);
      playThunder();
      setLoading(false);
      isKickStart = false;
    }
  }, [playId, randomResult]);

  useEffect(() => {
    if (speeches.nftSpeech && choiceImage && nft > 0) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: replyBubbleIndex + 1, nohero: null});
      const heroReplySpeechIndex = randomShuffle(speeches.nftReplySpeech.length - 1);
      setReplySpeech({hero: speeches.nftReplySpeech[heroReplySpeechIndex], nohero: null});
    } else if (speeches.noNftSpeech && choiceImage && nft < 1) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: null, nohero: replyBubbleIndex + 1});
      const heroReplySpeechIndex = randomShuffle(speeches.noNftReplySpeech.length - 1);
      setReplySpeech({hero: null, nohero: speeches.noNftReplySpeech[heroReplySpeechIndex]});
    }
  },[choiceImage]);

  useEffect(() => {
    const getSpeeches = async() => {
      const response = await fetch("https://cybernauts.fun/ipfsCache/robot_quips.json", {
        method: "GET",
      });
  
      if (!response.ok) {
        // console.log("Failed to obtain Speech Bubbles");
        return; // Exit if response is not ok
      }
  
      const allSpeech = await response.json();

      const nftSpeech = allSpeech.robot_quips;
      const nftReplySpeech = allSpeech.response_robot_quips;
      const noNftSpeech = allSpeech.incognito_quips;
      const noNftReplySpeech = allSpeech.response_incognito_quips;

      setSpeeches({
        nftSpeech,
        nftReplySpeech,
        noNftSpeech,
        noNftReplySpeech
      });
    }    

    getSpeeches();
  },[]);

  let isStale;
  useEffect(() => {
    if (prizePot.era && (counter !== prizePot.era)) {
      if (isStale) return;
      isStale = true;
      const fetchLastWinner = async() => {
          const prevEra = prizePot.era - 1;
          const previousWinner = await legendaryContract.pastwinners(prevEra);
          const formattedPot = ethers.formatEther(previousWinner[2]);
          const convertedTimeOfWin = new Date(Number(previousWinner[3]) * 1000).toLocaleString();
          setLastWinner({address: previousWinner[0].toString(), pot: Number(formattedPot), timestamp: convertedTimeOfWin});
      }
    fetchLastWinner();
    isStale = false;
    }
  },[prizePot.era]);

  useEffect(() => {
    if (visualEffect.playbox) {
      setTimeout(() => setVisualEffect({playbox: false}), 3000);
    }
    if (visualEffect.funds) {
      setTimeout(() => setVisualEffect({funds: false}), 3000);
    }
    if (visualEffect.nft) {
      setTimeout(() => setVisualEffect({nft: false}), 3000);
    }
  }, [visualEffect.playbox, visualEffect.funds, visualEffect.nft]);

  useEffect(() => {
    if (displayOff.patron === "block") {
      setTimeout(() => setVisualEffect({...visualEffect, dissolve3: true, dissolve1: true}), 20000);
      setTimeout(() => setDisplayOff({ hero: 'none', villain: 'block', patron: 'none', artifact: 'block'  }), 24000);
    }
    if (displayOff.artifact === "block") {
      setTimeout(() => setVisualEffect({...visualEffect, dissolve2: true, dissolve4: true}), 30000);
      setTimeout(() => setDisplayOff({ hero: 'none', villain: 'none', patron: 'none', artifact: 'none' }), 34000);
    }
  }, [displayOff.patron, displayOff.artifact]);

  return (
    <div className='legends-container' style={{backgroundImage: `url(${background})`}}> 
        <ReactPlayer
          url={soundEffectUrl}
          playing={isEffectPlaying}
          volume={volumeLevel}
          onEnded={stopSoundEffect} 
          style={{ display: 'none' }}
          controls={false}
        />
      <div className="nft">
        {nft === null && <div className="nftText">...loading</div>} 
        {nft > 0 && <img src={`https://cybernauts.fun/ipfsCache/${nft}.webp`} alt="NFT" className="nftImage" onClick={() => setNFTDisplay(true)} />}
        {nft === 0 && <img src={require('./assets/images/nonftsfound.webp')} alt="NFT" className="nftImage" onClick={noPlayNFT} />}
      </div>
      {heroImage && 
      <>
        <img src={heroImage} className={`characterImage index10 ${visualEffect.nft ? 'denied-shake' : ''}`} />
        <div className="vs"><img src={require("./assets/images/vs.gif")} alt="vs" className="vsImage" /></div>
        <div className="heroText">YOUR HERO <br/> 
          {nft ? <span className="waveanimator quote ledger">on Crusade {nft}</span> : <span className="waveanimator quote ledger" align='right'>unholy crusader</span>}
        </div>
        <div className="heroName waveanimator regal">{names.hero}</div>
      </>
      }
      {choiceImage && <>
        <img src={choiceImage} className="characterImage index11" />
        <div className="villainName waveanimator forest">{names.villain}</div>
      </>
      }
      {choiceImage && 
      <>
        {speechBubble.hero && 
        <>
          {!isMobile && <img src={require(`./assets/images/web/LEGEND/SPEECH/Speech_bubbles_hero_${speechBubble.hero}.webp`)} className="characterImage index10 index13" />}
          <div className={`characterImage index10 index13 speechText bubble${speechBubble.hero}`} >{heroSpeech.hero}</div> 
        </>
        } 
        {speechBubble.nohero && 
        <>
          {!isMobile && <img src={require(`./assets/images/web/LEGEND/SPEECH/Speech_bubbles_nohero_${speechBubble.nohero}.webp`)} className="characterImage index10 index13" />}
          <div className={`characterImage index10 index13 speechText bubblenoob${speechBubble.nohero}`} >{heroSpeech.nohero}</div> 
        </>
        } 
        {replyBubble.hero && 
        <>
          {!isMobile && <img src={require(`./assets/images/web/LEGEND/SPEECH/Speech_bubbles_godville_${replyBubble.hero}.webp`)} className="characterImage index11 index13" />}
          <div className={`characterImage index11 index13 speechText replybubble${replyBubble.hero}`} >{replySpeech.hero}</div> 
        </>
        } 
        {replyBubble.nohero && 
        <>
          {!isMobile && <img src={require(`./assets/images/web/LEGEND/SPEECH/Speech_bubbles_godville_${replyBubble.nohero}.webp`)} className="characterImage index11 index13" />}
          <div className={`characterImage index11 index13 speechText replybubble${replyBubble.nohero}`} >{replySpeech.nohero}</div> 
        </>
        } 
      </>
      }

      {matchImage && <>
        <img 
          src={matchImage} 
          className={`characterImage index12 ${loading || !randomResult ? 'fade-to-black' : ''}`} 
          style={loading || !randomResult ? { opacity: 0.5, filter: 'brightness(20%) blur(2px)', transform: 'translateZ(30px) scale(0.9)' } : { opacity: 1 } }
        />
        <div className="villainText">{!randomResult && !loading && choiceImage ? "YOUR LAST FATE" : loading ? "Fetching New Fate..." : "YOUR FATE"}</div>
      </>
      }
      <div className="panel">          
      {Object.entries(LegendaryChoices).map(([key, villain]) => (
        <img
          key={key}
          src={villain}
          alt={key}
          className={`selectedImage ${loading ? 'notallowed' : ''}`}
          onClick={() => selectChoice(key, villain)}  
        />
      ))}
      </div>
      <div className="tray"> 
        {prizePot.era && <div className="balloons"><span className="smaller">Season's {prizePot.era} Pot</span> <br /> {formatNumber(prizePot.jesse)}$</div>}
        
        <div className="pT2">Balance: {walletBalance ? <span className="waveanimator quote goldtext"> {formatNumber(walletBalance)}</span> : <span className="waveanimator quote goldtext">Loading... </span>} <span className='fontSmall'>ETH</span></div>
        
        {tokenBalance.Mil || tokenBalance.K || tokenBalance.Data && (
        <div className="jcAll pT2">          
          {tokenBalance.Mil && <><span className="waveanimator quote goldtext">  {formatNumber(tokenBalance.Mil)} Mil</span> <span className='fontSmall'>JESSE</span> </>}
          {tokenBalance.K && <><span className="waveanimator quote goldtext"> {formatNumber(tokenBalance.K)} K</span> <span className='fontSmall'>JESSE</span> </>}
          {tokenBalance.Data && <><span className="waveanimator quote goldtext"> {formatNumber(tokenBalance.Data)}</span> <span className='fontSmall'>JESSE</span> </>} 
        </div>
        )}
        
        <button className='legend-button' onClick={handlePlay} disabled={loading} style={{ opacity: loading ? 0.4 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Good luck' : 'Play!'}</button>
      </div>
      {blockchain.chainId === 57054 && <a className="mainlink" href="https://cybernauts.fun"><div className="back-button">Go to Mainnet</div></a>}
      {nftDisplay && 
      <div className="centrify nftDisplay" align="center" onClick={closeDisplay} style={{cursor: 'pointer'}} >
        <div className="nftTitle">Cybernaut in use (<span style={{color: 'white'}}>edition #{nft}</span>) </div>
        <img src={`https://cybernauts.fun/ipfsCache/${nft}.webp`} className="nftDisplayImage" /><br />
        <a href="https://opensea.io/collection/cybernauts-on-base" target="_blank"><button className="trade-button" onClick={() => {closeDisplay(); playButton()}}>Trade on Paintswap</button></a>
      </div>
      }
  
      <div className={visualEffect.dissolve1 ? 'dissolve-3d' : ''} style={{display: `${displayOff.hero}`}}>
        <div className={`literary-content-hero ${animations.literaryHero ? 'animate-in' : ''}`}>
          <img src={require('./assets/images/diya.gif')} className="candle" />
          <span className="waveanimator quote literary-content-title">Rules Of Play</span>
          <span className="literary-content-phonetic larger">The rules are simple. {isMobile ? ''  :  <br />}Simply predict your opponent to win the prize pot. {isMobile ? ''  :  <br />}Your odds are favorable: a wholesome <span style={{color: 'gold'}}>1 in 18</span> for the win.</span>
          <span className="literary-content-text">May the Singularity reward your cybernetic courage.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, hero: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>
      
      <div className={visualEffect.dissolve2 ? 'dissolve-3d' : ''} style={{display: `${displayOff.villain}`}}>
        <div className={`literary-content-villain ${animations.literaryVillain ? 'animate-in' : ''} villany`}>
          <img src={require('./assets/images/candle-bowl.gif')} className="candle" />
          <span className="waveanimator forest literary-content-title">Choose Your Destiny!</span>
          <span className="literary-content-phonetic larger">Cybernaut or Human? You are only one <span style={{color: 'gold'}}>correct guess</span> away from this season's <>{prizePot.jesse && <span style={{color: 'gold'}}> {formatNumber(prizePot.jesse)} $JESSE</span>}</> prize below. Win <span style={{color: 'gold'}}>$JESSE</span> and earn multiple token rewards as you play Jesse and the Cybernauts. </span>
          <span className="literary-content-text">Heroes play at 50% discount!<br/>Own Cybernaut NFTs to own heroes.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, villain: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>

      <div className={visualEffect.playbox ? 'denied-shake' : visualEffect.dissolve3 ? 'dissolve-3d' : ''} style={{display: `${displayOff.patron}`}}>
        <div className={`literary-content-patron ${animations.literaryPatron ? 'animate-in' : ''} higher`}>
          <img src={require('./assets/images/scented-candle.gif')} className="candle" />
          <span className="waveanimator regal literary-content-title">How To Play</span>
          <span className="literary-content-phonetic larger">Simply click on any of the <span style={{color: 'teal'}}>vestiges of humanity </span>below
          for your pick on who your opponent could be.</span>
          <span className="literary-content-text">Hit Play to find out who it is {isMobile ? ''  :  <br />}...and you've won this season's pot. <span style={{color: 'gold'}}><BsEmojiHeartEyesFill /></span></span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, patron: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div> 

      <div className={visualEffect.dissolve4 ? 'dissolve-3d' : ''} style={{display: `${displayOff.artifact}`}}>
        <div className={`literary-content-artifact tadhigh ${animations.literaryArtifact ? 'animate-in' : ''}`}>
          <img src={require('./assets/images/oil-lamp.gif')} className="candle" />
          <span className="waveanimator liberty literary-content-title">Low Risk - High Reward play</span>
          <span className="literary-content-phonetic larger">Pay a small fee each time you play. {isMobile ? ''  :  <br />} If you aren't lucky, it is added to {isMobile ? "" : <br/>} our prize pot for your <span style={{color: 'gold'}}>next attempt</span>. 
          {isMobile ? ''  :  <br />} Our fees are conveniently taken in <span style={{color: 'gold'}}>$JESSE</span>.</span>
          <span className="literary-content-text">If you own a Cybernaut NFT, you gain a discount on the platform fees for your winnings. Currently sitting at {feeType !== null ? feeType : 0}% discount {feeType == 0 && "\(because you own none)."}</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, artifact: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>
      
      <div className={isApproving ? 'notifications' : 'notificationscancel'} style={{display: hideNotifications ? 'block' : 'none'}}>
      {errorMessageVisible && (
        <div className={`notify notifyText ${isApproving ? '' : 'cancelled'} ${visualEffect.funds ? 'denied-shake' : ''}`}>              
          <MdCancel /> {errorMessage}
          <MdToggleOn onClick={() => setErrorMessageVisible(false)} style={{cursor: 'pointer', margin: '0vh 1vh'}}/>
        </div>
      )}
      </div>
      {/* <Partner /> */}
      {(counter !== prizePot.era) && lastWinner.pot && <div className='centrify prizewinner' onClick={saveEreCounter}>Hooray! A cybernaut has found the light!
        <span style={{color: "red", fontWeight: 'bold'}}>{truncateAddress(lastWinner.address)} </span>won the pot prize of <span style={{color: "red", fontWeight: 'bold'}}>{formatNumber(lastWinner.pot)} $JESSE</span> on <span style={{color: "red", fontWeight: 'bold'}}> {lastWinner.timestamp}</span> 
        Welcome to Season {prizePot.era}<br/>
        The Prize Pot is now at <span style={{color: "lime", fontWeight: 'bold', fontSize: 'xx-large'}}>{formatNumber(seasonPot)} $JESSE</span>. <br />
        Will you be the next Cybernaut to take this season's pot home? <br />
        <MdToggleOn/>
        </div>
       }
       {playId && (playId === randomResult) && <div className='centrify prizewinner' onClick={refreshState}>
        <span className="waveanimator liberty goldtext">Congratulations! You've won this season's pot!</span>
        Your gaming wallet <span style={{color: "red", fontWeight: 'bold'}}>{truncateAddress(account.address)} </span> will be credited soon.
        <br/> A new season begins!
        <MdToggleOn style={{color: 'whitesmoke'}}/>
       </div>
       }
    </div>
  );
};

export default Legends;

// import React, { useState, useEffect } from 'react';
// import './App.css';
// import "./Legends.css";
// import "./Story.css";
// import "./Mint.css";
// import legendsImg from './assets/images/legends.webp';


// const Legends = () => {
//   return (
//   <div className="mint-container" style={{backgroundImage:  `url(${legendsImg})`, backgroundColor: 'black'}}>
//     <a href="https://cybernauts.fun"><div className="waveanimator forest goldtext centered">Play on Testnet </div></a>
//   </div>
//   )
// }
// export default Legends;

