// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {KOTHToken} from "src/KOTHToken.sol";
import {KingOfTheHillHook} from "src/KingOfTheHillHook.sol";
import {KOTHRouter} from "src/KOTHRouter.sol";
import {ChronicleSoul} from "src/ChronicleSoul.sol";
import {ChronicleScroll} from "src/ChronicleScroll.sol";

import {HookMiner} from "./HookMiner.sol";

/// @notice **Phase 1** of the KOTH mainnet rollout: deploys all five contracts,
///         performs the admin-only inits, and burns admin on every contract.
///         **No Uniswap pool exists yet, no liquidity, no king.** This lets
///         marketing run while the contracts are already verifiable on
///         Etherscan and scoring "Safe" on GoPlus / Honeypot.is.
///
///         When ready to go live, run `script/LaunchMainnet.s.sol` (Phase 2)
///         to initialize the pool, seed LP and place the auto-buy in a single
///         atomic broadcast.
///
///         ⚠️  THIS IS REAL MONEY.
///         Use a hardware wallet for the actual broadcast. The PRIVATE_KEY env
///         path is for forks and tests only.
///
/// Required env:
///     TREASURY   address   Cold-wallet / multisig that owns protocol fees.
///
/// Usage (Ledger):
///     forge script script/DeployMainnet.s.sol \
///         --rpc-url $MAINNET_RPC \
///         --ledger --sender 0x<deployer> \
///         --broadcast --slow
///
/// After this script: write down the 5 addresses (KOTH/Hook/Router/Soul/Scroll),
/// verify each on Etherscan, hit GoPlus + Honeypot.is to seed scanner caches.
/// When ready to actually trade, run LaunchMainnet.s.sol.
contract DeployMainnet is Script {
    /// @dev Canonical Uniswap v4 PoolManager on Ethereum mainnet.
    address internal constant MAINNET_POOL_MANAGER = 0x000000000004444c5dc75cB358380D2e3dE08A90;
    /// @dev Universal Permit2 — same address on every chain.
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    /// @dev Arachnid's deterministic CREATE2 factory.
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    uint160 internal constant HOOK_FLAGS = 0x00CC;
    uint256 internal constant MAINNET_CHAIN_ID = 1;

    struct Deployment {
        address poolManager;
        address koth;
        address soul;
        address scroll;
        address hook;
        address kothRouter;
        address treasury;
    }

    function run() external returns (Deployment memory d) {
        require(block.chainid == MAINNET_CHAIN_ID, "Not mainnet - refusing");
        require(MAINNET_POOL_MANAGER.code.length > 0, "PoolManager missing");
        require(PERMIT2.code.length > 0, "Permit2 missing");

        uint256 pkEnv = vm.envOr("PRIVATE_KEY", uint256(0));
        address deployer = pkEnv != 0 ? vm.addr(pkEnv) : msg.sender;
        require(deployer != address(0), "Deployer unresolved");

        address treasury = vm.envOr("TREASURY", deployer);
        if (treasury == deployer) {
            console.log(unicode"WARN: TREASURY = deployer. Single key controls all fees.");
        }

        IPoolManager manager = IPoolManager(MAINNET_POOL_MANAGER);
        d.poolManager = MAINNET_POOL_MANAGER;
        d.treasury = treasury;

        console.log("=== KOTH Mainnet Deploy - Phase 1 (no LP yet) ===");
        console.log("Deployer  :", deployer);
        console.log("Treasury  :", treasury);

        uint64 nonce = vm.getNonce(deployer);
        address predictedKoth        = vm.computeCreateAddress(deployer, nonce + 0);
        address predictedSoul        = vm.computeCreateAddress(deployer, nonce + 2);
        address predictedScroll      = vm.computeCreateAddress(deployer, nonce + 3);
        address predictedKothRouter  = vm.computeCreateAddress(deployer, nonce + 4);

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

        // 1. KOTHToken — mints 1M KOTH to deployer
        address[] memory exemptions = new address[](2);
        exemptions[0] = address(manager);
        // PositionManager must be exempt so it can pull KOTH into the pool
        // during Phase 2 even if Phase 2 runs inside the anti-sniper window.
        exemptions[1] = 0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e;
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

        // 4. Bind everything. All four calls are admin-only and one-shot —
        //    after Phase 1, none of these can ever run again because admin
        //    is renounced below.
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

        // 5. Renounce admin on all three. Token, hook and router are now
        //    permanently ownerless — scanners read these slots and downgrade
        //    tokens with a live owner.
        koth.renounceAdmin();
        hook.renounceAdmin();
        kothRouter.renounceAdmin();

        vm.stopBroadcast();

        console.log("=== Phase 1 Complete ===");
        console.log("KOTHToken        :", d.koth);
        console.log("KingOfTheHillHook:", d.hook);
        console.log("KOTHRouter       :", d.kothRouter);
        console.log("ChronicleSoul    :", d.soul);
        console.log("ChronicleScroll  :", d.scroll);
        console.log("Treasury         :", d.treasury);
        console.log("");
        console.log("NEXT STEPS BEFORE PHASE 2:");
        console.log("1. forge verify-contract each of the five contracts on Etherscan.");
        console.log("2. Hit GoPlus / Honeypot.is URLs to seed scanner caches.");
        console.log("3. Confirm tokens shows 'Safe' before announcing the launch.");
        console.log("");
        console.log("When ready to actually go live, set these env vars then run");
        console.log("script/LaunchMainnet.s.sol:");
        console.log("  KOTH_ADDR=  ", d.koth);
        console.log("  HOOK_ADDR=  ", d.hook);
        console.log("  ROUTER_ADDR=", d.kothRouter);
    }
}
