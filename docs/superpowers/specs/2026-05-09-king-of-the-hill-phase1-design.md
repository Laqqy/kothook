# King of the Hill — Phase 1 Design Spec

**Date:** 2026-05-09
**Phase:** 1 of 3 (smart contracts only — DApp and deployment are Phases 2 and 3)
**Status:** Approved by user, ready for implementation planning

## 0. Concept (recap)

A Uniswap v4 hook embedded in an ETH/$KOTH trading pool. Every trader is automatically entered into the King-of-the-Hill game. The current King passively earns ETH (2% of each swap volume) until dethroned. Becoming King requires buying $KOTH in a single swap with ETH amount strictly greater than the *current decayed record* × 1.03. Selling $KOTH while King immediately strips the crown (Dump Protection). On every dethrone, two NFTs are minted to the old King: a soulbound `ChronicleSoul` and a tradeable `ChronicleScroll`.

## 1. Locked-in design decisions

| # | Parameter | Value | Notes |
|---|---|---|---|
| 1 | Phase scope | Contracts + tests + scripts only | DApp + mainnet deploy = future phases |
| 2 | EOA detection | Custom router writes msg.sender into transient storage (EIP-1153) | Hook reads via TLOAD. Other routers/aggregators bypass king mechanics. |
| 3 | Pool currency pair | Native ETH (currency0 = address(0)) / $KOTH | No WETH wrap needed |
| 4 | Decay formula | Linear: `decayed = highest × max(0, (DECAY_BLOCKS − elapsed) / DECAY_BLOCKS)` | 50% at 1800 blocks, 0 at 3600 |
| 5 | King payout pattern | Pull (claim) | `mapping(address => uint256) kingBalances`, only owner can `claim()` |
| 6 | NFT metadata | On-chain JSON + minimal on-chain SVG (~1kB) | Base64-encoded data URI |
| 7 | $KOTH total supply | 10,000,000 (with 18 decimals) | All minted to deployer at construction |
| 8 | Target network | Ethereum Mainnet | Anvil for local tests |
| 9 | Chronicle minting | Eager — both Soul + Scroll minted in the dethroning swap's afterSwap | Costs swapper extra ~150-250k gas |
| 10 | Forfeit timer | 24h (7200 blocks) from dethrone block | Active king's balance never expires |
| 11 | Forfeit trigger | Permissionless + 0.5% keeper tip | Stale balance is bought back as $KOTH and burned |
| 12 | LP fee | 0 (pool fee tier 0) | All fees managed by hook |
| 13 | Foundry stack | uniswapfoundation/v4-template (BaseHook, HookMiner, fixtures) | OZ v5 for ERC standards |
| 14 | Solidity / EVM | 0.8.26 / Cancun (TSTORE/TLOAD) | via_ir = true |

## 2. Constants

```solidity
DECAY_BLOCKS    = 3600     // ~12h on Ethereum mainnet
KING_FEE_BPS    = 200      // 2% of ETH volume → currentKing
BURN_FEE_BPS    = 100      // 1% of $KOTH volume → burned
THRESHOLD_BPS   = 10300    // 1.03× — required surplus over decayed record to dethrone
SNIPER_BLOCKS   = 100      // ~20 min anti-sniper window
MAX_WALLET_BPS  = 100      // 1% of supply during anti-sniper window
ROYALTY_BPS     = 500      // 5% Scroll royalty
FORFEIT_BLOCKS  = 7200     // 24h grace before stale balance can be forfeited
KEEPER_TIP_BPS  = 50       // 0.5% of forfeit amount goes to keeper
TOTAL_SUPPLY    = 10_000_000e18
```

## 3. Contracts overview

```
src/
├── Types.sol                Shared Reign struct
├── KOTHToken.sol            ERC-20 with anti-sniper and burnFromHook
├── KingOfTheHillHook.sol    BaseHook v4: decay, dump-protect, fees, dethrone, forfeit
├── KOTHRouter.sol           Records EOA in TSTORE before unlock; buy/sell entry points
├── ChronicleSoul.sol        ERC-721 soulbound (no transfers)
├── ChronicleScroll.sol      ERC-721 + ERC-2981 royalty
└── ChronicleRenderer.sol    Library producing on-chain JSON + SVG data URI
```

## 4. End-to-end flow (single buy through KOTHRouter)

```
1. User → KOTHRouter.buy{value: 1 ETH}(minKothOut)
2. Router: tstore(USER_TSLOT, msg.sender)
3. Router → poolManager.unlock(callbackData)
4. PoolManager → Router.unlockCallback(...)
5. Router → poolManager.swap(poolKey, params, "")
6. PoolManager → Hook.beforeSwap(...)
   - msgSender = tload(USER_TSLOT)
   - if (tload(INTERNAL_BURN_TSLOT) != 0) → return zero delta (no game logic)
   - if sell && msgSender == currentKing → _dethroneFor(msgSender, "DUMP")
   - take 2% ETH and 1% KOTH from the swap (split between before and after based on direction)
   - return BeforeSwapDelta
7. PoolManager performs AMM swap
8. PoolManager → Hook.afterSwap(...)
   - msgSender = tload(USER_TSLOT)
   - if buy:
       ethSpent = abs(delta on currency0) − before-side fee already taken
       if ethSpent > getThreshold():
         _dethroneFor(currentKing, "OVERTHROWN")  // mints chronicles to oldKing
         currentKing = msgSender
         highestBuyAmount = ethSpent
         highestBuyBlock = block.number
         dethronedAt[msgSender] = 0
         emit NewKing(msgSender, ethSpent, block.number)
   - take any deferred KOTH fee, burn via koth.burnFromHook
   - return AfterSwapDelta
9. PoolManager returns deltas to Router
10. Router settles ETH (input), takes KOTH out, forwards KOTH to user
11. Router: tstore(USER_TSLOT, 0)
```

Sells are symmetric: input = KOTH (from user via transferFrom), output = ETH. The 2% fee is taken on the ETH side regardless of direction (output side for sells, input side for buys); the 1% burn is taken on the KOTH side.

## 5. KOTHToken (ERC-20)

```solidity
contract KOTHToken is ERC20, ERC20Burnable {
    uint256 public constant TOTAL_SUPPLY = 10_000_000e18;
    uint256 public immutable LAUNCH_BLOCK;
    uint256 public constant SNIPER_BLOCKS = 100;
    uint256 public constant MAX_WALLET_BPS = 100;

    mapping(address => bool) public isExempt;
    address public hook;          // set once via setHook

    error AntiSniperLimit(uint256 wouldHave, uint256 maxAllowed);
    error HookAlreadySet();
    error OnlyHook();

    constructor(address[] memory exemptions) ERC20("King of the Hill", "KOTH") {
        LAUNCH_BLOCK = block.number;
        _mint(msg.sender, TOTAL_SUPPLY);
        for (uint i; i < exemptions.length; ++i) isExempt[exemptions[i]] = true;
        isExempt[msg.sender] = true;
    }

    function setHook(address _hook) external {
        if (hook != address(0)) revert HookAlreadySet();
        hook = _hook;
        isExempt[_hook] = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (block.number < LAUNCH_BLOCK + SNIPER_BLOCKS && !isExempt[to]) {
            uint256 wouldHave = balanceOf(to) + value;
            uint256 maxAllowed = (TOTAL_SUPPLY * MAX_WALLET_BPS) / 10_000;
            if (wouldHave > maxAllowed) revert AntiSniperLimit(wouldHave, maxAllowed);
        }
        super._update(from, to, value);
    }

    function burnFromHook(uint256 amount) external {
        if (msg.sender != hook) revert OnlyHook();
        _burn(hook, amount);
    }
}
```

**Exemption list passed to constructor:** PoolManager, PositionManager, KOTHRouter (precomputed CREATE2 address or set via second-step token-side mutator), deployer. Hook added later via `setHook`.

## 6. KingOfTheHillHook

### 6.1 Permissions

```solidity
function getHookPermissions() pure returns (Permissions memory) {
    return Permissions({
        beforeInitialize: false,
        afterInitialize: false,
        beforeAddLiquidity: false,
        afterAddLiquidity: false,
        beforeRemoveLiquidity: false,
        afterRemoveLiquidity: false,
        beforeSwap: true,
        afterSwap: true,
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: true,
        afterSwapReturnDelta: true,
        afterAddLiquidityReturnDelta: false,
        afterRemoveLiquidityReturnDelta: false
    });
}
```

Hook deployed via `HookMiner` (CREATE2 salt search) so its address has the matching permission flag bits in the lower bytes.

### 6.2 Storage

```solidity
// Game state
address public currentKing;
uint256 public highestBuyAmount;     // wei
uint256 public highestBuyBlock;
uint256 public reignsCount;          // 0, 1, 2, ...

// Pull-payment + forfeit
mapping(address => uint256) public kingBalances;
mapping(address => uint256) public dethronedAt;
uint256 public treasuryBalance;       // accrues when currentKing == 0

// Reign metadata for NFTs
struct Reign {
    address king;
    uint256 reignId;
    uint256 startBlock;
    uint256 endBlock;
    uint256 ethEarned;
    uint256 recordHigh;
    bytes32 dethroneReason;          // "OVERTHROWN" | "DUMP" | "FORFEIT" — left for future
}

// Immutables
PoolKey public poolKey;               // set once via initialize()
KOTHToken public immutable koth;
ChronicleSoul public immutable soul;
ChronicleScroll public immutable scroll;
KOTHRouter public immutable router;
address public immutable treasury;
IPoolManager public immutable poolManager;

// Transient slots
bytes32 constant USER_TSLOT          = keccak256("koth.user");
bytes32 constant INTERNAL_BURN_TSLOT = keccak256("koth.internalBurn");
```

### 6.3 View functions

```solidity
function getDecayedRecord() public view returns (uint256) {
    if (highestBuyAmount == 0) return 0;
    uint256 elapsed = block.number - highestBuyBlock;
    if (elapsed >= DECAY_BLOCKS) return 0;
    return highestBuyAmount * (DECAY_BLOCKS - elapsed) / DECAY_BLOCKS;
}

function getThreshold() public view returns (uint256) {
    return getDecayedRecord() * THRESHOLD_BPS / 10_000;
}
```

### 6.4 beforeSwap (pseudocode)

```
1. msgSender = tload(USER_TSLOT)
2. if tload(INTERNAL_BURN_TSLOT) != 0:
     return (selector, BeforeSwapDelta.ZERO, 0)         // skip all game logic
3. zeroForOne = params.zeroForOne   // currency0 = ETH, currency1 = KOTH
4. isBuy  = zeroForOne
5. isSell = !zeroForOne
6. if isSell && msgSender == currentKing:
     _dethroneFor(msgSender, "DUMP")                    // currentKing now = 0
7. Compute hook fees on the swap:
   - ethSide  = 2% of |swap ETH amount|
   - kothSide = 1% of |swap KOTH amount|
   The "specified" side is fee'd in beforeSwap (deltaSpecified),
   the "unspecified" side in afterSwap (deltaUnspecified).
   Net economic effect: 3% wedge across the swap, 2/3 of it ETH, 1/3 KOTH.
8. Take ETH portion from poolManager (mint claim) → credit kingBalances or treasuryBalance:
   if currentKing != 0: kingBalances[currentKing] += ethFee
   else:                treasuryBalance         += ethFee
9. Take KOTH portion → hook holds it temporarily; burned in afterSwap
10. Return BeforeSwapDelta
```

### 6.5 afterSwap (pseudocode)

```
1. if tload(INTERNAL_BURN_TSLOT) != 0:
     return (selector, 0)
2. msgSender = tload(USER_TSLOT)
3. if isBuy && msgSender != address(0):
     // Only swaps coming through KOTHRouter (which sets TSTORE) can change the crown.
     // Swaps via aggregators / stock v4 routers leave msgSender = 0 and cannot become king.
     ethSpent = computed gross input minus already-deducted ETH fee
     if ethSpent > getThreshold():
         _dethroneFor(currentKing, "OVERTHROWN")
         currentKing = msgSender
         highestBuyAmount = ethSpent
         highestBuyBlock = block.number
         dethronedAt[msgSender] = 0     // clear if previously dethroned
         emit NewKing(msgSender, ethSpent, block.number)
4. Burn deferred KOTH fee: koth.burnFromHook(kothHeld)
5. Return AfterSwapDelta
```

### 6.6 _dethroneFor (internal)

```
1. oldKing = currentKing
2. if oldKing == 0: return
3. data = Reign({
     king: oldKing,
     reignId: reignsCount,
     startBlock: highestBuyBlock,
     endBlock: block.number,
     ethEarned: kingBalances[oldKing],
     recordHigh: highestBuyAmount,
     dethroneReason: reason
   })
4. soul.mintReign(oldKing, reignsCount, data)
5. scroll.mintReign(oldKing, reignsCount, data)
6. emit KingDethroned(oldKing, reason, data.ethEarned)
7. currentKing = address(0)
8. dethronedAt[oldKing] = block.number
9. highestBuyAmount = 0
10. highestBuyBlock = 0
11. reignsCount++
```

Note: `kingBalances[oldKing]` is preserved — the old king retains the right to claim accumulated ETH within 24h. Only after `FORFEIT_BLOCKS` it can be forfeited.

### 6.7 claim

```solidity
function claim() external nonReentrant {
    uint256 amount = kingBalances[msg.sender];
    if (amount == 0) revert NothingToClaim();
    kingBalances[msg.sender] = 0;
    (bool ok,) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();
    emit Claimed(msg.sender, amount);
}

function claimTreasury() external nonReentrant {
    if (msg.sender != treasury) revert OnlyTreasury();
    uint256 amount = treasuryBalance;
    if (amount == 0) revert NothingToClaim();
    treasuryBalance = 0;
    (bool ok,) = treasury.call{value: amount}("");
    if (!ok) revert TransferFailed();
    emit TreasuryClaimed(amount);
}
```

### 6.8 forfeit (permissionless keeper)

```solidity
function forfeit(address staleKing) external nonReentrant {
    uint256 dethronedAtBlock = dethronedAt[staleKing];
    if (dethronedAtBlock == 0) revert NotDethroned();
    if (block.number <= dethronedAtBlock + FORFEIT_BLOCKS) revert TooEarly();

    uint256 amount = kingBalances[staleKing];
    if (amount == 0) revert NothingToForfeit();

    kingBalances[staleKing] = 0;
    dethronedAt[staleKing]  = 0;

    uint256 tip = amount * KEEPER_TIP_BPS / 10_000;
    uint256 toBurn = amount - tip;
    (bool ok,) = msg.sender.call{value: tip}("");
    if (!ok) revert TransferFailed();

    // Internal swap ETH → KOTH bypassing king mechanics
    assembly { tstore(INTERNAL_BURN_TSLOT, 1) }
    uint256 kothBought = _internalSwapEthToKoth(toBurn);
    assembly { tstore(INTERNAL_BURN_TSLOT, 0) }

    koth.burnFromHook(kothBought);
    emit Forfeited(staleKing, amount, tip, kothBought);
}

function _internalSwapEthToKoth(uint256 ethAmount) internal returns (uint256) {
    // poolManager.unlock with internal callback that performs:
    //   poolManager.swap(poolKey, {zeroForOne: true, amountSpecified: -int(ethAmount), sqrtPriceLimitX96: ...}, "")
    //   settle ETH from hook's own balance
    //   take KOTH to hook
    // Hook's beforeSwap/afterSwap see INTERNAL_BURN_TSLOT == 1 and skip all game logic.
}
```

### 6.9 Events

```solidity
event NewKing(address indexed king, uint256 amount, uint256 blockNumber);
event KingDethroned(address indexed king, bytes32 reason, uint256 totalEarned);
event Claimed(address indexed king, uint256 amount);
event TreasuryClaimed(uint256 amount);
event Forfeited(address indexed king, uint256 totalAmount, uint256 keeperTip, uint256 kothBurned);
```

## 7. KOTHRouter

```solidity
contract KOTHRouter is IUnlockCallback {
    IPoolManager public immutable poolManager;
    KOTHToken public immutable koth;
    KingOfTheHillHook public immutable hook;
    Currency public constant ETH_CURRENCY = Currency.wrap(address(0));
    PoolKey public poolKey;                 // set once during initializePool

    bytes32 constant USER_TSLOT = keccak256("koth.user");

    enum SwapKind { Buy, Sell }

    error NotPoolManager();
    error InsufficientOutput();
    error PoolKeyAlreadySet();

    constructor(IPoolManager _poolManager, KOTHToken _koth, KingOfTheHillHook _hook) {
        poolManager = _poolManager;
        koth = _koth;
        hook = _hook;
    }

    bool public poolInitialized;

    function initializePool(PoolKey calldata key) external {
        if (poolInitialized) revert PoolKeyAlreadySet();
        poolKey = key;
        poolInitialized = true;
    }

    function buy(uint256 minKothOut) external payable returns (uint256 kothOut) {
        require(msg.value > 0, "Zero ETH");
        assembly { tstore(USER_TSLOT, caller()) }
        bytes memory result = poolManager.unlock(abi.encode(SwapKind.Buy, msg.sender, msg.value, minKothOut));
        assembly { tstore(USER_TSLOT, 0) }
        return abi.decode(result, (uint256));
    }

    function sell(uint256 kothIn, uint256 minEthOut) external returns (uint256 ethOut) {
        koth.transferFrom(msg.sender, address(this), kothIn);
        assembly { tstore(USER_TSLOT, caller()) }
        bytes memory result = poolManager.unlock(abi.encode(SwapKind.Sell, msg.sender, kothIn, minEthOut));
        assembly { tstore(USER_TSLOT, 0) }
        return abi.decode(result, (uint256));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        (SwapKind kind, address user, uint256 amountIn, uint256 minOut)
            = abi.decode(raw, (SwapKind, address, uint256, uint256));

        SwapParams memory params = kind == SwapKind.Buy
            ? SwapParams({zeroForOne: true,  amountSpecified: -int256(amountIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1})
            : SwapParams({zeroForOne: false, amountSpecified: -int256(amountIn), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1});

        BalanceDelta delta = poolManager.swap(poolKey, params, "");

        if (kind == SwapKind.Buy) {
            // settle ETH, take KOTH
            poolManager.sync(ETH_CURRENCY);
            poolManager.settle{value: amountIn}();
            uint256 kothOut = uint256(int256(delta.amount1()));
            if (kothOut < minOut) revert InsufficientOutput();
            poolManager.take(Currency.wrap(address(koth)), user, kothOut);
            return abi.encode(kothOut);
        } else {
            // settle KOTH (router holds it from earlier transferFrom), take ETH
            poolManager.sync(Currency.wrap(address(koth)));
            koth.transfer(address(poolManager), amountIn);
            poolManager.settle();
            uint256 ethOut = uint256(int256(delta.amount0()));
            if (ethOut < minOut) revert InsufficientOutput();
            poolManager.take(ETH_CURRENCY, user, ethOut);
            return abi.encode(ethOut);
        }
    }

    receive() external payable {}     // for sell ETH receipt
}
```

Only `exactInput` is supported. `exactOutput` is out of scope for v1.

Sells require prior `koth.approve(KOTHRouter, kothIn)` from the user — standard ERC-20 approval flow.

## 8. Chronicle NFTs

### 8.1 ChronicleSoul (soulbound)

```solidity
contract ChronicleSoul is ERC721 {
    address public immutable hook;
    mapping(uint256 => Reign) public reigns;

    error Soulbound();
    error OnlyHook();

    constructor(address _hook) ERC721("KOTH Chronicle Soul", "KOTH-SOUL") {
        hook = _hook;
    }

    function mintReign(address to, uint256 reignId, Reign memory data) external {
        if (msg.sender != hook) revert OnlyHook();
        reigns[reignId] = data;
        _safeMint(to, reignId);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();   // allow mint and burn, block transfer
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert Soulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert Soulbound(); }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return ChronicleRenderer.render(reigns[tokenId], "Soul");
    }
}
```

### 8.2 ChronicleScroll (transferable, ERC-2981)

```solidity
contract ChronicleScroll is ERC721, ERC2981 {
    address public immutable hook;
    address public immutable treasury;
    mapping(uint256 => Reign) public reigns;

    error OnlyHook();

    constructor(address _hook, address _treasury) ERC721("KOTH Chronicle Scroll", "KOTH-SCROLL") {
        hook = _hook;
        treasury = _treasury;
        _setDefaultRoyalty(_treasury, 500);    // 5%
    }

    function mintReign(address to, uint256 reignId, Reign memory data) external {
        if (msg.sender != hook) revert OnlyHook();
        reigns[reignId] = data;
        _safeMint(to, reignId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return ChronicleRenderer.render(reigns[tokenId], "Scroll");
    }

    function supportsInterface(bytes4 id) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(id);
    }
}
```

### 8.3 ChronicleRenderer (library)

Produces a `data:application/json;base64,...` URI containing on-chain JSON with all reign attributes plus a Base64-encoded SVG image (~1kB).

The SVG template is intentionally minimal: dark background, gold border for Soul / silver border for Scroll, crown emoji as a graphic anchor, text rows with king address (truncated), reign ID, blocks (start–end), ETH earned, record high, dethrone reason.

### 8.4 Shared `Reign` type

The `Reign` struct is referenced by `KingOfTheHillHook`, `ChronicleSoul`, `ChronicleScroll`, and `ChronicleRenderer`. It lives in its own file `src/Types.sol` and is imported by each of the four. This avoids duplication and ABI mismatch.

## 9. Deployment order

The hook's address must encode permission flags in its low bits, so deployment is multi-step:

```
1. Deploy KOTHToken with exemptions =
   [POOL_MANAGER, POSITION_MANAGER, deployer, precomputedRouter]
2. Use HookMiner to find a CREATE2 salt such that
   the resulting hook address has the required permission bits.
3. Deploy ChronicleSoul(precomputedHookAddress).
4. Deploy ChronicleScroll(precomputedHookAddress, treasury).
5. Deploy KingOfTheHillHook{salt}(
       poolManager, koth, soul, scroll, treasury,
       precomputedRouterAddress
   ).
   Verify deployed address == precomputed.
6. KOTHToken.setHook(hookAddress).
7. Deploy KOTHRouter at the precomputed address (CREATE2 with known salt).
8. PoolManager.initialize(poolKey).
   poolKey = (ETH=address(0), KOTH, fee=0, tickSpacing, hookAddress)
9. PositionManager.modifyLiquidity(...) with deployer's seed ETH + KOTH.
10. Write all addresses to deployments/mainnet.json.
```

PositionManager + Router exemption in KOTHToken is required because both addresses transiently hold large $KOTH amounts during liquidity operations and sells.

## 10. Tests

### 10.1 Unit tests (`test/KingOfTheHillHook.t.sol`)

| # | Test | Scenario | Expected |
|---|---|---|---|
| 1 | testCrownOnFirstBuy | First buy from empty throne | `currentKing == buyer`, record set |
| 2 | testNoCrownBelowThreshold | Buy < `getThreshold()` | `currentKing` unchanged |
| 3 | testNewKingAboveThreshold | Buy > `getThreshold()` | Crown moves, record updated |
| 4 | testEthFeeAccumulatesForKing | Other party swaps with king present | `kingBalances[king] += 2% ETH` |
| 5 | testEthFeeToTreasuryIfNoKing | Swap when `currentKing == 0` | `treasuryBalance += 2% ETH` |
| 6 | testKothBurnedOnSwap | Any swap | `koth.totalSupply()` decreased by 1% of $KOTH volume |
| 7 | testClaimByCurrentKing | Active king `claim()` | Receives ETH |
| 8 | testClaimByExKing | Ex-king `claim()` before 24h | Receives ETH |
| 9 | testClaimRevertsForNonKing | `claim()` from random address | Revert (NothingToClaim) |
| 10 | testClaimReentrancyGuard | Reentrant `claim()` via malicious wallet | Revert |
| 11 | testDumpProtection | King sells $KOTH through router | `currentKing == 0`, `dethronedAt[king] != 0`, NFTs minted |
| 12 | testDumpDoesNotForfeitBalance | After dump, kingBalances preserved | `kingBalances[oldKing]` non-zero, claimable |
| 13 | testDecayLinear | Roll 1800 blocks | `getDecayedRecord() ≈ 50% of highest` |
| 14 | testDecayThresholdAllowsSmallerBuy | Roll 1800 blocks, buy 0.6× original | New king |
| 15 | testDecayFullAfter3600Blocks | Roll 3600 blocks | `getDecayedRecord() == 0`; tiny buy → king |
| 16 | testForfeitBeforeDeadline | `forfeit()` before 7200 blocks | Revert (TooEarly) |
| 17 | testForfeitAfterDeadline | `forfeit()` after 7200 blocks | Balance zeroed, KOTH bought + burned, keeper got 0.5% tip |
| 18 | testForfeitInternalSwapDoesNotChangeKing | During forfeit-buyback | `currentKing` not changed, no NFT minted |
| 19 | testChroniclesMintedOnDethrone | Dethrone | Soul + Scroll minted to old king with correct Reign data |
| 20 | testSoulNonTransferable | `transferFrom` Soul | Revert |
| 21 | testSoulMintAllowed | Mint Soul via hook | OK |
| 22 | testScrollTransferable | Transfer Scroll | Successful |
| 23 | testScrollRoyalty | `royaltyInfo(id, 1 ether)` | `(treasury, 0.05 ether)` |
| 24 | testTokenURIRendersOnchain | Query tokenURI | Returns parseable Base64 JSON with image data URI |
| 25 | testAntiSniperBlocksLargeBuy | Buy > 1% supply in first 100 blocks | Revert (AntiSniperLimit) |
| 26 | testAntiSniperLifts | Buy > 1% after 100 blocks | OK |
| 27 | testPoolManagerExempt | LP adds liquidity in first 100 blocks | OK (PoolManager exempt) |
| 28 | testRouterExempt | Router accumulates KOTH during sell in first 100 blocks | OK (router exempt) |
| 29 | testNonRouterSwapBypassesGame | Swap via stock v4 router (no TSTORE) | Swap proceeds, crown unchanged, fees still routed (to treasury since msgSender==0 has no king) |
| 30 | testEventsEmitted | NewKing, KingDethroned, Claimed, Forfeited | All emitted with correct args |

### 10.2 Invariant tests

- `Decay.invariant.t.sol` — `getDecayedRecord() <= highestBuyAmount` always; monotonically non-increasing between blocks; equals 0 when `block >= highestBuyBlock + DECAY_BLOCKS`.
- `Fees.invariant.t.sol` — total ETH in `kingBalances` + `treasuryBalance` + ETH spent on forfeit-burns + keeper tips = total fee ETH the hook ever took from swaps.

### 10.3 Helpers

- `helpers/DeployFixture.sol` — common setUp deploying full stack on isolated PoolManager fork.
- `helpers/EvilWallet.sol` — mock contract that re-enters `claim()` for test #10.

## 11. Scripts

### 11.1 Deploy.s.sol

Reads env: `PRIVATE_KEY`, `TREASURY`, `POOL_MANAGER`, `POSITION_MANAGER`, `INIT_LIQUIDITY_ETH`, `INIT_LIQUIDITY_KOTH`. Executes the full deployment order from §9.

### 11.2 DeployLocal.s.sol

Same as Deploy.s.sol but deploys its own PoolManager and PositionManager for Anvil.

### 11.3 SimulateBattle.s.sol

Replays the plan's reference timeline:

```
Block 0      Deploy + seed liquidity
Block 1      Founder buys 2 ETH                                → currentKing == founder
Block 100    vm.roll past anti-sniper window
Block 500    Alice buys 2.07 ETH (vs threshold 2.06)           → currentKing == alice
Block 1000   Bob buys 0.5 ETH                                   → currentKing == alice (below threshold)
Block 2000   Log getDecayedRecord() (≈ 1.93 ETH)
Block 2100   Charlie buys 2.0 ETH (vs threshold ~1.99 after decay) → currentKing == charlie
Block 2101   Charlie sells 100 KOTH                             → currentKing == 0, dethronedAt[charlie] set
Block 2102   Dave buys 0.01 ETH                                 → currentKing == dave
Block 9302   vm.roll past 24h after Charlie's dethrone
             keeper calls forfeit(charlie)                      → kingBalances[charlie] == 0,
                                                                   keeper got 0.5% tip,
                                                                   KOTH supply decreased
```

Each step asserts state and prints a console line.

## 12. Foundry config

```toml
[profile.default]
solc            = "0.8.26"
optimizer       = true
optimizer_runs  = 800
evm_version     = "cancun"
via_ir          = true
fuzz            = { runs = 256 }
invariant       = { runs = 64, depth = 32 }
```

## 13. External dependencies

```
v4-core              pinned to deployed-on-mainnet commit
v4-periphery         BaseHook, HookMiner, PositionManager
openzeppelin v5.x    ERC20Burnable, ERC721, ERC2981, ReentrancyGuard
forge-std            latest
```

## 14. Out of scope for Phase 1

- Frontend / DApp (Phase 2)
- Mainnet deploy + audit (Phase 3)
- exactOutput swaps in router (only exactInput supported)
- Aggregator support (only KOTHRouter supports king mechanics)
- Multi-pool / multi-fee-tier deployments (single pool only)
- Upgradability / proxy pattern (immutable deployment)
- Governance (treasury is a single configurable address)

## 15. Known risks and mitigations

| Risk | Mitigation |
|---|---|
| Hook returns wrong delta math, swap reverts | Comprehensive tests on each swap kind, fuzz on amounts |
| Router/PoolManager/PositionManager addresses change after token deployment | Exemption list set in constructor; if changed, redeploy token |
| Forfeit buyback front-running (sandwich) | Capped per-call by single king's balance; rare event |
| Reentrancy via king's `receive()` during claim | `nonReentrant` modifier; pull payment pattern |
| HookMiner CREATE2 salt search slow | Cache salts in script; mining is one-time per deploy |
| User skips KOTHRouter and swaps via stock v4 router | Swap succeeds but bypasses king mechanics; documented intentional behavior |
| Price manipulation just before forfeit to tank KOTH burn | Acceptable — burn amount is small relative to liquidity, no protocol funds lost |
