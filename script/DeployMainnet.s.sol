// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

import {HookMiner} from "./HookMiner.sol";
import {IERC20Minimal} from "v4-core/src/interfaces/external/IERC20Minimal.sol";

/// @notice Deploys the full KOTH stack to Ethereum **MAINNET** using the
///         canonical Uniswap v4 PositionManager for liquidity. The deployer
///         receives an ERC-721 LP NFT representing the seeded position; only
///         the NFT owner can decrease / burn the position. This mirrors how
///         Uniswap's own UI seeds liquidity — and removes the shared-position
///         vulnerability that PoolModifyLiquidityTest has.
///
///         ⚠️  THIS IS REAL MONEY.
///         Use a hardware wallet for the actual broadcast. The PRIVATE_KEY env
///         path is for forks and tests only.
///
/// Required env:
///     TREASURY   address   Cold-wallet / multisig that owns protocol fees.
/// Optional env:
///     SEED_ETH   uint      ETH (wei) added to seed liquidity. Default 1.05 ETH.
///     LIQUIDITY  uint      Uniswap-v4 `liquidity` value. Default 1e21
///                          → ~1 ETH + 1M KOTH full-range at sqrtP = 1000.
///
/// Usage (Ledger):
///     forge script script/DeployMainnet.s.sol \
///         --rpc-url $MAINNET_RPC \
///         --ledger --sender 0x<deployer> \
///         --broadcast --slow
contract DeployMainnet is Script {
    /// @dev Canonical Uniswap v4 PoolManager on Ethereum mainnet.
    address internal constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    /// @dev Canonical Uniswap v4 PositionManager (ERC-721 LP). Verified on
    ///      mainnet — name() = "Uniswap v4 Positions NFT".
    address internal constant MAINNET_POSITION_MANAGER = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
    /// @dev Universal Permit2 — same address on every chain.
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    /// @dev Arachnid's deterministic CREATE2 factory.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant HOOK_FLAGS = 0x00CC;
    /// @dev 1 ETH = 1,000,000 KOTH at launch.
    uint160 internal constant INITIAL_SQRT_PRICE_X96 = 79228162514264337593543950336000;
    int24   internal constant TICK_LOWER = -887220;
    int24   internal constant TICK_UPPER =  887220;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    /// @dev Max-permissive Permit2 expiration (~8.9M years).
    uint48 internal constant PERMIT2_EXPIRATION = type(uint48).max;
    /// @dev Mint deadline buffer — 10 minutes from script start.
    uint256 internal constant MINT_DEADLINE_BUFFER = 600;

    struct Deployment {
        address poolManager;
        address positionManager;
        address koth;
        address soul;
        address scroll;
        address hook;
        address kothRouter;
        address treasury;
        uint256 lpTokenId;   // ERC-721 token id of the minted LP position
    }

    function run() external returns (Deployment memory d) {
        require(block.chainid == MAINNET_CHAIN_ID, "Not mainnet - refusing");
        require(MAINNET_POOL_MANAGER.code.length > 0, "PoolManager missing");
        require(MAINNET_POSITION_MANAGER.code.length > 0, "PositionManager missing");
        require(PERMIT2.code.length > 0, "Permit2 missing");

        // Resolve deployer (PRIVATE_KEY for fork/test, msg.sender for --ledger).
        uint256 pkEnv = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pkEnv != 0 ? vm.addr(pkEnv) : msg.sender;
        require(deployer != address(0), "Deployer unresolved");

        address treasury = vm.envOr("TREASURY", deployer);
        if (treasury == deployer) {
            console.log(unicode"⚠️  TREASURY = deployer. Single key controls all fees.");
        }

        uint256 seedEth = vm.envOr("SEED_ETH", uint256(1.05 ether));
        uint256 liquidity = vm.envOr("LIQUIDITY", uint256(1e21));

        require(
            deployer.balance >= seedEth + 0.05 ether,
            "Deployer ETH insufficient for seed + gas headroom (need >=1.10 ETH)"
        );

        IPoolManager manager = IPoolManager(MAINNET_POOL_MANAGER);
        d.poolManager = MAINNET_POOL_MANAGER;
        d.positionManager = MAINNET_POSITION_MANAGER;
        d.treasury = treasury;

        console.log("=== KOTH Mainnet Deploy (PositionManager) ===");
        console.log("Deployer  :", deployer);
        console.log("Treasury  :", treasury);
        console.log("SEED_ETH  :", seedEth);
        console.log("LIQUIDITY :", liquidity);

        // ─── Predict CREATE addresses ──────────────────────────────────────
        // Order: KOTHToken (n+0) → CREATE2 hook (consumes n+1) → Soul (n+2)
        //        → Scroll (n+3) → KOTHRouter (n+4).
        uint64 nonce = vm.getNonce(deployer);
        address predictedKoth        = vm.computeCreateAddress(deployer, nonce + 0);
        address predictedSoul        = vm.computeCreateAddress(deployer, nonce + 2);
        address predictedScroll      = vm.computeCreateAddress(deployer, nonce + 3);
        address predictedKothRouter  = vm.computeCreateAddress(deployer, nonce + 4);

        // ─── Mine CREATE2 hook salt ────────────────────────────────────────
        bytes memory hookCreationCode = type(KingOfTheHillHook).creationCode;
        bytes memory hookCtorArgs = abi.encode(
            manager,
            KOTHToken(predictedKoth),
            ChronicleSoul(predictedSoul),
            ChronicleScroll(predictedScroll),
            treasury,
            predictedKothRouter,
            deployer
        );
        (address minedHook, bytes32 hookSalt) = HookMiner.find(HOOK_FLAGS, hookCreationCode, hookCtorArgs);
        console.log("[mine] hook addr :", minedHook);
        console.log("[mine] hook salt :", uint256(hookSalt));

        if (pkEnv != 0) vm.startBroadcast(pkEnv);
        else            vm.startBroadcast();

        // 1. KOTHToken
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        exemptions[1] = MAINNET_POSITION_MANAGER;
        KOTHToken koth = new KOTHToken(exemptions);
        require(address(koth) == predictedKoth, "koth nonce drift");
        d.koth = address(koth);

        // 2. Hook via CREATE2
        bytes memory initCode = bytes.concat(hookCreationCode, hookCtorArgs);
        (bool ok, bytes memory ret) = CREATE2_DEPLOYER.call(bytes.concat(hookSalt, initCode));
        require(ok, "CREATE2 hook deploy failed");
        address deployedHook;
        if (ret.length >= 20) {
            assembly { deployedHook := mload(add(ret, 20)) }
        } else {
            deployedHook = minedHook;
        }
        require(deployedHook == minedHook, "hook addr mismatch");
        require(minedHook.code.length > 0, "hook code missing");
        d.hook = minedHook;

        // 3. Soul / Scroll / KOTHRouter
        ChronicleSoul soul = new ChronicleSoul(minedHook);
        require(address(soul) == predictedSoul, "soul nonce drift");
        d.soul = address(soul);

        ChronicleScroll scroll = new ChronicleScroll(minedHook, treasury);
        require(address(scroll) == predictedScroll, "scroll nonce drift");
        d.scroll = address(scroll);

        KOTHRouter kothRouter = new KOTHRouter(manager, koth, KingOfTheHillHook(payable(minedHook)));
        require(address(kothRouter) == predictedKothRouter, "kothRouter nonce drift");
        d.kothRouter = address(kothRouter);

        // 4. Bind
        koth.setHook(minedHook);
        KingOfTheHillHook hook = KingOfTheHillHook(payable(minedHook));
        hook.seedRecord(0, 0);

        Currency cEth = Currency.wrap(address(0));
        Currency cKoth = Currency.wrap(address(koth));
        PoolKey memory pk_ = PoolKey({
            currency0: cEth,
            currency1: cKoth,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(minedHook)
        });
        hook.initializePoolKey(pk_);
        kothRouter.initializePool(pk_);

        // 5. Initialize pool directly
        manager.initialize(pk_, INITIAL_SQRT_PRICE_X96);

        // 6. Permit2 dance — KOTH → Permit2 → PositionManager
        IERC20Minimal(address(koth)).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(
            address(koth),
            MAINNET_POSITION_MANAGER,
            type(uint160).max,
            PERMIT2_EXPIRATION
        );

        // 7. Mint LP NFT via PositionManager.
        // We cannot pre-read tokenId reliably — PositionManager is a shared
        // contract and other users may mint between our broadcast txs (the
        // simulation read can be stale by mint time). We log the "expected"
        // value from current state, but the authoritative tokenId is the one
        // emitted in the ERC721 Transfer event of the modifyLiquidities tx.
        // After deploy, find it via:
        //   cast logs --rpc-url $RPC --from-block <deployBlock> \
        //     --address 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e \
        //     --topic-1 $(cast hash "Transfer(address,address,uint256)") \
        //     --topic-3 $(cast 2u 0x<deployer>)
        // Or simpler: cast call posm "balanceOf(address)" $deployer → should be 1
        uint256 tokenId = IPositionManager(MAINNET_POSITION_MANAGER).nextTokenId();
        d.lpTokenId = tokenId;

        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            pk_,
            TICK_LOWER,
            TICK_UPPER,
            liquidity,
            type(uint128).max,   // amount0Max — pool is empty, no slippage risk
            type(uint128).max,   // amount1Max
            deployer,            // NFT recipient
            bytes("")
        );
        params[1] = abi.encode(cEth, cKoth);

        IPositionManager(MAINNET_POSITION_MANAGER).modifyLiquidities{value: seedEth}(
            abi.encode(actions, params),
            block.timestamp + MINT_DEADLINE_BUFFER
        );

        // 8. Renounce admin on all three contracts. After this every
        //    privileged init function reverts (OnlyAdmin, admin = 0x0).
        //    GoPlus / De.Fi / Honeypot.is read these slots and downgrade
        //    tokens with a live owner — zeroing them maximises trust scores.
        koth.renounceAdmin();
        hook.renounceAdmin();
        kothRouter.renounceAdmin();

        vm.stopBroadcast();

        console.log("=== KOTH Mainnet Deployment Complete ===");
        console.log("PoolManager      :", d.poolManager);
        console.log("PositionManager  :", d.positionManager);
        console.log("KOTHToken        :", d.koth);
        console.log("ChronicleSoul    :", d.soul);
        console.log("ChronicleScroll  :", d.scroll);
        console.log("KingOfTheHillHook:", d.hook);
        console.log("KOTHRouter       :", d.kothRouter);
        console.log("Treasury         :", d.treasury);
        console.log("LP NFT tokenId   :", d.lpTokenId, "(MAY BE STALE - see below)");
        console.log("");
        console.log("IMPORTANT: tokenId above is read at simulation time. If anyone");
        console.log("else minted via PositionManager between our simulation and");
        console.log("broadcast, the ACTUAL tokenId is higher. Find the real one:");
        console.log("  cast logs --rpc-url $RPC --from-block <deploy_block> ");
        console.log("    --address 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e ");
        console.log("    --topic-2 0x0000000000000000000000000000000000000000000000000000000000000000 ");
        console.log("  (Filter where topic-3 = deployer address-padded.)");
        console.log("Or just check that balanceOf(deployer) returned 1 NFT:");
        console.log("  cast call <posm> 'balanceOf(address)(uint256)' <deployer>");
    }
}
