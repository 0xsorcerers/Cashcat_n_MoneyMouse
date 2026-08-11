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
import { MdToggleOn, MdCancel } from 'react-icons/md';
import { BsEmojiHeartEyesFill, BsEmojiDizzyFill } from 'react-icons/bs';
import { miscImages, LegendaryHeroes, LegendaryChoices, LegendaryMatches,
  soundEffects, foregroundStoryboards, foregroundStoryboardsMobile } from "./tools/effects";
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

/** Comic-style speech chip tints (bg + border + soft glow) */
const SPEECH_TINTS = [
  { bg: "linear-gradient(165deg, rgba(255,252,245,0.98), rgba(255,236,190,0.96))", border: "rgba(200,140,40,0.45)", glow: "rgba(245,197,66,0.25)" },
  { bg: "linear-gradient(165deg, rgba(255,245,250,0.98), rgba(255,210,225,0.96))", border: "rgba(220,80,120,0.4)", glow: "rgba(255,120,160,0.22)" },
  { bg: "linear-gradient(165deg, rgba(240,250,255,0.98), rgba(190,230,255,0.96))", border: "rgba(40,130,200,0.4)", glow: "rgba(80,180,255,0.22)" },
  { bg: "linear-gradient(165deg, rgba(240,255,245,0.98), rgba(190,245,210,0.96))", border: "rgba(40,160,90,0.4)", glow: "rgba(80,220,140,0.22)" },
  { bg: "linear-gradient(165deg, rgba(248,242,255,0.98), rgba(220,200,255,0.96))", border: "rgba(120,80,200,0.4)", glow: "rgba(160,120,255,0.22)" },
  { bg: "linear-gradient(165deg, rgba(255,248,240,0.98), rgba(255,220,180,0.96))", border: "rgba(220,120,40,0.4)", glow: "rgba(255,160,80,0.22)" },
  { bg: "linear-gradient(165deg, rgba(255,250,255,0.98), rgba(255,210,245,0.96))", border: "rgba(200,60,160,0.4)", glow: "rgba(255,100,200,0.2)" },
  { bg: "linear-gradient(165deg, rgba(240,255,255,0.98), rgba(180,245,245,0.96))", border: "rgba(20,160,160,0.4)", glow: "rgba(60,220,220,0.2)" },
];

/**
 * Random fixed position above a stage lane + random tint.
 * lane: 'hero' | 'choice'
 */
const randomSpeechChipStyle = (lane, mobile) => {
  const tint = SPEECH_TINTS[randomShuffle(Math.max(SPEECH_TINTS.length - 1, 0))] || SPEECH_TINTS[0];
  let top;
  let left;
  if (lane === "hero") {
    // Above left hero portrait
    if (mobile) {
      top = 4 + Math.random() * 14; // 4–18vh
      left = 2 + Math.random() * 28; // 2–30vw
    } else {
      top = 2 + Math.random() * 18; // 2–20vh
      left = 1 + Math.random() * 22; // 1–23vw
    }
  } else {
    // Above center/right choice portrait
    if (mobile) {
      top = 10 + Math.random() * 16; // 10–26vh
      left = 38 + Math.random() * 30; // 38–68vw
    } else {
      top = 2 + Math.random() * 20; // 2–22vh
      left = 28 + Math.random() * 28; // 28–56vw
    }
  }
  // slight rotation for comic pop
  const rot = (Math.random() * 6 - 3).toFixed(2); // -3° … +3°
  return {
    top: `${top.toFixed(1)}vh`,
    left: `${left.toFixed(1)}vw`,
    transform: `rotate(${rot}deg)`,
    background: tint.bg,
    borderColor: tint.border,
    boxShadow: `0 8px 22px rgba(0,0,0,0.32), 0 0 18px ${tint.glow}, inset 0 0 0 1px rgba(255,255,255,0.35)`,
  };
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
  /** Which stage portrait is in front: 'hero' | 'choice' | 'match' */
  const [stageFocus, setStageFocus] = useState('hero');
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
  /** Full metadata JSON for the active Cashcat (from ipfsCache). */
  const [nftMeta, setNftMeta] = useState(null);
  /** Lightbox: false = image face, true = attribute info face. */
  const [nftFlipInfo, setNftFlipInfo] = useState(false);
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
  /** Random placement + color tint for comic speech chips */
  const [speechChipStyle, setSpeechChipStyle] = useState({ hero: null, reply: null });
  const [userRandomNumero, setUserRandomNumero] = useState(null);
  const pendingPlaySeed = useRef(null); // bytes32 seed awaiting receipt parse
  const processedTxHash = useRef(null); // avoid double-handling the same receipt
  /** Choice key locked in when Hunt is submitted — used only for match reveal, never on tray reselection. */
  const choiceKeyAtPlayRef = useRef(null);
  /** Dedup match reveal for a given result pair. */
  const lastMatchRevealKey = useRef(null);

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
      setSpeechChipStyle((s) => ({ ...s, hero: randomSpeechChipStyle("hero", isMobile) }));
      setStageFocus('hero');
    } else if (!(nft > 0) && speeches.noNftSpeech?.length) {
      const bubbleIndex = randomShuffle(6);
      setSpeechBubble({hero: null, nohero: bubbleIndex + 1});
      const heroSpeechIndex = randomShuffle(speeches.noNftSpeech.length);
      setHeroSpeech({hero: null, nohero: speeches.noNftSpeech[heroSpeechIndex]});
      setSpeechChipStyle((s) => ({ ...s, hero: randomSpeechChipStyle("hero", isMobile) }));
      setStageFocus('hero');
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
    const boardMap = isMobile ? foregroundStoryboardsMobile : foregroundStoryboards;
    const allSources = Object.values(boardMap || foregroundStoryboards);
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

  /**
   * Reveal the right-side Match portrait from on-chain draws ONLY.
   * - Never called from selectChoice / tray clicks.
   * - Win (firstDraw === secondDraw): Matches art for the locked-in choice key.
   * - Lose: a different Matches portrait (not the selected choice).
   * Choice center image stays LegendaryChoices and is never written here.
   */
  const revealMatchFromResult = (firstDraw, secondDraw, choiceKey) => {
    const a = Number(firstDraw);
    const b = secondDraw != null ? Number(secondDraw) : NaN;
    const revealId = `${a}|${b}|${choiceKey || ''}`;
    if (lastMatchRevealKey.current === revealId) return;
    lastMatchRevealKey.current = revealId;

    const matchEntries = Object.entries(LegendaryMatches);
    if (!matchEntries.length) return;

    const isWin =
      !Number.isNaN(a) && !Number.isNaN(b) && a === b;

    if (isWin && choiceKey && LegendaryMatches[choiceKey]) {
      setMatchImage(LegendaryMatches[choiceKey]);
      setStageFocus('match');
      return;
    }

    // Lose (or missing choice key): pick any Matches art except the selected one
    const others = matchEntries.filter(([k]) => k !== choiceKey);
    const pool = others.length > 0 ? others : matchEntries;
    const idx = randomShuffle(Math.max(pool.length - 1, 0));
    setMatchImage(pool[idx][1]);
    setStageFocus('match');
  };

  const closeDisplay = () => {
    setNFTDisplay(false);
    setNftFlipInfo(false);
  };

  /** Pull Name / Profit Index / Vicinity (and helpers) from metadata attributes. */
  const getNftFacts = () => {
    const data = nftMeta;
    const attrs = Array.isArray(data?.attributes) ? data.attributes : [];
    const findAttr = (...patterns) => {
      for (const re of patterns) {
        const hit = attrs.find((a) => re.test(String(a?.trait_type || "")));
        if (hit != null && hit.value != null && String(hit.value).trim() !== "") {
          return String(hit.value).trim();
        }
      }
      return null;
    };
    return {
      name:
        findAttr(/^name$/i, /\bname\b/i) ||
        (data?.name && String(data.name).trim()) ||
        names.hero ||
        "—",
      profitIndex:
        findAttr(/profit\s*index/i, /\bprofit\b/i, /discount/i) || "—",
      vicinity:
        findAttr(/vicinity/i, /\blocation\b/i, /\bzone\b/i, /district/i, /region/i) ||
        "—",
      edition: nft > 0 ? nft : null,
      description: data?.description ? String(data.description).trim() : null,
      // leftover attributes for optional extra context
      extras: attrs.filter((a) => {
        const t = String(a?.trait_type || "");
        return (
          !/^name$/i.test(t) &&
          !/\bname\b/i.test(t) &&
          !/profit/i.test(t) &&
          !/vicinity/i.test(t) &&
          !/location|zone|district|region/i.test(t)
        );
      }),
    };
  };

  /**
   * Center portrait only — tray selection must NEVER touch matchImage.
   * Matches update exclusively via revealMatchFromResult after a play result.
   */
  const selectChoice = (_key, _choice) => {
    if (loading) return;
    if (!verifyConnection()) return;
    setChoiceImage(_choice);
    setNames((prev) => ({ ...prev, villain: _key }));
    setStageFocus('choice'); // bring choice portrait to front while selecting
    playThunder();
  }

  /** Fate label for the right (match) portrait — no roll numbers on Choices. */
  const getFateLabel = () => {
    if (playOutcome === 'win') return 'Match';
    if (loading && matchImage) return 'Your Previous Fate';
    return 'Your Fate';
  };

  /** Resolve a LegendaryHeroes key from metadata text (case/spacing tolerant). */
  const resolveHeroKey = (raw) => {
    if (raw == null || raw === "") return null;
    const keys = Object.keys(LegendaryHeroes);
    const text = String(raw).trim();
    const first = text.split(/[\s/_-]+/)[0] || text;
    // exact / first-token match
    const exact = keys.find(
      (k) => k.toLowerCase() === text.toLowerCase() || k.toLowerCase() === first.toLowerCase()
    );
    if (exact) return exact;
    // metadata contains hero key (or reverse)
    const partial = keys.find(
      (k) =>
        text.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(first.toLowerCase())
    );
    return partial || null;
  };

  /** Always show a left-side hero portrait — never leave the stage blank. */
  const applyHeroFallback = (label = "Unidentified") => {
    setNames((n) => ({ ...n, hero: label }));
    setHeroImage(miscImages.noHeroFound || Object.values(LegendaryHeroes)[0] || null);
    setNftMeta(null);
  };

  /**
   * Load legendary hero art for a Cashcat token id.
   * @param {number} [tokenIdOverride] use explicit id (from fetchNFT) to avoid stale state races
   */
  const fetchHero = async (tokenIdOverride) => {
    const id =
      tokenIdOverride !== undefined && tokenIdOverride !== null
        ? Number(tokenIdOverride)
        : Number(nft);

    try {
      if (!(id > 0)) {
        applyHeroFallback("Unidentified");
        return;
      }

      const response = await fetch(
        `https://daemon.penny4thots.my/ipfsCache/${id}.json`,
        { method: "GET" }
      );

      if (!response.ok) {
        console.log("Hero metadata response not ok:", response.status);
        setNftMeta(null);
        // Owned NFT but metadata flaky — still show a legendary portrait so stage isn't empty
        const keys = Object.keys(LegendaryHeroes);
        const k = keys[randomShuffle(Math.max(keys.length - 1, 0))] || keys[0];
        if (k && LegendaryHeroes[k]) {
          setHeroImage(LegendaryHeroes[k]);
          setNames((n) => ({ ...n, hero: k }));
        } else {
          applyHeroFallback("Unidentified");
        }
        return;
      }

      const heroData = await response.json();
      setNftMeta(heroData);
      const attrs = Array.isArray(heroData?.attributes) ? heroData.attributes : [];

      // Prefer Cashcat breed/trait; fall back to name / any trait value that matches a hero key
      const heroTrait =
        attrs.find((attr) => /cashcat/i.test(String(attr?.trait_type || ""))) ||
        attrs.find((attr) => /breed|type|hero|character/i.test(String(attr?.trait_type || "")));

      let key =
        resolveHeroKey(heroTrait?.value) ||
        resolveHeroKey(heroData?.name) ||
        resolveHeroKey(heroData?.Hero) ||
        null;

      if (!key) {
        for (const attr of attrs) {
          key = resolveHeroKey(attr?.value);
          if (key) break;
        }
      }

      if (key && LegendaryHeroes[key]) {
        setHeroImage(LegendaryHeroes[key]);
        setNames((n) => ({ ...n, hero: key }));
        return;
      }

      // Last resort: deterministic pick from token id so first paint is never blank
      const keys = Object.keys(LegendaryHeroes);
      if (keys.length) {
        const k = keys[Math.abs(id) % keys.length];
        setHeroImage(LegendaryHeroes[k]);
        setNames((n) => ({ ...n, hero: k }));
      } else {
        applyHeroFallback("Unidentified");
      }
    } catch (err) {
      console.log("Error fetching NFT data: ", err);
      setNftMeta(null);
      applyHeroFallback("Unidentified");
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
      applyHeroFallback("Unidentified");
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
        applyHeroFallback("Unidentified");
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
          applyHeroFallback("Unidentified");
          // one legend RPC: global + non-holder quote
          await fetchGameData(account.address, 0);
        } else {
          setNFT(tokenId);
          // Load hero immediately with explicit id (avoids waiting on nft state race)
          await fetchHero(tokenId);
          // one legend RPC: global + holder quote / power bonus / fees
          await fetchGameData(account.address, tokenId);
        }

     } else {
      setNFT(0);
      applyHeroFallback("Unidentified");
      await fetchGameData(account.address, 0);
    }

    } catch (err) {
      console.log("error fetching NFTs: ", err);
      setNFT(0);
      applyHeroFallback("Unidentified");
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
    setDidWin(false);
    setWinAmount(null);
    setPlayOutcome(null);
    setMatchImage(null);
    pendingPlaySeed.current = null;
    choiceKeyAtPlayRef.current = null;
    lastMatchRevealKey.current = null;
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

    // Match portrait updates HERE only — never when reselecting a choice
    const lockedKey = choiceKeyAtPlayRef.current || names.villain;
    revealMatchFromResult(a, b, lockedKey);

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
    // Lock the choice used for THIS hunt (tray can still change visuals for next hunt only)
    choiceKeyAtPlayRef.current = names.villain;
    lastMatchRevealKey.current = null;
    // Keep previous matchImage until the new play reveals — only then replace it.
    // Clear roll numbers so UI shows "Your Previous Fate" while hunting.
    setRandomResult(null);
    setPlayId(null);
    // Hunting focuses the fate/match lane (previous or pending result)
    setStageFocus('match');

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
    // Keep a placeholder portrait during reload so the left stage is never blank
    applyHeroFallback(account ? "…" : "Unidentified");
    setPlayOutcome(null);
    setTokenBalance({ Wei: null, Mil: null, K: null, Data: null });
    isWalletParameter = false;
    if (!account) {
      setWalletBalance(null);
      setNFT(null);
      applyHeroFallback("Unidentified");
    }
    bootstrapGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  // Safety net: if nft state settles after bootstrap paths, still resolve hero art
  useEffect(() => {
    if (!account) return;
    if (nft !== null && nft > 0) {
      fetchHero(nft);
    } else if (nft === 0) {
      applyHeroFallback("Unidentified");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nft, account?.address]);

  // Ephemeral toasts — auto-hide after 5s unless the user dismisses sooner
  useEffect(() => {
    if (!errorMessageVisible) return undefined;
    const t = setTimeout(() => {
      setErrorMessageVisible(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [errorMessageVisible, errorMessage]);
  
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

  // After a result is applied: soft UI feedback only (match image is set in applyPlayOutcome)
  useEffect(() => {
    if (playId == null || randomResult == null) return;
    playThunder();
    setLoading(false);
    const boardMap = isMobile ? foregroundStoryboardsMobile : foregroundStoryboards;
    const allSources = Object.values(boardMap || foregroundStoryboards);
    if (!allSources.length) return;
    const imageIndex = randomShuffle(Math.max(allSources.length - 1, 0));
    setBackground(allSources[imageIndex]);
  }, [playId, randomResult, isMobile]);

  useEffect(() => {
    if (speeches.nftReplySpeech?.length && choiceImage && nft > 0) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: replyBubbleIndex + 1, nohero: null});
      const heroReplySpeechIndex = randomShuffle(speeches.nftReplySpeech.length);
      setReplySpeech({hero: speeches.nftReplySpeech[heroReplySpeechIndex], nohero: null});
      setSpeechChipStyle((s) => ({ ...s, reply: randomSpeechChipStyle("choice", isMobile) }));
      setStageFocus('choice');
    } else if (speeches.noNftReplySpeech?.length && choiceImage && !(nft > 0)) {
      const replyBubbleIndex = randomShuffle(6);
      setReplyBubble({hero: null, nohero: replyBubbleIndex + 1});
      const heroReplySpeechIndex = randomShuffle(speeches.noNftReplySpeech.length);
      setReplySpeech({hero: null, nohero: speeches.noNftReplySpeech[heroReplySpeechIndex]});
      setSpeechChipStyle((s) => ({ ...s, reply: randomSpeechChipStyle("choice", isMobile) }));
      setStageFocus('choice');
    }
  }, [choiceImage, isMobile]);

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

  // Hunt! button cycles every 5s between call-to-action and fee requirements
  const [showHuntReq, setShowHuntReq] = useState(false);
  useEffect(() => {
    if (loading || dataLoading || !dataReady || !feePreview) {
      setShowHuntReq(false);
      return undefined;
    }
    const id = setInterval(() => {
      setShowHuntReq((prev) => !prev);
    }, 5000);
    return () => clearInterval(id);
  }, [loading, dataLoading, dataReady, feePreview?.eth, feePreview?.ccc]);

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
          <div className="goldtext" style={{ fontSize: '1.15rem', padding: '1rem', textAlign: 'center' }}>
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

      {/* Original hero / choice / match placement (fixed coords from your design) */}
      {/* Always paint a left portrait so first load is never blank */}
      <>
        <img
          src={heroImage || miscImages.noHeroFound}
          className={`characterImage index10 ${visualEffect.nft ? 'denied-shake' : ''} ${stageFocus === 'hero' ? 'stage-focus' : ''}`}
          alt={names.hero || 'Hero'}
          onClick={() => setStageFocus('hero')}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        />
        <div className="vs"><img src={require("./assets/images/vs.gif")} alt="vs" className="vsImage" /></div>
        <div className="heroText">YOUR HERO <br/>
          {nft > 0
            ? <span className="waveanimator quote ledger">on Hunter {nft}</span>
            : <span className="waveanimator quote ledger">rouge hunt</span>}
        </div>
        {names.hero && names.hero !== "…" && (
          <div className={`heroName waveanimator regal ${stageFocus === 'hero' ? 'stage-focus-label' : ''}`}>{names.hero}</div>
        )}
      </>
      {choiceImage && <>
        <img
          src={choiceImage}
          className={`characterImage index11 ${stageFocus === 'choice' ? 'stage-focus' : ''}`}
          alt={names.villain || 'Choice'}
          onClick={() => setStageFocus('choice')}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        />
        <div className={`villainName waveanimator forest ${stageFocus === 'choice' ? 'stage-focus-label' : ''}`}>{names.villain}</div>
      </>
      }
      {choiceImage && 
      <>
        {speechBubble.hero && 
          <div
            className={`speechText speech-chip speech-chip--hero${stageFocus === 'hero' ? ' stage-focus' : ''}`}
            style={speechChipStyle.hero || undefined}
            onClick={() => setStageFocus('hero')}
          >{heroSpeech.hero}</div>
        } 
        {speechBubble.nohero && 
          <div
            className={`speechText speech-chip speech-chip--hero${stageFocus === 'hero' ? ' stage-focus' : ''}`}
            style={speechChipStyle.hero || undefined}
            onClick={() => setStageFocus('hero')}
          >{heroSpeech.nohero}</div>
        } 
        {replyBubble.hero && 
          <div
            className={`speechText speech-chip speech-chip--choice${stageFocus === 'choice' ? ' stage-focus' : ''}`}
            style={speechChipStyle.reply || undefined}
            onClick={() => setStageFocus('choice')}
          >{replySpeech.hero}</div>
        } 
        {replyBubble.nohero && 
          <div
            className={`speechText speech-chip speech-chip--choice${stageFocus === 'choice' ? ' stage-focus' : ''}`}
            style={speechChipStyle.reply || undefined}
            onClick={() => setStageFocus('choice')}
          >{replySpeech.nohero}</div>
        } 
      </>
      }

      {matchImage && <>
        <img 
          src={matchImage} 
          className={`characterImage index12 ${loading ? 'fate-previous' : playOutcome === 'win' ? 'fate-match' : ''} ${stageFocus === 'match' ? 'stage-focus' : ''}`} 
          alt={getFateLabel()}
          onClick={() => setStageFocus('match')}
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        />
        <div className={`villainText ${stageFocus === 'match' ? 'stage-focus-label' : ''}`}>
          {getFateLabel()}
        </div>
      </>
      }

      {/* Bottom chrome: NFT dock + choice strip + tray — never under stage art */}
      <div className="bottom-chrome">
        <div className="nft-dock">
          {(nft === null || dataLoading) && <div className="nftText">…</div>}
          {nft > 0 && !dataLoading && (
            <img
              src={`https://daemon.penny4thots.my/ipfsCache/${nft}.webp`}
              alt={`NFT #${nft}`}
              className="nftImage"
              onClick={() => {
                setNftFlipInfo(false);
                setNFTDisplay(true);
              }}
            />
          )}
          {nft === 0 && !dataLoading && (
            <img
              src={require('./assets/images/nonftsfound.webp')}
              alt="No NFT"
              className="nftImage"
              onClick={noPlayNFT}
            />
          )}
        </div>
        <div className="chrome-main">
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
            <div className="dashboard">
              {dataReady && seasonPot != null && prizePot?.era != null && (
                <div className="pot-chip" aria-label="Season pot">
                  <span className="smaller">Season {prizePot.era} pot</span>
                  <span className="pot-value">{safeNum(seasonPot)} ETH</span>
                </div>
              )}
            </div>
            <div className="scoreboard">
              <span className="stat">
                <span className="stat-label">ETH</span>
                {walletBalance != null
                  ? <span className="goldtext">{safeNum(walletBalance)}</span>
                  : <span className="goldtext">…</span>}
              </span>
              {tokenBalance?.Mil != null && tokenBalance.Mil > 0 && (
                <span className="stat">
                  <span className="stat-label">CCC</span>
                  <span className="goldtext">{safeNum(tokenBalance.Mil)}M</span>
                </span>
              )}
              {tokenBalance?.K != null && tokenBalance.K > 0 && (
                <span className="stat">
                  <span className="stat-label">CCC</span>
                  <span className="goldtext">{safeNum(tokenBalance.K)}K</span>
                </span>
              )}
              {tokenBalance?.Data != null && tokenBalance.Data > 0 && !(tokenBalance?.Mil > 0) && !(tokenBalance?.K > 0) && (
                <span className="stat">
                  <span className="stat-label">CCC</span>
                  <span className="goldtext">{safeNum(tokenBalance.Data)}</span>
                </span>
              )}
            </div>
            <div className="button-board">
              <button
                className="legend-button"
                onClick={handlePlay}
                disabled={playDisabled}
                style={{ opacity: playDisabled ? 0.4 : 1, cursor: playDisabled ? 'not-allowed' : 'pointer' }}
                title={
                  !dataReady
                    ? (dataLoading ? 'Loading game data…' : (dataError || 'Game data unavailable'))
                    : feePreview
                      ? (feePreview.ccc > 0
                          ? `Requires ${safeNum(feePreview.eth)} ETH + ${safeNum(feePreview.ccc)} CCC${feePreview.hasNft ? ' (NFT rate)' : ''}`
                          : `Requires ${safeNum(feePreview.eth)} ETH${feePreview.hasNft ? ' (NFT rate)' : ''}`)
                      : 'Hunt!'
                }
              >
                {dataLoading && !dataReady ? (
                  'Loading…'
                ) : loading ? (
                  isApproving ? 'Approving...' : 'Hunting...'
                ) : (
                  <span className="hunt-swap" aria-live="polite">
                    <span className={`hunt-swap__face ${showHuntReq && feePreview ? 'is-hidden' : 'is-shown'}`}>
                      <span className="hunt-swap__title">Hunt!</span>
                    </span>
                    {feePreview && (
                      <span className={`hunt-swap__face ${showHuntReq ? 'is-shown' : 'is-hidden'}`}>
                        <span className="hunt-swap__req">
                          Requires {safeNum(feePreview.eth)} ETH
                          {feePreview.ccc > 0 ? ` + ${safeNum(feePreview.ccc)} CCC` : ''}
                        </span>
                      </span>
                    )}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      {account?.address && dataReady && <WalletParameter />}
      {blockchain.chainId === 57054 && <a className="mainlink" href="https://cashcats.fun"><div className="back-button">Go to Mainnet</div></a>}
      {nftDisplay && (() => {
        const facts = getNftFacts();
        return (
      <div className="centrify nftDisplay" onClick={closeDisplay} role="dialog" aria-label="Cashcat NFT">
        <div
          className="nftDisplay-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="nftDisplay-toolbar">
            <div className="nftTitle">
              Cashcat in use (<span style={{ color: 'white' }}>edition #{nft}</span>)
            </div>
            <button
              type="button"
              className="nft-close-btn"
              aria-label="Close NFT display"
              title="Close"
              onClick={closeDisplay}
            >
              ×
            </button>
          </div>

          <div
            className={`nft-flip${nftFlipInfo ? ' is-flipped' : ''}`}
            onClick={() => setNftFlipInfo((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setNftFlipInfo((v) => !v);
              }
            }}
            title={nftFlipInfo ? 'Show NFT image' : 'Show NFT details'}
          >
            <div className="nft-flip-inner">
              <div className="nft-flip-face nft-flip-front">
                <img
                  src={`https://daemon.penny4thots.my/ipfsCache/${nft}.webp`}
                  className="nftDisplayImage"
                  alt={`Cashcat #${nft}`}
                  draggable={false}
                />
                <span className="nft-flip-hint">Tap image for details</span>
              </div>
              <div className="nft-flip-face nft-flip-back">
                <div className="nft-info">
                  <div className="nft-info-block">
                    <h3 className="nft-info-header">Name</h3>
                    <p className="nft-info-value">{facts.name}</p>
                  </div>
                  <div className="nft-info-block">
                    <h3 className="nft-info-header">Profit Index</h3>
                    <p className="nft-info-value nft-info-value--accent">{facts.profitIndex}</p>
                    <p className="nft-info-note">
                      On-chain profit metric — higher means you keep more of your winnings and get a better play discount.
                    </p>
                  </div>
                  <div className="nft-info-block">
                    <h3 className="nft-info-header">Vicinity</h3>
                    <p className="nft-info-value">{facts.vicinity}</p>
                    <p className="nft-info-note">
                      The beat this Cashcat occupies or practises in.
                    </p>
                  </div>
                  {facts.edition != null && (
                    <div className="nft-info-block nft-info-block--compact">
                      <h3 className="nft-info-header">Edition</h3>
                      <p className="nft-info-value">#{facts.edition}</p>
                    </div>
                  )}
                  {!nftMeta && (
                    <p className="nft-info-note" style={{ marginTop: '0.5rem' }}>
                      Metadata still loading or unavailable for this edition.
                    </p>
                  )}
                  <span className="nft-flip-hint">Tap to show image</span>
                </div>
              </div>
            </div>
          </div>

          <a
            href="https://opensea.io/collection/0x6f2A200D859a1E4DF8FfB28eBc6F45F4b0341132"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="trade-button"
              onClick={() => { closeDisplay(); playButton(); }}
            >
              Trade on Opensea
            </button>
          </a>
        </div>
      </div>
        );
      })()}
  
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
      {/* <Partner /> */}
      {dataReady &&
        prizePot?.era != null &&
        counter !== prizePot.era &&
        lastWinner?.pot != null &&
        lastWinner?.address && (
        <div className="prizewinner outcome-season" onClick={saveEreCounter} role="dialog" aria-label="New season">
          <div className="outcome-card outcome-season" onClick={saveEreCounter}>
            <span className="outcome-badge">New season</span>
            <h2 className="outcome-title">A Cashcat found the light</h2>
            <div className="outcome-body">
              <div>
                <strong>{truncateAddress(lastWinner.address)}</strong> took{' '}
                <span className="outcome-hl">{safeNum(lastWinner.pot)} ETH</span>
                {lastWinner.timestamp ? <> on {lastWinner.timestamp}</> : null}.
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                Welcome to Season <strong>{prizePot.era}</strong>. Pot is now{' '}
                <span className="outcome-eth">{safeNum(seasonPot)} ETH</span>.
              </div>
              <div style={{ marginTop: '0.35rem' }}>Will you be next?</div>
            </div>
            <div className="outcome-hint">Tap to continue</div>
          </div>
        </div>
       )}
       {/* Dual-draw match (firstDraw == secondDraw) — contract win condition */}
       {playOutcome === 'win' && (
         <div className="prizewinner outcome-win" onClick={refreshState} role="dialog" aria-label="You won">
           <div className="outcome-card outcome-win">
             <span className="outcome-badge">Jackpot</span>
             <h2 className="outcome-title">
               {winAmount
                 ? "You won the season pot!"
                 : "Double match — jackpot roll!"}
             </h2>
             <div className="outcome-body">
               <div>
                 Draws <span className="outcome-hl">#{randomResult}</span>
                 {' '}&amp;{' '}
                 <span className="outcome-hl">#{playId != null ? playId : randomResult}</span>
                 {' '}matched.
               </div>
               {winAmount != null && winAmount > 0 && (
                 <div style={{ marginTop: '0.45rem' }}>
                   Payout ~ <span className="outcome-eth">{safeNum(winAmount)} ETH</span>
                   {' '}→ <strong>{truncateAddress(account?.address)}</strong>
                 </div>
               )}
               {(!winAmount || winAmount <= 0) && (
                 <div style={{ marginTop: '0.45rem' }}>
                   Pot was empty this season — your fee seeded the next round.
                 </div>
               )}
             </div>
             <div className="outcome-hint">Tap to continue</div>
           </div>
         </div>
       )}
       {playOutcome === 'lose' && randomResult != null && (
         <div className="prizewinner outcome-lose" onClick={() => setPlayOutcome(null)} role="dialog" aria-label="No match">
           <div className="outcome-card outcome-lose">
             <span className="outcome-badge">No match</span>
             <h2 className="outcome-title">Close, but no cigar</h2>
             <div className="outcome-body">
               <div>
                 Draws <span className="outcome-hl">#{randomResult}</span>
                 {playId != null && (
                   <>
                     {' '}&amp;{' '}
                     <span className="outcome-hl">#{playId}</span>
                   </>
                 )}
                 {' '}— both numbers must match to win.
               </div>
               <div style={{ marginTop: '0.45rem' }}>
                 Your ETH fee joined the season pot. Hunt again!
               </div>
             </div>
             <BsEmojiDizzyFill style={{ color: 'var(--lg-gold)', marginTop: '0.15rem', fontSize: '1.35rem' }} />
             <div className="outcome-hint">Tap to continue</div>
           </div>
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

