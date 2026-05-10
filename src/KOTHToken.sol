// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract KOTHToken is ERC20, ERC20Burnable {
    uint256 public constant TOTAL_SUPPLY = 10_000_000 ether;

    constructor(address[] memory /* exemptions */) ERC20("King of the Hill", "KOTH") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}
