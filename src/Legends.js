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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait for a wallet tx to be mined (not merely submitted). */
const waitForTxMined = async (txResult, label = "Transaction") => {
  const transactionHash =
    typeof txResult === "string"
      ? txResult
      : txResult?.transactionHash || txResult?.hash;
  if (!transactionHash) {
    throw new Error(`${label}: no transaction hash returned from wallet.`);
  }
  const receipt = await waitForReceipt({
    client,
    chain: base,
    transactionHash,
  });
  const bad =
    receipt?.status === "reverted" ||
    receipt?.status === 0 ||
    receipt?.status === "0" ||
    receipt?.status === false;
  if (bad) {
    throw new Error(`${label} reverted on-chain.`);
  }
  return { receipt, transactionHash };
};

/**
 * Poll ERC20 allowance until >= needed (or timeout).
 * Guards against RPC lag right after an approve receipt lands.
 */
const waitForAllowance = async (
  owner,
  spender,
  needed,
  { attempts = 24, delayMs = 750 } = {}
) => {
  let last = 0n;
  for (let i = 0; i < attempts; i++) {
    try {
      last = toBigInt(await cashcatContract.allowance(owner, spender));
      if (last >= needed) return last;
    } catch (e) {
      console.warn("allowance poll failed:", e?.message || e);
    }
    await sleep(delayMs);
  }
  return last;
};

/** Pretty-print camelCase legend keys for outcome copy (BazooMacho → Bazoo Macho). */
const formatLegendName = (key) => {
  if (key == null || key === "") return null;
  const s = String(key).trim();
  if (!s) return null;
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
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
  const {
    mutate: sendTransaction,
    mutateAsync: sendTransactionAsync,
    data: transactionResult,
    error: txError,
  } = useSendTransaction();
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
  /** Themed hunt labels for outcome popup (no draw numbers). */
  const [outcomeHunt, setOutcomeHunt] = useState({ bounty: null, hunted: null });
  /** Season index after a pot win (chain advances era immediately on payout). */
  const [seasonAfterWin, setSeasonAfterWin] = useState(null);
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
  const [lastWinner, setLastWinner] = useState({
    address: null, pot: null, timestamp: null, era: null,
  });
  /** Seasons hall of fame (pastwinners board). */
  const [showSeasonBoard, setShowSeasonBoard] = useState(false);
  const [seasonBoard, setSeasonBoard] = useState([]); // { era, winner, amount, timestamp }[]
  const [seasonBoardLoading, setSeasonBoardLoading] = useState(false);
  const [seasonBoardError, setSeasonBoardError] = useState(null);
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
    try {
      const cachedCounter = localStorage.getItem('seasonCounter');
      if (cachedCounter !== null && !isNaN(parseInt(cachedCounter, 10))) {
        return parseInt(cachedCounter, 10);
      }
    } catch (_) { /* private mode / blocked storage */ }
    return 1;
  }
  const [counter, setCounter] = useState(seasonSelector());

  /** Persist the player's last-seen season so returning users get a new-season notice. */
  const cacheSeasonEra = (era) => {
    if (era == null || Number.isNaN(Number(era))) return;
    const n = Number(era);
    setCounter(n);
    try {
      localStorage.setItem('seasonCounter', String(n));
    } catch (_) { /* ignore */ }
  };

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
      setErrorMessage(`You need ${blockchain.nativeSymbol} to pay the entry fee`);
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
   * Also records bounty/hunted names for themed outcome copy (no draw numbers in UI).
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
    const bountyKey = choiceKey || names.villain || null;

    if (isWin && choiceKey && LegendaryMatches[choiceKey]) {
      setMatchImage(LegendaryMatches[choiceKey]);
      setOutcomeHunt({ bounty: bountyKey, hunted: choiceKey });
      setStageFocus('match');
      return;
    }

    // Lose (or missing choice key): pick any Matches art except the selected one
    const others = matchEntries.filter(([k]) => k !== choiceKey);
    const pool = others.length > 0 ? others : matchEntries;
    const idx = randomShuffle(Math.max(pool.length - 1, 0));
    const [huntedKey, huntedImg] = pool[idx];
    setMatchImage(huntedImg);
    setOutcomeHunt({ bounty: bountyKey, hunted: huntedKey });
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
          era: data.lastWinEra || Math.max(1, data.currentEra - 1),
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
    setOutcomeHunt({ bounty: null, hunted: null });
    setSeasonAfterWin(null);
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

    const won = Boolean(potWon) || isMatch;
    setDidWin(won);
    setPlayOutcome(won ? 'win' : 'lose');
    if (amountWon != null) {
      const amt = Number(safeFormatEther(amountWon));
      setWinAmount(Number.isFinite(amt) ? amt : 0);
    } else {
      setWinAmount(null);
    }

    // Chain increments era on pot win — next season is live immediately
    if (won) {
      const eraNow = prizePot?.era ?? gameData?.currentEra ?? null;
      setSeasonAfterWin(eraNow != null ? Number(eraNow) + 1 : null);
    } else {
      setSeasonAfterWin(null);
    }

    // Match portrait updates HERE only — never when reselecting a choice
    const lockedKey = choiceKeyAtPlayRef.current || names.villain;
    revealMatchFromResult(a, b, lockedKey);

    isWalletParameter = false;
    setLoading(false);

    // Refresh pot / era / balances after the play fee (and possible payout).
    // On a win the contract already advanced era + paid the wallet — pull fresh state.
    setTimeout(() => {
      fetchCashcatBalance();
      fetchGameData(account?.address || ethers.ZeroAddress, nft > 0 ? nft : 0)
        .then((data) => {
          if (won && data?.currentEra != null) {
            setSeasonAfterWin(data.currentEra);
            // Keep local era cache aligned so the win doesn't also trigger a "new season" banner about yourself
            cacheSeasonEra(data.currentEra);
          }
        })
        .catch(() => {});
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
    cacheSeasonEra(prizePot?.era);
  };

  /**
   * Load past season winners from legends contract.pastwinners(era).
   * Completed seasons are 1 .. currentEra-1 (era increments on each pot win).
   */
  const loadSeasonBoard = async () => {
    setSeasonBoardLoading(true);
    setSeasonBoardError(null);
    try {
      let current =
        prizePot?.era != null
          ? Number(prizePot.era)
          : gameData?.currentEra != null
            ? Number(gameData.currentEra)
            : null;
      if (current == null || !Number.isFinite(current)) {
        try {
          current = Number(await legendaryContract.era());
        } catch (_) {
          current = null;
        }
      }
      if (current == null || !Number.isFinite(current) || current < 2) {
        setSeasonBoard([]);
        setSeasonBoardLoading(false);
        return;
      }

      const eras = [];
      for (let e = current - 1; e >= 1; e--) eras.push(e);

      // Cap remote calls for very long-running deployments
      const slice = eras.slice(0, 48);
      const rows = await Promise.all(
        slice.map(async (e) => {
          try {
            const w = await legendaryContract.pastwinners(e);
            const winner = (w?.winner ?? w?.[0])?.toString?.() || ethers.ZeroAddress;
            const eraNum = Number(w?.era ?? w?.[1] ?? e) || e;
            const amountWei = w?.amount ?? w?.[2] ?? 0n;
            const ts = Number(w?.timestamp ?? w?.[3] ?? 0) || 0;
            if (!winner || winner === ethers.ZeroAddress) return null;
            const amt = Number(safeFormatEther(amountWei));
            return {
              era: eraNum,
              winner,
              amount: Number.isFinite(amt) ? amt : 0,
              timestamp: ts ? new Date(ts * 1000).toLocaleString() : "—",
            };
          } catch (_) {
            return null;
          }
        })
      );

      setSeasonBoard(rows.filter(Boolean));
    } catch (err) {
      console.error("loadSeasonBoard failed:", err);
      setSeasonBoardError(
        err?.shortMessage || err?.message || "Could not load season winners"
      );
      setSeasonBoard([]);
    } finally {
      setSeasonBoardLoading(false);
    }
  };

  const openSeasonBoard = (e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setShowSeasonBoard(true);
    loadSeasonBoard();
  };

  const closeSeasonBoard = (e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setShowSeasonBoard(false);
  };

  /** Dismiss personal win: cache the (already-advanced) season and reset play UI. */
  const dismissWinAndContinue = () => {
    // After a pot win the chain has already incremented era; prefer live pot era.
    const nextEra =
      prizePot?.era != null
        ? prizePot.era
        : gameData?.currentEra != null
          ? gameData.currentEra
          : null;
    if (nextEra != null) cacheSeasonEra(nextEra);
    refreshState();
    // Refresh pot / era after payout settles
    fetchGameData(account?.address || ethers.ZeroAddress, nft > 0 ? nft : 0).catch(() => {});
  };

  /**
   * Play entrypoint: native entry fee (pot) + token fee, dual RNG via sendToCashcat.
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
    setOutcomeHunt({ bounty: null, hunted: null });
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
        setErrorMessage(`Requires ${formatNumber(ethCostEth)} ${blockchain.nativeSymbol} entry fee`);
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
            `Requires ${formatNumber(tokenCostEth)} ${blockchain.symbol} token fee` +
            (nftParam > 0 ? "" : " (non-NFT rate)")
          );
          setErrorMessageVisible(true);
          noPlayFunds();
          setLoading(false);
          pendingPlaySeed.current = null;
          return;
        }

        // Spender must be the game contract (pulls token fee via transferFrom)
        const spender = blockchain.legend_contract_address;
        let approvalAllowance = toBigInt(
          await cashcatContract.allowance(account.address, spender)
        );

        if (approvalAllowance < tokenCostWei) {
          console.log(`Initiating $${blockchain.symbol} approval...`);
          setIsApproving(true);
          setErrorMessage(`Requesting $${blockchain.symbol} Approval...`);
          setErrorMessageVisible(true);

          // Approve enough for this hunt (not full wallet) — clear intent for wallets
          const approveAmount = tokenCostWei;
          const approveTransaction = prepareContractCall({
            contract: thirdwebCASHCATContract,
            method: "function approve(address spender, uint256 value)",
            params: [spender, approveAmount],
          });

          // 1) Submit approve  2) wait for mine  3) poll allowance
          // Blind 2.5s retries were flaky on mainnet RPCs after the network cutover.
          const approveResult = await sendTransactionAsync(approveTransaction);
          setErrorMessage(`Waiting for $${blockchain.symbol} approval to confirm…`);
          setErrorMessageVisible(true);
          await waitForTxMined(approveResult, "Approve");
          approvalAllowance = await waitForAllowance(
            account.address,
            spender,
            tokenCostWei
          );
          setIsApproving(false);

          if (approvalAllowance < tokenCostWei) {
            setErrorMessage(
              `Approval confirmed but allowance is still too low. Wait a few seconds and tap Hunt again.`
            );
            setErrorMessageVisible(true);
            setLoading(false);
            pendingPlaySeed.current = null;
            return;
          }
          setErrorMessage(`$${blockchain.symbol} approved! Hunting…`);
          setErrorMessageVisible(true);
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
      setIsApproving(false);
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
    if (/user rejected|user denied|rejected the request|denied transaction/i.test(raw)) {
      return "Approval or play was cancelled in the wallet.";
    }
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
      return `Not enough ${blockchain.nativeSymbol} sent for the entry fee.`;
    }
    if (/SafeERC20FailedOperation|ERC20Insufficient|transfer amount exceeds|insufficient allowance/i.test(raw)) {
      return `Not enough $${blockchain.symbol} (or allowance) for the token fee. Approve again, then Hunt.`;
    }
    if (/insufficient funds|exceeds the balance/i.test(raw)) {
      return `Not enough ${blockchain.nativeSymbol} in your wallet for gas + entry fee.`;
    }
    if (/chain|network|switch/i.test(raw) && /2274228|cashcat/i.test(raw + String(blockchain.chainId))) {
      return `Wallet is on the wrong network. Switch to ${blockchain.name} (chain ${blockchain.chainId}).`;
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

    // Approve is awaited inline in sendToCashcat (waitForReceipt + allowance poll).
    // Only the play tx still uses the mutate → transactionResult path.

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

  // Last winner is included in getGameData(); backfill / refresh when era cache is stale
  useEffect(() => {
    if (
      !dataReady ||
      prizePot?.era == null ||
      counter === prizePot.era
    ) return;

    const hydrateFromGameData = () => {
      if (
        gameData?.lastWinner &&
        gameData.lastWinner !== ethers.ZeroAddress
      ) {
        const pot = Number(safeFormatEther(gameData.lastWinAmount));
        setLastWinner({
          address: gameData.lastWinner,
          pot: Number.isFinite(pot) ? pot : 0,
          timestamp: gameData.lastWinTimestamp
            ? new Date(gameData.lastWinTimestamp * 1000).toLocaleString()
            : "—",
          era: gameData.lastWinEra || Math.max(1, Number(prizePot.era) - 1),
        });
        return true;
      }
      return false;
    };

    if (hydrateFromGameData()) return;

    // Fallback: read pastwinners(prevEra) directly when getGameData lacked a winner row
    let cancelled = false;
    const prevEra = Math.max(1, Number(prizePot.era) - 1);
    (async () => {
      try {
        const w = await legendaryContract.pastwinners(prevEra);
        if (cancelled) return;
        const winner = (w?.winner ?? w?.[0])?.toString?.() || ethers.ZeroAddress;
        if (!winner || winner === ethers.ZeroAddress) return;
        const pot = Number(safeFormatEther(w?.amount ?? w?.[2] ?? 0n));
        const ts = Number(w?.timestamp ?? w?.[3] ?? 0) || 0;
        setLastWinner({
          address: winner,
          pot: Number.isFinite(pot) ? pot : 0,
          timestamp: ts ? new Date(ts * 1000).toLocaleString() : "—",
          era: Number(w?.era ?? w?.[1] ?? prevEra) || prevEra,
        });
      } catch (err) {
        console.warn("pastwinners fallback failed:", err?.message || err);
      }
    })();
    return () => { cancelled = true; };
  }, [prizePot?.era, gameData, counter, dataReady]);

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
            <button
              type="button"
              className="nft-dock-btn"
              onClick={() => {
                setNftFlipInfo(false);
                setNFTDisplay(true);
              }}
              aria-label={`Open Cashcat #${nft} details`}
            >
              <img
                src={`https://daemon.penny4thots.my/ipfsCache/${nft}.webp`}
                alt={`NFT #${nft}`}
                className="nftImage"
                draggable={false}
              />
              <span className="nft-click-me">click me</span>
            </button>
          )}
          {nft === 0 && !dataLoading && (
            <button
              type="button"
              className="nft-dock-btn"
              onClick={noPlayNFT}
              aria-label="No Cashcat NFT — open spawn help"
            >
              <img
                src={require('./assets/images/nonftsfound.webp')}
                alt="No NFT"
                className="nftImage"
                draggable={false}
              />
              <span className="nft-click-me">click me</span>
            </button>
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
                  <span className="pot-value">{safeNum(seasonPot)} {blockchain.nativeSymbol}</span>
                  <button
                    type="button"
                    className="outcome-details-btn pot-chip-details"
                    onClick={openSeasonBoard}
                    title="Season winners board"
                  >
                    Details
                  </button>
                </div>
              )}
            </div>
            <div className="scoreboard">
              <span className="stat">
                <span className="stat-label">{blockchain.nativeSymbol}</span>
                {walletBalance != null
                  ? <span className="goldtext">{safeNum(walletBalance)}</span>
                  : <span className="goldtext">…</span>}
              </span>
              {tokenBalance?.Mil != null && tokenBalance.Mil > 0 && (
                <span className="stat">
                  <span className="stat-label">{blockchain.symbol}</span>
                  <span className="goldtext">{safeNum(tokenBalance.Mil)}M</span>
                </span>
              )}
              {tokenBalance?.K != null && tokenBalance.K > 0 && (
                <span className="stat">
                  <span className="stat-label">{blockchain.symbol}</span>
                  <span className="goldtext">{safeNum(tokenBalance.K)}K</span>
                </span>
              )}
              {tokenBalance?.Data != null && tokenBalance.Data > 0 && !(tokenBalance?.Mil > 0) && !(tokenBalance?.K > 0) && (
                <span className="stat">
                  <span className="stat-label">{blockchain.symbol}</span>
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
                          ? `Requires ${safeNum(feePreview.eth)} ${blockchain.nativeSymbol} + ${safeNum(feePreview.ccc)} ${blockchain.symbol}${feePreview.hasNft ? ' (NFT rate)' : ''}`
                          : `Requires ${safeNum(feePreview.eth)} ${blockchain.nativeSymbol}${feePreview.hasNft ? ' (NFT rate)' : ''}`)
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
                          Requires {safeNum(feePreview.eth)} {blockchain.nativeSymbol}
                          {feePreview.ccc > 0 ? ` + ${safeNum(feePreview.ccc)} ${blockchain.symbol}` : ''}
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
                <span className="nft-flip-hint">click me</span>
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
                  <span className="nft-flip-hint">click me</span>
                </div>
              </div>
            </div>
          </div>

          <a
            href={`https://opensea.io/${blockchain.chainId}/${blockchain.address}`}
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
          <span className="literary-content-phonetic larger">The rules are simple. {isMobile ? ''  :  <br />}Successfully <span style={{color: 'gold'}}>hunt</span> your bounty to win the prize pot. {isMobile ? ''  :  <br />}Your odds are favorable: a wholesome <span style={{color: 'gold'}}>match</span> (only 1 in 18) and you win this season's {blockchain.nativeSymbol} pot.</span>
          <span className="literary-content-text">Play and earn multiple promotional token rewards while you hunt.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, hero: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>
      
      <div className={visualEffect.dissolve2 ? 'dissolve-3d' : ''} style={{display: `${displayOff.villain}`}}>
        <div className={`literary-content-villain ${animations.literaryVillain ? 'animate-in' : ''} villany`}>
          <img src={require('./assets/images/candle-bowl.gif')} className="candle" />
          <span className="waveanimator forest literary-content-title">Choose Your Destiny!</span>
          <span className="literary-content-phonetic larger">To be or not to be? Every hunt feeds the {blockchain.nativeSymbol} pot. You are only one <span style={{color: 'gold'}}>good hunt</span> away from this season's <>{dataReady && prizePot?.eth != null && <span style={{color: 'gold'}}> {safeNum(prizePot.eth)} {blockchain.nativeSymbol}</span>}</> prize. </span>
          <span className="literary-content-text">Cash Cat NFT owners pay a base fee in both {blockchain.nativeSymbol} + ${blockchain.symbol} fees. Non-holders face steeper odds by paying more.<br/> Helps to spawn a Cash Cat.</span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, villain: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div>

      <div className={visualEffect.playbox ? 'denied-shake' : visualEffect.dissolve3 ? 'dissolve-3d' : ''} style={{display: `${displayOff.patron}`}}>
        <div className={`literary-content-patron ${animations.literaryPatron ? 'animate-in' : ''} higher`}>
          <img src={require('./assets/images/scented-candle.gif')} className="candle" />
          <span className="waveanimator regal literary-content-title">How To Play</span>
          <span className="literary-content-phonetic larger">Click any <span style={{color: 'teal'}}>vestige of rodentry</span> below as your pick, then hit Hunt. The contract draws two numbers, all verifiable on-chain.</span>
          <span className="literary-content-text">If both draws match, you take the {blockchain.nativeSymbol} pot. {isMobile ? ''  :  <br />}Miss, and your {blockchain.nativeSymbol} hunting fee grows the prize for the next cat. <span style={{color: 'gold'}}><BsEmojiHeartEyesFill /></span></span>
          <MdToggleOn onClick={() => setDisplayOff({ ...displayOff, patron: 'none' })} style={{cursor: 'pointer'}}/>
        </div>
      </div> 

      <div className={visualEffect.dissolve4 ? 'dissolve-3d' : ''} style={{display: `${displayOff.artifact}`}}>
        <div className={`literary-content-artifact tadhigh ${animations.literaryArtifact ? 'animate-in' : ''}`}>
          <img src={require('./assets/images/oil-lamp.gif')} className="candle" />
          <span className="waveanimator liberty literary-content-title">Low Risk - High Reward play</span>
          <span className="literary-content-phonetic larger">Pay a small <span style={{color: 'gold'}}>{blockchain.nativeSymbol}</span> entry fee (feeds the pot) plus a <span style={{color: 'gold'}}>${blockchain.symbol}</span> token fee each play. {isMobile ? ''  :  <br />} Miss and your {blockchain.nativeSymbol} stays in the pot for the <span style={{color: 'gold'}}>next attempt</span>.</span>
          <span className="literary-content-text">If you own a Cash Cat, you gain a significant discount on the platform fee on your winnings. Currently sitting at {feeType !== null ? feeType : 0}% discount {feeType == 0 && "\(because you own none)."}</span>
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
      {/* Returning player: local era cache != on-chain season */}
      {dataReady &&
        prizePot?.era != null &&
        counter !== prizePot.era &&
        playOutcome == null &&
        !showSeasonBoard && (
        <div
          className="prizewinner outcome-season"
          onClick={saveEreCounter}
          role="dialog"
          aria-label="New season"
        >
          <div
            className="outcome-card outcome-season"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="outcome-badge">New season</span>
            <h2 className="outcome-title">A Cashcat found the light</h2>
            <div className="outcome-body">
              {lastWinner?.address ? (
                <div>
                  Last season
                  {lastWinner.era != null ? (
                    <> (<span className="outcome-hl">Season {lastWinner.era}</span>)</>
                  ) : null}
                  {"'s pot was claimed by "}
                  <strong>{truncateAddress(lastWinner.address)}</strong>
                  {lastWinner.pot != null && (
                    <>
                      {" — "}
                      <span className="outcome-hl">{safeNum(lastWinner.pot)} {blockchain.nativeSymbol}</span>
                    </>
                  )}
                  {lastWinner.timestamp && lastWinner.timestamp !== "—" ? (
                    <> on {lastWinner.timestamp}</>
                  ) : null}
                  .
                </div>
              ) : (
                <div>A legend claimed the last season pot while you were away.</div>
              )}
              <div style={{ marginTop: "0.55rem" }}>
                <strong>Season {prizePot.era} has already begun.</strong>
                {" "}The hunt is live
                {seasonPot != null && (
                  <>
                    {" — pot sits at "}
                    <span className="outcome-eth">{safeNum(seasonPot)} {blockchain.nativeSymbol}</span>
                  </>
                )}
                .
              </div>
              <div style={{ marginTop: "0.35rem" }}>
                Will you be the next name on the board?
              </div>
            </div>
            <div className="outcome-actions">
              <button
                type="button"
                className="outcome-details-btn"
                onClick={openSeasonBoard}
              >
                Details
              </button>
              <button
                type="button"
                className="outcome-continue-btn"
                onClick={saveEreCounter}
              >
                Continue hunting
              </button>
            </div>
            <div className="outcome-hint">Tap outside to continue</div>
          </div>
        </div>
      )}

       {/* Win: themed hunt copy — deposit + next season retention, no draw numbers */}
       {playOutcome === 'win' && !showSeasonBoard && (
         <div
           className="prizewinner outcome-win"
           onClick={dismissWinAndContinue}
           role="dialog"
           aria-label="You won"
         >
           <div
             className="outcome-card outcome-win"
             onClick={(e) => e.stopPropagation()}
           >
             <span className="outcome-badge">Jackpot</span>
             <h2 className="outcome-title">
               {winAmount
                 ? "You claimed the season pot!"
                 : "A perfect hunt!"}
             </h2>
             <div className="outcome-body">
               {(() => {
                 const bountyName = formatLegendName(
                   outcomeHunt.bounty || choiceKeyAtPlayRef.current || names.villain
                 );
                 const huntedName = formatLegendName(
                   outcomeHunt.hunted || outcomeHunt.bounty || choiceKeyAtPlayRef.current || names.villain
                 );
                 return (
                   <div>
                     {bountyName ? (
                       <>
                         Your bounty was <span className="outcome-hl">{bountyName}</span>
                         {', and you hunted '}
                         <span className="outcome-hl">{huntedName || bountyName}</span>
                         {' — bounty and quarry as one!'}
                       </>
                     ) : (
                       <>Your bounty matched the hunt!</>
                     )}
                   </div>
                 );
               })()}
               {winAmount != null && winAmount > 0 && (
                 <div style={{ marginTop: '0.5rem' }}>
                   The pot is being deposited into your wallet now
                   {' — '}
                   <span className="outcome-eth">{safeNum(winAmount)} {blockchain.nativeSymbol}</span>
                   {' → '}
                   <strong>{truncateAddress(account?.address)}</strong>.
                 </div>
               )}
               {(!winAmount || winAmount <= 0) && (
                 <div style={{ marginTop: '0.5rem' }}>
                   The pot was empty this season — your fee seeds the next hunt.
                 </div>
               )}
               <div style={{ marginTop: '0.5rem' }}>
                 Your win closed this season —{" "}
                 <strong>
                   Season{" "}
                   {prizePot?.era != null
                     ? prizePot.era
                     : "the next"}{" "}
                   has already begun.
                 </strong>{" "}
                 Fresh quarry. Fresh pot. Keep hunting.
               </div>
             </div>
             <div className="outcome-actions">
               <button
                 type="button"
                 className="outcome-details-btn"
                 onClick={openSeasonBoard}
               >
                 Details
               </button>
               <button
                 type="button"
                 className="outcome-continue-btn"
                 onClick={dismissWinAndContinue}
               >
                 Hunt next season
               </button>
             </div>
             <div className="outcome-hint">Tap outside to continue</div>
           </div>
         </div>
       )}

       {playOutcome === 'lose' && !showSeasonBoard && (
         <div
           className="prizewinner outcome-lose"
           onClick={() => setPlayOutcome(null)}
           role="dialog"
           aria-label="No match"
         >
           <div className="outcome-card outcome-lose">
             <span className="outcome-badge">No match</span>
             <h2 className="outcome-title">Close, but no cigar</h2>
             <div className="outcome-body">
               {(() => {
                 const bountyName = formatLegendName(
                   outcomeHunt.bounty || choiceKeyAtPlayRef.current || names.villain
                 ) || 'unknown';
                 const huntedName = formatLegendName(outcomeHunt.hunted) || 'a different quarry';
                 return (
                   <div>
                     Your bounty was <span className="outcome-hl">{bountyName}</span>
                     {', but you hunted down '}
                     <span className="outcome-hl">{huntedName}</span>.
                   </div>
                 );
               })()}
               <div style={{ marginTop: '0.45rem' }}>
                 Your bounty needs to match your hunt to win the match, so your{' '}
                 <span className="outcome-hl">${blockchain.symbol}</span>
                 {' '}fee has joined the season pot. Hunt again!
               </div>
             </div>
             <BsEmojiDizzyFill style={{ color: 'var(--lg-gold)', marginTop: '0.15rem', fontSize: '1.35rem' }} />
             <div className="outcome-hint">Tap to continue</div>
           </div>
         </div>
       )}

       {/* Seasons board — pastwinners from legends contract */}
       {showSeasonBoard && (
         <div
           className="prizewinner outcome-board-overlay"
           onClick={closeSeasonBoard}
           role="dialog"
           aria-label="Season winners board"
         >
           <div
             className="outcome-card outcome-board"
             onClick={(e) => e.stopPropagation()}
           >
             <span className="outcome-badge">Hall of fame</span>
             <h2 className="outcome-title">Season winners</h2>
             <p className="season-board-lead">
               Legends who claimed the pot. Your name could be next.
             </p>
             {seasonBoardLoading && (
               <div className="season-board-status">Loading past seasons…</div>
             )}
             {seasonBoardError && !seasonBoardLoading && (
               <div className="season-board-status season-board-error">
                 {seasonBoardError}
               </div>
             )}
             {!seasonBoardLoading && !seasonBoardError && seasonBoard.length === 0 && (
               <div className="season-board-status">
                 No completed seasons yet — be the first legend on the board.
               </div>
             )}
             {!seasonBoardLoading && seasonBoard.length > 0 && (
               <div className="season-board-table-wrap">
                 <table className="season-board-table">
                   <thead>
                     <tr>
                       <th>Season</th>
                       <th>Winner</th>
                       <th>Pot</th>
                       <th>When</th>
                     </tr>
                   </thead>
                   <tbody>
                     {seasonBoard.map((row) => (
                       <tr key={`era-${row.era}-${row.winner}`}>
                         <td className="season-board-era">#{row.era}</td>
                         <td className="season-board-addr" title={row.winner}>
                           {truncateAddress(row.winner)}
                         </td>
                         <td className="season-board-pot">
                           {safeNum(row.amount)} {blockchain.nativeSymbol}
                         </td>
                         <td className="season-board-when">{row.timestamp}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
             <div className="outcome-actions">
               <button
                 type="button"
                 className="outcome-details-btn"
                 onClick={openSeasonBoard}
                 disabled={seasonBoardLoading}
               >
                 {seasonBoardLoading ? "Loading…" : "Refresh"}
               </button>
               <button
                 type="button"
                 className="outcome-continue-btn"
                 onClick={closeSeasonBoard}
               >
                 Close
               </button>
             </div>
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

