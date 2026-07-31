// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// ============================================================
/// EVO-EVM — DRAFT. NOT COMPILED. NOT AUDITED. DO NOT DEPLOY.
/// Port of the EVO primitive: ERC-721 with a redeemable reserve
/// (native or ERC-20) sealed inside each token + evolution.
/// Mirrors the Solana program's invariants (see main repo SECURITY.md §4):
/// reserve conservation on forge/feed/shatter, exits always open,
/// checks-effects-interactions on every value transfer.
/// ============================================================

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract EvoCollection is ERC721, ERC2981, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── immutable economics (locked at deploy, like create_collection) ──
    IERC20  public immutable reserveToken;   // address(0) => native ETH/BNB
    uint256 public immutable mintPrice;      // to creator
    uint256 public immutable lockAmount;     // sealed per token (the floor)
    uint256 public immutable supplyCap;
    uint16  public immutable shatterFeeBps;  // <= 2000
    address public immutable creator;

    // ── evolution config (AND logic, cumulative per stage) ──
    uint16  public immutable maxStages;
    uint256 public immutable feedThreshold;    // reserve units per stage
    uint256 public immutable holdSeconds;      // per stage
    uint256 public immutable lockedThreshold;  // per stage

    // ── per-token state ──
    mapping(uint256 => uint256) public locked;         // reserve sealed
    mapping(uint256 => uint256) public totalFed;
    mapping(uint256 => uint16)  public stage;
    mapping(uint256 => uint256) public lastTransition;
    uint256 public totalMinted;   // monotonic — burned ids never reused
    uint256 public liveSupply;
    string  private _baseTokenURI; // baseURI/{stage}/{id}.json

    event Forged(uint256 indexed id, address indexed owner, uint256 lockedAmt);
    event Fed(uint256 indexed id, uint256 amount, uint256 newLocked);
    event Evolved(uint256 indexed id, uint16 newStage);
    event Shattered(uint256 indexed id, address indexed owner, uint256 returned, uint256 fee);

    constructor(
        string memory name_, string memory symbol_, string memory baseURI_,
        address reserveToken_, uint256 mintPrice_, uint256 lockAmount_,
        uint256 supplyCap_, uint16 shatterFeeBps_, uint96 royaltyBps_,
        uint16 maxStages_, uint256 feedThreshold_, uint256 holdSeconds_,
        uint256 lockedThreshold_
    ) ERC721(name_, symbol_) {
        require(lockAmount_ > 0 && supplyCap_ > 0 && shatterFeeBps_ <= 2000, "bad config");
        reserveToken = IERC20(reserveToken_);
        mintPrice = mintPrice_; lockAmount = lockAmount_; supplyCap = supplyCap_;
        shatterFeeBps = shatterFeeBps_; creator = msg.sender;
        maxStages = maxStages_; feedThreshold = feedThreshold_;
        holdSeconds = holdSeconds_; lockedThreshold = lockedThreshold_;
        _baseTokenURI = baseURI_;
        _setDefaultRoyalty(msg.sender, royaltyBps_);
    }

    function _isNative() internal view returns (bool) { return address(reserveToken) == address(0); }

    /// forge — mint + seal the reserve. msg.value or ERC-20 pull.
    function forge() external payable nonReentrant returns (uint256 id) {
        require(liveSupply < supplyCap, "sold out");
        id = totalMinted++;            // monotonic slot, never reused
        liveSupply++;
        locked[id] = lockAmount;
        lastTransition[id] = block.timestamp;
        _safeMint(msg.sender, id);     // effects before external interactions below
        if (_isNative()) {
            require(msg.value == mintPrice + lockAmount, "wrong value");
            (bool ok, ) = creator.call{value: mintPrice}("");
            require(ok, "creator pay failed");
        } else {
            require(msg.value == 0, "no native");
            reserveToken.safeTransferFrom(msg.sender, creator, mintPrice);
            reserveToken.safeTransferFrom(msg.sender, address(this), lockAmount);
        }
        emit Forged(id, msg.sender, lockAmount);
    }

    /// feed — anyone may raise a token's floor (owner-gate optional per product).
    function feed(uint256 id, uint256 amount) external payable nonReentrant {
        _requireOwned(id);
        require(amount > 0, "zero");
        if (_isNative()) { require(msg.value == amount, "wrong value"); }
        else { require(msg.value == 0, "no native"); reserveToken.safeTransferFrom(msg.sender, address(this), amount); }
        locked[id] += amount;
        totalFed[id] += amount;
        emit Fed(id, amount, locked[id]);
    }

    /// evolve — permissionless; thresholds are cumulative x next stage.
    function evolve(uint256 id) external {
        _requireOwned(id);
        uint16 next = stage[id] + 1;
        require(maxStages > 0 && next < maxStages, "max stage");
        if (feedThreshold > 0)   require(totalFed[id] >= feedThreshold * next, "feed");
        if (holdSeconds > 0)     require(block.timestamp - lastTransition[id] >= holdSeconds * next, "hold");
        if (lockedThreshold > 0) require(locked[id] >= lockedThreshold * next, "locked");
        stage[id] = next;
        lastTransition[id] = block.timestamp;
        emit Evolved(id, next);
    }

    /// shatter — burn + reclaim reserve minus fee. Exits must ALWAYS work:
    /// no pause, no authority, can ever gate this function.
    function shatter(uint256 id) external nonReentrant {
        require(ownerOf(id) == msg.sender, "not owner");
        uint256 amt = locked[id];
        uint256 fee = (amt * shatterFeeBps) / 10000;
        uint256 refund = amt - fee;
        // effects first
        locked[id] = 0;
        liveSupply--;
        _burn(id);
        // interactions last
        if (_isNative()) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "refund failed");
            if (fee > 0) { (bool ok2, ) = creator.call{value: fee}(""); require(ok2, "fee failed"); }
        } else {
            reserveToken.safeTransfer(msg.sender, refund);
            if (fee > 0) reserveToken.safeTransfer(creator, fee);
        }
        emit Shattered(id, msg.sender, refund, fee);
    }

    /// Dynamic metadata: wallets/marketplaces render evolution automatically.
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat(_baseTokenURI, "/", _toString(stage[id]), "/", _toString(id), ".json");
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 t = v; uint256 d; while (t != 0) { d++; t /= 10; }
        bytes memory b = new bytes(d);
        while (v != 0) { d--; b[d] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(b);
    }

    function supportsInterface(bytes4 iid) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(iid);
    }
}
