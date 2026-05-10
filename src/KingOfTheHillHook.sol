// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";

import {KOTHToken} from "./KOTHToken.sol";
import {ChronicleSoul} from "./ChronicleSoul.sol";
import {ChronicleScroll} from "./ChronicleScroll.sol";
import {Reign, REASON_OVERTHROWN, REASON_DUMP} from "./Types.sol";

contract KingOfTheHillHook is IHooks {
    // ============ Constants ============
    uint256 public constant DECAY_BLOCKS    = 3600;
    uint256 public constant KING_FEE_BPS    = 200;     // 2%
    uint256 public constant BURN_FEE_BPS    = 100;     // 1%
    uint256 public constant THRESHOLD_BPS   = 10300;   // 1.03×
    uint256 public constant FORFEIT_BLOCKS  = 7200;
    uint256 public constant KEEPER_TIP_BPS  = 50;      // 0.5%

    bytes32 internal constant USER_TSLOT          = keccak256("koth.user");
    bytes32 internal constant INTERNAL_BURN_TSLOT = keccak256("koth.internalBurn");

    // ============ Immutables ============
    IPoolManager   public immutable poolManager;
    KOTHToken      public immutable koth;
    ChronicleSoul  public immutable soul;
    ChronicleScroll public immutable scroll;
    address        public immutable treasury;
    address        public immutable router;

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

    // ============ Events ============
    event NewKing(address indexed king, uint256 amount, uint256 blockNumber);
    event KingDethroned(address indexed king, bytes32 reason, uint256 totalEarned);
    event Claimed(address indexed king, uint256 amount);
    event TreasuryClaimed(uint256 amount);
    event Forfeited(address indexed king, uint256 totalAmount, uint256 keeperTip, uint256 kothBurned);

    constructor(
        IPoolManager _manager,
        KOTHToken _koth,
        ChronicleSoul _soul,
        ChronicleScroll _scroll,
        address _treasury,
        address _router
    ) {
        poolManager = _manager;
        koth = _koth;
        soul = _soul;
        scroll = _scroll;
        treasury = _treasury;
        router = _router;
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
        if (poolKeySet) revert PoolKeyAlreadySet();
        poolKey = key;
        poolKeySet = true;
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
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external pure returns (bytes4, BeforeSwapDelta, uint24) {
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, int128) {
        return (IHooks.afterSwap.selector, 0);
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
