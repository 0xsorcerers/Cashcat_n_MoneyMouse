const fs = require("fs");
for (const f of ["src/Legends.js", "src/Mint.js"]) {
  const s = fs.readFileSync(f, "utf8");
  const bad = [];
  s.split("\n").forEach((line, i) => {
    if (!line.includes("${blockchain")) return;
    if (line.includes("`")) return; // template ok
    // JSX uses {blockchain...} without $
    if (line.includes("{blockchain.symbol}") || line.includes("{blockchain.tokenSymbol}")) {
      // ok if not inside quotes with ${
    }
    // double/single quoted with ${ is broken
    if ((line.includes("'") || line.includes('"')) && line.includes("${blockchain") && !line.includes("`")) {
      bad.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
  const ethUi = [];
  s.split("\n").forEach((line, i) => {
    if (/\bETH\b/.test(line) && !/ethFee|ethCost|ethWei|formatEther|ethers|//|tokenSymbol|parseEther|ethBal|needEth|prizePot\.eth|feePreview\.eth|ethCostEth/.test(line)) {
      ethUi.push(`${i + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  console.log(f, "quoted-broken:", bad.length, "eth-ui:", ethUi.length);
  bad.forEach((x) => console.log("  broken", x));
  ethUi.forEach((x) => console.log("  eth", x));
}
