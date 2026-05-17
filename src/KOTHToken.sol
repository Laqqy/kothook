// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract KOTHToken is ERC20, ERC20Burnable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000 ether;
    uint256 public constant SNIPER_BLOCKS = 175;       // ~35 min at 12s/block
    uint256 public constant MAX_WALLET_BPS = 100;       // 1%
    uint256 public immutable LAUNCH_BLOCK;
    address public immutable admin;

    mapping(address => bool) public isExempt;

    address public hook;

    error AntiSniperLimit(uint256 wouldHave, uint256 maxAllowed);
    error HookAlreadySet();
    error OnlyHook();
    error OnlyAdmin();

    constructor(address[] memory exemptions) ERC20("King of the Hill", "KOTH") {
        LAUNCH_BLOCK = block.number;
        admin = msg.sender;
        isExempt[msg.sender] = true;
        for (uint256 i; i < exemptions.length; ++i) isExempt[exemptions[i]] = true;
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    function setHook(address _hook) external {
        if (msg.sender != admin) revert OnlyAdmin();
        if (hook != address(0)) revert HookAlreadySet();
        hook = _hook;
        isExempt[_hook] = true;
    }

    function burnFromHook(uint256 amount) external {
        if (msg.sender != hook) revert OnlyHook();
        _burn(hook, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (
            block.number < LAUNCH_BLOCK + SNIPER_BLOCKS
            && to != address(0)
            && !isExempt[to]
        ) {
            uint256 wouldHave = balanceOf(to) + value;
            uint256 maxAllowed = (TOTAL_SUPPLY * MAX_WALLET_BPS) / 10_000;
            if (wouldHave > maxAllowed) revert AntiSniperLimit(wouldHave, maxAllowed);
        }
        super._update(from, to, value);
    }
}
