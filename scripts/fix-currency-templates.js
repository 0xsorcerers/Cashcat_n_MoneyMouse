const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

// ---- Legends ----
{
  const p = path.join(root, "src", "Legends.js");
  let s = fs.readFileSync(p, "utf8");

  const pairs = [
    [
      'setErrorMessage("You need ${blockchain.symbol} to pay the entry fee");',
      "setErrorMessage(`You need ${blockchain.symbol} to pay the entry fee`);",
    ],
    [
      'console.log("Initiating ${blockchain.tokenSymbol} approval...");',
      "console.log(`Initiating $${blockchain.tokenSymbol} approval...`);",
    ],
    [
      'setErrorMessage("Requesting ${blockchain.tokenSymbol} Approval...");',
      "setErrorMessage(`Requesting $${blockchain.tokenSymbol} Approval...`);",
    ],
    [
      'return "Not enough ${blockchain.symbol} sent for the entry fee.";',
      "return `Not enough ${blockchain.symbol} sent for the entry fee.`;",
    ],
    [
      'return "Not enough ${blockchain.tokenSymbol} (or allowance) for the token fee.";',
      "return `Not enough $${blockchain.tokenSymbol} (or allowance) for the token fee.`;",
    ],
    [
      'return "Not enough ${blockchain.symbol} in your wallet for gas + entry fee.";',
      "return `Not enough ${blockchain.symbol} in your wallet for gas + entry fee.`;",
    ],
  ];

  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log("Legends MISS:", from.slice(0, 70));
    } else {
      s = s.split(from).join(to);
      console.log("Legends OK:", from.slice(0, 50));
    }
  }

  // token fee line should show $SYMBOL
  s = s.replace(
    "Requires ${formatNumber(tokenCostEth)} ${blockchain.tokenSymbol} token fee",
    "Requires ${formatNumber(tokenCostEth)} $${blockchain.tokenSymbol} token fee"
  );

  fs.writeFileSync(p, s);
}

// ---- Mint ----
{
  const p = path.join(root, "src", "Mint.js");
  let s = fs.readFileSync(p, "utf8");

  const pairs = [
    [
      "return 'Insufficient ${blockchain.symbol} fee for mint.';",
      "return `Insufficient ${blockchain.symbol} fee for mint.`;",
    ],
    [
      "return 'Not enough ${blockchain.symbol} for fee + gas.';",
      "return `Not enough ${blockchain.symbol} for fee + gas.`;",
    ],
  ];

  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.log("Mint MISS:", from.slice(0, 70));
    } else {
      s = s.split(from).join(to);
      console.log("Mint OK:", from.slice(0, 50));
    }
  }

  // Flag remaining double/single quoted strings that still contain ${blockchain
  s.split("\n").forEach((line, i) => {
    if (!line.includes("${blockchain")) return;
    const t = line.trim();
    if (t.startsWith("//")) return;
    const hasBacktick = line.includes("`");
    if (!hasBacktick && (line.includes("'") || line.includes('"'))) {
      console.log("Maybe broken", i + 1, t.slice(0, 120));
    }
  });

  fs.writeFileSync(p, s);
}

console.log("fix complete");
