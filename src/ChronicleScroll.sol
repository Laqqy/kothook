// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Reign} from "./Types.sol";

contract ChronicleScroll is ERC721, ERC2981 {
    address public immutable hook;
    address public immutable treasury;
    mapping(uint256 => Reign) public reigns;

    error OnlyHook();

    constructor(address _hook, address _treasury) ERC721("KOTH Chronicle Scroll", "KOTH-SCROLL") {
        hook = _hook;
        treasury = _treasury;
        _setDefaultRoyalty(_treasury, 500); // 5%
    }

    function mintReign(address to, uint256 reignId, Reign calldata data) external {
        if (msg.sender != hook) revert OnlyHook();
        reigns[reignId] = data;
        _safeMint(to, reignId);
    }

    function supportsInterface(bytes4 id)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(id);
    }
}
