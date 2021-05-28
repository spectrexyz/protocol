// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./SERC20.sol";
import "./lib/Cast.sol";
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
import "hardhat/console.sol";

/**
 * @title sERC1155
 * @notice sERC1155 token wrapping ERC721s into sERC20s.
 * @dev Remarks:
 *        - sERC1155 does not implement mint nor burn in an effort to maintain some separation of concerns between
 * financial / monetary primitives - handled by sERC20s - and display / collectible primitives - handled by the
 * sERC1155. Let's note that the ERC1155 standard does not require neither mint nor burn functions.
 */
contract SERC1155 is Context, ERC165, AccessControlEnumerable, IERC1155, IERC1155MetadataURI, IERC721Receiver {
    using Address for address;
    using Cast for address;
    using Cast for uint256;
    using Cast for bytes32;
    using Clones for address;
    using ERC165Checker for address;

    enum SpectreState {
        Null,
        ERC721Locked,
        ERC721Unlocked
    }

    struct Spectre {
        SpectreState state;
        address collection;
        uint256 tokenId;
        address guardian;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address private _sERC20Base;
    string private _unwrappedURI;

    mapping (address => mapping(address => bool)) private _operatorApprovals;
    mapping (uint256 => Spectre) private _spectres; // token type => Spectre [immutable]
    mapping (address => mapping (uint256 => uint256)) private _locks; // ERC721 => token type [re-initialized when unlocked]

    event Spectralize(address indexed collection, uint256 indexed tokenId, uint256 indexed id, address sERC20, address guardian);
    event Lock(uint indexed id);
    event Unlock(uint256 indexed id, address recipient);

    /**
     * @notice sERC1155 constructor.
     * @dev Context, ERC165 and AccessControlEnumerable have no constructor.
     */
    constructor(address sERC20Base_, string memory unwrappedURI_) {
        require(sERC20Base_ != address(0), "sERC1155: sERC20 base cannot be the zero address");

        _sERC20Base = sERC20Base_;
        _unwrappedURI = unwrappedURI_;

        _setupRole(ADMIN_ROLE,_msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

  /* #region ERC165 */
    /**
     * @dev ERC165 and AccessControlEnumerable interfaces are supported through super.supportsInterface().
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(IERC165, ERC165, AccessControlEnumerable)
        returns (bool)
    {
        return interfaceId == type(IERC1155).interfaceId
            || interfaceId == type(IERC1155MetadataURI).interfaceId
            || interfaceId == type(IERC721Receiver).interfaceId
            || super.supportsInterface(interfaceId);
    }
  /* #endregion */

  /* #region ERC1155 */
    /**
     * @notice Returns the amount of tokens of token type `id` owned by `account`.
     * @dev `account` cannot be the zero address.
     * @param account The account whose balance is queried.
     * @param id The token type whose balance is queried.
     * @return The amount of tokens of token type `id` owned by `account`.
     */
    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        require(account != address(0), "sERC1155: balance query for the zero address");

        return _spectres[id].state != SpectreState.Null ? id.toSERC20().balanceOf(account) : 0;
    }

    /**
     * @notice Batched version of `balanceOf`
     * @dev `accounts` and `ids` must have the same length.
     */
    function balanceOfBatch(
        address[] memory accounts,
        uint256[] memory ids
    )
        public
        view
        override
        returns (uint256[] memory)
    {
        require(accounts.length == ids.length, "sERC1155: accounts and ids length mismatch");

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @notice Grants or revokes permission to `operator` to transfer the caller's tokens, according to `approved`
     * @dev Emits an `ApprovalForAll` event.
     */
    function setApprovalForAll(address operator, bool approved) public override {
        require(_msgSender() != operator, "sERC1155: setting approval status for self");

        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address account, address operator) public view override returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    )
        public
        override
    {
        require(to != address(0), "sERC1155: transfer to the zero address");
        require(_canTransfer(from), "sERC1155: must be owner or approved to transfer");

        address operator = _msgSender();
        id.toSERC20().onSERC1155Transferred(from, to, amount);

        emit TransferSingle(operator, from, to, id, amount);  // déjà emis dans le hook on SERC20 transferred ?

        _doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        public
        override
    {
        require(ids.length == amounts.length, "sERC1155: ids and amounts length mismatch");
        require(to != address(0), "sERC1155: transfer to the zero address");
        require(_canTransfer(from), "sERC1155: must be owner or approved to transfer");

        address operator = _msgSender();
        for (uint256 i = 0; i < ids.length; ++i) {
            ids[i].toSERC20().onSERC1155Transferred(from, to, amounts[i]);
        }

        emit TransferBatch(operator, from, to, ids, amounts);  // déjà emis dans le hook on SERC20 transferred ?

        _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }
  /* #endregion */

  /* #region ERC1155MetadataURI */
    /**
     * @notice Returns the URI for token type `id`.
     * @dev The ERC1155 standard requires this function to return the same value as the latest `URI` event for an `_id`
     * if such events are emitted. Because we cannot control the original NFT's uri updates, we do NOT emit such `URI`
     * event at token type creation. See https://eips.ethereum.org/EIPS/eip-1155#metadata.
     * @param id The ERC1155 id of the token type.
     * @return "" if the token type does not exist, `_unwrappedURI` if the token type exists but its underlying ERC721 has
     * been unwrapped, the original ERC721's URI otherwise.
     */
    function uri(uint256 id) public view override returns (string memory) {
        Spectre storage spectre = _spectres[id];

        if (spectre.state == SpectreState.ERC721Locked)
          return IERC721Metadata(spectre.collection).tokenURI(spectre.tokenId);

        if (spectre.state == SpectreState.ERC721Unlocked)
            return _unwrappedURI;

        return "";
    }
  /* #endregion */

  /* #region IERC721Receiver */
    /**
     * data looks like this
        data = [
          bytes32(name)     | 32 bytes
          bytes32(symbol)   | 32 bytes
          uint256(cap)      | 32 bytes
          address(admin)    | 32 bytes
          address(guardian) | 32 bytes 
     */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 tokenId,
        bytes calldata data
    )
        external
        override
        returns (bytes4)
    {
        address collection = _msgSender();
  
        require(collection.supportsInterface(0x80ac58cd), "sERC1155: ERC721 is not standard-compliant");
        require(!isLocked(collection, tokenId), "sERC1155: ERC721 is already locked");
        require(IERC721(collection).ownerOf(tokenId) == address(this), "sERC1155: ERC721 has not been transferred");
        require(data.length == 160, "sERC1155: invalid spectralization data");

        // il faut vérifier que le token recu n'est pas déjà lock.

        // one cannot mload data located in calldata
        bytes memory _data = data;
        // declare variable to populate in assembly
        bytes32 name;
        bytes32 symbol;
        uint256 cap;
        address admin;
        address guardian;
        
        assembly {
            name := mload(add(_data, 32))
            symbol := mload(add(_data, 64))
            cap := mload(add(_data, 96))
            admin := mload(add(_data, 128))
            guardian:= mload(add(_data, 160))
        }

        emit Lock(_spectralize(collection, tokenId, name.toString(), symbol.toString(), cap, admin, guardian));
        
        return 0x150b7a02; // IERC721Receiver.onERC721Received.selector
    }
  /* #endregion */

  /* #region sERC1155 */
    /**
     * @notice Wraps the ERC721-compliant NFT belonging to `collection` and identified by `tokenId` into an sERC20.
     * Remarks:
     *  - This contract must be approved to transfer the NFT before this function is called.
     *  - sERC20-related parameters are checked in SERC20.initialize().
     * @param collection The address of the ERC721 contract the NFT to spectralize belongs to.
     * @param tokenId The tokenId of the NFT to spectralize.
     * @param name The name of the sERC20 to spectralize the ERC721 into.
     * @param symbol The symbol of the sERC20 to clone.
     * @param cap The supply cap of the sERC20 to clone.
     * @param admin The addresses to which to assign the sERC20 to clone roles.
     * @param guardian The address which is gonna be allowed to unlock the NFT to spectralize.
     */
    function spectralize(
        address collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address guardian
    )
        external
    {
        require(collection.supportsInterface(0x80ac58cd), "sERC1155: ERC721 is not standard");
        require(_locks[collection][tokenId] == 0, "sERC1155: ERC721 is already locked");

        _lock(
            collection,
            tokenId,
            _spectralize(collection, tokenId, name, symbol, cap, admin, guardian)
        );
    }

    function unlock(uint256 id, address recipient, bytes memory data) external {
        Spectre storage spectre = _spectres[id];
        address collection = spectre.collection;
        uint256 tokenId = spectre.tokenId;

        require(spectre.state == SpectreState.ERC721Locked, "sERC1155: NFT is not wrapped");
        require(_msgSender() == spectre.guardian, "sERC1155: must be guardian to unlock");

        _unlock(collection, tokenId, id, recipient, data);
    }

    function unlock(address sERC20, address recipient, bytes memory data) external {
        uint256 id = sERC20.toId();
        Spectre storage spectre = _spectres[id];
        // address collection = nft.collection;
        // uint256 tokenId = nft.tokenId;

        require(spectre.state == SpectreState.ERC721Locked, "sERC1155: NFT is not wrapped");
        require(_msgSender() == spectre.guardian, "sERC1155: must be guardian to unlock");

        _unlock(spectre.collection, spectre.tokenId, id, recipient, data);
    }

    function updateUnwrappedURI(string memory unwrappedURI_) external {
        require(hasRole(ADMIN_ROLE, _msgSender()), "sERC1155: must have admin role to update unwrappedURI");

        _unwrappedURI = unwrappedURI_;
    }

    /**
     * @notice Mirrors sERC20s transfers.
     * @dev This function is called by sERC20s whenever a transfer occurs at the sERC20 layer. This enable the sERC1155
     * contract to emit a `TransferSingle` event, as required per the ERC1155 standard, each time a transfer occurs - 
     * even when this transfer occurs at the sERC20 layer.
     * @param from The address the tokens have been transferred from.
     * @param to The address the tokens have been transferred to.
     * @param amount The amount of tokens which have been transferred.
     */
    function onSERC20Transferred(
        address from,
        address to,
        uint256 amount
    )
        external
    {
        address operator = _msgSender();
        uint256 id = operator.toId();

        require(_spectres[id].state != SpectreState.Null, "sERC1155: must be sERC20 to use transfer hook");

        emit TransferSingle(operator, from, to, id, amount);
    }

    function unwrappedURI() public view returns (string memory) {
        return _unwrappedURI;
    }

    function sERC20Base() public view returns (address) {
        return _sERC20Base;
    }

    function isLocked(address collection, uint256 tokenId) public view returns (bool) {
        return _locks[collection][tokenId] != 0;
    }

    function lockOf(address collection, uint256 tokenId) public view returns (uint256) {
        return _locks[collection][tokenId];
    }

    /**
     * @notice Returns the NFT associated to the `id` token type.
     * @param id The id of the token type whose NFT is queried.
     * @return The NFT associated to the `id` token type.
     */
    function spectreOf(uint256 id) public view returns (Spectre memory) {
        return _spectres[id];
    }

    /**
     * @notice Returns the NFT associated to the `sERC20` token.
     * @param sERC20 The address of the sERC20 whose NFT is queried.
     * @return The NFT associated to the `sERC20` token.
     */
    function spectreOf(address sERC20) public view returns (Spectre memory) {
        return _spectres[sERC20.toId()];
    }

    /**
     * @notice Returns the address of the sERC20 associated to the `id` token type.
     * @param id The id of the token type whose sERC20 address is queried.
     * @return The address of the sERC20 associated to the `id` token type.
     */
    function sERC20Of(uint256 id) public pure returns (address) {
        return id.toAddress();
    }
  /* #endregion*/

  /* #region private */
    function _lock(address collection, uint256 tokenId, uint256 id) private {
        IERC721(collection).transferFrom(IERC721(collection).ownerOf(tokenId), address(this), tokenId);

        emit Lock(id);
    }

    function _spectralize(
        address collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address admin,
        address guardian
    ) private 
      returns(uint256)
    {
        // clone + initialize = 867 741 gas
        address sERC20 = _sERC20Base.clone();
        uint256 id = sERC20.toId();
        
        _locks[collection][tokenId] = id;
        _spectres[id] = Spectre({ state: SpectreState.ERC721Locked, collection: collection, tokenId: tokenId, guardian: guardian });

        SERC20(sERC20).initialize(name, symbol, cap, admin);
        // SERC20(sERC20).grantRole(SERC20(sERC20).MINTER_ROLE(), admin);
        // SERC20(sERC20).renounceRole(SERC20(sERC20).DEFAULT_ADMIN_ROLE(), address(this));



        emit Spectralize(collection, tokenId, id, sERC20, guardian);

        return id;
    }

    function _unlock(address collection, uint256 tokenId, uint256 id, address recipient, bytes memory data) private {
        delete _locks[collection][tokenId];
        _spectres[id].state = SpectreState.ERC721Unlocked;
        IERC721(collection).safeTransferFrom(address(this), recipient, tokenId, data);

        emit Unlock(id, recipient);
    }

    function _canTransfer(address from) private view returns (bool) {
        return from == _msgSender() || isApprovedForAll(from, _msgSender());
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    )
        private
    {
        if (to.isContract()) {
            /* solhint-disable indent */
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
                if (response != IERC1155Receiver(to).onERC1155Received.selector) {
                    revert("sERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("sERC1155: transfer to non ERC1155Receiver implementer");
            }
            /* solhint-enable indent */
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        private
    {
        if (to.isContract()) {
            /* solhint-disable indent */
            /* solhint-disable max-line-length */
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
                if (response != IERC1155Receiver(to).onERC1155BatchReceived.selector) {
                    revert("sERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("sERC1155: transfer to non ERC1155Receiver implementer");
            }
            /* solhint-enable max-line-length */
            /* solhint-enable indent  */
        }
    }
  /* #endregion */
}
