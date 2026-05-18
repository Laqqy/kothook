// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KOTHToken} from "./KOTHToken.sol";

/// @notice Test variant of KOTHToken with display ticker "KEHT".
/// @dev    Inherits the entire KOTHToken implementation — identical storage,
///         identical anti-sniper, identical burnFromHook gating. Only the
///         `name()` and `symbol()` view functions are overridden so wallets
///         and Etherscan show this token as KEHT, separating it from the
///         eventual production KOTH deploy.
///
///         Because KEHTToken IS-A KOTHToken (Solidity inheritance), it can be
///         passed straight to `KingOfTheHillHook`'s constructor which expects
///         a `KOTHToken` parameter.
contract KEHTToken is KOTHToken {
    constructor(address[] memory exemptions) KOTHToken(exemptions) {}

    function name() public pure override returns (string memory) {
        return "King of the Hill TEST";
    }

    function symbol() public pure override returns (string memory) {
        return "KEHT";
    }
}
