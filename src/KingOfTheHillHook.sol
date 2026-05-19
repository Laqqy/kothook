// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";

import {KOTHToken} from "./KOTHToken.sol";
import {ChronicleSoul} from "./ChronicleSoul.sol";
import {ChronicleScroll} from "./ChronicleScroll.sol";
import {Reign, REASON_OVERTHROWN, REASON_DUMP, REASON_FORFEIT} from "./Types.sol";

contract KingOfTheHillHook is IHooks, ReentrancyGuard, IUnlockCallback {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    // ============ Constants ============
    uint256 public constant DECAY_BLOCKS    = 3600;
    uint256 public constant KING_FEE_BPS    = 200;     // 2%
    uint256 public constant BURN_FEE_BPS    = 100;     // 1%
    uint256 public constant THRESHOLD_BPS   = 10300;   // 1.03×
    uint256 public constant FORFEIT_BLOCKS  = 3600;    // ~12h at 12s/block
    uint256 public constant KEEPER_TIP_BPS  = 300;     // 3%
    uint256 public constant MIN_FORFEIT_AMOUNT = 0.001 ether;
    /// @dev Max in-swap deviation for the forfeit buyback (50 bps on sqrtPrice ≈ 1% on price).
    uint256 public constant FORFEIT_SLIP_BPS = 50;

    bytes32 internal constant INTERNAL_BURN_TSLOT = keccak256("koth.internalBurn");

    // ============ Immutables ============
    IPoolManager   public immutable poolManager;
    KOTHToken      public immutable koth;
    ChronicleSoul  public immutable soul;
    ChronicleScroll public immutable scroll;
    address        public immutable treasury;
    address        public immutable router;
    /// @notice Privileged address for the two one-shot init calls
    /// (`initializePoolKey`, `seedRecord`). Zeroed via `renounceAdmin` at the
    /// end of the deploy script so scanner heuristics (GoPlus etc.) don't
    /// flag a live owner.
    address        public admin;

    // ============ State ============
    PoolKey     public poolKey;
    bool        public poolKeySet;

    address public currentKing;
    uint256 public highestBuyAmount;
    uint256 public highestBuyBlock;
    uint256 public reignsCount;

    mapping(address => uint256) public kingBalances;
    mapping(address => uint256) public dethronedAt;
    uint256 public treasuryBalance;

    // ============ Errors ============
    error PoolKeyAlreadySet();
    error NothingToClaim();
    error NotDethroned();
    error TooEarly();
    error NothingToForfeit();
    error TransferFailed();
    error OnlyTreasury();
    error OnlyRouter();
    error OnlyPoolManager();
    error OnlyAdmin();
    error InvalidPoolKey();
    error SlippageExceeded();

    // ============ Events ============
    event NewKing(address indexed king, uint256 amount, uint256 blockNumber);
    event KingDethroned(address indexed king, bytes32 reason, uint256 totalEarned);
    event Claimed(address indexed king, uint256 amount);
    event TreasuryClaimed(uint256 amount);
    event Forfeited(address indexed king, uint256 totalAmount, uint256 keeperTip, uint256 kothBurned);
    event AdminRenounced();

    constructor(
        IPoolManager _manager,
        KOTHToken _koth,
        ChronicleSoul _soul,
        ChronicleScroll _scroll,
        address _treasury,
        address _router,
        address _admin
    ) {
        poolManager = _manager;
        koth = _koth;
        soul = _soul;
        scroll = _scroll;
        treasury = _treasury;
        router = _router;
        admin = _admin;
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize:        false,
            afterInitialize:         false,
            beforeAddLiquidity:      false,
            afterAddLiquidity:       false,
            beforeRemoveLiquidity:   false,
            afterRemoveLiquidity:    false,
            beforeSwap:              true,
            afterSwap:               true,
            beforeDonate:            false,
            afterDonate:             false,
            beforeSwapReturnDelta:   true,
            afterSwapReturnDelta:    true,
            afterAddLiquidityReturnDelta:    false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function initializePoolKey(PoolKey calldata key) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (poolKeySet) revert PoolKeyAlreadySet();
        if (Currency.unwrap(key.currency0) != address(0)) revert InvalidPoolKey();
        if (Currency.unwrap(key.currency1) != address(koth)) revert InvalidPoolKey();
        if (address(key.hooks) != address(this)) revert InvalidPoolKey();
        poolKey = key;
        poolKeySet = true;
    }

    // ============ Decay views ============

    /// @notice Linearly-decayed record. Reaches zero exactly DECAY_BLOCKS after the high.
    function getDecayedRecord() public view returns (uint256) {
        if (highestBuyAmount == 0) return 0;
        uint256 elapsed = block.number - highestBuyBlock;
        if (elapsed >= DECAY_BLOCKS) return 0;
        return highestBuyAmount * (DECAY_BLOCKS - elapsed) / DECAY_BLOCKS;
    }

    /// @notice The amount a buyer must exceed (in ETH) to dethrone the current king.
    function getThreshold() public view returns (uint256) {
        return getDecayedRecord() * THRESHOLD_BPS / 10_000;
    }

    // ============ One-shot init seeder ============

    /// @notice Seeds (highestBuyAmount, highestBuyBlock) for testing/init purposes.
    ///         Admin-only and one-shot. Deploy script calls this with (0,0) immediately
    ///         after deploy to permanently lock it out; defaults are already zero so
    ///         this just flips _seedDone. Front-runs were possible in the prior version;
    ///         the admin gate now blocks them.
    bool internal _seedDone;
    error AlreadySeeded();

    function seedRecord(uint256 amount, uint256 atBlock) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (_seedDone) revert AlreadySeeded();
        _seedDone = true;
        highestBuyAmount = amount;
        highestBuyBlock = atBlock;
    }

    /// @notice Permanently zero the `admin` slot. After this, neither
    /// `initializePoolKey` nor `seedRecord` can be called again (both revert
    /// on `msg.sender != admin` with admin = 0x0). Deploy script calls this
    /// directly after both one-shot inits succeed.
    function renounceAdmin() external {
        if (msg.sender != admin) revert OnlyAdmin();
        admin = address(0);
        emit AdminRenounced();
    }

    // ============ IHooks implementation (stubs — logic added in later tasks) ============

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4, BeforeSwapDelta, uint24) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();

        // Skip game logic during internal forfeit-burn swaps
        uint256 isInternal;
        bytes32 burnSlot = INTERNAL_BURN_TSLOT;
        assembly { isInternal := tload(burnSlot) }
        if (isInternal != 0) return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);

        // Only support exactInput in v1
        if (params.amountSpecified >= 0) {
            return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        address msgSender = _identifyUser(sender, hookData);

        bool isBuy = params.zeroForOne;
        uint256 specifiedAmt = uint256(-params.amountSpecified);

        // Sell + king dumping → dethrone immediately (before fees so fee credits new state)
        if (!isBuy && msgSender != address(0) && msgSender == currentKing) {
            _dethroneFor(msgSender, REASON_DUMP);
        }

        // Take fee from the specified currency
        // Buy: ETH (currency0) → 2% to king/treasury
        // Sell: KOTH (currency1) → 1% burned
        uint256 fee;
        if (isBuy) {
            fee = specifiedAmt * KING_FEE_BPS / 10_000;
            if (fee > 0) {
                poolManager.take(key.currency0, address(this), fee);
                _creditEth(fee);
            }
        } else {
            fee = specifiedAmt * BURN_FEE_BPS / 10_000;
            if (fee > 0) {
                poolManager.take(key.currency1, address(this), fee);
                koth.burnFromHook(fee);
            }
        }

        BeforeSwapDelta delta = toBeforeSwapDelta(int128(int256(fee)), 0);
        return (IHooks.beforeSwap.selector, delta, 0);
    }

    function _creditEth(uint256 amount) internal {
        if (currentKing != address(0)) {
            kingBalances[currentKing] += amount;
        } else {
            treasuryBalance += amount;
        }
    }

    /// @dev Hybrid EOA identification:
    ///      1. Swap via our trusted KOTHRouter with hookData → use hookData address
    ///         (smart-wallet friendly; signed by the router we control)
    ///      2. Any other router (Universal Router, 1inch, MetaMask Swap, gmgn, axiom)
    ///         → fall back to tx.origin so the trader on the other end still plays.
    ///      tx.origin caveat: smart-contract wallets going through third-party routers
    ///      will have tx.origin = bundler/relayer, so the crown goes to the bundler.
    ///      Smart-wallet users should swap via our KOTHRouter for correct attribution.
    function _identifyUser(address sender, bytes calldata hookData) internal view returns (address) {
        if (sender == router && hookData.length == 32) {
            return abi.decode(hookData, (address));
        }
        return tx.origin;
    }

    // ============ Pull payment ============

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

    // ============ Forfeit ============

    /// @notice Reclaim a stale king's coffer: 3% keeper tip, 97% buyback-and-burn.
    /// @param staleKing The dethroned king whose 12h reclaim window has passed.
    /// @param minKothOut Min KOTH the keeper expects the buyback to receive. 0 disables.
    ///        On top of this, an in-swap sqrtPriceLimit caps single-tx price impact
    ///        (FORFEIT_SLIP_BPS); unused ETH (if the cap clamped the swap) is credited
    ///        to treasury so accounting stays consistent.
    function forfeit(address staleKing, uint256 minKothOut) external nonReentrant {
        uint256 dethronedAtBlock = dethronedAt[staleKing];
        if (dethronedAtBlock == 0) revert NotDethroned();
        if (block.number <= dethronedAtBlock + FORFEIT_BLOCKS) revert TooEarly();

        uint256 amount = kingBalances[staleKing];
        if (amount == 0) revert NothingToForfeit();

        kingBalances[staleKing] = 0;
        dethronedAt[staleKing] = 0;

        // Dust path: amounts too small for a meaningful buyback go entirely to the keeper.
        // This prevents 1-wei coffers from getting stuck (the swap would round to 0 KOTH out).
        if (amount < MIN_FORFEIT_AMOUNT) {
            (bool okDust,) = msg.sender.call{value: amount}("");
            if (!okDust) revert TransferFailed();
            emit Forfeited(staleKing, amount, amount, 0);
            return;
        }

        uint256 tip = amount * KEEPER_TIP_BPS / 10_000;
        uint256 toBurn = amount - tip;

        // Buyback FIRST, then pay the keeper. Paying the tip before the buyback would
        // let a malicious keeper run arbitrary code in their `receive()` — including a
        // fresh `poolManager.unlock()` cycle that shifts the price — and our buyback
        // would then read the manipulated `sqrtPriceX96` and execute at a worse rate.
        // By paying last we close the intra-tx sandwich window. Pre-tx mempool sandwich
        // is still bounded by FORFEIT_SLIP_BPS + the keeper-supplied minKothOut.
        bytes32 burnSlot = INTERNAL_BURN_TSLOT;
        assembly { tstore(burnSlot, 1) }
        (uint256 kothBought, uint256 ethSpent) = abi.decode(
            poolManager.unlock(abi.encode(toBurn, minKothOut)),
            (uint256, uint256)
        );
        assembly { tstore(burnSlot, 0) }

        if (kothBought > 0) koth.burnFromHook(kothBought);

        // If the sqrtPriceLimit clamped the swap, the remainder is owed back to the
        // protocol. Sweep it to treasury so address(this).balance stays accounted-for.
        if (ethSpent < toBurn) {
            treasuryBalance += (toBurn - ethSpent);
        }

        (bool ok,) = msg.sender.call{value: tip}("");
        if (!ok) revert TransferFailed();

        emit Forfeited(staleKing, amount, tip, kothBought);
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        (uint256 ethAmount, uint256 minKothOut) = abi.decode(raw, (uint256, uint256));

        // Cap in-swap price movement to ~1% (FORFEIT_SLIP_BPS on sqrtPrice).
        // If a keeper sandwich pre-moved the price, this still bounds the *additional*
        // damage during the buyback; unused ETH is returned via partial fill.
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
        uint160 limit = uint160(uint256(sqrtPriceX96) * (10_000 - FORFEIT_SLIP_BPS) / 10_000);
        if (limit <= TickMath.MIN_SQRT_PRICE) limit = TickMath.MIN_SQRT_PRICE + 1;

        BalanceDelta delta = poolManager.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(ethAmount),
                sqrtPriceLimitX96: limit
            }),
            ""   // empty hookData → not a router swap
        );

        // For exact-input zeroForOne:
        //   delta.amount0 ≤ 0 (we owe ETH; |a0| ≤ ethAmount if clamped)
        //   delta.amount1 ≥ 0 (manager owes us KOTH)
        int128 a0 = delta.amount0();
        int128 a1 = delta.amount1();
        uint256 ethSpent = a0 < 0 ? uint256(uint128(-a0)) : 0;
        uint256 kothOut = a1 > 0 ? uint256(uint128(a1)) : 0;

        if (kothOut < minKothOut) revert SlippageExceeded();

        if (ethSpent > 0) poolManager.settle{value: ethSpent}();
        if (kothOut > 0) poolManager.take(poolKey.currency1, address(this), kothOut);

        return abi.encode(kothOut, ethSpent);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4, int128) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();

        // Skip game logic during internal forfeit-burn swaps
        uint256 isInternal;
        bytes32 burnSlot = INTERNAL_BURN_TSLOT;
        assembly { isInternal := tload(burnSlot) }
        if (isInternal != 0) return (IHooks.afterSwap.selector, 0);

        // Only support exactInput
        if (params.amountSpecified >= 0) return (IHooks.afterSwap.selector, 0);

        bool isBuy = params.zeroForOne;
        // Take unspecified-side fee:
        //   Buy: 1% KOTH (currency1) → burn
        //   Sell: 2% ETH (currency0) → king/treasury
        int128 unspecifiedAmt = isBuy ? delta.amount1() : delta.amount0();
        uint256 unspecifiedFee = 0;
        if (unspecifiedAmt > 0) {
            uint256 grossOut = uint256(uint128(unspecifiedAmt));
            if (isBuy) {
                unspecifiedFee = grossOut * BURN_FEE_BPS / 10_000;
                if (unspecifiedFee > 0) {
                    poolManager.take(key.currency1, address(this), unspecifiedFee);
                    koth.burnFromHook(unspecifiedFee);
                }
            } else {
                unspecifiedFee = grossOut * KING_FEE_BPS / 10_000;
                if (unspecifiedFee > 0) {
                    poolManager.take(key.currency0, address(this), unspecifiedFee);
                    _creditEth(unspecifiedFee);
                }
            }
        }

        // King-crowning logic (only on buys; works for any router via _identifyUser)
        if (isBuy) {
            address msgSender = _identifyUser(sender, hookData);
            if (msgSender != address(0)) {
                // grossEth = |amountSpecified|. Threshold compares against gross.
                uint256 grossEth = uint256(-params.amountSpecified);
                if (grossEth > getThreshold()) {
                    address oldKing = currentKing;
                    if (oldKing != address(0)) {
                        _dethroneFor(oldKing, REASON_OVERTHROWN);
                    }
                    currentKing = msgSender;
                    highestBuyAmount = grossEth;
                    highestBuyBlock = block.number;
                    dethronedAt[msgSender] = 0;
                    emit NewKing(msgSender, grossEth, block.number);
                }
            }
        }

        return (IHooks.afterSwap.selector, int128(int256(unspecifiedFee)));
    }

    function _dethroneFor(address oldKing, bytes32 reason) internal {
        uint256 reignId = reignsCount;
        Reign memory data = Reign({
            king: oldKing,
            reignId: reignId,
            startBlock: highestBuyBlock,
            endBlock: block.number,
            ethEarned: kingBalances[oldKing],
            recordHigh: highestBuyAmount,
            dethroneReason: reason
        });

        // State writes BEFORE external calls (CEI). Also: if either mint reverts
        // (e.g. king is a contract that rejects ERC721 callbacks), dethrone must still
        // succeed — otherwise an attacker contract crowns itself and becomes permanent
        // king by refusing the Soul/Scroll mints.
        currentKing = address(0);
        dethronedAt[oldKing] = block.number;
        highestBuyAmount = 0;
        highestBuyBlock = 0;
        reignsCount = reignId + 1;

        emit KingDethroned(oldKing, reason, data.ethEarned);

        try soul.mintReign(oldKing, reignId, data) {} catch {}
        try scroll.mintReign(oldKing, reignId, data) {} catch {}
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IHooks.afterDonate.selector;
    }

    receive() external payable {}
}
