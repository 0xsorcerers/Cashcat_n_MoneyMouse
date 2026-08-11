

import { createWallet, walletConnect, inAppWallet } from "thirdweb/wallets";
import { createThirdwebClient } from "thirdweb";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { defineChain } from "thirdweb/chains";
import { ethers, JsonRpcProvider } from "ethers";
import { getContract } from "thirdweb";
import CCC from "../abi/CashcatToken.json";
import Legend from "../abi/Legend.json";
import CASHCATS from "../abi/CASHCATS.json";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import Pyth from '@pythnetwork/pyth-sdk-solidity/abis/IPyth.json';

//Thirdweb wallet connect
// Global Constants ***************************************************************************************************************
export const client = createThirdwebClient({
  clientId: `${process.env.REACT_CLIENT_ID}`,
});

export const wallets = [
  // createWallet("com.coinbase.wallet"),
  // walletConnect(),
  // createWallet("io.metamask"),
  inAppWallet({
    auth: {
      // mode: "redirect",
      options: [
        "farcaster",
        "google",
        "x",
        "telegram",
        "facebook",
        "discord",
        "apple",
        "phone",
        "email",
      ],
    },
  }),
];

export const blockchain = {
  // // mainnet (Base) — fill with mainnet deploys when ready
  // name: 'Cashcat',
  // symbol: 'CASHCAT',
  // address: '0x...',
  // chainId: 8453,
  // rpc: 'https://mainnet.base.org',
  // blockExplorer: 'https://basescan.org/',
  // cashcat_contract_address: "0x...",
  // decimals: 18,
  // pyth_contract_address: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
  // legend_contract_address: "0x...",
  // base_price_id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",

  // testnet — Ethereum Sepolia (contracts are deployed here)
  // NOTE: chainId MUST match the RPC's eth_chainId. Do not point chainId 11155111
  // at rpc.cashcatchain.cash (that endpoint is chain 2274228 and has no code at these addresses).
  name: 'Cashcat',
  symbol: 'CASHCAT',
  address: '0x6f2A200D859a1E4DF8FfB28eBc6F45F4b0341132', // CASHCATS NFT
  chainId: 11155111, // Ethereum Sepolia
  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  blockExplorer: 'https://sepolia.etherscan.io/',
  cashcat_contract_address: "0x8bb94d9345EB47e8b5f4555c7724124043D0931a", // ERC20
  decimals: 18,
  pyth_contract_address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", // Pyth on Sepolia (legacy; game no longer needs entropy fee)
  legend_contract_address: "0x785ad69b277c7c5668e4D0FbFC195f7987F6A2Ee", // CashCat_n_MoneyMouse
  base_price_id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

export const base = defineChain({ id: blockchain.chainId, rpc: blockchain.rpc});
// Pin network so ethers does not auto-detect a mismatched chain from a bad RPC
export const provider = new JsonRpcProvider(blockchain.rpc, blockchain.chainId, { staticNetwork: true });

// convert a thirdweb account to ethers signer
export const getSigner = async (account) => {    
  try {   
    //signers & providers
    const ethersSigner = ethers6Adapter.signer.toEthers({
      client,
      chain: base,
      account: account,
    });
    
    return ethersSigner;
  } catch (error) {
      console.error('Error getting signer:', error);
  }
};

//ABIs
export const abi = {ccc: CCC.abi, // erc20 token abi
  legend: Legend.abi,  //gaming abi
  cashcats: CASHCATS.abi, // nft abi
  pyth: Pyth};

//ethers contracts
export const contract = new ethers.Contract(blockchain.address, abi.cashcats, provider);
export const legendaryContract = new ethers.Contract(blockchain.legend_contract_address, abi.legend, provider);
export const cashcatContract = new ethers.Contract(blockchain.cashcat_contract_address, abi.ccc, provider);

//oracle contracts (optional legacy; game contract now uses on-chain RNG)
export const oracleProvider = new JsonRpcProvider(blockchain.rpc, blockchain.chainId, { staticNetwork: true });
export const oraclePriceContract = new ethers.Contract(blockchain.pyth_contract_address, abi.pyth, oracleProvider);


//getContracts Thirdweb
  // Mint contract (NFT)
export const thirdwebContract = getContract({
  // the client you have created via `createThirdwebClient()`
  client,
  // the chain the contract is deployed on
  chain: base,
  // the contract's address
  address: blockchain.address,
  // OPTIONAL: the contract's abi
  abi: abi.cashcats,
});

//CASHCAT contract
export const thirdwebCASHCATContract = getContract({
  // the client you have created via `createThirdwebClient()`
  client,
  // the chain the contract is deployed on
  chain: base,
  // the contract's address
  address: blockchain.cashcat_contract_address,
  // OPTIONAL: the contract's abi
  abi: abi.ccc,
});

//Thirdweb price oracle
export const thirdwebLegendaryContract = getContract({
  // the client you have created via `createThirdwebClient()`
  client,
  // the chain the contract is deployed on
  chain: base,
  // the contract's address
  address: blockchain.legend_contract_address,
  // OPTIONAL: the contract's abi
  abi: abi.legend,
});

export function Connector () {
  return (
    <ConnectButton
      client={client}
      chain={base}
      wallets={wallets}
      theme={darkTheme({
        colors: {
          primaryText: "#7FFF00",
          secondaryText: "#FFF8DC",
          connectedButtonBg: "#252525",
          connectedButtonBgHover: "#161616",
          separatorLine: "#262830",
          primaryButtonBg: "#7FFF00",
        },
      })}
        supportedTokens={{
          [blockchain.chainId]: [{
            address: blockchain.cashcat_contract_address,
            name: blockchain.name,
            symbol: blockchain.symbol,
            icon: '/logo.png',
          },
          // {
          //   address: blockchain.partner1_contract_address,
          //   name: blockchain.partner1,
          //   symbol: blockchain.partner1_symbol,
          //   icon: '/partner1_logo.jpg',
          // }
        ]
        }}
        connectButton={{ label: "Login" }}
        connectModal={{
          size: "wide",
          title: "Socials or Wallet",
          titleIcon:
            "/logo512.webp",
          welcomeScreen: {
            title: "Cashcats 'n' MoneyMouse!",
            subtitle:
              "...unleashing kickass GambleFi and Yield on Base.",
            img: {
              src: '/logo512.webp',
              width: 250,
              height: 250,
            },
          },
        }}
      />     
  );
}

// Shuffle implementation
export const randomShuffle = (max) => {
  return Math.floor(Math.random() * max);
};

// Fisher-Yates shuffle implementation
export function fisherYatesShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

export const copyClipboard = async(text) => {
  await navigator.clipboard.writeText(text);
}

// Image caching utility
export const cacheImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(src));
    img.addEventListener('error', (error) => reject(error));
    img.src = src;
  });
};

// Preload images to improve performance
export const preloadImages = (imageUrls) => {
  return Promise.all(imageUrls.map(cacheImage));
};
  
//export esthetics
export const truncateAddress = (address) => {
  if (!address) return "No Account";
  const match = address.match(
    /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/
  );
  if (!match) return address;
  return `${match[1]} ... ${match[2]}`;
};

export const formatNumber = (number) => {
  if (!number) return "0";
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return formatter.format(number);
};

export const removeThousands = (value) => {
  const cleanedValue = value.replace(/,/g, '');
  const integerPart = cleanedValue.split('.')[0];
  return integerPart;
};

export function normalizeNumberString(n) {
  // convert scientific to decimal string manually
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 18,
    useGrouping: false
  });
}
    
// export const latin = [
//   'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Si longus, levis; Sed quid sentiat, non videtis. Non autem hoc: igitur ne illud quidem. Aliter enim explicari, quod quaeritur, non potest. An nisi populari fama',
//   'Quae quidem sapientes sequuntur duce natura tamquam videntes; Duo Reges: constructio interrete. Certe non potest. An vero, inquit, quisquam potest probare, quod perceptfum, quod. Beatus sibi videtur esse moriens.',
//   'Eiuro, inquit adridens, iniquum, hac quidem de re; Haec igitur Epicuri non probo, inquam. Quis istud possit, inquit, negare? Quod ea non occurrentia fingunt, vincunt Aristonem;',
//   'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Habes, inquam, Cato, formam eorum, de quibus loquor, philosophorum. Minime vero, inquit ille, consentit. Si stante, hoc natura videlicet vult, salvam esse se, quod concedimus; Huius, Lyco, oratione locuples, rebus ipsis ielunior. Virtutis, magnitudinis animi, patientiae, fortitudinis fomentis dolor mitigari solet. An hoc usque quaque, aliter in vita? Duo Reges: constructio interrete. Quid dubitas igitur mutare principia naturae?',
//   'Quis non odit sordidos, vanos, leves, futtiles? Sed ille, ut dixi, vitiose. Unum nescio, quo modo possit, si luxuriosus sit, finitas cupiditates habere. Bork Quam ob rem tandem, inquit, non satisfacit? At Zeno eum non beatum modo, sed etiam divitem dicere ausus est. Quid ait Aristoteles reliquique Platonis alumni? Tum ille: Ain tandem? Vitiosum est enim in dividendo partem in genere numerare.',
//   'Item de contrariis, a quibus ad genera formasque generum venerunt. Sin dicit obscurari quaedam nec apparere, quia valde parva sint, nos quoque concedimus; Verum audiamus. Sequitur disserendi ratio cognitioque naturae; Perturbationes autem nulla naturae vi commoventur, omniaque ea sunt opiniones ac iudicia levitatis. Nihil acciderat ei, quod nollet, nisi quod anulum, quo delectabatur, in mari abiecerat. Restinguet citius, si ardentem acceperit. Ex ea difficultate illae fallaciloquae, ut ait Accius, malitiae natae sunt. Reguli reiciendam;',
//   'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Deinceps videndum est, quoniam satis apertum est sibi quemque natura esse carum, quae sit hominis natura. Quod est, ut dixi, habere ea, quae secundum naturam sint, vel omnia vel plurima et maxima. Naturales divitias dixit parabiles esse, quod parvo esset natura contenta. Duo Reges: constructio interrete. Itaque a sapientia praecipitur se ipsam, si usus sit, sapiens ut relinquat. Vives, inquit Aristo, magnifice atque praeclare, quod erit cumque visum ages, numquam angere, numquam cupies, numquam timebis. Scaevola tribunus plebis ferret ad plebem vellentne de ea re quaeri. Coniunctio autem cum honestate vel voluptatis vel non dolendi id ipsum honestum, quod amplecti vult, id efficit turpe.',
//   'Beatus autem esse in maximarum rerum timore nemo potest. Partim cursu et peragratione laetantur, congregatione aliae coetum quodam modo civitatis imitantur; Aliter enim nosmet ipsos nosse non possumus. Suo genere perveniant ad extremum; Num igitur utiliorem tibi hunc Triarium putas esse posse, quam si tua sint Puteolis granaria? Nam illud vehementer repugnat, eundem beatum esse et multis malis oppressum.',
//   'Mihi enim satis est, ipsis non satis. Paulum, cum regem Persem captum adduceret, eodem flumine invectio? Negabat igitur ullam esse artem, quae ipsa a se proficisceretur; Estne, quaeso, inquam, sitienti in bibendo voluptas? Eam si varietatem diceres, intellegerem, ut etiam non dicente te intellego; Facit enim ille duo seiuncta ultima bonorum, quae ut essent vera, coniungi debuerunt; Quid ei reliquisti, nisi te, quoquo modo loqueretur, intellegere, quid diceret? Quid, cum volumus nomina eorum, qui quid gesserint, nota nobis esse, parentes, patriam, multa praeterea minime necessaria? Cum sciret confestim esse moriendum eamque mortem ardentiore studio peteret, quam Epicurus voluptatem petendam putat. Sin autem eos non probabat, quid attinuit cum iis, quibuscum re concinebat, verbis discrepare? Manebit ergo amicitia tam diu, quam diu sequetur utilitas, et, si utilitas amicitiam constituet, tollet eadem. Est igitur officium eius generis, quod nec in bonis ponatur nec in contrariis.'
// ]
    