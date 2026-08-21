// SPDX-License-Identifier: MIT
// @title Cashcat NFT Cards
// website: https://cashcats.my

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/utils/Strings.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC20/utils/SafeERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v5.0/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

pragma solidity 0.8.21;

contract CASHCATS is ERC721Enumerable, Ownable, ReentrancyGuard {        
        constructor(string memory _name, string memory _symbol, address _cashcatDAO) 
        ERC721(_name, _symbol) Ownable(msg.sender)
        {
            cashcatDAO = _cashcatDAO;
        }  
    using SafeERC20 for IERC20;  
    using Strings for uint256;
    
    address public cashcatDAO; 
    address public cashcatAddress;
    address private developmentAddress;
    address public burnAddress;
    string public baseURI;
    uint256 public fee = 0 ether;
    uint256 public cyberFee = 2000 ether;
    uint256 public payId = 0;
    uint256 public immutable supplyCap = 5000;
    uint256 private startTime = block.timestamp + 1 days;
    uint256 private wlDuration = 60 minutes;
    uint256 public toll = 100;
    uint256 public deadtax = 10;
    uint256 public devtax = 40;
    uint256 public gametax = 50;
    uint256 public TotalBurns = 0;
    uint256 public TotalGameDeposits = 0;
    uint256 public air1Limit = 100;
    uint256 public air2Limit = 100;
    uint256 public air3Limit = 100;
    uint256 public air4Limit = 100;
    uint256 public air5Limit = 70;
    uint256 public air6Limit = 30;
    string public Author = "undoxxed";
    bool public baseURItype = false; 
    bool public paused = false; 

    modifier onlyCashcatDAO() {
        require(msg.sender == cashcatDAO, "Not authorized.");
        _;
    }

    struct TokenInfo {
        IERC20 paytoken;
    }

    struct WhiteList {
        bool whitelist;
        uint256 air3NFTowner;
        uint256 air2NFTowner;
        uint256 air1NFTowner;
        uint256 air5Community;
        uint256 air4Contributor;
        uint256 earlyContributor;
    }

    struct BlackList {
        bool blacklist;       
    }

    struct CashcatMinted {
        uint256 cashcatmint;
        uint256 air3NFTmints;
        uint256 air2NFTmints;
        uint256 air1NFTmints;
        uint256 air5Mints;
        uint256 air4Mints;
        uint256 air6Mints;
    }

    //Array
    TokenInfo[] public AllowedCrypto;

    //Maps
    mapping (address => WhiteList) public whitelisted;
    mapping (uint256 => BlackList) public blacklisted;
    mapping (address => CashcatMinted) public cashcatminted;
    
    function addCurrency(IERC20 _paytoken) external onlyCashcatDAO {
        AllowedCrypto.push(
            TokenInfo({
                paytoken: _paytoken
            })
        );
    }

    function whitelistState() internal returns (bool) {
        if (!whitelisted[msg.sender].whitelist) return false;     
        uint256 cashcatUnminted = totalMintable();   
        if (cashcatUnminted > 0 && limitCompliance()) {
            return true;
        } 
        return false;        
    }

    function totalMintable() internal view returns (uint256) {
        uint256 cashcatOwned = cashcatminted[msg.sender].cashcatmint;
        uint256 cashcatMintable = whitelisted[msg.sender].air3NFTowner + whitelisted[msg.sender].air2NFTowner + whitelisted[msg.sender].air1NFTowner 
            + whitelisted[msg.sender].air5Community + whitelisted[msg.sender].air4Contributor + whitelisted[msg.sender].earlyContributor;
        uint256 cashcatUnminted = cashcatMintable - cashcatOwned;
          require(cashcatOwned <= cashcatMintable, "failsafe");
        return cashcatUnminted;
    }

    function limitCompliance() internal returns (bool) {
        if (cashcatminted[msg.sender].cashcatmint < 1) {          
            // initialize snapshot record of cashcatMint
        cashcatminted[msg.sender].air3NFTmints = whitelisted[msg.sender].air3NFTowner;
        cashcatminted[msg.sender].air2NFTmints = whitelisted[msg.sender].air2NFTowner;
        cashcatminted[msg.sender].air1NFTmints = whitelisted[msg.sender].air1NFTowner;
        cashcatminted[msg.sender].air5Mints = whitelisted[msg.sender].air5Community;
        cashcatminted[msg.sender].air4Mints = whitelisted[msg.sender].air4Contributor;
        cashcatminted[msg.sender].air6Mints = whitelisted[msg.sender].earlyContributor;
        } 

            //Objectively subtract mint from associated whitelist limit
            if (cashcatminted[msg.sender].air3NFTmints > 0 && air3Limit > 0) {
                cashcatminted[msg.sender].air3NFTmints--;
                // subtract mint from air3 eligibilty whitelist
                air3Limit--;
                return true;
            } else if (cashcatminted[msg.sender].air2NFTmints > 0 && air2Limit > 0) {
                cashcatminted[msg.sender].air2NFTmints--;
                // subtract mint from air2 eligibility whitelist
                air2Limit--;
                return true;
            } else if (cashcatminted[msg.sender].air1NFTmints > 0 && air1Limit > 0) {
                cashcatminted[msg.sender].air1NFTmints--;
                //subtract mint from air1 eligibility whitelist
                air1Limit--;
                return true;
            } else if (cashcatminted[msg.sender].air5Mints > 0 && air5Limit > 0) {
                cashcatminted[msg.sender].air5Mints--;
                // subtract mint from air5 eligibility whitelist
                air5Limit--;
                return true;
            } else if (cashcatminted[msg.sender].air4Mints > 0 && air4Limit > 0) {
                cashcatminted[msg.sender].air4Mints--;
                // subtract mint from air4 eligibility whitelist
                air4Limit--;
                return true;
            } else if (cashcatminted[msg.sender].air6Mints > 0 && air6Limit > 0) {
                cashcatminted[msg.sender].air6Mints--;
                // subtract mint from air6 eligibility whitelist
                air6Limit--;
                return true;
            }            
            return false;
    }
    
    event proofOfCashcat(uint256 indexed tokenId);

    function SpinAWhiteCashcat() internal {
        uint256 currentSupply = totalSupply();
        require(currentSupply < supplyCap, "Max Exceeded");

            uint256 tokenId = currentSupply + 1;
            
            // Conditional Mint to the Spartan Reserve for the Sparta of Sonic GambleFi app
            if (currentSupply > 0 && currentSupply % 10 == 0) {
                _mint(cashcatDAO, tokenId);
                //Map it
                blacklisted[tokenId] = BlackList({
                    blacklist: false
                });
                cashcatminted[cashcatDAO].cashcatmint++;
                emit proofOfCashcat(tokenId);
                tokenId++;  // Increment for the next mint
            }

            // Regular Mint
            _mint(msg.sender, tokenId);
            //record mint
            cashcatminted[msg.sender].cashcatmint++;
            
            //Map it
            blacklisted[tokenId] = BlackList({
                blacklist: false
            });
            
            emit proofOfCashcat(tokenId);

    }

    function SpinACashcat() internal {
        uint256 currentSupply = totalSupply();
        require(currentSupply < supplyCap, "Max Exceeded");

            uint256 tokenId = currentSupply + 1;
            
            // Conditional Mint to the Spartan Reserve for the Sparta of Sonic GambleFi app
            if (currentSupply > 0 && currentSupply % 10 == 0) {
                _mint(cashcatDAO, tokenId);
                //Map it
                blacklisted[tokenId] = BlackList({
                    blacklist: false
                });
                cashcatminted[cashcatDAO].cashcatmint++;
                emit proofOfCashcat(tokenId);
                tokenId++;  // Increment for the next mint
            }

            // Regular Mint
            _mint(msg.sender, tokenId);
            //record mint
            cashcatminted[msg.sender].cashcatmint++;
            
            //Map it
            blacklisted[tokenId] = BlackList({
                blacklist: false
            });
            
            emit proofOfCashcat(tokenId);
    }

    function mint() public payable nonReentrant {
        require(!paused, "Paused Contract");
        uint256 supply = totalSupply();
        require( supply < supplyCap, "Max Exceeded.");
        require (startTime < block.timestamp, "Mint Not Live!");

        if (whitelistState()) { 
            //Mint a Cashcat
            SpinAWhiteCashcat(); 

        } else {
          require((startTime + wlDuration) < block.timestamp, "Public Phase Has Not Yet Begun");
          require(msg.value == fee, "Insufficient fee");
          // Transfer required air3 tokens to mint a air3
            transferTokens(cyberFee); 
          // Initiate permaburn from the contract
            burn(cyberFee, toll);

            //Mint a Cashcat
            SpinACashcat();
        }
    }

    function burn(uint256 _burnAmount, uint256 _num) internal {
        uint256 taxed = (_burnAmount * _num)/100 ;

        uint256 dead = (taxed * deadtax)/100;
        uint256 dev =  (taxed * devtax)/100;
        uint256 game = (taxed * gametax)/100;

        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken;
        paytoken = tokens.paytoken;               
        paytoken.transfer(burnAddress, dead);   
        paytoken.transfer(developmentAddress, dev); 
        paytoken.transfer(cashcatAddress, game); 
        TotalBurns += dead;
        TotalGameDeposits += game;       
    }
    
    function transferTokens(uint256 _cost) internal {
        TokenInfo storage tokens = AllowedCrypto[payId];
        IERC20 paytoken;
        paytoken = tokens.paytoken;
        paytoken.transferFrom(msg.sender,address(this), _cost);
    }

    function setValues (uint256 _feeWei, uint256 _cyberFeeEther, uint256 _payId, uint256[] calldata _taxes, uint256 _startTime, uint256 _wlDuration, uint256[] calldata _mintLimits) external onlyCashcatDAO() {
        fee = _feeWei;
        cyberFee = _cyberFeeEther * 1 ether;
        payId = _payId;
        toll = _taxes[0];
        deadtax = _taxes[1];
        devtax = _taxes[2];
        gametax = _taxes[3];
        startTime = block.timestamp + (_startTime * 1 days);
        wlDuration = _wlDuration * 1 minutes;
        air3Limit = _mintLimits[0];
        air1Limit = _mintLimits[1];
        air2Limit = _mintLimits[2];
        air5Limit = _mintLimits[3];
        air4Limit = _mintLimits[4];
        air6Limit = _mintLimits[5];
    }
    
    function changeOwner(address newOwner) external onlyCashcatDAO {
        // Update the owner to the new owner
        transferOwnership(newOwner);
    }

    function withdraw(uint256 _amount) external payable onlyCashcatDAO nonReentrant {
        address payable _owner = payable(owner());
        _owner.transfer(_amount);
    }

    function withdrawERC20(uint256 _payId, uint256 _amount) external payable onlyCashcatDAO nonReentrant {
        TokenInfo storage tokens = AllowedCrypto[_payId];
        IERC20 paytoken;
        paytoken = tokens.paytoken;
        paytoken.transfer(msg.sender, _amount);
    }

    function _baseURI() internal view virtual override returns (string memory) {
    return baseURI;
    }

    function updateBaseURI(string memory _newLink) external onlyCashcatDAO() {
        baseURI = _newLink;
    }

    function setBaseURItype() external onlyCashcatDAO() {
      if (!baseURItype) {
        baseURItype = true;
      } else {
        baseURItype = false;
      }
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
    require(_tokenId <= totalSupply(), "Not Found");
      string memory uriBase = baseURI;
      if (blacklisted[_tokenId].blacklist) { 
        return
          bytes(uriBase).length > 0
            ? string(abi.encodePacked(uriBase, "blacklisted", ".json"))
            : "";
      }

      if (baseURItype) {
        return
          bytes(uriBase).length > 0
            ? string(abi.encodePacked(uriBase, _tokenId.toString(), ".json"))
            : "";
        } 
        return
          bytes(uriBase).length > 0
            ? string(abi.encodePacked(uriBase, "alpha", ".json"))
            : "";
    }

    event Pause();
    function pause() public onlyCashcatDAO {
        require(!paused, "Already paused.");
        paused = true;
        emit Pause();
    }

    event Unpause();
    function unpause() public onlyCashcatDAO {
        require(paused, "Not paused.");
        paused = false;
        emit Unpause();
    } 

    // Helpers
    function addToAir3Whitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].air3NFTowner = _amount[i];
        }
    }

    function addToAir2Whitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].air2NFTowner = _amount[i];
        }
    }

    function addToAir1Whitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].air1NFTowner = _amount[i];
        }
    }

    function addToAir5Whitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].air5Community = _amount[i];
        }
    }

    function addToAir4Whitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].air4Contributor = _amount[i];
        }
    }

    function addToEarlyWhitelist(address[] calldata _address, uint256[] calldata _amount) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = true;
            whitelisted[_address[i]].earlyContributor = _amount[i];
        }
    }

    function addToBlacklist(uint256[] calldata _nfts) external onlyCashcatDAO {
        for (uint256 i = 0; i < _nfts.length; i++) {
            blacklisted[_nfts[i]].blacklist = true;
        }
    }

    function removeFromWhitelist(address[] calldata _address) external onlyCashcatDAO {
        for (uint256 i = 0; i < _address.length; i++) {
            whitelisted[_address[i]].whitelist = false;
            whitelisted[_address[i]].air3NFTowner = 0;
            whitelisted[_address[i]].air2NFTowner = 0;
            whitelisted[_address[i]].air1NFTowner = 0;
            whitelisted[_address[i]].air5Community = 0;
            whitelisted[_address[i]].air4Contributor = 0;
            whitelisted[_address[i]].earlyContributor = 0;
        }
    }

    function removeFromBlacklist(uint256[] calldata _nfts) external onlyCashcatDAO {
        for (uint256 i = 0; i < _nfts.length; i++) {
            blacklisted[_nfts[i]].blacklist = false;
        }
    }

    function setDAO (address _cashcatDAO) external onlyCashcatDAO {
        cashcatDAO = _cashcatDAO;
    }

    function setAddresses (address _address1, address _address2, address _address3) external onlyCashcatDAO {
        burnAddress = _address1;
        developmentAddress = _address2;
        cashcatAddress = _address3;
    }
    
    function setAuthor (string memory _reveal) external onlyCashcatDAO {
        Author = _reveal;
    }

    /// @notice Single-call snapshot for the mint page (global + per-player).
    /// @dev tokenFee is the ERC20 mint cost (cyberFee storage). ethFee is native `fee`.
    ///      remAir* are free-mint slots still available to `player` (0 if not whitelisted).
    ///      canFreeMint is true when whitelist path would succeed right now (limits + live).
    function getMintData(address player) external view returns (
            uint256 ethFee,
            uint256 tokenFee,
            bool isPaused,
            bool mintLive,
            bool publicPhaseLive,
            uint256 supply,
            uint256 supplyCap_,
            uint256 air3Limit_,
            uint256 air2Limit_,
            uint256 air1Limit_,
            uint256 air5Limit_,
            uint256 air4Limit_,
            uint256 air6Limit_,
            bool isWhitelisted,
            uint256 wlAir3,
            uint256 wlAir2,
            uint256 wlAir1,
            uint256 wlAir5,
            uint256 wlAir4,
            uint256 wlAir6,
            uint256 mintedTotal,
            uint256 remAir3,
            uint256 remAir2,
            uint256 remAir1,
            uint256 remAir5,
            uint256 remAir4,
            uint256 remAir6,
            uint256 freeEligible,
            bool canFreeMint
        )
    {
        ethFee = fee;
        tokenFee = cyberFee;
        isPaused = paused;
        mintLive = block.timestamp > startTime;
        publicPhaseLive = block.timestamp > (startTime + wlDuration);
        supply = totalSupply();
        supplyCap_ = supplyCap;
        air3Limit_ = air3Limit;
        air2Limit_ = air2Limit;
        air1Limit_ = air1Limit;
        air5Limit_ = air5Limit;
        air4Limit_ = air4Limit;
        air6Limit_ = air6Limit;

        WhiteList memory w = whitelisted[player];
        CashcatMinted memory m = cashcatminted[player];

        isWhitelisted = w.whitelist;
        wlAir3 = w.air3NFTowner;
        wlAir2 = w.air2NFTowner;
        wlAir1 = w.air1NFTowner;
        wlAir5 = w.air5Community;
        wlAir4 = w.air4Contributor;
        wlAir6 = w.earlyContributor;
        mintedTotal = m.cashcatmint;

        if (w.whitelist) {
            // Before first mint, remaining free slots = full whitelist allocation.
            // After first mint, cashcatminted air* fields hold remaining counts.
            if (m.cashcatmint < 1) {
                remAir3 = w.air3NFTowner;
                remAir2 = w.air2NFTowner;
                remAir1 = w.air1NFTowner;
                remAir5 = w.air5Community;
                remAir4 = w.air4Contributor;
                remAir6 = w.earlyContributor;
            } else {
                remAir3 = m.air3NFTmints;
                remAir2 = m.air2NFTmints;
                remAir1 = m.air1NFTmints;
                remAir5 = m.air5Mints;
                remAir4 = m.air4Mints;
                remAir6 = m.air6Mints;
            }
        }

        freeEligible = remAir3 + remAir2 + remAir1 + remAir5 + remAir4 + remAir6;
        canFreeMint =
            w.whitelist &&
            mintLive &&
            !paused &&
            supply < supplyCap &&
            (
                (remAir3 > 0 && air3Limit > 0) ||
                (remAir2 > 0 && air2Limit > 0) ||
                (remAir1 > 0 && air1Limit > 0) ||
                (remAir5 > 0 && air5Limit > 0) ||
                (remAir4 > 0 && air4Limit > 0) ||
                (remAir6 > 0 && air6Limit > 0)
            );
    }
}