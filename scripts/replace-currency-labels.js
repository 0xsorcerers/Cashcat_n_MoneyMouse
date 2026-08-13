/**
 * Replace user-facing ETH / $CASHCAT / CCC labels with blockchain.symbol / blockchain.tokenSymbol.
 * Does NOT rename ethFee / ethCost / prizePot.eth identifiers.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function transformLegends(s) {
  // Errors / fees (template literals inside source)
  s = s.replace(
    /You need ETH to pay the entry fee/g,
    "You need ${blockchain.symbol} to pay the entry fee"
  );
  s = s.replace(
    /Requires \$\{formatNumber\(ethCostEth\)\} ETH entry fee/g,
    "Requires ${formatNumber(ethCostEth)} ${blockchain.symbol} entry fee"
  );
  s = s.replace(
    /Not enough ETH sent for the entry fee\./g,
    "Not enough ${blockchain.symbol} sent for the entry fee."
  );
  s = s.replace(
    /Not enough ETH in your wallet for gas \+ entry fee\./g,
    "Not enough ${blockchain.symbol} in your wallet for gas + entry fee."
  );
  s = s.replace(
    /Requires \$\{formatNumber\(tokenCostEth\)\} \$CASHCAT token fee/g,
    "Requires ${formatNumber(tokenCostEth)} $${blockchain.tokenSymbol} token fee"
  );
  s = s.replace(
    /Not enough \$CASHCAT \(or allowance\) for the token fee\./g,
    "Not enough $${blockchain.tokenSymbol} (or allowance) for the token fee."
  );
  s = s.replace(
    /Initiating \$CASHCAT approval\.\.\./g,
    "Initiating $${blockchain.tokenSymbol} approval..."
  );
  s = s.replace(
    /Requesting \$CASHCAT Approval\.\.\./g,
    "Requesting $${blockchain.tokenSymbol} Approval..."
  );

  // JSX amounts
  s = s.replace(
    /\{safeNum\(seasonPot\)\} ETH/g,
    "{safeNum(seasonPot)} {blockchain.symbol}"
  );
  s = s.replace(
    /\{safeNum\(lastWinner\.pot\)\} ETH/g,
    "{safeNum(lastWinner.pot)} {blockchain.symbol}"
  );
  s = s.replace(
    /\{safeNum\(winAmount\)\} ETH/g,
    "{safeNum(winAmount)} {blockchain.symbol}"
  );
  s = s.replace(
    /\{safeNum\(row\.amount\)\} ETH/g,
    "{safeNum(row.amount)} {blockchain.symbol}"
  );
  s = s.replace(
    /\{safeNum\(prizePot\.eth\)\} ETH/g,
    "{safeNum(prizePot.eth)} {blockchain.symbol}"
  );

  // Fee preview template strings
  s = s.replace(
    /Requires \$\{safeNum\(feePreview\.eth\)\} ETH \+ \$\{safeNum\(feePreview\.ccc\)\} CCC/g,
    "Requires ${safeNum(feePreview.eth)} ${blockchain.symbol} + ${safeNum(feePreview.ccc)} ${blockchain.tokenSymbol}"
  );
  s = s.replace(
    /Requires \$\{safeNum\(feePreview\.eth\)\} ETH(\$\{feePreview\.hasNft)/g,
    "Requires ${safeNum(feePreview.eth)} ${blockchain.symbol}$1"
  );
  s = s.replace(
    /Requires \{safeNum\(feePreview\.eth\)\} ETH/g,
    "Requires {safeNum(feePreview.eth)} {blockchain.symbol}"
  );
  s = s.replace(
    /\{feePreview\.ccc > 0 \? ` \+ \$\{safeNum\(feePreview\.ccc\)\} CCC` : ''\}/g,
    "{feePreview.ccc > 0 ? ` + ${safeNum(feePreview.ccc)} ${blockchain.tokenSymbol}` : ''}"
  );

  // Stat labels
  s = s.replace(
    /<span className="stat-label">ETH<\/span>/g,
    "<span className=\"stat-label\">{blockchain.symbol}</span>"
  );
  s = s.replace(
    /<span className="stat-label">CCC<\/span>/g,
    "<span className=\"stat-label\">{blockchain.tokenSymbol}</span>"
  );

  // Literary tips
  s = s.replace(
    /you win the season ETH pot\./g,
    "you win the season {blockchain.symbol} pot."
  );
  s = s.replace(
    /Every play feeds the ETH pot\./g,
    "Every play feeds the {blockchain.symbol} pot."
  );
  s = s.replace(
    /pay base ETH \+ \$CASHCAT fees/g,
    "pay base {blockchain.symbol} + ${blockchain.tokenSymbol} fees"
  );
  s = s.replace(
    /you take the ETH pot\./g,
    "you take the {blockchain.symbol} pot."
  );
  s = s.replace(
    /your ETH fee grows the prize/g,
    "your {blockchain.symbol} fee grows the prize"
  );
  s = s.replace(
    /<span style=\{\{color: 'gold'\}\}>ETH<\/span> entry fee/g,
    "<span style={{color: 'gold'}}>{blockchain.symbol}</span> entry fee"
  );
  s = s.replace(
    /<span style=\{\{color: 'gold'\}\}>\$CASHCAT<\/span> token fee/g,
    "<span style={{color: 'gold'}}>${blockchain.tokenSymbol}</span> token fee"
  );
  s = s.replace(
    /Miss and your ETH stays in the pot/g,
    "Miss and your {blockchain.symbol} stays in the pot"
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
    "Insufficient ${blockchain.symbol} fee for mint."
  );
  s = s.replace(
    /Not enough ETH for fee \+ gas\./g,
    "Not enough ${blockchain.symbol} for fee + gas."
  );
  s = s.replace(
    /Requires \$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH/g,
    "Requires ${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.symbol}"
  );
  s = s.replace(
    / Top up ETH and try again\./g,
    " Top up ${blockchain.symbol} and try again."
  );
  s = s.replace(
    /\+ \$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH\./g,
    "+ ${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.symbol}."
  );
  s = s.replace(
    /Submitting paid mint \(\$\{formatNumber\(Number\(safeFormatEther\(needEth\)\)\)\} ETH\)…/g,
    "Submitting paid mint (${formatNumber(Number(safeFormatEther(needEth)))} ${blockchain.symbol})…"
  );

  // JSX fee display lines that are bare "ETH" after the amount
  // Match:   {ethFee ...}\n      ETH
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\n\s*ETH \+)/,
    "$1{blockchain.symbol}$2"
  );
  // Two fee lines in mobile/desktop panels
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\n)/g,
    "$1{blockchain.symbol}$2"
  );
  s = s.replace(
    /(\{ethFee != null \? formatNumber\(ethFee\) : '—'\}\s*\n\s*)ETH(\s*\+\s*\{)/g,
    "$1{blockchain.symbol}$2"
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
      /ethFee|ethCost|ethWei|prizePot\.eth|feePreview\.eth|needEth|ethBal|formatEther|ethers\.|eth_chainId|parseEther|ethCostHolder|ethCostNonHolder|safeFormatEther|ethCostEth|tokenCostEth|\/\/|tokenSymbol|blockchain\.symbol/.test(
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
