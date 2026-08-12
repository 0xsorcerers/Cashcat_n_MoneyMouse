// SPDX-License-Identifier: MIT
// @title Cashcat 'n' MoneyMouse game
// website: https://cashcats.my

pragma solidity 0.8.21;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICashcat {
    function balanceOf(address _sender) external view returns (uint256);
    function ownerOf(uint256 _index) external view returns (address);
    function blacklisted(uint256 _index) external view returns (bool);
}

interface IFarm {
    function balanceOf(address _sender) external view returns (uint256);
}

/// @notice Gaming contract: players pay a native-coin entry fee (pot) plus a token fee.
///         Play is a two-step commit/reveal so outcomes cannot be simulated in the same tx
///         as the entry (anti-bot) and smart-contract wallets are allowed.
///         Two random numbers are drawn per loop; if they match, the winner takes the native
///         pot (minus reseed + platform fee). NFT holders pay base fees; non-holders a multiple.
contract CashCat_n_MoneyMouse is ReentrancyGuard {
    using SafeERC20 for IERC20;

    constructor(address _gameDAO) {
        gameDAO = _gameDAO;
        lastAddress = _gameDAO;
    }

    event proofOfCashcat(
        uint256 indexed id,
        address indexed from,
        uint256 indexed amountWon,
        uint256 seeded
    );
    event proofOfNumber(address indexed from, bytes32 userRandomNumber, uint256 result);
    /// @notice Batch dual-RNG results for a settled play (one pair per loop).
    event RandomNumberResult(
        uint256 indexed nonce,
        uint64[] firstDraws,
        uint64[] secondDraws
    );
    /// @notice Player paid fees and locked a commit block; must settle in a later block.
    event PlayCommitted(
        address indexed player,
        uint256 indexed commitBlock,
        uint256 nft,
        uint32 plays
    );
    /// @notice Pending play settled with full draw arrays.
    event PlaySettled(
        address indexed player,
        uint64[] firstDraws,
        uint64[] secondDraws
    );
    /// @notice Commit aged past the 256-block blockhash window; fees stay in the pot.
    event PlayExpired(address indexed player, uint256 commitBlock, uint32 plays);
    event Pause();
    event Unpause();

    address public cashcat;
    address private gameDAO;
    address public burnAddress;
    address public bobbAddress;
    address public stakeAddress;
    address private developmentAddress;
    address private lastAddress;

    uint256 public reseed = 10;
    uint256 public multiple = 2;
    uint256 public tokenMultiple = 2;
    /// @notice Native-coin (ETH) entry fee required for NFT holders (wei).
    uint256 public requiredFee = 0 ether;
    /// @notice token entry fee required for NFT holders (token units).
    uint256 public tokenFee = 0;
    uint256 public age = 120;
    uint256 private challengers = 18;
    uint256 public payId = 0;

    // Token-fee tax rates (percent of the taxed portion)
    uint256 public burntoll = 100;
    uint256 public deadtax = 0;
    uint256 public bobbtax = 0;
    uint256 public staketax = 0;
    uint256 public lasttax = 0;
    uint256 public devtax = 0;

    // Native-coin (ETH) fee tax rates — parallel structure to token taxes
    uint256 public burneth = 20;
    uint256 public ethdeadtax = 0;
    uint256 public ethbobbtax = 0;
    uint256 public ethstaketax = 0;
    uint256 public ethlasttax = 10;
    uint256 public ethdevtax = 10;

    uint256 public platformFee = 20;
    uint256 public TotalBurns = 0;
    uint256 public TotalStaked = 0;
    uint256 public TotalPaid = 0;
    uint256 public TotalReserved = 0;
    uint256 public TotalPromos = 0;
    uint256 public TotalPlays = 0;
    uint256 public TotalEthFees = 0;
    uint256 public TotalTokenFees = 0;
    uint256 public era = 1;
    uint256 public TotalAmountWon = 0;
    string public Author = "0xsorcerers";
    bool public paused = false;

    /// @dev Nonce for added randomness entropy
    uint256 private nonce = 0;

    /// @notice on-chain cap for plays per tx (griefing / gas bound).
    ///         Frontend may expose a lower UX cap (e.g. x50).
    uint256 public MAX_BATCH_PLAYS = 100;

    modifier onlyGameDAO() {
        require(msg.sender == gameDAO, "Not authorized.");
        _;
    }

    struct TokenInfo {
        IERC20 paytoken;
    }

    struct WinnersList {
        address winner;
        uint256 era;
        uint256 amount;
        uint256 timestamp;
    }

    // Arrays
    TokenInfo[] public AllowedCrypto;
    address[] public AllowedCurrencies;
    address[] public AllowedFarms;
    uint256[] public AllowedAmounts;
    uint256[] public permittedFarms;

    // Maps
    mapping(uint256 => WinnersList) public pastwinners;
    mapping(address => uint256) public TokensDistributed;
    mapping(uint256 => uint256) public powerIndex;

    /// @dev One pending commit/reveal play per wallet (must settle or expire before next commit).
    struct PendingPlay {
        uint256 commitBlock;
        uint256 tokenId;
        uint32 plays;
        uint256 ethCostPerPlay;
        uint256 platformfee;
    }

    mapping(address => PendingPlay) public pendingPlays;

    function addCurrency(address _paytoken) external onlyGameDAO {
        IERC20 payToken = IERC20(_paytoken);
        AllowedCrypto.push(TokenInfo({paytoken: payToken}));
        AllowedCurrencies.push(_paytoken);
    }

    /// @dev Returns `_tokenId` if `player` owns a non-blacklisted Cashcat NFT, else 0.
    ///      Must not revert when the token does not exist so non-holders can still play.
    function _resolveCashcat(address player, uint256 _tokenId) internal view returns (uint256) {
        if (_tokenId == 0 || cashcat == address(0) || player == address(0)) {
            return 0;
        }

        try ICashcat(cashcat).blacklisted(_tokenId) returns (bool isBlacklisted) {
            if (isBlacklisted) {
                return 0;
            }
        } catch {
            return 0;
        }

        try ICashcat(cashcat).ownerOf(_tokenId) returns (address nftOwner) {
            if (nftOwner == player) {
                return _tokenId;
            }
            return 0;
        } catch {
            return 0;
        }
    }

    /// @dev Convenience wrapper for the play path (`msg.sender`).
    function getCashcat(uint256 _tokenId) internal view returns (uint256) {
        return _resolveCashcat(msg.sender, _tokenId);
    }

    /**
     * @notice Single-call helper: all frequently read game state + fee quotes.
     * @dev Use this from the UI instead of chaining individual public getters
     *      (pot, era, requiredFee, tokenFee, multiple, platformFee, pastwinners, …).
     *
     * @param player Optional wallet to price the play for. Pass address(0) for
     *               global data only (player quote fields will be non-holder rates).
     * @param _nft   Optional Cashcat token id for the discount path when `player`
     *               owns it. Pass 0 if unknown / no NFT.
     *
     * Returns (in order):
     *  - pot, currentEra
     *  - requiredFee_, tokenFee_, multiple_, tokenMultiple_, platformFee_, reseed_, challengers_
     *  - isPaused, totalPlays_, totalAmountWon_
     *  - ethCostHolder / ethCostNonHolder / tokenCostHolder / tokenCostNonHolder (tier table)
     *  - lastWinner, lastWinEra, lastWinAmount, lastWinTimestamp
     *  - ethCost, tokenCost, platformfee, powerBonus, qualifiesForDiscount (this player)
     */
    function getGameData(address player, uint256 _nft)
        external
        view
        returns (
            uint256 pot,
            uint256 currentEra,
            uint256 requiredFee_,
            uint256 tokenFee_,
            uint256 multiple_,
            uint256 tokenMultiple_,
            uint256 platformFee_,
            uint256 reseed_,
            uint256 challengers_,
            bool isPaused,
            uint256 totalPlays_,
            uint256 totalAmountWon_,
            uint256 ethCostHolder,
            uint256 ethCostNonHolder,
            uint256 tokenCostHolder,
            uint256 tokenCostNonHolder,
            address lastWinner,
            uint256 lastWinEra,
            uint256 lastWinAmount,
            uint256 lastWinTimestamp,
            uint256 ethCost,
            uint256 tokenCost,
            uint256 platformfee,
            uint256 powerBonus,
            bool qualifiesForDiscount
        )
    {
        // —— global snapshot ——
        pot = address(this).balance;
        currentEra = era;
        requiredFee_ = requiredFee;
        tokenFee_ = tokenFee;
        multiple_ = multiple;
        tokenMultiple_ = tokenMultiple;
        platformFee_ = platformFee;
        reseed_ = reseed;
        challengers_ = challengers;
        isPaused = paused;
        totalPlays_ = TotalPlays;
        totalAmountWon_ = TotalAmountWon;

        // —— published fee tiers (for UI preview without a player) ——
        ethCostHolder = requiredFee;
        ethCostNonHolder = requiredFee * multiple;
        tokenCostHolder = tokenFee;
        tokenCostNonHolder = tokenFee * tokenMultiple;

        // —— previous season winner (if any) ——
        if (era > 1) {
            WinnersList memory w = pastwinners[era - 1];
            lastWinner = w.winner;
            lastWinEra = w.era;
            lastWinAmount = w.amount;
            lastWinTimestamp = w.timestamp;
        }

        // —— this-player quote (holder discount when NFT qualifies) ——
        uint256 tokenId = _resolveCashcat(player, _nft);
        (ethCost, tokenCost, platformfee) = _calculateFees(tokenId);
        if (tokenId > 0) {
            powerBonus = powerIndex[tokenId];
            qualifiesForDiscount = true;
        } else {
            powerBonus = 0;
            qualifiesForDiscount = false;
        }
    }

    /// @dev Fee quote for a resolved token id (0 = non-holder path).
    function _calculateFees(uint256 tokenId)
        internal
        view
        returns (uint256 ethCost, uint256 tokenCost, uint256 platformfee)
    {
        if (tokenId > 0) {
            ethCost = requiredFee;
            tokenCost = tokenFee;
            // NFT holders can reduce platform fee via powerIndex
            if (platformFee > powerIndex[tokenId]) {
                platformfee = platformFee - powerIndex[tokenId];
            } else {
                platformfee = 0;
            }
        } else {
            ethCost = requiredFee * multiple;
            tokenCost = tokenFee * tokenMultiple;
            platformfee = platformFee + 5;
        }
    }

    /// @dev Seed-derived randomness (commit-reveal safe: no settle-block variables).
    ///      When `_factor > 0` (NFT path) range is 1..challengers;
    ///      when `_factor == 0` (non-holder) range is 1..(challengers * 2) — harder odds.
    ///      Returns uint64 so challengers can grow beyond the old uint8 (255) ceiling.
    function generateRandomNumber(bytes32 _userEntropy, uint256 _factor) internal returns (uint64) {
        nonce++;
        uint256 randomValue = uint256(
            keccak256(abi.encodePacked(_userEntropy, _factor, nonce, address(this)))
        );

        if (_factor > 0) {
            return uint64((randomValue % challengers) + 1);
        }
        return uint64((randomValue % (challengers * 2)) + 1);
    }

    /// @dev Low-level native transfer
    function _safeTransferETH(address _to, uint256 _value) internal {
        if (_value == 0) return;
        require(_to != address(0), "Zero address");
        (bool success, ) = payable(_to).call{value: _value}("");
        require(success, "Funds transfer failed.");
    }

    receive() external payable {}

    /**
     * @notice Step 1 — Commit: pay combined entry fees and lock the current block number.
     *         Outcome is not known yet; settle in a later block using that block's hash.
     * @param _nft Cashcat NFT id for the discounted fee path, or 0 if none.
     * @param plays How many dual-RNG loops to run on settle (1 .. MAX_BATCH_PLAYS).
     * @dev Smart-contract wallets are allowed (no tx.origin gate). One pending play per sender.
     */
    function commitPlay(uint256 _nft, uint32 plays) external payable nonReentrant {
        require(!paused, "Paused Contract");
        require(pendingPlays[msg.sender].commitBlock == 0, "Finish pending play first");
        require(plays > 0 && uint256(plays) <= MAX_BATCH_PLAYS, "Invalid play count");

        uint256 tokenId = getCashcat(_nft);
        (uint256 ethCost, uint256 tokenCost, uint256 platformfee) = _calculateFees(tokenId);

        uint256 playCount = uint256(plays);
        uint256 totalEthCost = ethCost * playCount;
        uint256 totalTokenCost = tokenCost * playCount;
        require(msg.value >= totalEthCost, "Insufficient fee");

        // Pull and tax token fees at commit (native tax applied per-loop on settle)
        if (totalTokenCost > 0) {
            transferTokens(totalTokenCost);
            burnTokenFees(totalTokenCost, burntoll);
            TotalTokenFees += totalTokenCost;
        }

        // Excess native value above the combined fee goes to development
        uint256 excess = msg.value - totalEthCost;
        if (excess > 0) {
            _safeTransferETH(developmentAddress, excess);
        }

        pendingPlays[msg.sender] = PendingPlay({
            commitBlock: block.number,
            tokenId: tokenId,
            plays: plays,
            ethCostPerPlay: ethCost,
            platformfee: platformfee
        });

        emit PlayCommitted(msg.sender, block.number, tokenId, plays);
    }

    /**
     * @notice Step 2 — Reveal/settle: draw from the commit blockhash and pay winners.
     *         Must be called in a later block than commit. After 256 blocks the EVM no longer
     *         serves that blockhash — the commit expires and fees remain in the pot.
     */
    function settlePlay() external nonReentrant {
        PendingPlay memory play = pendingPlays[msg.sender];
        require(play.commitBlock > 0, "No pending play");
        require(block.number > play.commitBlock, "Cannot settle in same block");

        // EVM only retains the last 256 blockhashes
        if (block.number > play.commitBlock + 256) {
            uint32 expiredPlays = play.plays;
            uint256 expiredBlock = play.commitBlock;
            delete pendingPlays[msg.sender];
            emit PlayExpired(msg.sender, expiredBlock, expiredPlays);
            return;
        }

        bytes32 seedHash = blockhash(play.commitBlock);
        // blockhash should be non-zero inside the 256-window; if not, treat as expired
        if (seedHash == bytes32(0)) {
            uint32 expiredPlays = play.plays;
            uint256 expiredBlock = play.commitBlock;
            delete pendingPlays[msg.sender];
            emit PlayExpired(msg.sender, expiredBlock, expiredPlays);
            return;
        }

        // Clear storage before payouts (CEI / anti-reentrancy)
        delete pendingPlays[msg.sender];

        lastAddress = msg.sender;

        uint256 playCount = uint256(play.plays);
        uint64[] memory firstDraws = new uint64[](playCount);
        uint64[] memory secondDraws = new uint64[](playCount);

        for (uint256 i = 0; i < playCount; ) {
            burnEthFees(play.ethCostPerPlay, burneth);
            TotalEthFees += play.ethCostPerPlay;
            TotalPlays++;

            promoDistribution();

            // Entropy fixed from commit blockhash — independent of settle-block timing
            bytes32 userEntropy = keccak256(
                abi.encodePacked(seedHash, msg.sender, play.plays, i, nonce)
            );

            // Dual RNG: first draw uses NFT factor (or 0); second uses the first draw as factor
            uint64 firstDraw = generateRandomNumber(userEntropy, play.tokenId);
            uint64 secondDraw = generateRandomNumber(userEntropy, firstDraw);

            firstDraws[i] = firstDraw;
            secondDraws[i] = secondDraw;

            emit proofOfNumber(msg.sender, userEntropy, firstDraw);

            if (firstDraw == secondDraw) {
                _processWin(msg.sender, play.platformfee);
            }

            unchecked {
                ++i;
            }
        }

        emit RandomNumberResult(nonce, firstDraws, secondDraws);
        emit PlaySettled(msg.sender, firstDraws, secondDraws);
    }

    /**
     * @notice View helper for UI: pending commit status for a player.
     * @return commitBlock Block locked at commit (0 if none).
     * @return tokenId Resolved Cashcat id used for odds/fees (0 if non-holder path).
     * @return plays Number of loops to settle.
     * @return ethCostPerPlay Native fee per loop (wei).
     * @return platformfee Platform fee % stored at commit.
     * @return canSettle True if a later block and still within the 256-blockhash window.
     * @return expired True if past the 256-block window (call settlePlay to clear).
     */
    function getPendingPlay(address player)
        external
        view
        returns (
            uint256 commitBlock,
            uint256 tokenId,
            uint32 plays,
            uint256 ethCostPerPlay,
            uint256 platformfee,
            bool canSettle,
            bool expired
        )
    {
        PendingPlay memory play = pendingPlays[player];
        commitBlock = play.commitBlock;
        tokenId = play.tokenId;
        plays = play.plays;
        ethCostPerPlay = play.ethCostPerPlay;
        platformfee = play.platformfee;

        if (commitBlock == 0) {
            return (0, 0, 0, 0, 0, false, false);
        }

        if (block.number <= commitBlock) {
            // Same block as commit (or clock skew) — not settleable yet
            canSettle = false;
            expired = false;
        } else if (block.number > commitBlock + 256) {
            canSettle = false;
            expired = true;
        } else {
            canSettle = true;
            expired = false;
        }
    }

    /// @dev Pay the native pot to the winner after reseed + platform fee.
    function _processWin(address winner, uint256 platformfee) internal {
        uint256 balance = address(this).balance;

        if (balance > 0) {
            uint256 seed = (balance * reseed) / 100;
            uint256 amountWon = balance - seed;
            uint256 winfee = (amountWon * platformfee) / 100;
            uint256 amountPayable = amountWon - winfee;

            _safeTransferETH(winner, amountPayable);
            _safeTransferETH(developmentAddress, winfee);

            uint256 currentEra = era;
            pastwinners[currentEra].era = currentEra;
            pastwinners[currentEra].winner = winner;
            pastwinners[currentEra].amount = amountWon;
            pastwinners[currentEra].timestamp = block.timestamp;

            TotalAmountWon += amountWon;
            era++;

            emit proofOfCashcat(currentEra, winner, amountWon, seed);
        }
    }

    function AddToFarmReorg(
        uint256 _farmInWei,
        address _token,
        uint256[] calldata _permittedFarms
    ) external onlyGameDAO {
        uint256 farming = _farmInWei;
        IERC20 farmtoken = IERC20(_token);
        farmtoken.safeTransferFrom(msg.sender, address(this), farming);
        permittedFarms = _permittedFarms;
    }

    function promoDistribution() internal {
        if (AllowedFarms.length > 0) {
            for (uint256 f = 0; f < permittedFarms.length; f++) {
                uint256 indexFarm = permittedFarms[f];
                address currentFarm = AllowedFarms[indexFarm];
                IERC20 farmtoken = IERC20(currentFarm);
                uint256 farmbal = IFarm(currentFarm).balanceOf(address(this));
                uint256 farm = AllowedAmounts[indexFarm];
                if (farmbal > farm && farm > 0) {
                    farmtoken.safeTransfer(lastAddress, farm);
                    TokensDistributed[currentFarm] += farm;
                    TotalPromos += farm;
                }
            }
        }
    }

    /// @dev Tax + distribute a portion of the token fee across configured recipients.
    function burnTokenFees(uint256 _burnAmount, uint256 _num) internal {
        uint256 taxed = (_burnAmount * _num) / 100;

        uint256 dead = (taxed * deadtax) / 100;
        uint256 bobb = (taxed * bobbtax) / 100;
        uint256 stake = (taxed * staketax) / 100;
        uint256 last = (taxed * lasttax) / 100;
        uint256 dev = (taxed * devtax) / 100;

        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken = tokens.paytoken;

        if (dead > 0) paytoken.safeTransfer(burnAddress, dead);
        if (bobb > 0) paytoken.safeTransfer(bobbAddress, bobb);
        if (stake > 0) paytoken.safeTransfer(stakeAddress, stake);
        if (last > 0) paytoken.safeTransfer(lastAddress, last);
        if (dev > 0) paytoken.safeTransfer(developmentAddress, dev);

        TotalReserved += bobb;
        TotalStaked += stake;
        TotalPaid += last;
        TotalBurns += dead;
    }

    /// @dev Tax + distribute a portion of the native entry fee across configured recipients.
    ///      Remaining ethCost (after taxes) stays in the contract and funds the pot.
    function burnEthFees(uint256 _feeAmount, uint256 _num) internal {
        uint256 taxed = (_feeAmount * _num) / 100;

        uint256 dead = (taxed * ethdeadtax) / 100;
        uint256 bobb = (taxed * ethbobbtax) / 100;
        uint256 stake = (taxed * ethstaketax) / 100;
        uint256 last = (taxed * ethlasttax) / 100;
        uint256 dev = (taxed * ethdevtax) / 100;

        _safeTransferETH(burnAddress, dead);
        _safeTransferETH(bobbAddress, bobb);
        _safeTransferETH(stakeAddress, stake);
        _safeTransferETH(lastAddress, last);
        _safeTransferETH(developmentAddress, dev);

        TotalReserved += bobb;
        TotalStaked += stake;
        TotalPaid += last;
        TotalBurns += dead;
    }

    function transferTokens(uint256 _cost) internal {
        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken = tokens.paytoken;
        paytoken.safeTransferFrom(msg.sender, address(this), _cost);
    }

    /**
     * @notice Configure game parameters and dual tax schedules.
     * @param _challengers Upper bound for RNG range.
     * @param _payId Index into AllowedCrypto for the token fee.
     * @param _requiredFee Native entry fee in wei.
     * @param _tokenFee token fee in token units.
     * @param _reseed Percent of pot retained for the next era.
     * @param _platformFee Percent of win amount taken as platform fee.
     * @param _multiple Multiplier applied to both fees for non-NFT players.
     * @param _tokenMultiple Token Multiplier applied to both token fees for non-NFT players.
     * @param _taxes Length >= 12:
     *        [0] burntoll, [1] deadtax, [2] bobbtax, [3] staketax, [4] lasttax, [5] devtax,
     *        [6] burneth, [7] ethdeadtax, [8] ethbobbtax, [9] ethstaketax,
     *        [10] ethlasttax, [11] ethdevtax
     */
    function setValues(
        uint256 _challengers,
        uint256 _payId,
        uint256 _requiredFee,
        uint256 _tokenFee,
        uint256 _reseed,
        uint256 _platformFee,
        uint256 _maxBatchPlays,
        uint256 _multiple,
        uint256 _tokenMultiple,
        uint256[] calldata _taxes
    ) external onlyGameDAO {
        require(_taxes.length >= 12, "Taxes array too short");
        // uint64 draw width allows large challenger pools (old uint8 capped at 255)
        require(_challengers > 0 && _challengers <= type(uint64).max, "Invalid challengers");
        require(_reseed <= 100 && _platformFee <= 100 && _multiple >= 1 && _tokenMultiple >= 1 && _maxBatchPlays > 0 , "Invalid entries");

        challengers = _challengers;
        payId = _payId;
        requiredFee = _requiredFee;
        tokenFee = _tokenFee;
        reseed = _reseed;
        platformFee = _platformFee;
        multiple = _multiple;
        tokenMultiple = _tokenMultiple;
        MAX_BATCH_PLAYS = _maxBatchPlays;

        // Token-fee taxes
        burntoll = _taxes[0];
        deadtax = _taxes[1];
        bobbtax = _taxes[2];
        staketax = _taxes[3];
        lasttax = _taxes[4];
        devtax = _taxes[5];

        // Native-coin (ETH) fee taxes
        burneth = _taxes[6];
        ethdeadtax = _taxes[7];
        ethbobbtax = _taxes[8];
        ethstaketax = _taxes[9];
        ethlasttax = _taxes[10];
        ethdevtax = _taxes[11];
    }

    function setAddresses(
        address _burnAddress,
        address _bobbAddress,
        address _stakeAddress,
        address _devAddress,
        address _cashcat
    ) external onlyGameDAO {
        burnAddress = _burnAddress;
        bobbAddress = _bobbAddress;
        developmentAddress = _devAddress;
        stakeAddress = _stakeAddress;
        cashcat = _cashcat;
    }

    function setFarmYield(
        address[] memory _allowedFarms,
        uint256[] memory _farmingAmounts,
        uint256[] memory _permittedFarms
    ) external onlyGameDAO {
        permittedFarms = _permittedFarms;
        AllowedAmounts = _farmingAmounts;
        AllowedFarms = _allowedFarms;
    }

    function addToPowerIndex(uint256 _start, uint256[] calldata _indices) external onlyGameDAO {
        for (uint256 i = 0; i < _indices.length; i++) {
            powerIndex[_start + i] = _indices[i];
        }
    }

    function setAuthor(string memory _reveal) external onlyGameDAO {
        Author = _reveal;
    }

    /// @notice Withdraw native coin from the contract (DAO only).
    function withdraw(uint256 _amount) external onlyGameDAO nonReentrant {
        require(_amount <= address(this).balance, "Insufficient balance");
        _safeTransferETH(gameDAO, _amount);
    }

    /// @notice Withdraw ERC20 tokens from the contract (DAO only).
    function withdrawERC20(
        address _token,
        uint256 _amount
    ) external onlyGameDAO nonReentrant {
        IERC20 paytoken = IERC20(_token);
        paytoken.safeTransfer(msg.sender, _amount);
    }

    function pause() public onlyGameDAO {
        require(!paused, "Already paused.");
        paused = true;
        emit Pause();
    }

    function unpause() public onlyGameDAO {
        require(paused, "Not paused.");
        paused = false;
        emit Unpause();
    }

    function setDAO(address _gameDAO) external onlyGameDAO {
        require(_gameDAO != address(0), "Zero address");
        gameDAO = _gameDAO;
    }

    /// @notice Current native pot available for the next winner.
    function potBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
