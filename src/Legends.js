import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import "./Legends.css";
import "./Story.css";
import "./Mint.css";
import { useMediaQuery } from 'react-responsive';
import { ethers } from "ethers";
import { prepareContractCall, waitForReceipt, prepareEvent, parseEventLogs } from "thirdweb";
import { useActiveAccount, useActiveWallet, useSendTransaction, useWalletBalance } from "thirdweb/react";
import { contract, blockchain, thirdwebLegendaryContract, 
  provider, legendaryContract, formatNumber, base, client, abi,
  cashcatContract, randomShuffle, thirdwebCASHCATContract, truncateAddress } from "./tools/utils";
import { RxDividerVertical } from "react-icons/rx";
import { MdToggleOn, MdCancel } from 'react-icons/md';
import { BsEmojiHeartEyesFill, BsEmojiDizzyFill } from 'react-icons/bs';
import { miscImages, LegendaryHeroes, LegendaryChoices,
  soundEffects, foregroundStoryboards } from "./tools/effects";
import ReactPlayer from 'react-player';
import Partner from './partner';

/** Safe bigint parse — never throws on null/undefined/bad RPC values. */
const toBigInt = (v) => {
  try {
    if (v === null || v === undefined || v === "") return 0n;
    return BigInt(typeof v === "object" && v.toString ? v.toString() : v);
  } catch {
    return 0n;
  }
};

/** Safe ether formatting — never throws on null/undefined. */
const safeFormatEther = (v) => {
  try {
    if (v === null || v === undefined) return "0";
    return ethers.formatEther(v);
  } catch {
    return "0";
  }
};

/** Safe number display helper wrapping formatNumber. */
const safeNum = (v, fallback = "0") => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return fallback;
  return formatNumber(v);
};

// Media Screen Resolution
const Desktop = ({ children }) => {
const isDesktop = useMediaQuery({ minWidth: 769 });
  return isDesktop ? children : null;
};

const Mobile = ({ children }) => {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  return isMobile ? children : null;
};

let account, wallet, isWalletParameter = false, isWalletRead = false, isNftRead = false;

// CashCat_n_MoneyMouse: dual on-chain draws; win when firstDraw == secondDraw
const DEFAULT_CHALLENGERS = 18; // contract default; used for UI odds copy

// Prepared event fragments for receipt parsing (on-chain RNG — no external oracle)
const randomNumberResultEvent = prepareEvent({
  signature: "event RandomNumberResult(uint256 indexed nonce, uint8 firstDraw, uint8 secondDraw)",
});
const proofOfNumberEvent = prepareEvent({
  signature: "event proofOfNumber(address indexed from, bytes32 userRandomNumber, uint256 result)",
});
const proofOfCashcatWinEvent = prepareEvent({
  signature: "event proofOfCashcat(uint256 indexed id, address indexed from, uint256 indexed amountWon, uint256 seeded)",
});

const Legends = ({setComponent}) => {
  account = useActiveAccount();
  wallet = useActiveWallet();
  const [loading, setLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(null);
  const [volumeLevel, setVolumeLevel] = useState(0.8);
  const [soundEffectUrl, setSoundEffectUrl] = useState(null);
  const [isEffectPlaying, setIsEffectPlaying] = useState(false); 
  const [transactionReceipt, setTransactionReceipt] = useState(null);
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
  const { mutate: sendTransaction, data: transactionResult, error: txError } = useSendTransaction();
  const [heroImage, setHeroImage] = useState(null);
  const [names, setNames] = useState({hero: null, villain: null});
  const [choiceImage, setChoiceImage] = useState(null);
  const [nftDisplay, setNFTDisplay] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [feeType, setFeeType] = useState(null);
  // randomResult = firstDraw; playId = secondDraw. Win when they match.
  const [playId, setPlayId] = useState(null);
  const [didWin, setDidWin] = useState(false);
  const [winAmount, setWinAmount] = useState(null);
  const [playOutcome, setPlayOutcome] = useState(null); // 'win' | 'lose' | null
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
  // eth = native pot (wei formatted as ether string number); era = season index
  const [prizePot, setPrizePot] = useState({eth: null, era: null});
  const [seasonPot, setSeasonPot] = useState(null);
  const [lastWinner, setLastWinner] = useState({address: null, pot: null, timestamp: null})
  const [recentCost, setRecentCost] = useState(null);
  /** Cached one-shot read from getGameData() — pot, fees, odds, last winner, etc. */
  const [gameData, setGameData] = useState(null);
  /** True only after a successful getGameData() parse — gate UI that depends on it. */
  const [dataReady, setDataReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  /** Increments on each bootstrap so stale async results are ignored. */
  const bootstrapGen = useRef(0);
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
  const pendingPlaySeed = useRef(null); // bytes32 seed awaiting receipt parse
  const processedTxHash = useRef(null); // avoid double-handling the same receipt

  function seasonSelector () {
    const cachedCounter = localStorage.getItem('seasonCounter');
    if (cachedCounter !== null && !isNaN(parseInt(cachedCounter))) {
      return parseInt(cachedCounter);
    }    
    return 1;
  }
  const [counter, setCounter] = useState(seasonSelector());

  const quickBanter = () => {
    if (!choiceImage) return;
    if (nft > 0 && speeches.nftSpeech?.length) {
      const bubbleIndex = randomShuffle(6);
      setSpeechBubble({hero: bubbleIndex + 1, nohero: null});
      const heroSpeechIndex = randomShuffle(speeches.nftSpeech.length);
      setHeroSpeech({hero: speeches.nftSpeech[heroSpeechIndex], nohero: null});
    } else if (!(nft > 0) && speeches.noNftSpeech?.length) {
      const bubbleIndex = randomShuffle(6);
      setSpeechBubble({hero: null, nohero: bubbleIndex + 1});
      const heroSpeechIndex = randomShuffle(speeches.noNftSpeech.length);
      setHeroSpeech({hero: null, nohero: speeches.noNftSpeech[heroSpeechIndex]});
    }
  }

  const verifyConnection = () => {
    if (!account) {
      setErrorMessage("Connect Wallet To Play");
      setErrorMessageVisible(true);
      playWrong();
      return false;
    }
    return true;
  }

  const handlePlay = () => {    
    if (loading || dataLoading) return;
    if (!dataReady || !gameData) {
      setErrorMessage(dataError || "Game data still loading — try again in a moment");
      setErrorMessageVisible(true);
      return;
    }
    if (!verifyConnection()) return;
    sendToCashcat();
  }
  
  const balanceVerificationCheck = () => {
    if (walletBalance == null || Number(walletBalance) <= 0) {
      setErrorMessage("You need ETH to pay the entry fee");
      setErrorMessageVisible(true);
      noPlayFunds();
      setLoading(false);
      return true;
    }
    return false;
  }

  const fetchAmenities = () => {
    const allSources = Object.values(foregroundStoryboards);
    if (!allSources.length) return;
    const imageIndex = randomShuffle(Math.max(allSources.length - 1, 0));
    setBackground(allSources[imageIndex]);
    // NFT / game data loaded via bootstrapGame — only banter once ready
    if (dataReady) quickBanter();
  }

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
    try {  
      if (nft > 0 ) {
        const response = await fetch(`https://daemon.penny4thots.my/ipfsCache/${nft}.json`, {
          method: "GET",
        });
    
        if (!response.ok) {
          console.log("Network response was not ok");
          return; // Exit if response is not ok
        }
    
        const heroData = await response.json();

        // Find the HERO trait
        const heroTrait = heroData.attributes.find(
          attr => attr.trait_type === "Cashcats"
        );
        
        if (heroTrait) {
          const heroName = heroTrait.value;
          
          // Remove any numbering or titles from the hero name (like "Androcles Kronjenidas I" -> "Androcles")
          const baseHeroName = heroName.split(' ')[0];
          
          // Find matching image in foregroundHeroes
          const matchedHeroImage = LegendaryHeroes[baseHeroName];
          
          if (matchedHeroImage) {
            setHeroImage(matchedHeroImage);
            setNames({...names, hero: baseHeroName});
          }
        }
      } else {
          setNames({...names, hero: "Unidentified"});
          setHeroImage(miscImages.noHeroFound);
      }
      
    } catch (err) {
      console.log("Error fetching NFT data: ", err);
    }
  };

  /**
   * Single RPC against the legend contract via getGameData(player, nft).
   * Returns pot, fees, odds, pause, stats, last winner, AND this player's fee quote.
   * @param {string} [player] wallet to price (defaults to connected account or zero)
   * @param {number} [nftId] Cashcat id for discount path (defaults to known nft state)
   */
  const fetchGameData = async (player, nftId) => {
    try {
      const playerAddr =
        player ||
        account?.address ||
        ethers.ZeroAddress;
      const nftParam =
        nftId !== undefined && nftId !== null && !Number.isNaN(Number(nftId))
          ? Number(nftId)
          : nft > 0
            ? Number(nft)
            : 0;

      const d = await legendaryContract.getGameData(playerAddr, nftParam);
      if (d == null) {
        throw new Error("Empty getGameData response");
      }

      const data = {
        pot: toBigInt(d.pot ?? d[0]),
        currentEra: Number(d.currentEra ?? d[1] ?? 1) || 1,
        requiredFee: toBigInt(d.requiredFee_ ?? d[2]),
        tokenFee: toBigInt(d.tokenFee_ ?? d[3]),
        multiple: toBigInt(d.multiple_ ?? d[4] ?? 1n),
        tokenMultiple: toBigInt(d.tokenMultiple_ ?? d[5] ?? 1n),
        platformFee: Number(d.platformFee_ ?? d[6] ?? 0) || 0,
        reseed: Number(d.reseed_ ?? d[7] ?? 0) || 0,
        challengers: Number(d.challengers_ ?? d[8] ?? DEFAULT_CHALLENGERS) || DEFAULT_CHALLENGERS,
        isPaused: Boolean(d.isPaused ?? d[9]),
        totalPlays: Number(d.totalPlays_ ?? d[10] ?? 0) || 0,
        totalAmountWon: toBigInt(d.totalAmountWon_ ?? d[11]),
        ethCostHolder: toBigInt(d.ethCostHolder ?? d[12]),
        ethCostNonHolder: toBigInt(d.ethCostNonHolder ?? d[13]),
        tokenCostHolder: toBigInt(d.tokenCostHolder ?? d[14]),
        tokenCostNonHolder: toBigInt(d.tokenCostNonHolder ?? d[15]),
        lastWinner: (d.lastWinner ?? d[16])?.toString?.() || ethers.ZeroAddress,
        lastWinEra: Number(d.lastWinEra ?? d[17] ?? 0) || 0,
        lastWinAmount: toBigInt(d.lastWinAmount ?? d[18]),
        lastWinTimestamp: Number(d.lastWinTimestamp ?? d[19] ?? 0) || 0,
        // player-specific quote (same call)
        ethCost: toBigInt(d.ethCost ?? d[20]),
        tokenCost: toBigInt(d.tokenCost ?? d[21]),
        platformfee: Number(d.platformfee ?? d[22] ?? 0) || 0,
        powerBonus: Number(d.powerBonus ?? d[23] ?? 0) || 0,
        qualifiesForDiscount: Boolean(d.qualifiesForDiscount ?? d[24]),
        quotedForNft: nftParam,
        quotedForPlayer: playerAddr,
      };

      setGameData(data);
      setDataReady(true);
      setDataError(null);

      const potEth = Number(safeFormatEther(data.pot));
      const potSafe = Number.isFinite(potEth) ? potEth : 0;
      setPrizePot({ eth: potSafe.toFixed(4), era: data.currentEra });
      setSeasonPot(potSafe.toFixed(4));

      if (
        data.currentEra > 1 &&
        data.lastWinner &&
        data.lastWinner !== ethers.ZeroAddress
      ) {
        const winAmt = Number(safeFormatEther(data.lastWinAmount));
        setLastWinner({
          address: data.lastWinner,
          pot: Number.isFinite(winAmt) ? winAmt : 0,
          timestamp: data.lastWinTimestamp
            ? new Date(data.lastWinTimestamp * 1000).toLocaleString()
            : "—",
        });
      }

      // Platform-fee discount % for UI (NFT holders vs full non-holder cut)
      if (data.qualifiesForDiscount) {
        const totalFee = data.platformFee + 5;
        const feetype = data.platformFee - data.powerBonus;
        const discount = totalFee > 0 ? ((totalFee - feetype) / totalFee) * 100 : 0;
        setFeeType(Number.isFinite(discount) ? discount : 0);
      } else if (nftParam === 0) {
        setFeeType(0);
      }

      return data;
    } catch (error) {
      console.error("fetchGameData failed:", error);
      const msg =
        error?.shortMessage ||
        error?.reason ||
        error?.message ||
        "Could not load game data";
      setDataError(msg);
      // Do not flip dataReady off if a prior successful load exists — only notify
      setErrorMessage("Could not load game data from contract");
      setErrorMessageVisible(true);
      return null;
    }
  };

  /**
   * Bootstrap: wait for getGameData before treating the board as ready.
   * Avoids null crashes while fee/pot/era fields are still loading.
   */
  const bootstrapGame = async () => {
    const gen = ++bootstrapGen.current;
    setDataLoading(true);
    setDataError(null);
    try {
      // 1) Always load global (or player/non-nft) snapshot first
      const player = account?.address || ethers.ZeroAddress;
      const gd = await fetchGameData(player, 0);
      if (gen !== bootstrapGen.current) return; // superseded by newer bootstrap
      if (!gd) {
        setDataReady(false);
        return;
      }

      // 2) If wallet connected, resolve NFT and re-quote in one more getGameData
      if (account?.address) {
        await fetchNFT();
      } else {
        setNFT(0);
      }
      if (gen !== bootstrapGen.current) return;
    } catch (err) {
      if (gen !== bootstrapGen.current) return;
      console.error("bootstrapGame failed:", err);
      setDataError(err?.message || "Failed to bootstrap game");
      // First load: dataReady stays false. Re-fetch fail: leave prior ready snapshot.
    } finally {
      if (gen === bootstrapGen.current) {
        setDataLoading(false);
      }
    }
  };

  /** Fee preview for the Play button — uses player quote from getGameData when available. */
  const getFeePreview = () => {
    if (!dataReady || !gameData) return null;
    try {
      const hasNft = nft > 0;
      const ethWei =
        gameData.ethCost != null
          ? gameData.ethCost
          : hasNft
            ? gameData.ethCostHolder
            : gameData.ethCostNonHolder;
      const tokWei =
        gameData.tokenCost != null
          ? gameData.tokenCost
          : hasNft
            ? gameData.tokenCostHolder
            : gameData.tokenCostNonHolder;
      if (ethWei == null || tokWei == null) return null;
      const eth = Number(safeFormatEther(ethWei));
      const ccc = Number(safeFormatEther(tokWei));
      if (!Number.isFinite(eth) || !Number.isFinite(ccc)) return null;
      return {
        eth,
        ccc,
        hasNft: hasNft || Boolean(gameData.qualifiesForDiscount),
      };
    } catch (e) {
      console.warn("getFeePreview failed:", e);
      return null;
    }
  };

  const fetchNFT = async() => {
    if (!account?.address) {
      setNFT(0);
      await fetchGameData(ethers.ZeroAddress, 0);
      return;
    }
    try {      
     const call1 = await contract.balanceOf(account.address);
     const token = Number(call1) || 0;

     if (token > 0) {
      const index = randomShuffle(token);
      const call2 = await contract.tokenOfOwnerByIndex(account.address, index);
      const tokenId = Number(call2);
      if (!Number.isFinite(tokenId) || tokenId <= 0) {
        setNFT(0);
        await fetchGameData(account.address, 0);
        return;
      }
      const call3 = await contract.blacklisted(tokenId);
        // public mapping returns (bool blacklist)
        const isBlacklisted = typeof call3 === 'object' && call3 !== null
          ? Boolean(call3.blacklist ?? call3[0])
          : Boolean(call3);
        if (isBlacklisted) { 
          setNFT(0);
          // one legend RPC: global + non-holder quote
          await fetchGameData(account.address, 0);
        } else {
          setNFT(tokenId);
          // one legend RPC: global + holder quote / power bonus / fees
          await fetchGameData(account.address, tokenId);
        }

     } else {
      setNFT(0);
      await fetchGameData(account.address, 0);
    }

    } catch (err) {
      console.log("error fetching NFTs: ", err);
      setNFT(0);
      // Still try global quote so play board can load
      try {
        await fetchGameData(account?.address || ethers.ZeroAddress, 0);
      } catch (_) { /* already logged in fetchGameData */ }
    }
  }

  const refreshState = () => {
    isWalletParameter = false;
    setError(null);
    setPlayId(null);
    setFeeType(null);
    setErrorMessage("");
    setRandomResult(null);
    setSequenceNumber(null);
    setUserRandomNumero(null);
    setTransactionReceipt(null);
    setErrorMessageVisible(false);
    setHeroMappings({byNumber: {}, bySrc: {}});
    setDidWin(false);
    setWinAmount(null);
    setPlayOutcome(null);
    setMatchImage(null);
    pendingPlaySeed.current = null;
  }

  /**
   * Parse on-chain RNG outcome from a confirmed play transaction.
   * Contract emits RandomNumberResult(firstDraw, secondDraw) + proofOfNumber;
   * on match also proofOfCashcat (native pot payout).
   */
  const applyPlayOutcome = ({ firstDraw, secondDraw, nonce, potWon, amountWon }) => {
    const a = Number(firstDraw);
    const b = secondDraw != null ? Number(secondDraw) : null;
    const isMatch = b != null && !Number.isNaN(a) && !Number.isNaN(b) && a === b;

    setRandomResult(a);
    setPlayId(b);
    if (nonce != null) setSequenceNumber(nonce.toString());

    setDidWin(Boolean(potWon) || isMatch);
    setPlayOutcome(isMatch || potWon ? 'win' : 'lose');
    if (amountWon != null) {
      const won = Number(safeFormatEther(amountWon));
      setWinAmount(Number.isFinite(won) ? won : 0);
    } else {
      setWinAmount(null);
    }

    isWalletParameter = false;
    setLoading(false);

    // Refresh pot / balances after the play fee (and possible payout)
    setTimeout(() => {
      fetchCashcatBalance();
      isWalletParameter = false;
    }, 1500);
  };

  const processPlayReceipt = async (txResult) => {
    try {
      const transactionHash =
        typeof txResult === 'string'
          ? txResult
          : txResult?.transactionHash || txResult?.hash;

      if (!transactionHash) {
        console.error('Play tx result missing hash', txResult);
        setErrorMessage('Play submitted but no receipt hash');
        setErrorMessageVisible(true);
        setLoading(false);
        return;
      }
      if (processedTxHash.current === transactionHash) return;
      processedTxHash.current = transactionHash;

      setTransactionReceipt(txResult);

      const receipt = await waitForReceipt({
        client,
        chain: base,
        transactionHash,
      });

      if (receipt.status === 'reverted' || receipt.status === 0 || receipt.status === '0') {
        setErrorMessage('Play transaction reverted');
        setErrorMessageVisible(true);
        setLoading(false);
        pendingPlaySeed.current = null;
        return;
      }

      const events = parseEventLogs({
        logs: receipt.logs,
        events: [randomNumberResultEvent, proofOfNumberEvent, proofOfCashcatWinEvent],
      });

      let firstDraw = null;
      let secondDraw = null;
      let nonce = null;
      let potWon = false;
      let amountWon = null;
      const seed = pendingPlaySeed.current;

      for (const ev of events) {
        if (ev.eventName === 'RandomNumberResult') {
          nonce = ev.args.nonce ?? ev.args[0];
          firstDraw = ev.args.firstDraw ?? ev.args[1];
          secondDraw = ev.args.secondDraw ?? ev.args[2];
        }
        if (ev.eventName === 'proofOfNumber') {
          const from = (ev.args.from ?? ev.args[0])?.toString?.() || '';
          const userRandomNumber = (ev.args.userRandomNumber ?? ev.args[1])?.toString?.() || '';
          // Prefer our own play if seed matches; otherwise still take result if from our account
          if (
            account?.address &&
            from.toLowerCase() === account.address.toLowerCase() &&
            (!seed || userRandomNumber.toLowerCase() === seed.toLowerCase())
          ) {
            // proofOfNumber only carries first draw; keep secondDraw from RandomNumberResult
            if (firstDraw == null) firstDraw = ev.args.result ?? ev.args[2];
          }
        }
        if (ev.eventName === 'proofOfCashcat') {
          const from = (ev.args.from ?? ev.args[1])?.toString?.() || '';
          if (account?.address && from.toLowerCase() === account.address.toLowerCase()) {
            potWon = true;
            amountWon = ev.args.amountWon ?? ev.args[2];
          }
        }
      }

      // Fallback: decode with ethers Interface if thirdweb parse missed logs
      if (firstDraw == null && receipt.logs?.length) {
        const iface = new ethers.Interface(abi.legend);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (!parsed) continue;
            if (parsed.name === 'RandomNumberResult') {
              nonce = parsed.args[0];
              firstDraw = parsed.args[1];
              secondDraw = parsed.args[2];
            } else if (parsed.name === 'proofOfNumber') {
              if (firstDraw == null) firstDraw = parsed.args[2];
            } else if (parsed.name === 'proofOfCashcat') {
              potWon = true;
              amountWon = parsed.args[2];
            }
          } catch {
            // not our event
          }
        }
      }

      if (firstDraw == null) {
        console.error('No RNG events in play receipt', receipt);
        setErrorMessage('Play confirmed but no random result found');
        setErrorMessageVisible(true);
        setLoading(false);
        pendingPlaySeed.current = null;
        return;
      }

      applyPlayOutcome({ firstDraw, secondDraw, nonce, potWon, amountWon });
      pendingPlaySeed.current = null;
    } catch (err) {
      console.error('processPlayReceipt failed:', err);
      setErrorMessage(err?.shortMessage || err?.message || 'Failed to read play result');
      setErrorMessageVisible(true);
      setLoading(false);
      pendingPlaySeed.current = null;
    }
  };

  const fetchCashcatBalance = async() => { 
    if (!account?.address) return;
    try {
      // Token balance only here — pot/era already come from getGameData bootstrap
      const call = await cashcatContract.balanceOf(account.address);
      const formattedCall = safeFormatEther(call);
      const tokenBalMil = Number(formattedCall) / 10**6;
      const tokenBalK = Number(formattedCall) / 10**3;
      const tokenBalData = Number(formattedCall);
      if (tokenBalMil > 0.1) {
        setTokenBalance({Wei: call, Mil: tokenBalMil, K: null, Data: null});
      } else if (tokenBalK > 0.998) {
        setTokenBalance({Wei: call, Mil: null, K: tokenBalK, Data: null});
      } else if (tokenBalData > 0) {
        setTokenBalance({Wei: call, Mil: null, K: null, Data: tokenBalData});
      } else {
        setTokenBalance({Wei: call, Mil: null, K: null, Data: 0});
      }
      // Refresh pot/quote after plays without blocking on NFT re-resolve
      if (dataReady) {
        const nftParam = nft > 0 ? nft : 0;
        await fetchGameData(account.address, nftParam);
      }
    } catch (error) {
      console.error("fetchCashcatBalance failed:", error);
      setErrorMessage("Could not fetch balances / pot");
      setErrorMessageVisible(true);
    }
  }
  
  function WalletParameter() {
    let tx, tx2;
    const walletAddress = account?.address;
    const { data: myBalance, isLoading, isError } = useWalletBalance({
      chain: base,
      address: walletAddress,
      client,
    });

    const { data: potBalance, isLoading: potLoading, isError: potError } = useWalletBalance({
      chain: base,
      address: blockchain.legend_contract_address,
      client,
    });

    useEffect(() => {
      if (isError || potError) {
        setErrorMessage("Internet Error. Refresh please.");
        setErrorMessageVisible(true);
      }
    }, [isError, potError]);

    useEffect(() => {    
      if (!account || !myBalance) return;
      if ((account && myBalance && !walletBalance) || (account && myBalance && !isWalletParameter)) {
        if (isWalletRead) return;
        isWalletRead = true;
        isWalletParameter = true;
        try {
          const raw = myBalance?.value?.toString?.() ?? "0";
          tx = safeFormatEther(raw);
          const bal = Number(tx);
          setWalletBalance(Number.isFinite(bal) ? bal.toFixed(10) : "0");
          if (potBalance?.value != null && !dataReady) {
            // Prefer getGameData pot once ready; only seed from wallet balance while loading
            tx2 = safeFormatEther(potBalance.value.toString());
            const potN = Number(tx2);
            if (Number.isFinite(potN)) setSeasonPot(potN.toFixed(4));
          }
          fetchCashcatBalance();
        } catch (e) {
          console.warn("WalletParameter hydrate failed:", e);
        }
        isWalletRead = false;
      }
    }, [account, transactionResult, txError, isWalletParameter, myBalance, potBalance]);
  }


  const saveEreCounter = () => {
    const era = prizePot?.era;
    if (era == null) return;
    setCounter(era);
    localStorage.setItem('seasonCounter', String(era));
    console.log("eraset: ", era);
  }

  /**
   * Play entrypoint: native ETH entry fee (pot) + $CASHCAT tokenFee, dual RNG via sendToCashcat.
   * Result is resolved from the confirmed tx receipt (firstDraw == secondDraw to win).
   */
  const sendToCashcat = async () => {
    if (!choiceImage) {
      noPlay();
      return;
    }

    if (balanceVerificationCheck()) return;

    isWalletParameter = false;
    setLoading(true);
    setPlayOutcome(null);
    setDidWin(false);
    setWinAmount(null);
    setMatchImage(null);
    setRandomResult(null);
    setPlayId(null);

    // User-supplied entropy mixed on-chain with block.prevrandao / nonce / etc.
    const userRandomNumber = ethers.hexlify(ethers.randomBytes(32));
    console.log("User RNG seed: ", userRandomNumber);
    pendingPlaySeed.current = userRandomNumber;
    setUserRandomNumero(userRandomNumber);

    try {
      if (!account?.address) {
        setErrorMessage("Connect Wallet To Play");
        setErrorMessageVisible(true);
        setLoading(false);
        pendingPlaySeed.current = null;
        return;
      }

      // One legend-contract RPC: fees + pot + pause + player quote
      const nftParam = nft > 0 ? nft : 0;
      const gd = await fetchGameData(account.address, nftParam);
      if (!gd || gd.ethCost == null || gd.tokenCost == null) {
        throw new Error("Could not load fee schedule");
      }

      const ethCostWei = gd.ethCost;
      const tokenCostWei = gd.tokenCost;

      const ethCostEth = Number(safeFormatEther(ethCostWei));
      const tokenCostEth = Number(safeFormatEther(tokenCostWei));
      if (!Number.isFinite(ethCostEth) || !Number.isFinite(tokenCostEth)) {
        throw new Error("Invalid fee values from contract");
      }
      setRecentCost(ethCostEth.toString());

      if (gd.isPaused) {
        setErrorMessage("Game is paused. Try again later.");
        setErrorMessageVisible(true);
        setLoading(false);
        pendingPlaySeed.current = null;
        return;
      }

      // Native entry fee check
      if (walletBalance != null && Number(walletBalance) < ethCostEth) {
        setErrorMessage(`Requires ${formatNumber(ethCostEth)} ETH entry fee`);
        setErrorMessageVisible(true);
        noPlayFunds();
        setLoading(false);
        pendingPlaySeed.current = null;
        return;
      }

      // Token fee check + approval when tokenFee is configured
      if (tokenCostWei > 0n) {
        const playerTok = tokenBalance.Wei != null
          ? toBigInt(tokenBalance.Wei)
          : toBigInt(await cashcatContract.balanceOf(account.address));

        if (playerTok < tokenCostWei) {
          setErrorMessage(
            `Requires ${formatNumber(tokenCostEth)} $CASHCAT token fee` +
            (nftParam > 0 ? "" : " (non-NFT rate)")
          );
          setErrorMessageVisible(true);
          noPlayFunds();
          setLoading(false);
          pendingPlaySeed.current = null;
          return;
        }

        const approvalAllowance = toBigInt(
          await cashcatContract.allowance(
            account.address,
            blockchain.legend_contract_address
          )
        );

        if (approvalAllowance < tokenCostWei) {
          console.log("Initiating $CASHCAT approval...");
          setIsApproving(true);
          setErrorMessage("Requesting $CASHCAT Approval...");
          setErrorMessageVisible(true);

          const approveTransaction = prepareContractCall({
            contract: thirdwebCASHCATContract,
            method: "function approve(address spender, uint256 value)",
            params: [blockchain.legend_contract_address, playerTok],
          });

          sendTransaction(approveTransaction);
          return;
        }
      }

      quickBanter();
      processedTxHash.current = null;

      const transaction = prepareContractCall({
        contract: thirdwebLegendaryContract,
        method: "function sendToCashcat(uint256 _nft, bytes32 userRandomNumber) payable",
        params: [nftParam, userRandomNumber],
        // Native entry fee funds the pot (taxes distributed on-chain)
        value: ethCostWei,
      });

      sendTransaction(transaction);
      console.log("Play transaction submitted (awaiting on-chain RNG)...");
    } catch (error) {
      console.error("Error in sendToCashcat:", error);
      setErrorMessage(formatPlayError(error));
      setErrorMessageVisible(true);
      setLoading(false);
      pendingPlaySeed.current = null;
    }
  };

  /** Map common revert data / viem messages to player-facing copy */
  function formatPlayError(error) {
    const raw = String(
      error?.data ||
      error?.cause?.data ||
      error?.cause?.reason ||
      error?.shortMessage ||
      error?.message ||
      ""
    );
    // OZ ERC721NonexistentToken(uint256) selector — token id not minted
    if (raw.includes("0x7e273289") || /ERC721NonexistentToken/i.test(raw)) {
      return "That Cashcat NFT does not exist yet. Play without an NFT, or mint one first.";
    }
    if (/Smart contracts not allowed/i.test(raw)) {
      return "Play from a normal wallet (no contract wallets).";
    }
    if (/Paused Contract/i.test(raw)) {
      return "Game is paused. Try again later.";
    }
    if (/Insufficient fee/i.test(raw)) {
      return "Not enough ETH sent for the entry fee.";
    }
    if (/SafeERC20FailedOperation|ERC20Insufficient|transfer amount exceeds|insufficient allowance/i.test(raw)) {
      return "Not enough $CASHCAT (or allowance) for the token fee.";
    }
    if (/insufficient funds|exceeds the balance/i.test(raw)) {
      return "Not enough ETH in your wallet for gas + entry fee.";
    }
    // Prefer short viem message when present
    if (error?.shortMessage && !/Encoded error signature/i.test(error.shortMessage)) {
      return error.shortMessage;
    }
    if (/Encoded error signature/i.test(raw)) {
      return "Play reverted on-chain (unknown error). Check fees / NFT / pause state.";
    }
    return error?.message || "Play failed";
  }

  useEffect(() => {
    if (loading && !isApproving && transactionResult) {
      if (isWalletRead) return;
      isWalletRead = true;
      // Confirmed (or at least submitted) play — parse RNG from receipt
      processPlayReceipt(transactionResult).finally(() => {
        isWalletRead = false;
      });
    }

    if (loading && isApproving && transactionResult) {
      if (isWalletRead) return;
      isWalletRead = true;
      setIsApproving(false);
      setErrorMessage("Approved! Playing...");
      setErrorMessageVisible(true);
      setTimeout(() => {
        sendToCashcat();
        isWalletRead = false;
      }, 2500);
    }

    if (loading && !isApproving && txError) {
      if (isWalletRead) return;
      isWalletRead = true;
      setLoading(false);
      setErrorMessage(txError?.message || "Play dropped / rejected");
      setErrorMessageVisible(true);
      isWalletParameter = false;
      pendingPlaySeed.current = null;
      isWalletRead = false;
    }

    if (loading && isApproving && txError) {
      setIsApproving(false);
      setLoading(false);
      setErrorMessage("Approval cancelled");
      setErrorMessageVisible(true);
      pendingPlaySeed.current = null;
    }
  }, [transactionResult, txError]);

  // Background art (non-chain) once on mount
  useEffect(() => {
    fetchAmenities();
  }, []);

  // Bootstrap contract helper whenever wallet connects/disconnects.
  // Gate interactive fee/play UI on dataReady so null fields never hit the render path.
  useEffect(() => {
    setHeroImage(null);
    setPlayOutcome(null);
    setTokenBalance({ Wei: null, Mil: null, K: null, Data: null });
    isWalletParameter = false;
    if (!account) {
      setWalletBalance(null);
      setNFT(null);
    }
    bootstrapGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  useEffect(() => {
    if (account && nft !== null && nft > 0) {
      fetchHero(); 
    } else if (nft === 0) {
      setNames((n) => ({ ...n, hero: "Unidentified" }));
      setHeroImage(miscImages.noHeroFound);
    }
  }, [nft, account]);
  
  useEffect(() => {
    if (account) {        
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

  // After on-chain roll lands: map lucky number (playId) + rolled result onto choice/fate art
  useEffect(() => {
    if (playId != null && randomResult != null && choiceImage) {
      assignRandomNumbers(playId, randomResult, choiceImage);
      playThunder();
      setLoading(false);
      // Soft refresh NFT / background without wiping outcome state
      const allSources = Object.values(foregroundStoryboards);
      const imageIndex = randomShuffle(allSources.length - 1);
      setBackground(allSources[imageIndex]);
    }
  }, [playId, randomResult]);

  useEffect(() => {
    if (speeches.nftReplySpeech?.length && choiceImage && nft > 0) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: replyBubbleIndex + 1, nohero: null});
      const heroReplySpeechIndex = randomShuffle(speeches.nftReplySpeech.length);
      setReplySpeech({hero: speeches.nftReplySpeech[heroReplySpeechIndex], nohero: null});
    } else if (speeches.noNftReplySpeech?.length && choiceImage && !(nft > 0)) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: null, nohero: replyBubbleIndex + 1});
      const heroReplySpeechIndex = randomShuffle(speeches.noNftReplySpeech.length);
      setReplySpeech({hero: null, nohero: speeches.noNftReplySpeech[heroReplySpeechIndex]});
    }
  },[choiceImage]);

  useEffect(() => {
    const getSpeeches = async () => {
      try {
        // Local themed banter: Cats (bounty hunters / NFT) vs Mice (rich prey / no-NFT)
        const response = await fetch(`${process.env.REACT_PUBLIC_NFT_CACHE || ''}/quips.json`, {
          method: 'GET',
        });

        if (!response.ok) {
          console.log('Failed to obtain Speech Bubbles');
          return;
        }

        const allSpeech = await response.json();

        setSpeeches({
          nftSpeech: allSpeech.cat_quips,
          nftReplySpeech: allSpeech.response_cat_quips,
          noNftSpeech: allSpeech.mouse_quips,
          noNftReplySpeech: allSpeech.response_mouse_quips,
        });
      } catch (err) {
        // Offline / missing file: speech bubbles are non-critical
        console.warn('Speech bubbles unavailable:', err?.message || err);
      }
    };

    getSpeeches();
  }, []);

  // Last winner is included in getGameData(); only backfill if cache is missing fields
  useEffect(() => {
    if (
      dataReady &&
      prizePot?.era != null &&
      counter !== prizePot.era &&
      gameData?.lastWinner &&
      gameData.lastWinner !== ethers.ZeroAddress &&
      (lastWinner?.pot == null)
    ) {
      const pot = Number(safeFormatEther(gameData.lastWinAmount));
      setLastWinner({
        address: gameData.lastWinner,
        pot: Number.isFinite(pot) ? pot : 0,
        timestamp: gameData.lastWinTimestamp
          ? new Date(gameData.lastWinTimestamp * 1000).toLocaleString()
          : "—",
      });
    }
  }, [prizePot?.era, gameData, counter, lastWinner?.pot, dataReady]);

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

  const playDisabled = loading || dataLoading || !dataReady;
  const challengersShown = gameData?.challengers || DEFAULT_CHALLENGERS;
  const feePreview = getFeePreview();

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

      {/* Full-board gate until getGameData has resolved at least once */}
      {(dataLoading && !dataReady) && (
        <div className="centrify" style={{ zIndex: 50, pointerEvents: 'auto' }}>
          <div className="waveanimator quote goldtext" style={{ fontSize: '1.2rem', padding: '1rem' }}>
            Loading game data…
          </div>
        </div>
      )}
      {(!dataLoading && !dataReady && dataError) && (
        <div className="centrify" style={{ zIndex: 50, pointerEvents: 'auto' }}>
          <div className="notify notifyText cancelled" style={{ maxWidth: '90vw' }}>
            <MdCancel /> Could not load contract data.
            <div style={{ marginTop: '0.5rem', opacity: 0.9, fontSize: '0.85em' }}>
              {String(dataError).slice(0, 160)}
            </div>
            <button
              className="legend-button"
              style={{ marginTop: '0.75rem' }}
              onClick={() => bootstrapGame()}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="nft">
        {(nft === null || dataLoading) && <div className="nftText">...loading</div>} 
        {nft > 0 && !dataLoading && <img src={`https://daemon.penny4thots.my/ipfsCache/${nft}.webp`} alt="NFT" className="nftImage" onClick={() => setNFTDisplay(true)} />}
        {nft === 0 && !dataLoading && <img src={require('./assets/images/nonftsfound.webp')} alt="NFT" className="nftImage" onClick={noPlayNFT} />}
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
        <div className="villainText">
          {loading
            ? "Hunting..."
            : randomResult != null && playId != null
              ? `FATE #${randomResult} vs #${playId}${Number(randomResult) === Number(playId) ? ' MATCH' : ''}`
              : randomResult != null
                ? `FATE #${randomResult}`
                : !randomResult && choiceImage
                  ? "YOUR LAST FATE"
                  : "YOUR FATE"}
        </div>
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
      <div className="dashboard" />
        <div className="scoreboard"><>Balance: {walletBalance != null ? <span className="waveanimator quote goldtext"> {safeNum(walletBalance)}</span> : <span className="waveanimator quote goldtext">Loading... </span>} <span className='fontSmall'>ETH</span></>
        {isMobile ? <br /> : <span> {(tokenBalance?.Mil || tokenBalance?.K || tokenBalance?.Data) && <RxDividerVertical />}</span>}
        {tokenBalance?.Mil != null && tokenBalance.Mil > 0 && <><span className="waveanimator quote goldtext">  {safeNum(tokenBalance.Mil)} Mil</span> <span className='fontSmall'>CASHCAT</span> </>}
        {tokenBalance?.K != null && tokenBalance.K > 0 && <><span className="waveanimator quote goldtext"> {safeNum(tokenBalance.K)} K</span> <span className='fontSmall'>CASHCAT</span> </>}
        {tokenBalance?.Data != null && tokenBalance.Data > 0 && <><span className="waveanimator quote goldtext"> {safeNum(tokenBalance.Data)}</span> <span className='fontSmall'>CASHCAT</span> </>}
      </div>
        <div className="button-board">
          <button
            className='legend-button'
            onClick={handlePlay}
            disabled={playDisabled}
            style={{ opacity: playDisabled ? 0.4 : 1, cursor: playDisabled ? 'not-allowed' : 'pointer' }}
            title={
              !dataReady
                ? (dataLoading ? 'Loading game data…' : (dataError || 'Game data unavailable'))
                : feePreview
                  ? (feePreview.ccc > 0
                      ? `Entry: ${safeNum(feePreview.eth)} ETH + ${safeNum(feePreview.ccc)} $CASHCAT${feePreview.hasNft ? ' (NFT rate)' : ' (full rate)'}`
                      : `Entry: ${safeNum(feePreview.eth)} ETH${feePreview.hasNft ? ' (NFT rate)' : ' (full rate)'}`)
                  : 'Play'
            }
          >
            {dataLoading && !dataReady ? (
              'Loading…'
            ) : loading ? (
              isApproving ? 'Approving...' : 'Rolling...'
            ) : (
              <>
                <span>Play!</span>
                {feePreview && (
                  <span
                    className="fontSmall"
                    style={{
                      display: 'block',
                      fontSize: '0.65em',
                      lineHeight: 1.2,
                      marginTop: '0.15em',
                      opacity: 0.92,
                      fontWeight: 500,
                    }}
                  >
                    {safeNum(feePreview.eth)} ETH
                    {feePreview.ccc > 0 ? ` + ${safeNum(feePreview.ccc)} CCC` : ''}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
      {account?.address && dataReady && <WalletParameter />}
      {blockchain.chainId === 57054 && <a className="mainlink" href="https://cashcats.fun"><div className="back-button">Go to Mainnet</div></a>}
      {nftDisplay && 
      <div className="centrify nftDisplay" align="center" onClick={closeDisplay} style={{cursor: 'pointer'}} >
        <div className="nftTitle">Cashcat in use (<span style={{color: 'white'}}>edition #{nft}</span>) </div>
        <img src={`https://daemon.penny4thots.my/ipfsCache/${nft}.webp`} className="nftDisplayImage" /><br />
        <a href="https://opensea.io/collection/0x6f2A200D859a1E4DF8FfB28eBc6F45F4b0341132" target="_blank"><button className="trade-button" onClick={() => {closeDisplay(); playButton()}}>Trade on Paintswap</button></a>
      </div>
      }
  
      <div className={visualEffect.dissolve1 ? 'dissolve-3d' : ''} style={{display: `${displayOff.hero}`}}>
        <div className={`literary-content-hero ${animations.literaryHero ? 'animate-in' : ''}`}>
          <img src={require('./assets/images/diya.gif')} className="candle" />
          <span className="waveanimator quote literary-content-title">Rules Of Play</span>
          <span className="literary-content-phonetic larger">The rules are simple. {isMobile ? ''  :  <br />}Pick a vestige, hit Play, and the chain rolls <span style={{color: 'gold'}}>two</span> fate numbers. {isMobile ? ''  :  <br />}If they <span style={{color: 'gold'}}>match</span> (about 1 in {challengersShown} for NFT heroes), you win the season ETH pot.</span>
          <span className="literary-content-text">Randomness is fully on-chain — no external oracles. Non-holders face tougher odds.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, hero: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>
      
      <div className={visualEffect.dissolve2 ? 'dissolve-3d' : ''} style={{display: `${displayOff.villain}`}}>
        <div className={`literary-content-villain ${animations.literaryVillain ? 'animate-in' : ''} villany`}>
          <img src={require('./assets/images/candle-bowl.gif')} className="candle" />
          <span className="waveanimator forest literary-content-title">Choose Your Destiny!</span>
          <span className="literary-content-phonetic larger">Cashcat or Human? Every play feeds the ETH pot. Match both fate numbers to claim this season's <>{dataReady && prizePot?.eth != null && <span style={{color: 'gold'}}> {safeNum(prizePot.eth)} ETH</span>}</> prize. </span>
          <span className="literary-content-text">Heroes (Cashcat NFT holders) pay base ETH + $CASHCAT fees; humans pay a multiple.<br/>Own Cashcat NFTs to own heroes.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, villain: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>

      <div className={visualEffect.playbox ? 'denied-shake' : visualEffect.dissolve3 ? 'dissolve-3d' : ''} style={{display: `${displayOff.patron}`}}>
        <div className={`literary-content-patron ${animations.literaryPatron ? 'animate-in' : ''} higher`}>
          <img src={require('./assets/images/scented-candle.gif')} className="candle" />
          <span className="waveanimator regal literary-content-title">How To Play</span>
          <span className="literary-content-phonetic larger">Click any <span style={{color: 'teal'}}>vestige of humanity</span> below as your pick, then hit Play. The contract rolls two numbers on-chain (1–{challengersShown} for heroes).</span>
          <span className="literary-content-text">If both draws match, you take the ETH pot. {isMobile ? ''  :  <br />}Miss, and your ETH fee grows the prize for the next cat. <span style={{color: 'gold'}}><BsEmojiHeartEyesFill /></span></span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, patron: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div> 

      <div className={visualEffect.dissolve4 ? 'dissolve-3d' : ''} style={{display: `${displayOff.artifact}`}}>
        <div className={`literary-content-artifact tadhigh ${animations.literaryArtifact ? 'animate-in' : ''}`}>
          <img src={require('./assets/images/oil-lamp.gif')} className="candle" />
          <span className="waveanimator liberty literary-content-title">Low Risk - High Reward play</span>
          <span className="literary-content-phonetic larger">Pay a small <span style={{color: 'gold'}}>ETH</span> entry fee (feeds the pot) plus a <span style={{color: 'gold'}}>$CASHCAT</span> token fee each play. {isMobile ? ''  :  <br />} Miss and your ETH stays in the pot for the <span style={{color: 'gold'}}>next attempt</span>.</span>
          <span className="literary-content-text">If you own a Cashcat NFT, you gain a discount on the platform fee cut of your winnings. Currently sitting at {feeType !== null ? feeType : 0}% discount {feeType == 0 && "\(because you own none)."}</span>
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
      {dataReady && seasonPot != null && prizePot?.era != null && (
        <div className="balloons">
          <span className="smaller">Season's {prizePot.era} Pot</span>
          <br />
          {safeNum(seasonPot)} ETH
        </div>
      )}
      {/* <Partner /> */}
      {dataReady &&
        prizePot?.era != null &&
        counter !== prizePot.era &&
        lastWinner?.pot != null &&
        lastWinner?.address && (
        <div className='centrify prizewinner' onClick={saveEreCounter}>Hooray! A cashcat has found the light!
        <span style={{color: "red", fontWeight: 'bold'}}>{truncateAddress(lastWinner.address)} </span>won the pot prize of <span style={{color: "red", fontWeight: 'bold'}}>{safeNum(lastWinner.pot)} ETH</span> on <span style={{color: "red", fontWeight: 'bold'}}> {lastWinner.timestamp || "—"}</span> 
        Welcome to Season {prizePot.era}<br/>
        The Prize Pot is now at <span style={{color: "lime", fontWeight: 'bold', fontSize: 'xx-large'}}>{safeNum(seasonPot)} ETH</span>. <br />
        Will you be the next Cashcat to take this season's pot home? <br />
        <MdToggleOn/>
        </div>
       )}
       {/* Dual-draw match (firstDraw == secondDraw) — contract win condition */}
       {playOutcome === 'win' && (
         <div className='centrify prizewinner' onClick={refreshState}>
           <span className="waveanimator liberty goldtext">
             {winAmount
               ? "Congratulations! You've won this season's pot!"
               : "Double match! You hit the jackpot roll!"}
           </span>
           <div style={{ marginTop: '0.5rem' }}>
             Draws <span style={{ color: 'gold', fontWeight: 'bold' }}>#{randomResult}</span>
             {' '}&amp;{' '}
             <span style={{ color: 'gold', fontWeight: 'bold' }}>#{playId != null ? playId : randomResult}</span>
             {' '}— matched!
           </div>
           {winAmount != null && winAmount > 0 && (
             <div>
               Payout ~ <span style={{ color: 'lime', fontWeight: 'bold' }}>{safeNum(winAmount)} ETH</span>
               {' '}to <span style={{ color: 'red', fontWeight: 'bold' }}>{truncateAddress(account?.address)}</span>
             </div>
           )}
           {(!winAmount || winAmount <= 0) && (
             <div style={{ opacity: 0.9 }}>
               Pot was empty this season — your fee still seeded the next round.
             </div>
           )}
           <br />
           <MdToggleOn style={{ color: 'whitesmoke' }} />
         </div>
       )}
       {playOutcome === 'lose' && randomResult != null && (
         <div className='centrify prizewinner' onClick={() => setPlayOutcome(null)} style={{ cursor: 'pointer' }}>
           <span className="waveanimator forest goldtext">No match this round</span>
           <div>
             Draws <span style={{ color: 'gold', fontWeight: 'bold' }}>#{randomResult}</span>
             {playId != null && (
               <>
                 {' '}&amp;{' '}
                 <span style={{ color: 'gold', fontWeight: 'bold' }}>#{playId}</span>
               </>
             )}
             {' '}— need both numbers equal to win the pot.
           </div>
           <div style={{ opacity: 0.9 }}>Your ETH fee was added to the season pot. Try again!</div>
           <BsEmojiDizzyFill style={{ color: 'gold', marginTop: '0.5rem' }} />
           <MdToggleOn style={{ color: 'whitesmoke' }} />
         </div>
       )}
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
//     <a href="https://cashcats.fun"><div className="waveanimator forest goldtext centered">Play on Testnet </div></a>
//   </div>
//   )
// }
// export default Legends;

