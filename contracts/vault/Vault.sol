// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity 0.8.9;

import "./IVault.sol";
import "./libraries/Cast.sol";
import "./libraries/ERC165Ids.sol";
import "./libraries/Spectres.sol";
import "../token/sIERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

/**
 * @title Vault
 * @notice ERC1155 token wrapping locked ERC721 tokens into sERC20 tokens.
 * @dev - This contract does not implement mint nor burn functions.
 *      - This is made on purpose to maintain some separation of concerns between:
 *        - financial / monetary primitives - handled by sERC20s, and
 *        - display / collectible primitives - handled by this Vault.
 *      - Let's note that the ERC1155 standard does not require neither mint nor burn functions.
 */
contract Vault is Context, ERC165, AccessControlEnumerable, IERC1155, IERC1155MetadataURI, IERC721Receiver, IVault {
    using Address for address;
    using Cast for address;
    using Cast for bytes32;
    using Cast for uint256;
    using Cast for sIERC20;
    using Clones for address;
    using ERC165Checker for address;

    bytes32 public constant FRACTIONALIZE_ROLE = keccak256("FRACTIONALIZE_ROLE");
    bytes32 public constant DERRIDA = 0x1d2496c631fd6d8be20fb18c5c1fa9499e1f28016c62da960ec6dcf752f2f7ce; // keccak256("Le spectral, ce sont ces autres, jamais présents comme tels, ni vivants ni morts, avec lesquels je m'entretiens");

    address private _sERC20Base;
    string private _unavailableURI;
    string private _unlockedURI;

    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => Spectres.Spectre) private _spectres; // token type => Spectres.Spectre [immutable]
    mapping(IERC721 => mapping(uint256 => uint256)) private _tokenTypes; // ERC721 => token type [re-initialized when unlocked]

    /**
     * @notice Vault constructor.
     * @dev Neither Context, nor ERC165, nor AccessControlEnumerable have a constructor.
     */
    constructor(
        address sERC20Base_,
        string memory unavailableURI_,
        string memory unlockedURI_
    ) {
        require(sERC20Base_ != address(0), "Vault: sERC20 base cannot be the zero address");

        _sERC20Base = sERC20Base_;
        _unavailableURI = unavailableURI_;
        _unlockedURI = unlockedURI_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /** IERC165 */

    /**
     * @dev ERC165 and AccessControlEnumerable interfaces are supported through super.supportsInterface().
     */
    function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC165, AccessControlEnumerable) returns (bool) {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /** IERC1155 */

    /**
     * @notice Return the amount of tokens of type `id` owned by `account`.
     * @dev `account` cannot be the zero address.
     * @param account The account whose balance is queried.
     * @param id The token type whose balance is queried.
     * @return The amount of tokens of type `id` owned by `account`.
     */
    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        require(account != address(0), "Vault: balance query for the zero address");

        return _spectres[id].state != Spectres.State.Null ? id.sERC20().balanceOf(account) : 0;
    }

    /**
     * @notice Batched version of `balanceOf`.
     * @dev - `accounts` and `ids` must have the same length.
     *      - `accounts` entries cannot be the zero address.
     * @param accounts The accounts whose balances are queried.
     * @param ids The token types whose balances are queried.
     * @return The amount of tokens of types `ids` owned by `accounts`.
     */
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) public view override returns (uint256[] memory) {
        require(accounts.length == ids.length, "Vault: accounts and ids length mismatch");

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; i++) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @notice Grant or revoke permission to `operator` to transfer the caller's tokens, according to `approved`.
     * @dev Caller cannot set approval for self.
     * @param operator The operator being approved.
     * @param approved True if the operator is approved, false to revoke its approval.
     */
    function setApprovalForAll(address operator, bool approved) external override {
        require(_msgSender() != operator, "Vault: setting approval status for self");

        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @notice Transfer `amount` tokens of type `id` from `from` to `to`.
     * @dev - `to` cannot be the zero address.
     *      - If the caller is not `from`, it must be an approved operator of `from`.
     *      - `from` must have a balance of tokens of type `id` of at least `amount`.
     *      - If `to` refers to a smart contract, it must implement onERC1155Received and return the acceptance magic value.
     * @param from The address to transfer the tokens from.
     * @param to The address to transfer the tokens to.
     * @param id The id of the token type to transfer.
     * @param amount The amount of tokens to transfer.
     * @param data The data to be passed to `onERC1155Received` on `_to` if it is a contract.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override {
        address operator = _msgSender();

        require(to != address(0), "Vault: transfer to the zero address");
        require(from == operator || _operatorApprovals[from][operator], "Vault: must be owner or approved to transfer");

        id.sERC20().onERC1155Transferred(from, to, amount);

        emit TransferSingle(operator, from, to, id, amount);

        _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
    }

    /**
     * @notice Batched version of `safeTransferFrom`.
     * @dev - The same remarks as above apply, plus:
     *      - `ids` and `amounts` must have the same length.
     * @param from The address to transfer the tokens from.
     * @param to The address to transfer the tokens to.
     * @param ids The ids of the token types to transfer.
     * @param amounts The amounts of tokens to transfer.
     * @param data The data to be passed to `onERC1155Received` on `_to` if it is a contract.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override {
        address operator = _msgSender();

        require(ids.length == amounts.length, "Vault: ids and amounts length mismatch");
        require(to != address(0), "Vault: transfer to the zero address");
        require(from == operator || _operatorApprovals[from][operator], "Vault: must be owner or approved to transfer");

        for (uint256 i = 0; i < ids.length; i++) {
            ids[i].sERC20().onERC1155Transferred(from, to, amounts[i]);
        }

        emit TransferBatch(operator, from, to, ids, amounts);

        _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }

    /**
     * @notice Check whether `operator` is approved to transfer `account`'s tokens.
     * @param account The account whose approval of `operator` is being queried.
     * @param operator The operator whose approval from `account` is being queried.
     * @return True if `operator` is approved to transfer `account`'s tokens, false otherwise.
     */
    function isApprovedForAll(address account, address operator) public view override returns (bool) {
        return _operatorApprovals[account][operator];
    }

    /** IERC1155MetadataURI */

    /**
     * @notice Return the URI for token type `id`.
     * @dev - The ERC1155 standard requires this function to return the same value as the latest `URI` event for an `_id` if such events are emitted.
     *      - Because we cannot control the wrapped NFT's URI updates, we do NOT emit such `URI` event at token type creation.
     *      - See https://eips.ethereum.org/EIPS/eip-1155#metadata.
     * @param id The id of the token type.
     * @return - "" if the token type does not exist,
     *         - `_unavailableURI` if the token type exists, its underlying ERC721 is still locked, but does not implement ERC721Metadata,
     *         - `_unlockedURI` if the token type exists but its underlying ERC721 has been unlocked,
     *         - the token type's underlying ERC721's URI otherwise.
     *
     */
    function uri(uint256 id) public view override returns (string memory) {
        Spectres.Spectre storage spectre = _spectres[id];

        if (spectre.state == Spectres.State.Locked) {
            try IERC721Metadata(address(spectre.collection)).tokenURI(spectre.tokenId) returns (string memory uri_) {
                return uri_;
            } catch {
                return _unavailableURI;
            }
        }

        if (spectre.state == Spectres.State.Unlocked) return _unlockedURI;

        return "";
    }

    /** IERC721Receiver */

    /**
     * @notice Called whenever an NFT is transferred to this contract through ERC721#safeTransferFrom.
     * @dev - We do not check that the NFT is not already locked as such a transfer could only be triggered by this very contract if the ERC721 contract itself
     *        is not malicious. If the ERC721 is malicious, there is nothing we can do anyhow.
     *      - We do not check that the NFT has actually been transferred as this function call should happen only after the transfer if the ERC721 contract
     *        itself is not malicious. If the ERC721 is malicious, there is nothing we can do anyhow.
     *      - This function extract the fractionalization parameters out of the data bytes.
     *      - See `fractionalize` natspec for more details on those parameters.
     *      - The data bytes are expected to look like this:
     *        [
     *          bytes32(name)    | 32 bytes
     *          bytes32(symbol)  | 32 bytes
     *          uint256(cap)     | 32 bytes
     *          address(admin)   | 32 bytes
     *          address(broker)  | 32 bytes
     *          bytes32(DERRIDA) | 32 bytes
     *        ]
     */
    function onERC721Received(
        address, /* operator */
        address, /* from */
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        IERC721 collection = IERC721(_msgSender());
        require(collection.supportsInterface(ERC165Ids.ERC721), "Vault: NFT is not ERC721-compliant");
        require(data.length == 192, "Vault: invalid fractionalization data length");

        bytes memory _data = data; // one cannot mload data located in calldata
        bytes32 name;
        bytes32 symbol;
        uint256 cap;
        address admin;
        address broker;
        bytes32 derrida;

        assembly {
            name := mload(add(_data, 32))
            symbol := mload(add(_data, 64))
            cap := mload(add(_data, 96))
            admin := mload(add(_data, 128))
            broker := mload(add(_data, 160))
            derrida := mload(add(_data, 192))
        }

        require(derrida == DERRIDA, "Vault: invalid fractionalization data");

        _fractionalize(collection, tokenId, address(collection), name.toString(), symbol.toString(), cap, admin, broker);

        return IERC721Receiver.onERC721Received.selector;
    }

    /** IVault */

    /**
     * @notice Fractionalize the ERC721-compliant NFT belonging to `collection` and identified by `tokenId` into an sERC20.
     * @dev - This contract must be approved to transfer the NFT before this function is called.
     *      - sERC20-related parameters are checked in sERC20#initialize.
     *      - This function is open to re-entrancy for it would be harmless.
     * @param collection The address of the ERC721 contract the NFT to fractionalize belongs to.
     * @param tokenId The tokenId of the NFT to fractionalize.
     * @param name The name of the sERC20 to fractionalize the NFT into.
     * @param symbol The symbol of the sERC20 to fractionalize the NFT into.
     * @param cap The supply cap of the sERC20 to fractionalize the NFT into.
     * @param admin The admin of the sERC20 to fractionalize the NFT into [allowed to manage its roles and permissions].
     * @param broker The broker of the fractionalized NFT [allowed to unlock its spectre and release its NFT].
     */
    function fractionalize(
        IERC721 collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address broker
    ) external override returns (uint256) {
        require(
            hasRole(FRACTIONALIZE_ROLE, _msgSender()) || _msgSender() == collection.ownerOf(tokenId),
            "Vault: must have FRACTIONALIZE_ROLE or be NFT owner to fractionalize"
        );
        require(collection.supportsInterface(ERC165Ids.ERC721), "Vault: NFT is not ERC721-compliant");
        require(_tokenTypes[collection][tokenId] == 0, "Vault: NFT is already locked");

        address owner = collection.ownerOf(tokenId);
        // in case the NFT accidentally ended up owned by this contract while un-fractionalized
        require(owner != address(this), "Vault: NFT is already owned by this vault");

        uint256 id = _fractionalize(collection, tokenId, _msgSender(), name, symbol, cap, admin, broker);
        collection.transferFrom(owner, address(this), tokenId);

        return id;
    }

    /**
     * @notice Unlock the spectre tied to `sERC20` and transfer its underlying NFT to `recipient` with `data` as ERC721#safeTransferFrom callback data.
     * @param sERC20 The sERC20 of the spectre to unlock.
     * @param recipient The recipient of the spectre's underlying NFT.
     * @param data The ERC721#safeTransferFrom callback data.
     */
    function unlock(
        sIERC20 sERC20,
        address recipient,
        bytes calldata data
    ) external override {
        uint256 id = sERC20.id();
        Spectres.Spectre storage spectre = _spectres[id];

        require(spectre.state == Spectres.State.Locked, "Vault: spectre is not locked");
        require(_msgSender() == spectre.broker, "Vault: must be spectre's broker to unlock");

        _unlock(spectre.collection, spectre.tokenId, id, recipient, data);
    }

    /**
     * @notice Set the URI associated to spectres whose underlying NFTs do not implement IERC721Metadata to `unavailableURI_`.
     * @param unavailableURI_ The URI to associate to spectres whose underlying NFTs do not implement IERC721Metadata.
     */
    function setUnavailableURI(string memory unavailableURI_) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Vault: must have DEFAULT_ADMIN_ROLE to set unavailableURI");

        _unavailableURI = unavailableURI_;
    }

    /**
     * @notice Set the URI associated to unlocked spectres.
     * @param unlockedURI_ The URI to associate to unlocked spectres.
     */
    function setUnlockedURI(string memory unlockedURI_) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Vault: must have DEFAULT_ADMIN_ROLE to set unlockedURI");

        _unlockedURI = unlockedURI_;
    }

    /**
     * @notice Mirror sERC20s transfers.
     * @dev - This function is called by sERC20s whenever a transfer occurs at the sERC20 layer.
     *      - This enable this vault to emit a `TransferSingle` event, as required per the ERC1155 standard, each time a transfer occurs [no matter which layer
     *        this transfer is triggered from].
     *      - If the recipient of the tokens implements ERC1155Receiver, its callback function is called.
     * @param from The address the tokens have been transferred from.
     * @param to The address the tokens have been transferred to.
     * @param amount The amount of tokens which have been transferred.
     */
    function onERC20Transferred(
        address from,
        address to,
        uint256 amount
    ) external override {
        address operator = _msgSender();
        uint256 id = operator.id();

        require(_spectres[id].state != Spectres.State.Null, "Vault: must be sERC20 to use transfer hook");

        emit TransferSingle(operator, from, to, id, amount);

        if (to.supportsInterface(ERC165Ids.ERC1155Receiver)) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, "") returns (
                bytes4 /*response*/
            ) {} catch Error(
                string memory /*reason*/
            ) {} catch {}
        }
    }

    /**
     * @notice Return the address of sERC20's implementation contract.
     */
    function sERC20Base() public view override returns (address) {
        return _sERC20Base;
    }

    /**
     * @notice Return the URI associated to spectres whose underlying NFTs do not implement IERC721Metadata.
     */
    function unavailableURI() public view override returns (string memory) {
        return _unavailableURI;
    }

    /**
     * @notice Return the URI associated to unlocked spectres.
     */
    function unlockedURI() public view override returns (string memory) {
        return _unlockedURI;
    }

    /**
     * @notice Check whether the NFT belonging to `collection` and identified by `tokenId` is locked into this vault or not.
     */
    function isLocked(IERC721 collection, uint256 tokenId) public view override returns (bool) {
        return _tokenTypes[collection][tokenId] != 0;
    }

    /**
     * @notice Return the token type associated to the NFT belonging to `collection` and identified by `tokenId` [return 0 if the NFT is not currently locked].
     */
    function tokenTypeOf(IERC721 collection, uint256 tokenId) public view override returns (uint256) {
        return _tokenTypes[collection][tokenId];
    }

    /**
     * @notice Return the spectre associated to the token type `id` .
     * @param id The id of the token type whose spectre is queried.
     */
    function spectreOf(uint256 id) public view override returns (Spectres.Spectre memory) {
        return _spectres[id];
    }

    /**
     * @notice Return the spectre associated to the sERC20 `sERC20`.
     * @param sERC20 The sERC20 whose spectre is queried.
     */
    function spectreOf(sIERC20 sERC20) public view override returns (Spectres.Spectre memory) {
        return _spectres[sERC20.id()];
    }

    /**
     * @notice Return the sERC20 associated to the token type `id`.
     * @param id The id of the token type whose sERC20 is queried.
     */
    function sERC20Of(uint256 id) public pure override returns (sIERC20) {
        return id.sERC20();
    }

    /** private */

    function _fractionalize(
        IERC721 collection,
        uint256 tokenId,
        address operator,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address broker
    ) private returns (uint256) {
        address sERC20 = _sERC20Base.clone();
        uint256 id = sERC20.id();

        _spectres[id] = Spectres.Spectre({state: Spectres.State.Locked, collection: collection, tokenId: tokenId, broker: broker});
        _tokenTypes[collection][tokenId] = id;

        sIERC20(sERC20).initialize(name, symbol, cap, admin);

        emit TransferSingle(operator, address(0), address(0), id, uint256(0));
        emit Fractionalize(collection, tokenId, id, sIERC20(sERC20), broker);

        return id;
    }

    function _unlock(
        IERC721 collection,
        uint256 tokenId,
        uint256 id,
        address recipient,
        bytes memory data
    ) private {
        _spectres[id].state = Spectres.State.Unlocked;
        delete _tokenTypes[collection][tokenId];

        collection.safeTransferFrom(address(this), recipient, tokenId, data);

        emit Unlock(id, recipient);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
                if (response != IERC1155Receiver(to).onERC1155Received.selector) {
                    revert("Vault: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("Vault: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
                if (response != IERC1155Receiver(to).onERC1155BatchReceived.selector) {
                    revert("Vault: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("Vault: transfer to non ERC1155Receiver implementer");
            }
        }
    }
}
