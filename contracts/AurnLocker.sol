// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal ERC-20 surface the locker needs.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title  AurnLocker
 * @notice Non-custodial ERC-20 time-locks with a fully public registry.
 *
 * Anyone can lock a token they hold until a chosen unlock time; the tokens sit in
 * this contract and can only be withdrawn by the lock's owner, and only once the
 * unlock time has passed. AURN never holds a key - every lock/unlock is signed by
 * the owner's own wallet. Every lock is readable by anyone through the view
 * functions below (no wallet required), so the list of locked tokens is public.
 */
contract AurnLocker {
    struct Lock {
        address owner;      // who can withdraw
        address token;      // the ERC-20 locked
        uint256 amount;     // amount actually held (measured post-transfer)
        uint64  lockedAt;   // unix seconds the lock was created
        uint64  unlockAt;   // unix seconds it becomes withdrawable
        bool    withdrawn;  // true once returned to the owner
    }

    Lock[] private _locks;
    mapping(address => uint256[]) private _byOwner;
    mapping(address => uint256[]) private _byToken;

    /// Currently-locked (not-yet-withdrawn) amount per token.
    mapping(address => uint256) public totalLocked;

    error ZeroAmount();
    error UnlockInPast();
    error NotOwner();
    error StillLocked();
    error AlreadyWithdrawn();
    error TransferFailed();

    event Locked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount, uint64 unlockAt);
    event Unlocked(uint256 indexed id, address indexed owner, address indexed token, uint256 amount);

    /**
     * @notice Lock `amount` of `token` until `unlockAt`. The caller must have
     *         approved this contract for at least `amount` first.
     * @return id The new lock's id (also its index).
     */
    function lock(address token, uint256 amount, uint64 unlockAt) external returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        if (unlockAt <= block.timestamp) revert UnlockInPast();

        // Measure what actually arrived so fee-on-transfer tokens lock the real amount.
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        _safeTransferFrom(token, msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;
        if (received == 0) revert ZeroAmount();

        id = _locks.length;
        _locks.push(Lock({
            owner: msg.sender,
            token: token,
            amount: received,
            lockedAt: uint64(block.timestamp),
            unlockAt: unlockAt,
            withdrawn: false
        }));
        _byOwner[msg.sender].push(id);
        _byToken[token].push(id);
        totalLocked[token] += received;

        emit Locked(id, msg.sender, token, received, unlockAt);
    }

    /// @notice Withdraw a matured lock back to its owner.
    function unlock(uint256 id) external {
        Lock storage l = _locks[id];
        if (l.owner != msg.sender) revert NotOwner();
        if (l.withdrawn) revert AlreadyWithdrawn();
        if (block.timestamp < l.unlockAt) revert StillLocked();

        l.withdrawn = true;
        totalLocked[l.token] -= l.amount;
        _safeTransfer(l.token, l.owner, l.amount);

        emit Unlocked(id, l.owner, l.token, l.amount);
    }

    // ------------------------------------------------------------------
    // Public views - callable by anyone, no wallet needed.
    // ------------------------------------------------------------------

    function locksCount() external view returns (uint256) {
        return _locks.length;
    }

    function getLock(uint256 id) external view returns (Lock memory) {
        return _locks[id];
    }

    /// @notice A page of locks [start, start+count) for cheap public listing.
    function getLocks(uint256 start, uint256 count) external view returns (Lock[] memory out) {
        uint256 n = _locks.length;
        if (start >= n) return new Lock[](0);
        uint256 end = start + count;
        if (end > n) end = n;
        out = new Lock[](end - start);
        for (uint256 i = start; i < end; i++) {
            out[i - start] = _locks[i];
        }
    }

    function ownerLockIds(address owner) external view returns (uint256[] memory) {
        return _byOwner[owner];
    }

    function tokenLockIds(address token) external view returns (uint256[] memory) {
        return _byToken[token];
    }

    // ------------------------------------------------------------------
    // Safe transfers - tolerate ERC-20s that return no value / return false.
    // ------------------------------------------------------------------

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
