/**
 * Replace user-facing ETH / $CASHCAT / CCC labels with blockchain.nativeSymbol / blockchain.symbol.
 * Does NOT rename ethFee / ethCost / prizePot.eth identifiers.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function transformLegends(s) {
  // Errors / fees (template literals inside source)
  s = s.replace(
    /You need ETH to pay the entry fee/g,
    "You need ${blockchain.nativeSymbol} to pay the entry fee"
  );
  s = s.replace(
    /Requires \$\{formatNumber\(ethCostEth\)\} ETH entry fee/g,
    "Requires ${formatNumber(ethCostEth)} ${blockchain.nativeSymbol} entry fee"
  );
  s = s.replace(
    /Not enough ETH sent for the entry fee\./g,
    "Not enough ${blockchain.nativeSymbol} sent for the entry fee."
  );
  s = s.replace(
    /Not enough ETH in your wallet for gas \+ entry fee\./g,
    "Not enough ${blockchain.nativeSymbol} in your wallet for gas + entry fee."
  );
  s = s.replace(
    /Requires \$\{formatNumber\(tokenCostEth\)\} \$CASHCAT token fee/g,
    "Requires ${formatNumber(tokenCostEth)} $${blockchain.symbol} token fee"
  );
  s = s.replace(
    /Not enough \$CASHCAT \(or allowance\) for the token fee\./g,
    "Not enough $${blockchain.symbol} (or allowance) for the token fee."
  );
  s = s.replace(
    /Initiating \$CASHCAT approval\.\.\./g,
    "Initiating $${blockchain.symbol} approval..."
  );
  s = s.replace(
    /Requesting \$CASHCAT Approval\.\.\./g,
    "Requesting $${blockchain.symbol} Approval..."
  );

  // JSX amounts
  s = s.replace(
    /\{safeNum\(seasonPot\)\} ETH/g,
    "{safeNum(seasonPot)} {blockchain.nativeSymbol}"
  );
  s = s.replace(
    /\{safeNum\(lastWinner\.pot\)\} ETH/g,
    "{safeNum(lastWinner.pot)} {blockchain.nativeSymbol}"
  );
  s = s.replace(
    /\{safeNum\(winAmount\)\} ETH/g,
    "{safeNum(winAmount)} {blockchain.nativeSymbol}"
  );
  s = s.replace(
    /\{safeNum\(row\.amount\)\} ETH/g,
    "{safeNum(row.amount)} {blockchain.nativeSymbol}"
  );
  s = s.replace(
    /\{safeNum\(prizePot\.eth\)\} ETH/g,
    "{safeNum(prizePot.eth)} {blockchain.nativeSymbol}"
  );

  // Fee preview template strings
  s = s.replace(
    /Requires \$\{safeNum\(feePreview\.eth\)\} ETH \+ \$\{safeNum\(feePreview\.ccc\)\} CCC/g,
    "Requires ${safeNum(feePreview.eth)} ${blockchain.nativeSymbol} + ${safeNum(feePreview.ccc)} ${blockchain.symbol}"
  );
  s = s.replace(
    /Requires \$\{safeNum\(feePreview\.eth\)\} ETH(\$\{feePreview\.hasNft)/g,
    "Requires ${safeNum(feePreview.eth)} ${blockchain.nativeSymbol}$1"
  );
  s = s.replace(
    /Requires \{safeNum\(feePreview\.eth\)\} ETH/g,
    "Requires {safeNum(feePreview.eth)} {blockchain.nativeSymbol}"
  );
  s = s.replace(
    /\{feePreview\.ccc > 0 \? ` \+ \$\{safeNum\(feePreview\.ccc\)\} CCC` : ''\}/g,
    "{feePreview.ccc > 0 ? ` + ${safeNum(feePreview.ccc)} ${blockchain.symbol}` : ''}"
  );

  // Stat labels
  s = s.replace(
    /<span className="stat-label">ETH<\/span>/g,
    "<span className=\"stat-label\">{blockchain.nativeSymbol}</span>"
  );
  s = s.replace(
    /<span className="stat-label">CCC<\/span>/g,
    "<span className=\"stat-label\">{blockchain.symbol}</span>"
  );

  // Literary tips
  s = s.replace(
    /you win the season ETH pot\./g,
    "you win the season {blockchain.nativeSymbol} pot."
  );
  s = s.replace(
    /Every play feeds the ETH pot\./g,
    "Every play feeds the {blockchain.nativeSymbol} pot."
  );
  s = s.replace(
    /pay base ETH \+ \$CASHCAT fees/g,
    "pay base {blockchain.nativeSymbol} + ${blockchain.symbol} fees"
  );
  s = s.replace(
    /you take the ETH pot\./g,
    "you take the {blockchain.nativeSymbol} pot."
  );
  s = s.replace(
    /your ETH fee grows the prize/g,
    "your {blockchain.nativeSymbol} fee grows the prize"
  );
  s = s.replace(
    /<span style=\{\{color: 'gold'\}\}>ETH<\/span> entry fee/g,
    "<span style={{color: 'gold'}}>{blockchain.nativeSymbol}</span> entry fee"
  );
  s = s.replace(
    /<span style=\{\{color: 'gold'\}\}>\$CASHCAT<\/span> token fee/g,
    "<span style={{color: 'gold'}}>${blockchain.symbol}</span> token fee"
  );
  s = s.replace(
    /Miss and your ETH stays in the pot/g,
    "Miss and your {blockchain.nativeSymbol} stays in the pot"
  );

  s = s.replace(
    /native ETH entry fee \(pot\) \+ \$CASHCAT tokenFee/g,
    "native entry fee (pot) + token fee"
  );

  return s;
}

function transformMint(s) {
  s = s.replace(
    /Insufficient ETH fee for mint\./g,
    "Insufficient ${blockchain.nativeSymbol} fee for mint."
  );
  s = s.replace(
    /Not enough ETH for fee \+ gas\./g,
    "Not enough ${blockchain.nativeSymbol} for fee + gas."
  );
  s = s.replace(
    /Requires \$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH/g,
    "Requires ${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.nativeSymbol}"
  );
  s = s.replace(
    / Top up ETH and try again\./g,
    " Top up ${blockchain.nativeSymbol} and try again."
  );
  s = s.replace(
    /\+ \$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH\./g,
    "+ ${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.nativeSymbol}."
  );
  s = s.replace(
    /Submitting paid mint \(\$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH\)…/g,
    "Submitting paid mint (${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.nativeSymbol})…"
  );

  // JSX fee display lines that are bare "ETH" after the amount
  // Match:   {ethFee ...}\n      ETH
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\n\s*ETH \+)/,
    "$1{blockchain.nativeSymbol}$2"
  );
  // Two fee lines in mobile/desktop panels
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\n)/g,
    "$1{blockchain.nativeSymbol}$2"
  );
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\+\s*\{)/g,
    "$1{blockchain.nativeSymbol}$2"
  );

  s = s.replace(
    /paid \(ETH fee \+ optional \$CASHCAT tokenFee\)/g,
    "paid (native fee + optional token fee)"
  );

  return s;
}

function leftovers(name, text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if (!/\bETH\b|\$CASHCAT|\bCCC\b/.test(line)) return;
    // skip code identifiers / comments about ether formatting
    if (
      /ethFee|ethCost|ethWei|prizePot\.eth|feePreview\.eth|needEth|ethBal|formatEther|ethers\.|eth_chainId|parseEther|ethCostHolder|ethCostNonHolder|safeFormatEther|ethCostEth|tokenCostEth|\/\/|nativeSymbol|blockchain\.nativeSymbol/.test(
        line
      )
    )
      return;
    hits.push(`${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  console.log(`${name} leftovers: ${hits.length}`);
  hits.forEach((h) => console.log(" ", h));
}

const legPath = path.join(root, "src", "Legends.js");
const mintPath = path.join(root, "src", "Mint.js");
const leg = fs.readFileSync(legPath, "utf8");
const mint = fs.readFileSync(mintPath, "utf8");
const leg2 = transformLegends(leg);
const mint2 = transformMint(mint);
fs.writeFileSync(legPath, leg2);
fs.writeFileSync(mintPath, mint2);
console.log("Legends changed:", leg !== leg2);
console.log("Mint changed:", mint !== mint2);
leftovers("Legends", leg2);
leftovers("Mint", mint2);
