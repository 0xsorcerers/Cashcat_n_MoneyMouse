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
///         Two random numbers are drawn; if they match, the winner takes the native pot
///         (minus reseed + platform fee). NFT holders pay base fees; non-holders pay a multiple.
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
    event RandomNumberResult(uint256 indexed nonce, uint8 firstDraw, uint8 secondDraw);
    event Pause();
    event Unpause();

    address public cashcat;
    address public gameDAO;
    address public burnAddress;
    address public bobbAddress;
    address public stakeAddress;
    address private developmentAddress;
    address private lastAddress;

    uint256 public reseed = 10;
    uint256 public multiple = 2;
    uint256 public tokenMultiple = 2;
    /// @notice Native-coin (ETH) entry fee required for NFT holders (wei).
    uint256 public requiredFee = 0.001 ether;
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
    uint256 public burneth = 100;
    uint256 public ethdeadtax = 0;
    uint256 public ethbobbtax = 0;
    uint256 public ethstaketax = 0;
    uint256 public ethlasttax = 0;
    uint256 public ethdevtax = 0;

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
    string public Author = "undoxxed";
    bool public paused = false;

    /// @dev Nonce for added randomness entropy
    uint256 private nonce = 0;

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
        if (tokenId > 0) {
            ethCost = requiredFee;
            tokenCost = tokenFee;
            powerBonus = powerIndex[tokenId];
            qualifiesForDiscount = true;
            if (platformFee > powerBonus) {
                platformfee = platformFee - powerBonus;
            } else {
                platformfee = 0;
            }
        } else {
            ethCost = requiredFee * multiple;
            tokenCost = tokenFee * tokenMultiple;
            platformfee = platformFee + 5;
            powerBonus = 0;
            qualifiesForDiscount = false;
        }
    }

    /// @dev On-chain randomness. When `_factor > 0` (NFT path) range is 1..challengers;
    ///      when `_factor == 0` (non-holder) range is 1..(challengers * 2) — harder odds.
    function generateRandomNumber(bytes32 _userEntropy, uint256 _factor) internal returns (uint8) {
        nonce++;
        uint256 randomValue = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1),
                    msg.sender,
                    tx.origin,
                    nonce,
                    _userEntropy,
                    _factor
                )
            )
        );

        if (_factor > 0) {
            return uint8((randomValue % challengers) + 1);
        }
        return uint8((randomValue % (challengers * 2)) + 1);
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
     * @notice Play a round. Caller sends native coin (entry + pot contribution) and must
     *         have approved this contract for the token fee.
     * @param _nft Cashcat NFT id for the discounted fee path, or 0 if none.
     * @param userRandomNumber Off-chain entropy mixed into the RNG.
     */
    function sendToCashcat(
        uint256 _nft,
        bytes32 userRandomNumber
    ) public payable nonReentrant {
        require(!paused, "Paused Contract");
        // Prevents smart-contract wrappers from gaming the pot
        require(msg.sender == tx.origin, "Smart contracts not allowed");

        uint256 tokenId = getCashcat(_nft);
        uint256 ethCost;
        uint256 tokenCost;
        uint256 platformfee;

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

        require(msg.value >= ethCost, "Insufficient fee");

        // Pull token fee from the player (if configured)
        if (tokenCost > 0) {
            transferTokens(tokenCost);
            // Distribute token-fee taxes; remainder (if any) stays in the contract
            burnTokenFees(tokenCost, burntoll);
            TotalTokenFees += tokenCost;
        }

        // Distribute native-fee taxes from the required ethCost; remainder stays as pot
        burnEthFees(ethCost, burneth);
        TotalEthFees += ethCost;

        // Any excess native value above the required fee goes to development
        uint256 excess = msg.value - ethCost;
        if (excess > 0) {
            _safeTransferETH(developmentAddress, excess);
        }

        lastAddress = msg.sender;
        TotalPlays++;

        promoDistribution();

        // Dual RNG: first draw uses NFT factor (or 0); second uses the first draw as factor
        uint8 firstDraw = generateRandomNumber(userRandomNumber, tokenId);
        uint8 secondDraw = generateRandomNumber(userRandomNumber, firstDraw);

        emit RandomNumberResult(nonce, firstDraw, secondDraw);
        emit proofOfNumber(msg.sender, userRandomNumber, firstDraw);

        // Win when the two independently generated numbers match
        if (firstDraw == secondDraw) {
            _processWin(msg.sender, platformfee);
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
        uint256 _multiple,
        uint256 _tokenMultiple,
        uint256[] calldata _taxes
    ) external onlyGameDAO {
        require(_taxes.length >= 12, "Taxes array too short");
        require(_challengers > 0 && _challengers <= 255, "Invalid challengers");
        require(_reseed <= 100, "Invalid reseed");
        require(_platformFee <= 100, "Invalid platform fee");
        require(_multiple >= 1 && _tokenMultiple >= 1, "Invalid multiples");

        challengers = _challengers;
        payId = _payId;
        requiredFee = _requiredFee;
        tokenFee = _tokenFee;
        reseed = _reseed;
        platformFee = _platformFee;
        multiple = _multiple;
        tokenMultiple = _tokenMultiple;

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
