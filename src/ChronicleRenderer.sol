// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Reign} from "./Types.sol";

/// @notice On-chain renderer for the two reign NFTs (Soul / Scroll).
///         Both call render() with their variant name; the SVG layout is
///         identical but the metal accent (gold vs silver) and seal colour
///         (vermilion vs lapis) differ. No external assets, fully on-chain.
library ChronicleRenderer {
    using Strings for uint256;

    function render(Reign memory r, string memory variant) internal pure returns (string memory) {
        string memory svg = _buildSVG(r, variant);
        string memory json = string.concat(
            '{"name":"KOTH Chronicle ', variant, ' #', r.reignId.toString(),
            '","description":"On-chain record of reign by ', _shortAddr(r.king), '",',
            '"attributes":[',
                '{"trait_type":"King","value":"', Strings.toHexString(uint256(uint160(r.king)), 20), '"},',
                '{"trait_type":"Reign ID","value":', r.reignId.toString(), '},',
                '{"trait_type":"Start Block","value":', r.startBlock.toString(), '},',
                '{"trait_type":"End Block","value":', r.endBlock.toString(), '},',
                '{"trait_type":"Duration Blocks","value":', (r.endBlock - r.startBlock).toString(), '},',
                '{"trait_type":"ETH Earned (wei)","value":"', r.ethEarned.toString(), '"},',
                '{"trait_type":"Record High (wei)","value":"', r.recordHigh.toString(), '"},',
                '{"trait_type":"Dethrone Reason","value":"', _bytes32ToString(r.dethroneReason), '"}',
            '],',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _buildSVG(Reign memory r, string memory variant) internal pure returns (string memory) {
        bool isSoul = keccak256(bytes(variant)) == keccak256(bytes("Soul"));
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">',
                _defsAndBg(isSoul),
                _frame(),
                _crown(),
                _seal(r.reignId, isSoul),
                _heading(variant, isSoul),
                _sovereign(r.king),
                _stats(r),
                _reasonBadge(r.dethroneReason),
            '</svg>'
        );
    }

    function _defsAndBg(bool isSoul) internal pure returns (string memory) {
        return string.concat(
            '<defs>',
                '<radialGradient id="bg" cx="50%" cy="20%" r="80%">',
                    '<stop offset="0%" stop-color="#1A1428"/>',
                    '<stop offset="100%" stop-color="#0A0810"/>',
                '</radialGradient>',
                '<linearGradient id="metal" x1="0%" y1="0%" x2="100%" y2="100%">',
                    isSoul
                        ? '<stop offset="0%" stop-color="#F4D053"/><stop offset="50%" stop-color="#E8B339"/><stop offset="100%" stop-color="#A07720"/>'
                        : '<stop offset="0%" stop-color="#F0F0F8"/><stop offset="50%" stop-color="#C8C8D8"/><stop offset="100%" stop-color="#7A7A95"/>',
                '</linearGradient>',
            '</defs>',
            '<rect width="400" height="600" fill="url(#bg)"/>'
        );
    }

    function _frame() internal pure returns (string memory) {
        return string.concat(
            '<rect x="12" y="12" width="376" height="576" fill="none" stroke="url(#metal)" stroke-width="2"/>',
            '<rect x="22" y="22" width="356" height="556" fill="none" stroke="url(#metal)" stroke-width="0.5" opacity="0.35"/>',
            '<g fill="url(#metal)">',
                '<circle cx="32" cy="32" r="2.5"/>',
                '<circle cx="368" cy="32" r="2.5"/>',
                '<circle cx="32" cy="568" r="2.5"/>',
                '<circle cx="368" cy="568" r="2.5"/>',
            '</g>'
        );
    }

    function _crown() internal pure returns (string memory) {
        return string.concat(
            '<g transform="translate(200,80)">',
                '<path d="M-55 25 L-42 -8 L-22 8 L0 -20 L22 8 L42 -8 L55 25 Z" fill="url(#metal)" stroke="#000" stroke-width="0.6" stroke-opacity="0.3"/>',
                '<rect x="-55" y="25" width="110" height="9" fill="url(#metal)"/>',
                '<g fill="#FFF8DC" opacity="0.85">',
                    '<circle cx="-45" cy="29.5" r="1.8"/>',
                    '<circle cx="-27" cy="29.5" r="1.8"/>',
                    '<circle cx="-9" cy="29.5" r="1.8"/>',
                    '<circle cx="9" cy="29.5" r="1.8"/>',
                    '<circle cx="27" cy="29.5" r="1.8"/>',
                    '<circle cx="45" cy="29.5" r="1.8"/>',
                '</g>',
                '<circle cx="-42" cy="-8" r="3" fill="#7A1820"/>',
                '<circle cx="0" cy="-20" r="3.5" fill="#1F3A6B"/>',
                '<circle cx="42" cy="-8" r="3" fill="#1F6B3A"/>',
            '</g>'
        );
    }

    function _seal(uint256 reignId, bool isSoul) internal pure returns (string memory) {
        string memory sealColor = isSoul ? "#7A1820" : "#1F3A6B";
        return string.concat(
            '<g transform="translate(200,200)">',
                '<circle r="38" fill="', sealColor, '" stroke="url(#metal)" stroke-width="2.5"/>',
                '<circle r="32" fill="none" stroke="url(#metal)" stroke-width="0.5" opacity="0.45"/>',
                '<text text-anchor="middle" dy="0.35em" font-family="Georgia, serif" font-size="22" fill="url(#metal)" font-weight="bold">',
                    _toRoman(reignId),
                '</text>',
            '</g>'
        );
    }

    function _heading(string memory variant, bool isSoul) internal pure returns (string memory) {
        return string.concat(
            '<text x="200" y="278" text-anchor="middle" font-family="Georgia, serif" font-size="10" font-style="italic" fill="#888" letter-spacing="3">CHRONICLE OF THE</text>',
            '<text x="200" y="316" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="url(#metal)">',
                variant,
            '</text>',
            '<line x1="90" y1="338" x2="172" y2="338" stroke="url(#metal)" stroke-width="0.5" opacity="0.45"/>',
            '<line x1="228" y1="338" x2="310" y2="338" stroke="url(#metal)" stroke-width="0.5" opacity="0.45"/>',
            '<text x="200" y="343" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="url(#metal)" opacity="0.75">',
                isSoul ? '&#10022;' : '&#10059;',
            '</text>'
        );
    }

    function _sovereign(address king) internal pure returns (string memory) {
        return string.concat(
            '<text x="200" y="380" text-anchor="middle" font-family="monospace" font-size="9" fill="#777" letter-spacing="3">SOVEREIGN</text>',
            '<text x="200" y="405" text-anchor="middle" font-family="monospace" font-size="14" fill="#EAEAEA">',
                _shortAddr(king),
            '</text>'
        );
    }

    function _stats(Reign memory r) internal pure returns (string memory) {
        return string.concat(
            '<text x="200" y="442" text-anchor="middle" font-family="monospace" font-size="9" fill="#777" letter-spacing="3">REIGN SPAN</text>',
            '<text x="200" y="464" text-anchor="middle" font-family="monospace" font-size="12" fill="#EAEAEA">',
                r.startBlock.toString(), '  &#8594;  ', r.endBlock.toString(),
            '</text>',
            '<text x="200" y="498" text-anchor="middle" font-family="monospace" font-size="9" fill="#777" letter-spacing="3">EARNED &#183; RECORD</text>',
            '<text x="200" y="522" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="url(#metal)">',
                _formatEthShort(r.ethEarned), '  &#183;  ', _formatEthShort(r.recordHigh),
            '</text>'
        );
    }

    function _reasonBadge(bytes32 reason) internal pure returns (string memory) {
        string memory text = _bytes32ToString(reason);
        bytes32 reasonHash = keccak256(bytes(text));
        string memory color;
        if (reasonHash == keccak256(bytes("OVERTHROWN"))) color = "#E8B339";
        else if (reasonHash == keccak256(bytes("DUMP"))) color = "#C04848";
        else if (reasonHash == keccak256(bytes("FORFEIT"))) color = "#A8A8C0";
        else color = "#888";

        return string.concat(
            '<g transform="translate(200,562)">',
                '<rect x="-58" y="-14" width="116" height="22" fill="none" stroke="', color, '" stroke-width="1.4" rx="2"/>',
                '<text text-anchor="middle" dy="0.35em" font-family="monospace" font-size="11" font-weight="bold" fill="', color, '" letter-spacing="3">',
                    text,
                '</text>',
            '</g>'
        );
    }

    function _shortAddr(address a) internal pure returns (string memory) {
        string memory full = Strings.toHexString(uint256(uint160(a)), 20);
        bytes memory fb = bytes(full);
        bytes memory out = new bytes(13);
        for (uint i; i < 6; ++i) out[i] = fb[i];
        out[6] = '.'; out[7] = '.'; out[8] = '.';
        for (uint i; i < 4; ++i) out[9 + i] = fb[fb.length - 4 + i];
        return string(out);
    }

    function _formatEthShort(uint256 wei_) internal pure returns (string memory) {
        uint256 whole = wei_ / 1 ether;
        uint256 frac = (wei_ % 1 ether) / 1e15;
        bytes memory fracStr = bytes(frac.toString());
        while (fracStr.length < 3) {
            bytes memory newStr = new bytes(fracStr.length + 1);
            newStr[0] = '0';
            for (uint i; i < fracStr.length; ++i) newStr[i+1] = fracStr[i];
            fracStr = newStr;
        }
        return string.concat(whole.toString(), '.', string(fracStr), ' &#926;');
    }

    function _bytes32ToString(bytes32 b) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && b[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint i; i < len; ++i) out[i] = b[i];
        return string(out);
    }

    /// @dev Converts 1..3999 to Roman numerals. 0 returns "O", larger values
    ///      fall back to the decimal form. NFT reign counts in this game
    ///      realistically stay well under 3999.
    function _toRoman(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "O";
        if (n > 3999) return n.toString();
        string memory r = "";
        while (n >= 1000) { r = string.concat(r, "M"); n -= 1000; }
        if (n >= 900) { r = string.concat(r, "CM"); n -= 900; }
        if (n >= 500) { r = string.concat(r, "D"); n -= 500; }
        if (n >= 400) { r = string.concat(r, "CD"); n -= 400; }
        while (n >= 100) { r = string.concat(r, "C"); n -= 100; }
        if (n >= 90) { r = string.concat(r, "XC"); n -= 90; }
        if (n >= 50) { r = string.concat(r, "L"); n -= 50; }
        if (n >= 40) { r = string.concat(r, "XL"); n -= 40; }
        while (n >= 10) { r = string.concat(r, "X"); n -= 10; }
        if (n >= 9) { r = string.concat(r, "IX"); n -= 9; }
        if (n >= 5) { r = string.concat(r, "V"); n -= 5; }
        if (n >= 4) { r = string.concat(r, "IV"); n -= 4; }
        while (n >= 1) { r = string.concat(r, "I"); n -= 1; }
        return r;
    }
}
