// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";

import {KOTHToken} from "./KOTHToken.sol";
import {KingOfTheHillHook} from "./KingOfTheHillHook.sol";

/// @notice Router that writes the EOA into transient storage before each swap so the
///         KingOfTheHillHook can identify the real swapper via TLOAD.
contract KOTHRouter is IUnlockCallback {
    IPoolManager public immutable poolManager;
    KOTHToken public immutable koth;
    KingOfTheHillHook public immutable hook;

    PoolKey public poolKey;
    bool public poolInitialized;

    /// @dev Slot used by both the router (TSTORE) and the hook (TLOAD) to pass the user address.
    bytes32 internal constant USER_TSLOT = keccak256("koth.user");

    enum SwapKind { Buy, Sell }

    error NotPoolManager();
    error InsufficientOutput();
    error PoolKeyAlreadySet();
    error ZeroAmount();

    constructor(IPoolManager _poolManager, KOTHToken _koth, KingOfTheHillHook _hook) {
        poolManager = _poolManager;
        koth = _koth;
        hook = _hook;
    }

    /// @notice One-time registration of the pool key for this router.
    function initializePool(PoolKey calldata key) external {
        if (poolInitialized) revert PoolKeyAlreadySet();
        poolKey = key;
        poolInitialized = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public swap entry-points
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Buy KOTH with ETH.
    /// @param minKothOut Minimum KOTH tokens the caller is willing to receive.
    function buy(uint256 minKothOut) external payable returns (uint256 kothOut) {
        if (msg.value == 0) revert ZeroAmount();

        // Write caller into transient storage so the hook can read it.
        bytes32 slot = USER_TSLOT;
        address sender = msg.sender;
        assembly { tstore(slot, sender) }

        bytes memory result = poolManager.unlock(
            abi.encode(SwapKind.Buy, msg.sender, msg.value, minKothOut)
        );

        // Clear transient slot after the unlock returns.
        assembly { tstore(slot, 0) }

        return abi.decode(result, (uint256));
    }

    /// @notice Sell KOTH for ETH.
    /// @param kothIn   Amount of KOTH tokens to sell (must be pre-approved).
    /// @param minEthOut Minimum ETH the caller is willing to receive.
    function sell(uint256 kothIn, uint256 minEthOut) external returns (uint256 ethOut) {
        if (kothIn == 0) revert ZeroAmount();
        koth.transferFrom(msg.sender, address(this), kothIn);

        bytes32 slot = USER_TSLOT;
        address sender = msg.sender;
        assembly { tstore(slot, sender) }

        bytes memory result = poolManager.unlock(
            abi.encode(SwapKind.Sell, msg.sender, kothIn, minEthOut)
        );

        assembly { tstore(slot, 0) }

        return abi.decode(result, (uint256));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // IUnlockCallback
    // ─────────────────────────────────────────────────────────────────────────

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (SwapKind kind, address user, uint256 amountIn, uint256 minOut) =
            abi.decode(raw, (SwapKind, address, uint256, uint256));

        // Buy  → zeroForOne (ETH → KOTH), Sell → oneForZero (KOTH → ETH)
        bool zeroForOne = kind == SwapKind.Buy;
        uint160 limit = zeroForOne
            ? TickMath.MIN_SQRT_PRICE + 1
            : TickMath.MAX_SQRT_PRICE - 1;

        BalanceDelta delta = poolManager.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn), // exact-input
                sqrtPriceLimitX96: limit
            }),
            ""
        );

        if (kind == SwapKind.Buy) {
            // currency0 = ETH (native): settle with value, take KOTH out
            poolManager.settle{value: amountIn}();

            // amount1 is negative (tokens leaving the pool → coming to us); negate to get positive
            uint256 kothOut = uint256(uint128(-delta.amount1()));
            if (kothOut < minOut) revert InsufficientOutput();
            poolManager.take(poolKey.currency1, user, kothOut);
            return abi.encode(kothOut);
        } else {
            // currency1 = KOTH (ERC-20): sync then transfer tokens in, take ETH out
            poolManager.sync(poolKey.currency1);
            koth.transfer(address(poolManager), amountIn);
            poolManager.settle();

            // amount0 is negative (ETH leaving the pool → coming to us); negate
            uint256 ethOut = uint256(uint128(-delta.amount0()));
            if (ethOut < minOut) revert InsufficientOutput();
            poolManager.take(poolKey.currency0, user, ethOut);
            return abi.encode(ethOut);
        }
    }

    receive() external payable {}
}
