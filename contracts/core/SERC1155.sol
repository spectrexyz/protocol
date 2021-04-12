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

/**
 * @title sERC1155
 * @notice sERC1155 token wrapping sERC20s of spectralized ERC721s.
 * @dev Remarks:
 *        - AccessControleEnumerable already inherits ERC165.
 *        - sERC1155 does not implement mint nor burn in an effort to maintain some separation of concerns between
 * financial / monetary primitives - handled by sERC20s - and display / collectible primitives - handled by the
 * sERC1155. Let's note that the ERC1155 standard does not require neither mint nor burn functions.
 */
contract SERC1155 is Context, AccessControlEnumerable, /*ERC165,*/ IERC1155, IERC1155MetadataURI, IERC721Receiver {
    using Address for address;
    using Cast for address;
    using Cast for uint256;
    using Clones for address;
    using ERC165Checker for address;

    struct NFT {
        address collection;
        uint256 tokenId;
        address owner;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    mapping (address => mapping(address => bool)) private _operatorApprovals;
    // token type => NFT [immutable]
    mapping (uint256 => NFT) private _NFTs;
    // NFT => token type [re-initialized to zero when unwrapped]
    mapping (address => mapping (uint256 => uint256)) private _currentTokenTypes;
    address private _sERC20Base;
    string  private _unwrappedURI;

    event Wrap(address indexed collection, uint256 indexed tokenId, uint256 indexed id, address sERC20, address owner);
    event Unwrap(
        address indexed collection,
        uint256 indexed tokenId,
        uint256 indexed id,
        address sERC20,
        address recipient
    );

    constructor(address sERC20Base_, string memory unwrappedURI_) {
        require(sERC20Base_ != address(0), "sERC1155: sERC20 base cannot be the zero address");

        _sERC20Base = sERC20Base_;
        _unwrappedURI = unwrappedURI_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(ADMIN_ROLE,_msgSender());
    }

  /* #region ERC165 */
    /**
     * @dev AccessControlEnumerable and ERC165 interfaces are supported through super.supportsInterface().
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlEnumerable, IERC165)
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
     * @notice Returns the URI for token type `id`.
     * @dev The ERC1155 standard requires this function to return the same value as the latest `URI` event for an `_id`
     * if such events are emitted. Because we cannot control the original NFT's uri updates, we do NOT emit such `URI`
     * event at token type creation. See https://eips.ethereum.org/EIPS/eip-1155#metadata.
     * @param id The ERC1155 id of the token type.
     * @return "" if the token type does not exist, `_unwrappedURI` if the token type exists but its underlying NFT has
     * been unwrapped, the original ERC721's URI otherwise.
     */
    function uri(uint256 id) public view override returns (string memory) {
        NFT storage nft = _NFTs[id];
        address collection = nft.collection;
        uint256 tokenId = nft.tokenId;

        if (collection == address(0))
            // NFT has never been wrapped
            return "";

        if (_currentTokenTypes[collection][tokenId] != id)
            // NFT has been wrapped, then unwrapped - and eventually re-wrapped
            return _unwrappedURI;

        // NFT is indeed wrapped within `id` token type
        return IERC721Metadata(collection).tokenURI(tokenId);
    }

    /**
     * @notice Returns the amount of tokens of token type `id` owned by `account`.
     * @dev `account` cannot be the zero address.
     * @param account The address of the account whose balance is queried.
     * @param id The token type whose balance is queried.
     * @return The amount of tokens of token type `id` owned by `account`.
     */
    function balanceOf(address account, uint256 id) public view override returns (uint256) {
        require(account != address(0), "sERC1155: balance query for the zero address");
        return id.toSERC20().balanceOf(account);
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

        emit TransferSingle(operator, from, to, id, amount);

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

        emit TransferBatch(operator, from, to, ids, amounts);

        _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }
  /* #endregion */

  /* #region IERC721Receiver */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    )
        external
        override
        returns (bytes4)
    {
        // TODO
        // address collection = _msgSender();

        // see https://gist.github.com/ageyev/779797061490f5be64fb02e978feb6ac
        // to see whether we can parse strings out of bytes or not

        // if we can't: delete the IERC721Receiver inheritance and the related ERC165 interface support
        return IERC721Receiver.onERC721Received.selector;
    }
  /* #endregion */

  /* #region sERC1155 */
    /**
     * @notice Mirrors sERC20s transfers.
     * @dev This function is called by sERC20s whenever a transfer occurs on the sERC20 layer. This enable the sERC1155
     * contract to emit a `TransferSingle` event, as required per the ERC1155 standard, each time a transfer occurs - 
     * even when this transfer occurs on the sERC20 layer.
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

        require(_NFTs[id].collection != address(0), "sERC1155: must be sERC20 to use transfer hook");

        emit TransferSingle(operator, from, to, id, amount);
    }

    /**
     * @notice Wraps the ERC721-compliant NFT belonging to `collection` and identified by `tokenId` into an sERC20.
     * Remarks:
     *  - This contract must be approved to transfer the NFT before this function is called.
     *  - sERC20-related parameters are checked in SERC20.initialize().
     * @param collection The address of the ERC721 contract the NFT to wrap belongs to.
     * @param tokenId The tokenId of the NFT to wrap.
     * @param name The name of the sERC20 to clone.
     * @param symbol The symbol of the sERC20 to clone.
     * @param cap The supply cap of the sERC20 to clone.
     * @param roles The addresses to which to assign the sERC20 to clone roles.
     * @param owner The address which is gonna be allowed to unwrap the NFT to wrap.
     */
    function wrap(
        address collection,
        uint256 tokenId,
        string memory name,
        string memory symbol,
        uint256 cap,
        address[6] memory roles,
        address owner
    )
        external
    {
        require(_currentTokenTypes[collection][tokenId] == 0, "sERC1155: NFT is already wrapped");
        require(collection.supportsInterface(0x80ac58cd), "sERC1155: NFT is not ERC721-compliant");

        address sERC20 = _sERC20Base.clone();
        uint256 id = sERC20.toId();
        
        _currentTokenTypes[collection][tokenId] = id;
        _NFTs[id] = NFT({ collection: collection, tokenId: tokenId, owner: owner });

        IERC721(collection).transferFrom(IERC721(collection).ownerOf(tokenId), address(this), tokenId);
        SERC20(sERC20).initialize(name, symbol, cap, roles);

        emit Wrap(collection, tokenId, id, sERC20, owner);
    }

    function unwrap(uint256 id, address recipient, bytes memory data) external {
        NFT storage nft = _NFTs[id];
        address collection = nft.collection;
        uint256 tokenId = nft.tokenId;

        require(collection != address(0), "sERC1155: NFT is not wrapped");
        require(_currentTokenTypes[collection][tokenId] == id, "sERC1155: NFT already unwrapped");
        require(_msgSender() == nft.owner, "sERC1155: must be owner to unwrap");

        _unwrap(collection, tokenId, id, recipient, data);
    }

    function unwrap(address sERC20, address recipient, bytes memory data) external {
        uint256 id = sERC20.toId();
        NFT storage nft = _NFTs[id];
        address collection = nft.collection;
        uint256 tokenId = nft.tokenId;

        require(collection != address(0), "sERC1155: NFT is not wrapped");
        require(_currentTokenTypes[collection][tokenId] == id, "sERC1155: NFT already unwrapped");
        require(_msgSender() == nft.owner, "sERC1155: must be owner to unwrap");

        _unwrap(collection, tokenId, id, recipient, data);
    }

    function updateUnwrappedURI(string memory unwrappedURI_) external {
        require(hasRole(ADMIN_ROLE, _msgSender()), "sERC1155: must have admin role to update unwrappedURI");

        _unwrappedURI = unwrappedURI_;
    }

    function unwrappedURI() public view returns (string memory) {
        return _unwrappedURI;
    }

    /**
     * @notice Returns the NFT associated to the `id` token type.
     * @param id The id of the token type whose NFT is queried.
     * @return The NFT associated to the `id` token type.
     */
    function NFTOf(uint256 id) public view returns (NFT memory) {
        return _NFTs[id];
    }

    /**
     * @notice Returns the NFT associated to the `sERC20` token.
     * @param sERC20 The address of the sERC20 whose NFT is queried.
     * @return The NFT associated to the `sERC20` token.
     */
    function NFTOf(address sERC20) public view returns (NFT memory) {
        return _NFTs[sERC20.toId()];
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
    function _unwrap(address collection, uint256 tokenId, uint256 id, address recipient, bytes memory data) private {
        delete _currentTokenTypes[collection][tokenId];

        IERC721(collection).safeTransferFrom(address(this), recipient, tokenId, data);

        emit Unwrap(collection, tokenId, id, tokenId.toAddress(), recipient);
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
