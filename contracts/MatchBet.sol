// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol";

interface IMatchBetCards {
    function balanceOf(address _sender) external view returns (uint256);
    function ownerOf(uint256 _index) external view returns (address);
    function blacklisted(uint256 _index) external view returns (bool);
}

interface IFarm {
    function balanceOf(address _sender) external view returns (uint256);
}

contract MatchBet is ReentrancyGuard {
    constructor(address _matchBetDAO, address _matchBetCards, address _betByIncentive, uint256 _feeInWei) {
        matchBetDAO = _matchBetDAO;
        matchBetCards = _matchBetCards;
        betByIncentive = _betByIncentive;
        fee = _feeInWei;
    }
    
    event proofOfLegend(uint256 indexed id, address indexed from, uint256 indexed amountWon, uint256 seeded);
    event proofOfNumber(address indexed from, bytes32 number, uint256 proof);
    event RandomNumberResult(uint256 sequenceNumber, uint8 result);

    address public matchBetCards;
    address public betByIncentive;
    address public matchBetDAO; 
    address public burnAddress; 
    address public bobbAddress;
    address public stakeAddress;
    address private developmentAddress;
    address private lastAddress;
    uint256 public fee;
    uint256 public reseed = 10;
    uint256 public multiple = 2;
    uint256 public betMultiple = 1000000;
    // uint256 public age = 120;
    uint256 private challengers = 18;
    uint256 public payId = 0;
    uint256 public pid = 0;
    uint256 public burntoll = 100;
    uint256 public deadtax = 0;
    uint256 public bobbtax = 0;
    uint256 public staketax = 0;
    uint256 public lasttax = 0;
    uint256 public devtax = 0;
    uint256 public farm = 0;
    uint256 public platformFee = 10;
    uint256 public TotalBurns = 0;
    uint256 public TotalStaked = 0;
    uint256 public TotalPaid = 0;
    uint256 public TotalReserved = 0;
    uint256 public TotalPromos = 0;
    uint256 public TotalPlays = 0;
    uint256 public era = 1;
    uint256 public TotalAmountWon = 0;
    string public Author = "undoxxed";
    bool public feeType = true; 
    bool public paused = false; 

    modifier onlyMatchBetCardsDAO() {
        require(msg.sender == matchBetDAO, "Not authorized.");
        _;
    }

    struct TokenInfo {
        IERC20 paytoken;
    }

    struct LegendInfo {
        uint8 indexer;
        address caller;
        uint256 platformFee;
    }

    struct WinnersList {
        address winner;
        uint256 era;
        uint256 amount;
        uint256 timestamp;
    }

    struct BlackList {
        bool blacklist;       
    }

    //Array
    TokenInfo[] public AllowedCrypto;

    //Maps
    mapping (uint256 => WinnersList) public pastwinners;
    mapping (uint256 => LegendInfo) private legendary;
    
    function addCurrency(IERC20 _paytoken) external onlyMatchBetCardsDAO {
        AllowedCrypto.push(
            TokenInfo({
                paytoken: _paytoken
            })
        );
    }

    function getMatchBetCards(uint256 _tokenId) internal view returns (uint256) {
        bool betState = IMatchBetCards(matchBetCards).blacklisted(_tokenId);
        if (!betState) {
            address betOwner = IMatchBetCards(matchBetCards).ownerOf(_tokenId);
            if (betOwner == msg.sender) {
                return _tokenId;
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }
    
    function requestRandomNumber(uint256 _num) internal view returns (uint8) {
        // Convert the random number to uint256
        uint256 randomValue = uint(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, msg.sender)));
        uint8 result;
        // Calculate the result between 1 and given
        if (_num > 0) {
            result = uint8((randomValue % challengers) + 1);
        } else {
            result = uint8((randomValue % (challengers * 2)) + 1);
        }
        return result;
    }  
    
    function betMatch(uint256 _bet, bytes32 userRandomNumber) public payable nonReentrant { 
        require(!paused, "Paused Contract");
        uint256 tokenId = getMatchBetCards(_bet);
        uint256 _index = requestRandomNumber(_bet);
        emit proofOfNumber(msg.sender, userRandomNumber, _index);
        uint256 platformfee;

        //TOS NFT Checker
        if (tokenId > 0) {
            //LOGIC FOR TALES OF SPARTA OWNER
            // transfer S needed for gameplay
            require (msg.value >= fee, "Insufficient fee");
            platformfee = platformFee; 
            //distribute incentive promo
            promoDistribution();
            //accept donations for development
            uint256 excess = msg.value - fee;
            if (excess > 0) {
                payable(developmentAddress).transfer(excess);
            }

        } else {
            // LOGIC FOR BET HOLDERS
            if (feeType) {
                // Require MAT needed for play
                require (msg.value >= fee, "Insufficient fee");  
                // Transfer multiples of BET for required deposit and burn is required
                uint256 requiredAmount = fee * betMultiple;
                transferTokens(requiredAmount); 
                platformfee = platformFee * 2;
                //distribute incentive promo
                promoDistribution();     
                //Initiate redistribution from the contract       
                burn(requiredAmount, burntoll);     
                uint256 excess = msg.value - fee;

                //accept donations for development
                if (excess > 0) {
                    payable(developmentAddress).transfer(excess);
                }

            } else {
                // Require multiple of S need for gameplay
                uint256 requiredAmount = fee * multiple;
                require(msg.value - fee >= requiredAmount, "Insufficient fee");
                
                // Transfer extra amount to bobbAddress
                payable(bobbAddress).transfer(requiredAmount - fee);

                platformfee = platformFee * 2;
                //distribute incentive promo
                promoDistribution();
                
                //accept donations for development
                uint256 excess = msg.value - (requiredAmount + fee);
                if (excess > 0) {
                    payable(developmentAddress).transfer(excess);
                }
            }
        }

        uint8 randomValue = requestRandomNumber(_index);
        
        emit RandomNumberResult(_index, randomValue);

        if (_index == randomValue) {
            address winner = msg.sender; 
            uint256 balance = address(this).balance;
            if (balance > 0) {
                uint256 seed = (balance * reseed) / 100;
                uint256 amountWon = balance - seed;
                uint256 winfee = (amountWon * platformfee) / 100;
                uint256 amountPayable = amountWon - winfee;
                payable(winner).transfer(amountPayable);
                payable(developmentAddress).transfer(winfee); 
                pastwinners[era].era = era;
                pastwinners[era].winner = msg.sender;
                pastwinners[era].amount = amountWon;
                pastwinners[era].timestamp = block.timestamp;
                TotalAmountWon += amountWon;
                era++;
                emit proofOfLegend(era, msg.sender, amountWon, seed);
            }
        }

        lastAddress = msg.sender;
        TotalPlays++;
    }

    function addToFarm (uint256 _farmInEth, uint256 _pid) external onlyMatchBetCardsDAO() {
        uint256 farming = _farmInEth * 1 ether;
        TokenInfo storage tokens = AllowedCrypto[_pid];
        IERC20 paytoken;
        paytoken = tokens.paytoken;              
        paytoken.transferFrom(msg.sender, address(this), farming);         
    }

    function promoDistribution() internal {    
        uint256 farmbal = IFarm(betByIncentive).balanceOf(address(this));    
        TokenInfo storage tokens_ = AllowedCrypto[pid];
        IERC20 promotoken; 
        promotoken = tokens_.paytoken; 
        if (farmbal > farm && farm > 0) {        
            promotoken.transfer(lastAddress, farm);
        }    
        TotalPromos += farm; 
    }

    function burn(uint256 _burnAmount, uint256 _num) internal {
        uint256 taxed = (_burnAmount * _num)/100 ;

        uint256 dead = (taxed * deadtax) / 100;
        uint256 bobb = (taxed * bobbtax) / 100;
        uint256 stake = (taxed * staketax) / 100;
        uint256 last = ((taxed * lasttax) / 100);
        uint256 dev =  (taxed * devtax) / 100;

        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken;
        paytoken = tokens.paytoken; 
        paytoken.transfer(burnAddress, dead);   
        paytoken.transfer(bobbAddress, bobb); 
        paytoken.transfer(stakeAddress, stake);
        paytoken.transfer(lastAddress, last);            
        paytoken.transfer(developmentAddress, dev); 
        TotalReserved += bobb;
        TotalStaked += stake;
        TotalPaid += last;
        TotalBurns += dead;  
    }
    
    function transferTokens(uint256 _cost) internal {
        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken;
        paytoken = tokens.paytoken;
        paytoken.transferFrom(msg.sender,address(this), _cost);
    } 

    function setValues (uint256 _feeInWei, uint256 _challengers, uint256 _payId, uint256 _pid, uint256 _farmInWei, uint256[] calldata _taxes) external onlyMatchBetCardsDAO() {
        fee = _feeInWei;
        // age = _age;
        challengers = _challengers;
        payId = _payId;
        pid = _pid;
        farm = _farmInWei;
        burntoll = _taxes[0];
        deadtax = _taxes[1];
        bobbtax = _taxes[2];
        staketax = _taxes[3];
        lasttax = _taxes[4];
        devtax = _taxes[5];
        reseed = _taxes[6];
        platformFee = _taxes[7];
        multiple = _taxes[8];
        betMultiple = _taxes[9];
    } 
    
    function setAddresses (address _burnAddress, address _bobbAddress, address _stakeAddress, address _devAddress, address _matchBetCards, address _betByIncentive) external onlyMatchBetCardsDAO {
        burnAddress = _burnAddress;
        bobbAddress = _bobbAddress;
        developmentAddress = _devAddress;
        stakeAddress = _stakeAddress;
        matchBetCards = _matchBetCards;
        betByIncentive = _betByIncentive;
    }

    function setFeeType(uint _binary) external onlyMatchBetCardsDAO {
        if (_binary > 0) {
            feeType = true;
        } else {
            feeType = false;
        }
    }
    
    function setAuthor (string memory _reveal) external onlyMatchBetCardsDAO {
        Author = _reveal;
    }

    function withdraw(uint256 _amount) external payable onlyMatchBetCardsDAO nonReentrant {
        address payable _owner = payable(matchBetDAO);
        _owner.transfer(_amount);
    }

    function withdrawERC20(uint256 _pid, uint256 _amount) external payable onlyMatchBetCardsDAO nonReentrant {
        TokenInfo storage tokens = AllowedCrypto[_pid];
        IERC20 paytoken;
        paytoken = tokens.paytoken;
        paytoken.transfer(msg.sender, _amount);
    }

    event Pause();
    function pause() public onlyMatchBetCardsDAO {
        require(!paused, "Already paused.");
        paused = true;
        emit Pause();
    }

    event Unpause();
    function unpause() public onlyMatchBetCardsDAO {
        require(paused, "Not paused.");
        paused = false;
        emit Unpause();
    } 

    function setDAO (address _matchBetDAO) external onlyMatchBetCardsDAO {
        matchBetDAO = _matchBetDAO;
    }

}
