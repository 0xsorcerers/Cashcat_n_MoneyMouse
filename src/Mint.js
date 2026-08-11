import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import './Mint.css';
import { visualEffects } from './tools/effects';
import { useMediaQuery } from 'react-responsive';
import {
  client,
  Connector,
  contract,
  provider,
  base,
  blockchain,
  thirdwebContract,
  thirdwebCASHCATContract,
  cashcatContract,
  formatNumber,
} from './tools/utils';
import { prepareContractCall, waitForReceipt, prepareEvent, parseEventLogs } from 'thirdweb';
import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useSendTransaction,
  useWalletBalance,
} from 'thirdweb/react';
import { MdToggleOn, MdCancel, MdCheckCircle, MdInfo } from 'react-icons/md';
import { ethers } from 'ethers';

/** Cashcats NFT mint event (indexed tokenId) */
const proofOfCashcatMintEvent = prepareEvent({
  signature: 'event proofOfCashcat(uint256 indexed tokenId)',
});

const IPFS_CACHE = 'https://daemon.penny4thots.my/ipfsCache';
const localAlpha = () => {
  try {
    return require('./assets/images/alpha.webp');
  } catch {
    return '/logo512.webp';
  }
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

const toBigInt = (v) => {
  if (v == null) return 0n;
  if (typeof v === 'bigint') return v;
  try {
    return BigInt(v.toString());
  } catch {
    return 0n;
  }
};

const safeFormatEther = (wei) => {
  try {
    return ethers.formatEther(toBigInt(wei));
  } catch {
    return '0';
  }
};

const parseTxError = (error) => {
  const raw =
    error?.reason ||
    error?.shortMessage ||
    error?.message ||
    error?.data?.message ||
    '';
  const s = String(raw);
  if (/Insufficient fee/i.test(s)) return 'Insufficient ETH fee for mint.';
  if (/Public Phase Has Not Yet Begun/i.test(s)) return 'Public mint phase has not started yet.';
  if (/Mint Not Live/i.test(s)) return 'Mint is not live yet.';
  if (/Paused Contract/i.test(s)) return 'Mint is paused.';
  if (/Max Exceeded/i.test(s)) return 'Max supply reached.';
  if (/user rejected|denied|User rejected|ACTION_REJECTED/i.test(s)) return 'Request cancelled.';
  if (/insufficient funds|exceeds the balance/i.test(s)) return 'Not enough ETH for fee + gas.';
  if (/ERC20Insufficient|insufficient allowance|transfer amount exceeds|SafeERC20/i.test(s)) {
    return `Not enough ${blockchain.symbol} (or allowance) for the token fee.`;
  }
  if (error?.shortMessage && !/Encoded error signature/i.test(error.shortMessage)) {
    return error.shortMessage;
  }
  return s ? s.slice(0, 120) : 'Failed to mint.';
};

/**
 * Mint page — free whitelist or paid (ETH fee + optional $CASHCAT tokenFee).
 */
const Mint = ({ setComponent }) => {
  const [eligibleMints, setEligibleMints] = useState({
    total: null, air3: null, air2: null, air1: null, air5: null, air4: null, air6: null,
  });
  const [minted, setMinted] = useState({
    total: null, air3: null, air2: null, air1: null, air5: null, air4: null, air6: null,
  });
  const [mintLimits, setMintLimits] = useState({
    air3: null, air2: null, air1: null, air5: null, air4: null, air6: null,
  });
  const [loading, setLoading] = useState(false);
  /** Latest global mint feed item { tokenId, timestamp } */
  const [mintLog, setMintLog] = useState(null);
  /** Token id minted by this wallet (personal receipt toast) */
  const [mintLogged, setMintLogged] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorMessageVisible, setErrorMessageVisible] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoMessageVisible, setInfoMessageVisible] = useState(false);
  const [infoTone, setInfoTone] = useState('info'); // 'info' | 'success'
  /** Free whitelist path available for this wallet */
  const [condition, setCondition] = useState(false);
  const [accountBal, setAccountBal] = useState(null);
  /** Human-readable token balance for display / checks */
  const [tokenBal, setTokenBal] = useState(null);
  /** Raw wei token balance */
  const [tokenBalWei, setTokenBalWei] = useState(0n);

  /** Paid mint fees from getMintData (wei + display) */
  const [ethFeeWei, setEthFeeWei] = useState(0n);
  const [tokenFeeWei, setTokenFeeWei] = useState(0n);
  const [ethFee, setEthFee] = useState(null);
  const [tokenFee, setTokenFee] = useState(null);
  const [mintLive, setMintLive] = useState(false);
  const [publicPhaseLive, setPublicPhaseLive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  /** Fallback art when daemon cache image 404s */
  const [thumbBroken, setThumbBroken] = useState({});

  const mintingRef = useRef(false);
  const seenMintIds = useRef(new Set());
  const dismissTimers = useRef([]);
  const accountRef = useRef(null);

  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { mutateAsync: sendTransactionAsync } = useSendTransaction();

  accountRef.current = account?.address || null;

  const { data: walletBalData } = useWalletBalance({
    chain: base,
    address: account?.address,
    client,
  });

  useEffect(() => {
    if (walletBalData?.value != null) {
      setAccountBal(Number(safeFormatEther(walletBalData.value)));
    }
  }, [walletBalData]);

  /** Apply a normalized mint snapshot into React state */
  const applyMintSnapshot = useCallback((snap) => {
    const {
      ethFeeW, tokenFeeW, paused, live, publicLive,
      air1L, air2L, air3L, air4L, air5L, air6L,
      isWhitelisted, wlAir3, wlAir2, wlAir1, wlAir5, wlAir4, wlAir6,
      mintedTotal, remAir3, remAir2, remAir1, remAir5, remAir4, remAir6,
      freeEligible, canFreeMint,
    } = snap;

    setEthFeeWei(ethFeeW);
    setTokenFeeWei(tokenFeeW);
    setEthFee(Number(safeFormatEther(ethFeeW)));
    setTokenFee(Number(safeFormatEther(tokenFeeW)));
    setIsPaused(paused);
    setMintLive(live);
    setPublicPhaseLive(publicLive);

    setMintLimits({
      air1: air1L, air2: air2L, air3: air3L,
      air4: air4L, air5: air5L, air6: air6L,
    });

    setEligibleMints({
      total: freeEligible,
      air3: remAir3,
      air2: remAir2,
      air1: remAir1,
      air5: remAir5,
      air4: remAir4,
      air6: remAir6,
    });

    setMinted({
      total: mintedTotal,
      air3: isWhitelisted ? Math.max(0, wlAir3 - remAir3) : 0,
      air2: isWhitelisted ? Math.max(0, wlAir2 - remAir2) : 0,
      air1: isWhitelisted ? Math.max(0, wlAir1 - remAir1) : 0,
      air5: isWhitelisted ? Math.max(0, wlAir5 - remAir5) : 0,
      air4: isWhitelisted ? Math.max(0, wlAir4 - remAir4) : 0,
      air6: isWhitelisted ? Math.max(0, wlAir6 - remAir6) : 0,
    });

    setCondition(canFreeMint);
    setDataReady(true);

    return {
      ethFeeWei: ethFeeW,
      tokenFeeWei: tokenFeeW,
      isPaused: paused,
      mintLive: live,
      publicPhaseLive: publicLive,
      canFreeMint,
      freeEligible,
    };
  }, []);

  /**
   * Fallback multi-read when getMintData is not yet on the deployed bytecode.
   * Still correct for fees + whitelist display; mintLive/publicPhaseLive default true
   * if we cannot read private startTime (paid path will surface contract reverts).
   */
  const fetchMintDataLegacy = useCallback(async (addr) => {
    const [
      feeRaw, cyberRaw, pausedRaw,
      air1L, air2L, air3L, air4L, air5L, air6L,
      wl, hist,
    ] = await Promise.all([
      contract.fee(),
      contract.cyberFee(),
      contract.paused(),
      contract.air1Limit(),
      contract.air2Limit(),
      contract.air3Limit(),
      contract.air4Limit(),
      contract.air5Limit(),
      contract.air6Limit(),
      contract.whitelisted(addr),
      contract.cashcatminted(addr),
    ]);

    const ethFeeW = toBigInt(feeRaw);
    const tokenFeeW = toBigInt(cyberRaw);
    const paused = Boolean(pausedRaw);
    const isWhitelisted = Boolean(wl[0] ?? wl.whitelist);
    const wlAir3 = Number(wl[1] ?? wl.air3NFTowner ?? 0);
    const wlAir2 = Number(wl[2] ?? wl.air2NFTowner ?? 0);
    const wlAir1 = Number(wl[3] ?? wl.air1NFTowner ?? 0);
    const wlAir5 = Number(wl[4] ?? wl.air5Community ?? 0);
    const wlAir4 = Number(wl[5] ?? wl.air4Contributor ?? 0);
    const wlAir6 = Number(wl[6] ?? wl.earlyContributor ?? 0);

    const mintedTotal = Number(hist[0] ?? hist.cashcatmint ?? 0);
    let remAir3; let remAir2; let remAir1; let remAir5; let remAir4; let remAir6;
    if (isWhitelisted) {
      if (mintedTotal < 1) {
        remAir3 = wlAir3; remAir2 = wlAir2; remAir1 = wlAir1;
        remAir5 = wlAir5; remAir4 = wlAir4; remAir6 = wlAir6;
      } else {
        remAir3 = Number(hist[1] ?? hist.air3NFTmints ?? 0);
        remAir2 = Number(hist[2] ?? hist.air2NFTmints ?? 0);
        remAir1 = Number(hist[3] ?? hist.air1NFTmints ?? 0);
        remAir5 = Number(hist[4] ?? hist.air5Mints ?? 0);
        remAir4 = Number(hist[5] ?? hist.air4Mints ?? 0);
        remAir6 = Number(hist[6] ?? hist.air6Mints ?? 0);
      }
    } else {
      remAir3 = remAir2 = remAir1 = remAir5 = remAir4 = remAir6 = 0;
    }

    const a1 = Number(air1L); const a2 = Number(air2L); const a3 = Number(air3L);
    const a4 = Number(air4L); const a5 = Number(air5L); const a6 = Number(air6L);
    const freeEligible = remAir3 + remAir2 + remAir1 + remAir5 + remAir4 + remAir6;
    const canFreeMint =
      isWhitelisted &&
      !paused &&
      (
        (remAir3 > 0 && a3 > 0) ||
        (remAir2 > 0 && a2 > 0) ||
        (remAir1 > 0 && a1 > 0) ||
        (remAir5 > 0 && a5 > 0) ||
        (remAir4 > 0 && a4 > 0) ||
        (remAir6 > 0 && a6 > 0)
      );

    return applyMintSnapshot({
      ethFeeW, tokenFeeW, paused,
      live: true, publicLive: true,
      air1L: a1, air2L: a2, air3L: a3, air4L: a4, air5L: a5, air6L: a6,
      isWhitelisted, wlAir3, wlAir2, wlAir1, wlAir5, wlAir4, wlAir6,
      mintedTotal, remAir3, remAir2, remAir1, remAir5, remAir4, remAir6,
      freeEligible, canFreeMint,
    });
  }, [applyMintSnapshot]);

  /**
   * One RPC: contract.getMintData(player) — global fees/limits + this wallet's free eligibility.
   * Falls back to multi-read if the deployed contract does not yet expose getMintData.
   */
  const fetchMintData = useCallback(async (playerAddr) => {
    const addr = playerAddr || account?.address || ethers.ZeroAddress;
    try {
      const d = await contract.getMintData(addr);
      if (d == null) throw new Error('Empty getMintData response');

      return applyMintSnapshot({
        ethFeeW: toBigInt(d.ethFee ?? d[0]),
        tokenFeeW: toBigInt(d.tokenFee ?? d[1]),
        paused: Boolean(d.isPaused ?? d[2]),
        live: Boolean(d.mintLive ?? d[3]),
        publicLive: Boolean(d.publicPhaseLive ?? d[4]),
        air3L: Number(d.air3Limit_ ?? d[7] ?? 0),
        air2L: Number(d.air2Limit_ ?? d[8] ?? 0),
        air1L: Number(d.air1Limit_ ?? d[9] ?? 0),
        air5L: Number(d.air5Limit_ ?? d[10] ?? 0),
        air4L: Number(d.air4Limit_ ?? d[11] ?? 0),
        air6L: Number(d.air6Limit_ ?? d[12] ?? 0),
        isWhitelisted: Boolean(d.isWhitelisted ?? d[13]),
        wlAir3: Number(d.wlAir3 ?? d[14] ?? 0),
        wlAir2: Number(d.wlAir2 ?? d[15] ?? 0),
        wlAir1: Number(d.wlAir1 ?? d[16] ?? 0),
        wlAir5: Number(d.wlAir5 ?? d[17] ?? 0),
        wlAir4: Number(d.wlAir4 ?? d[18] ?? 0),
        wlAir6: Number(d.wlAir6 ?? d[19] ?? 0),
        mintedTotal: Number(d.mintedTotal ?? d[20] ?? 0),
        remAir3: Number(d.remAir3 ?? d[21] ?? 0),
        remAir2: Number(d.remAir2 ?? d[22] ?? 0),
        remAir1: Number(d.remAir1 ?? d[23] ?? 0),
        remAir5: Number(d.remAir5 ?? d[24] ?? 0),
        remAir4: Number(d.remAir4 ?? d[25] ?? 0),
        remAir6: Number(d.remAir6 ?? d[26] ?? 0),
        freeEligible: Number(d.freeEligible ?? d[27] ?? 0),
        canFreeMint: Boolean(d.canFreeMint ?? d[28]),
      });
    } catch (primaryErr) {
      console.warn('getMintData unavailable, using legacy multi-read:', primaryErr?.shortMessage || primaryErr?.message);
      try {
        return await fetchMintDataLegacy(addr);
      } catch (error) {
        console.error('fetchMintData failed:', error);
        setErrorMessage('Failed to load mint data');
        setErrorMessageVisible(true);
        return null;
      }
    }
  }, [account?.address, applyMintSnapshot, fetchMintDataLegacy]);

  const fetchTokenBalance = useCallback(async (playerAddr) => {
    const addr = playerAddr || account?.address;
    if (!addr) return 0n;
    try {
      const raw = await cashcatContract.balanceOf(addr);
      const wei = toBigInt(raw);
      setTokenBalWei(wei);
      const human = Number(safeFormatEther(wei));
      setTokenBal(Number.isFinite(human) ? human.toFixed(0) : '0');
      return wei;
    } catch (error) {
      console.error('fetchTokenBalance failed:', error);
      return 0n;
    }
  }, [account?.address]);

  const refreshAll = useCallback(async () => {
    if (!account?.address) return;
    await Promise.all([
      fetchMintData(account.address),
      fetchTokenBalance(account.address),
    ]);
  }, [account?.address, fetchMintData, fetchTokenBalance]);

  useEffect(() => {
    if (account?.address) {
      refreshAll();
    } else {
      // Public snapshot (zero address) so fee copy still loads before login
      fetchMintData(ethers.ZeroAddress);
    }
  }, [account?.address, fetchMintData, refreshAll]);

  const clearDismissTimers = () => {
    dismissTimers.current.forEach((t) => clearTimeout(t));
    dismissTimers.current = [];
  };

  const scheduleDismiss = (fn, ms = 8000) => {
    const t = setTimeout(fn, ms);
    dismissTimers.current.push(t);
    return t;
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setErrorMessageVisible(true);
    setInfoMessageVisible(false);
    scheduleDismiss(() => setErrorMessageVisible(false), 10000);
  };

  const showInfo = (msg, tone = 'info') => {
    setInfoTone(tone);
    setInfoMessage(msg);
    setInfoMessageVisible(true);
    scheduleDismiss(() => setInfoMessageVisible(false), 7000);
  };

  /**
   * Mark a minted token in the feed; if wallet owns it, show personal receipt toast.
   * HTTP JsonRpcProvider does not deliver contract.on subscriptions reliably — prefer receipts + polling.
   */
  const registerMintedToken = useCallback(async (tokenId, { forcePersonal = false } = {}) => {
    const id = tokenId?.toString?.() ?? String(tokenId);
    if (!id || id === 'undefined' || id === 'null') return;

    const isNew = !seenMintIds.current.has(id);
    seenMintIds.current.add(id);

    if (isNew || forcePersonal) {
      setMintLog({ tokenId: id, timestamp: Date.now() });
      scheduleDismiss(() => {
        setMintLog((cur) => (cur?.tokenId === id ? null : cur));
      }, 12000);
    }

    const addr = accountRef.current;
    if (!addr && !forcePersonal) return;

    try {
      const ownerData = await contract.ownerOf(id);
      if (addr && ownerData && ownerData.toLowerCase() === addr.toLowerCase()) {
        setMintLogged(id);
        setThumbBroken((prev) => ({ ...prev, [id]: false }));
        showInfo(`CASHCATS #${id} minted to your wallet!`, 'success');
      }
    } catch (e) {
      // ownerOf can lag a block; still surface global feed
      console.warn('registerMintedToken ownerOf failed:', e?.shortMessage || e?.message);
      if (forcePersonal) {
        setMintLogged(id);
        showInfo(`CASHCATS #${id} mint confirmed!`, 'success');
      }
    }
  }, []);

  /**
   * Parse proofOfCashcat from a confirmed mint tx (primary receipt path).
   * When supply % 10 == 0 the contract also mints a DAO reserve token — pick the one you own.
   */
  const processMintReceipt = useCallback(async (txResult) => {
    try {
      const transactionHash =
        typeof txResult === 'string'
          ? txResult
          : txResult?.transactionHash || txResult?.hash;

      if (!transactionHash) {
        console.error('Mint tx result missing hash', txResult);
        showError('Mint submitted but no transaction hash was returned.');
        return null;
      }

      showInfo('Mint transaction confirmed — reading receipt…', 'info');

      const receipt = await waitForReceipt({
        client,
        chain: base,
        transactionHash,
      });

      if (receipt.status === 'reverted' || receipt.status === 0 || receipt.status === '0') {
        showError('Mint transaction reverted on-chain.');
        return null;
      }

      const tokenIds = [];

      try {
        const events = parseEventLogs({
          logs: receipt.logs || [],
          events: [proofOfCashcatMintEvent],
        });
        for (const ev of events) {
          const tid = ev.args?.tokenId ?? ev.args?.[0];
          if (tid != null) tokenIds.push(tid.toString());
        }
      } catch (parseErr) {
        console.warn('parseEventLogs failed, trying ethers Interface:', parseErr);
      }

      // Fallback: decode with ethers ABI (covers ABI/shape mismatches)
      if (!tokenIds.length && receipt.logs?.length) {
        const iface = new ethers.Interface(contract.interface.fragments);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed?.name === 'proofOfCashcat') {
              tokenIds.push(parsed.args[0].toString());
            }
          } catch {
            // not our event
          }
        }
      }

      // Transfer(from=0) as last resort
      if (!tokenIds.length && receipt.logs?.length) {
        const iface = new ethers.Interface([
          'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
        ]);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (
              parsed?.name === 'Transfer' &&
              parsed.args.from === ethers.ZeroAddress
            ) {
              tokenIds.push(parsed.args.tokenId.toString());
            }
          } catch {
            // skip
          }
        }
      }

      if (!tokenIds.length) {
        console.error('No mint events in receipt', receipt);
        showError('Mint confirmed but no token id found in the receipt. Refresh and check your wallet.');
        return null;
      }

      // Register all (DAO reserve + user). Personal toast only for owned ids.
      let personalId = null;
      const addr = accountRef.current?.toLowerCase();
      for (const id of tokenIds) {
        await registerMintedToken(id, { forcePersonal: false });
        if (addr) {
          try {
            const owner = (await contract.ownerOf(id))?.toLowerCase?.();
            if (owner === addr) personalId = id;
          } catch {
            // if only one id and we minted, treat as personal
            if (tokenIds.length === 1) personalId = id;
          }
        }
      }

      // If ownerOf lagged, still credit last id as personal when we initiated mint
      if (!personalId && tokenIds.length) {
        personalId = tokenIds[tokenIds.length - 1];
        setMintLogged(personalId);
        showInfo(`CASHCATS #${personalId} minted!`, 'success');
      }

      return personalId;
    } catch (err) {
      console.error('processMintReceipt failed:', err);
      showError(err?.shortMessage || err?.message || 'Failed to read mint receipt.');
      return null;
    }
  }, [registerMintedToken]);

  const handleMint = async () => {
    if (loading || mintingRef.current) return;
    if (!account?.address) {
      showError('Connect wallet to mint.');
      return;
    }

    mintingRef.current = true;
    setLoading(true);
    setErrorMessageVisible(false);
    clearDismissTimers();

    try {
      const md = await fetchMintData(account.address);
      if (!md) {
        showError('Could not load mint data. Check your connection and try again.');
        return;
      }

      if (md.isPaused) {
        showError('Mint is paused by the DAO. Try again later.');
        return;
      }
      if (!md.mintLive) {
        showError('Mint is not live yet. Check back when the countdown ends.');
        return;
      }

      // —— Free whitelist path ——
      if (md.canFreeMint) {
        setIsMinting(true);
        showInfo('Submitting free whitelist mint…', 'info');
        const tx = prepareContractCall({
          contract: thirdwebContract,
          method: 'function mint() payable',
          params: [],
          value: 0n,
        });
        const result = await sendTransactionAsync(tx);
        await processMintReceipt(result);
        await refreshAll();
        return;
      }

      // —— Paid path: exact native fee + optional ERC20 tokenFee ——
      if (!md.publicPhaseLive) {
        showError('Public mint phase has not started yet. Whitelist-only window is still open.');
        return;
      }

      const needEth = md.ethFeeWei;
      const needTok = md.tokenFeeWei;

      // ETH balance check (fee only; gas is extra)
      const ethBalWei = walletBalData?.value != null
        ? toBigInt(walletBalData.value)
        : (accountBal != null ? ethers.parseEther(String(accountBal)) : 0n);

      if (needEth > 0n && ethBalWei < needEth) {
        showError(
          `Insufficient Funds to Mint. Requires ${formatNumber(Number(safeFormatEther(needEth)))} ETH` +
          (needTok > 0n
            ? ` + ${formatNumber(Number(safeFormatEther(needTok)))} ${blockchain.symbol}.`
            : '.') +
          ' Top up ETH and try again.'
        );
        return;
      }

      // Token balance + approval when tokenFee > 0
      if (needTok > 0n) {
        const bal = await fetchTokenBalance(account.address);
        if (bal < needTok) {
          showError(
            `Insufficient Funds to Mint. Requires ${formatNumber(Number(safeFormatEther(needTok)))} ${blockchain.symbol}` +
            (needEth > 0n
              ? ` + ${formatNumber(Number(safeFormatEther(needEth)))} ETH.`
              : '.') +
            ` Your balance is too low.`
          );
          return;
        }

        const allowanceRaw = await cashcatContract.allowance(
          account.address,
          blockchain.address
        );
        const allowance = toBigInt(allowanceRaw);

        if (allowance < needTok) {
          setIsApproving(true);
          showInfo(
            `Approve ${formatNumber(Number(safeFormatEther(needTok)))} ${blockchain.symbol} for the mint contract…`,
            'info'
          );
          const approveTx = prepareContractCall({
            contract: thirdwebCASHCATContract,
            method: 'function approve(address spender, uint256 value)',
            params: [blockchain.address, needTok],
          });
          await sendTransactionAsync(approveTx);
          setIsApproving(false);
          showInfo(`${blockchain.symbol} approved. Submitting mint…`, 'success');
        }
      }

      setIsMinting(true);
      showInfo(
        needEth > 0n
          ? `Submitting paid mint (${formatNumber(Number(safeFormatEther(needEth)))} ETH)…`
          : 'Submitting paid mint…',
        'info'
      );
      // Contract requires msg.value == fee exactly on paid path
      const mintTx = prepareContractCall({
        contract: thirdwebContract,
        method: 'function mint() payable',
        params: [],
        value: needEth,
      });
      const result = await sendTransactionAsync(mintTx);
      await processMintReceipt(result);
      await refreshAll();
    } catch (err) {
      console.error('handleMint failed:', err);
      showError(parseTxError(err));
    } finally {
      setLoading(false);
      setIsApproving(false);
      setIsMinting(false);
      mintingRef.current = false;
    }
  };

  /**
   * Poll recent proofOfCashcat logs (works with HTTP RPC).
   * contract.on() needs a websocket / filter subscription most public RPCs do not provide.
   */
  useEffect(() => {
    if (!contract) return undefined;
    let cancelled = false;

    const pollMints = async () => {
      try {
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - 12);
        const logs = await contract.queryFilter(
          contract.filters.proofOfCashcat(),
          fromBlock,
          latest
        );
        if (cancelled || !logs?.length) return;
        for (const log of logs) {
          const id = (log.args?.[0] ?? log.args?.tokenId)?.toString?.();
          if (id) await registerMintedToken(id);
        }
      } catch (e) {
        // Silent — public RPC may rate-limit; receipt path still handles own mints
        console.warn('mint poll failed:', e?.shortMessage || e?.message);
      }
    };

    pollMints();
    const interval = setInterval(pollMints, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [registerMintedToken]);

  useEffect(() => () => clearDismissTimers(), []);

  // Create the target date in a way that works across all browsers
  const targetDate = new Date();
  targetDate.setFullYear(2025, 3, 12); // April 12, 2025 (months are 0-indexed)
  targetDate.setHours(19, 0, 0, 0);
  targetDate.setHours(targetDate.getHours() + 1);
  const countDownDate = targetDate.getTime();

  const [countDown, setCountDown] = useState(
    Math.max(0, Math.floor((countDownDate - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const secondsRemaining = Math.floor((countDownDate - Date.now()) / 1000);
      if (secondsRemaining >= 0) {
        setCountDown(secondsRemaining);
      } else {
        setCountDown(0);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [countDownDate]);

  const days = Math.floor(countDown / (60 * 60 * 24));
  const hours = Math.floor((countDown % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((countDown % (60 * 60)) / 60);
  const seconds = Math.floor(countDown % 60);

  const feeLine = (
    <>
      Mint a CASHCATS NFT for{' '}
      <span className="countText countTextShrink">
        {ethFee != null ? formatNumber(ethFee) : '—'}
      </span>{' '}
      ETH
      {' + '}
      <span className="countText countTextShrink">
        {tokenFee != null ? formatNumber(tokenFee) : '—'}
      </span>{' '}
      {blockchain.symbol}
    </>
  );

  const feeLineMobile = (
    <>
      NFT for{' '}
      <span className="countText countTextTiny" style={{ fontSize: 'medium' }}>
        {ethFee != null ? formatNumber(ethFee) : '—'}
      </span>{' '}
      ETH +{' '}
      <span className="countText countTextTiny" style={{ fontSize: 'medium' }}>
        {tokenFee != null ? formatNumber(tokenFee) : '—'}
      </span>{' '}
      {blockchain.symbol}
    </>
  );

  const buttonLabel = () => {
    if (loading && isApproving) return 'Approving...';
    if (loading && isMinting) return 'Minting...';
    if (loading) return 'Minting...';
    return ' Mint';
  };

  return (
    <div className="mint-container">
      {account ? (
        <>
          <Desktop>
            <div className="mintOutlay">
              <div className="mintChecker">
                <div className="air1 mintbox">
                  <img src={visualEffects.air1} className="icon" alt="Air1" />
                  <br />
                  <span className="mintText">Air1 x {eligibleMints.air1}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air1} / {mintLimits.air1} minted
                  </span>
                </div>
                <div className="air2 mintbox">
                  <img src={visualEffects.air2} className="icon" alt="Air2" />
                  <br />
                  <span className="mintText">Air2 x {eligibleMints.air2}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air2} / {mintLimits.air2} minted
                  </span>
                </div>
                <div className="air3 mintbox">
                  <img src={visualEffects.air3} className="icon" alt="Air3" />
                  <br />
                  <span className="mintText">Air3 x {eligibleMints.air3}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air3} / {mintLimits.air3} minted
                  </span>
                </div>
                <div className="air4 mintbox">
                  <img src={visualEffects.air4} className="icon" alt="Air4" />
                  <br />
                  <span className="mintText">Air4 x {eligibleMints.air4}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air4} / {mintLimits.air4} minted
                  </span>
                </div>
                <div className="air5 mintbox">
                  <img src={visualEffects.air5} className="icon" alt="Air5" />
                  <br />
                  <span className="mintText">Air5 x {eligibleMints.air5}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air5} / {mintLimits.air5} minted
                  </span>
                </div>
                <div className="air6 mintbox">
                  <img src={visualEffects.air6} className="icon" alt="Air6" />
                  <br />
                  <span className="mintText">Air6 x {eligibleMints.air6}</span>
                  <br />
                  <span className="mintedText pink">
                    {minted.air6} / {mintLimits.air6} minted
                  </span>
                </div>
              </div>
              <div className="mint-status">
                <div className="rewardsText">You are eligible to mint</div>
                {condition ? (
                  <div className="countText">{eligibleMints.total}</div>
                ) : (
                  <div className="countText">0</div>
                )}
                <div className="rewardsTextSmall">CASHCATS NFTs</div>
                {condition ? (
                  <div className="rewardsTextSmall pink">All whitelisted mints are free.</div>
                ) : (
                  <div className="rewardsTextSmall sunfire">{feeLine}.</div>
                )}
                <div className="mintpanel">
                  {countDown <= 0 ? (
                    <button
                      className="mint-button"
                      onClick={handleMint}
                      disabled={loading}
                      style={loading ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }}
                    >
                      <span className="smaller">{condition ? 'free' : 'paid'}</span>
                      {buttonLabel()}
                    </button>
                  ) : (
                    <button
                      className="mint-button"
                      onClick={() => {
                        setComponent('home');
                        disconnect(wallet);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Desktop>
          <Mobile>
            <div className="mobileOutlay">
              <div className="mobileChecker">
                <div className="air1 mobileMintbox" align="center">
                  <img src={visualEffects.air1} className="icon" alt="Air1" />
                </div>
                <div className="mobileMintText">Air1 x {eligibleMints.air1}</div>
                <div className="mobileMintedText pink">
                  {minted.air1} / {mintLimits.air1} minted
                </div>
              </div>
              <div className="mobileChecker">
                <div className="air2 mobileMintbox" align="center">
                  <img src={visualEffects.air2} className="icon" alt="Air2" />
                </div>
                <div className="mobileMintText">Air2 x {eligibleMints.air2}</div>
                <div className="mobileMintedText pink">
                  {minted.air2} / {mintLimits.air2} minted
                </div>
              </div>
            </div>
            <div className="mobileChecker">
              <div className="air3 mobileMintbox" align="center">
                <img src={visualEffects.air3} className="icon" alt="Air3" />
              </div>
              <div className="mobileMintText">Air3 x {eligibleMints.air3}</div>
              <div className="mobileMintedText pink">
                {minted.air3} / {mintLimits.air3} minted
              </div>
            </div>
            <div className="mobileChecker">
              <div className="air4 mobileMintbox" align="center">
                <img src={visualEffects.air4} className="icon" alt="Air4" />
              </div>
              <div className="mobileMintText">Air4 x {eligibleMints.air4}</div>
              <div className="mobileMintedText pink">
                {minted.air4} / {mintLimits.air4} minted
              </div>
            </div>
            <div className="mobileChecker">
              <div className="air5 mobileMintbox" align="center">
                <img src={visualEffects.air5} className="icon" alt="Air5" />
              </div>
              <div className="mobileMintText">Air5 x {eligibleMints.air5}</div>
              <div className="mobileMintedText pink">
                {minted.air5} / {mintLimits.air5} minted
              </div>
            </div>
            <div className="mobileChecker">
              <div className="air6 mobileMintbox" align="center">
                <img src={visualEffects.air6} className="icon" alt="Air6" />
              </div>
              <div className="mobileMintText">Air6 x {eligibleMints.air6}</div>
              <div className="mobileMintedText pink">
                {minted.air6} / {mintLimits.air6} minted
              </div>
            </div>

            <div className="minipanel">
              <>
                {condition ? (
                  <>
                    <div className="rewardsText"> You can mint </div>
                    <div className="countText">{eligibleMints.total}</div>
                    <div className="rewardsTextSmall">NFTs for free</div>
                  </>
                ) : (
                  <>
                    <div className="rewardsText"> Mint</div>
                    <div className="countText">1</div>
                    <div className="rewardsTextSmall sunfire">{feeLineMobile}.</div>
                  </>
                )}
              </>
              <div>
                {countDown <= 0 ? (
                  <button
                    className="mint-button"
                    onClick={handleMint}
                    disabled={loading}
                    style={loading ? { opacity: 0.5, cursor: 'not-allowed' } : { cursor: 'pointer' }}
                  >
                    <span className="smaller">{condition ? 'free' : 'paid'}</span>
                    {buttonLabel()}
                  </button>
                ) : (
                  <button
                    className="mint-button"
                    onClick={() => {
                      setComponent('home');
                      disconnect(wallet);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          </Mobile>
        </>
      ) : (
        <>
          <div className="mintTitle" align="center">
            <span style={{ fontFamily: 'NexaHeavy', color: '#7ec8ff' }}>Cashcats</span>
            {countDown > 0 ? 'Mint not yet live' : 'Mint is live'}
            <div style={{ padding: '0.5rem' }}>
              <Connector />
            </div>
          </div>
          <Desktop>
            <h1 className="waveanimator quote mintboard">
              {countDown > 0
                ? `${days.toString().padStart(2, '0')}:
              ${hours.toString().padStart(2, '0')}:
              ${minutes.toString().padStart(2, '0')}:
              ${seconds.toString().padStart(2, '0')}`
                : '00:00:00:00'}
            </h1>
          </Desktop>
          <Mobile>
            <h1 className="waveanimator quote mintboardMobile">
              {countDown > 0
                ? `${days.toString().padStart(2, '0')}:
              ${hours.toString().padStart(2, '0')}:
              ${minutes.toString().padStart(2, '0')}:
              ${seconds.toString().padStart(2, '0')}`
                : '00:00:00:00'}
            </h1>
          </Mobile>
          <div className="tagline">
            only available <br />
            on Base{' '}
          </div>
          <img src={visualEffects.logobase} className="tagImage" alt="Base" />
        </>
      )}

      {(() => {
        const hasToasts =
          errorMessageVisible ||
          infoMessageVisible ||
          !!mintLog ||
          !!mintLogged;
        if (!hasToasts) return null;

        const remoteThumb = mintLogged
          ? `${IPFS_CACHE}/${mintLogged}.webp`
          : null;
        const thumbSrc =
          mintLogged && !thumbBroken[mintLogged] && remoteThumb
            ? remoteThumb
            : localAlpha();

        return (
          <div className="notifications" style={{ display: 'block' }}>
            {errorMessageVisible && (
              <div className="notify notifyText cancelled">
                <MdCancel style={{ color: 'salmon', marginRight: '0.5vh' }} />
                {errorMessage}
                <MdToggleOn
                  onClick={() => setErrorMessageVisible(false)}
                  style={{ cursor: 'pointer', margin: '0vh 1vh' }}
                  title="Dismiss"
                />
              </div>
            )}
            {infoMessageVisible && (
              <div
                className={`notify notifyText ${infoTone === 'success' ? '' : 'cancelled'}`}
                style={
                  infoTone === 'success'
                    ? { borderColor: 'lime' }
                    : { borderColor: 'skyblue' }
                }
              >
                {infoTone === 'success' ? (
                  <MdCheckCircle style={{ color: 'lime', marginRight: '0.5vh' }} />
                ) : (
                  <MdInfo style={{ color: 'skyblue', marginRight: '0.5vh' }} />
                )}
                {infoMessage}
                <MdToggleOn
                  onClick={() => setInfoMessageVisible(false)}
                  style={{ cursor: 'pointer', margin: '0vh 1vh' }}
                  title="Dismiss"
                />
              </div>
            )}
            {mintLog && (
              <div className="notify notifyText">
                <img
                  className="notifyImg wheat"
                  src={localAlpha()}
                  alt="Mint"
                />
                CASHCATS <span style={{ color: 'lime' }}>#{mintLog.tokenId}</span> just minted
                <MdToggleOn
                  onClick={() => setMintLog(null)}
                  style={{ cursor: 'pointer', margin: '0vh 1vh' }}
                  title="Dismiss"
                />
              </div>
            )}
            {mintLogged && (
              <div className="myNotify myNotifyText">
                <img
                  className="myNotifyImg pink"
                  src={thumbSrc}
                  alt={`Cashcat #${mintLogged}`}
                  onError={() =>
                    setThumbBroken((prev) => ({ ...prev, [mintLogged]: true }))
                  }
                />
                CASHCATS <span style={{ color: 'maroon' }}>#{mintLogged}</span> minted by you!
                <MdToggleOn
                  onClick={() => setMintLogged(null)}
                  style={{ cursor: 'pointer', margin: '0vh 1vh' }}
                  title="Dismiss"
                />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default Mint;
