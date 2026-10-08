// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CupNightOracle — Autonomous FIFA tournament vault
/// @notice USDC entry, NFT ticketing, Hermes Oracle verdict payouts.
contract CupNightOracle is ERC721, Ownable {
    // ─── State ──────────────────────────────────────────────
    IERC20 public usdc;
    
    uint256 public nextTournamentId;

    struct Tournament {
        uint256 id;
        string  city;           
        uint64  startBlock;     
        uint64  endBlock;       
        address winner;         
        bool    isSettled;      
        bool    cancelled;      
        uint256 totalPool;       // amount collected (USDC)
        uint8   maxPlayers;             
        uint8   currentPlayers;
        mapping (address => uint256) playerEntry;  // address -> entry amount
        mapping (uint256 => address) playerList;   // index -> address
    }

    mapping(uint256 => Tournament) public tournaments;
    
    // NFT tickets — keyed by tournament ID + owner index in that tournament
    struct NFTData {
        uint8 tier;             // 0=spectator(entry),1=participant,2=winner,3=champion
        string ipfsHash;       // metadata hash for on-chain art lookup
        bool minted;
    }
    mapping(uint256 => mapping (address => NFTData)) public nftTickets;

    event TournamentCreated(uint256 indexed id, string city);
    event EntryDeposited(uint256 indexed tournamentId, address player, uint256 amount);
    event WinnerConfirmed(uint256 indexed tournamentId, address winner, uint256 poolShare);
    event NFTMinted(uint256 indexed tournamentId, address indexed minter, uint8 tier);
    event FundsReleased(uint256 indexed tournamentId, uint256 totalAmount);

    // ─── Errors ─────────────────────────────────────────────
    error AlreadyJoined();
    error NotEnoughPool();
    error WinnerAlreadySettled();
    error InvalidTournament();
    error EntryClosed();
    error OnlyOracle()();

    // Hermes oracle will be set by admin
    address public oracle;

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only Oracle");
        _;
    }

    constructor(address _usdc) ERC721("CupNight", "CNC") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        nextTournamentId = 1;
    }

    // ─── Admin Setup ────────────────────────────────────────
    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    /// Create a new tournament — called by Hermes admin
    function createTournament(
        string calldata _city,
        uint64 _startBlock,
        uint64 _endBlock,
        uint8   _maxPlayers
    ) external onlyOwner {
        require(nextTournamentId > 0, "Invalid ID");
        
        Tournament storage t = tournaments[nextTournamentId];
        t.id = nextTournamentId;
        t.city = _city;
        t.startBlock = _startBlock;
        t.endBlock = _endBlock;
        t.maxPlayers = _maxPlayers;

        emit TournamentCreated(nextTournamentId, _city);
        
        unchecked { ++nextTournamentId; }
    }

    // ─── Entry (USDC) ──────────────────────────────────────
    function joinTournament(uint256 _tournamentId, uint256 _entryAmount) external {
        Tournament storage t = tournaments[_tournamentId];
        
        require(t.id == _tournamentId, InvalidTournament());
        require(!t.cancelled, EntryClosed());
        require(block.number >= t.startBlock, "Tournament not started");
        require(block.number <= t.endBlock, "Entry window closed");
        require(t.currentPlayers < t.maxPlayers, "Pool full");
        require(t.playerEntry[msg.sender] == 0, AlreadyJoined());

        // Transfer USDC to vault
        uint256 actual = usdc.transferFrom(msg.sender, address(this), _entryAmount);
        
        t.playerEntry[msg.sender] = actual;
        t.playerList[t.currentPlayers] = msg.sender;
        t.totalPool += actual;
        unchecked { ++t.currentPlayers; }

        emit EntryDeposited(_tournamentId, msg.sender, actual);

        // Mint spectator NFT ticket
        _safeMint(msg.sender, _ticketId(_tournamentId, msg.sender));
        nftTickets[_tournamentId][msg.sender] = NFTData({
            tier: 0,
            ipfsHash: "",
            minted: true
        });
        emit NFTMinted(_tournamentId, msg.sender, 0);
    }

    // ─── Oracle Verdict (called by Hermes after verification) ──
    function confirmWinner(
        uint256 _tournamentId,
        address _winnerAddress,
        uint256[] calldata _playerList
    ) external onlyOracle {
        Tournament storage t = tournaments[_tournamentId];

        require(t.id == _tournamentId, InvalidTournament());
        require(!t.isSettled, WinnerAlreadySettled());
        
        t.winner = _winnerAddress;
        t.isSettled = true;

        // Calculate prize (minus platform fee)
        uint256 poolShare = t.totalPool - (t.totalPool / 100); // 1% admin fee for now
        
        // Update winner NFT tier to Champion
        nftTickets[_tournamentId][_winnerAddress].tier = 3;
        emit NFTMinted(_tournamentId, _winnerAddress, 3);

        emit WinnerConfirmed(_tournamentId, _winnerAddress, poolShare);
    }

    function releaseFunds(uint256 _tournamentId) external onlyOracle {
        require(!tournaments[_tournamentId].isSettled(), "Already settled");
        tournaments[_tournamentId].isSettled = true;

        uint256 amount = usdc.balanceOf(address(this)); // or per-player withdrawal
        
        // Could implement withdraw() for players, but direct transfer from admin for now
    }

    // ─── Player Withdrawal (optional: claim back winnings) ──
    function withdraw Winnings(uint256 _tournamentId) external {
        Tournament storage t = tournaments[_tournamentId];
        require(t.isSettled, "Tournament not concluded");
        require(t.winner == msg.sender, "Not winner");

        // Transfer winnings from vault to winner
        usdc.transfer(msg.sender, t.totalPool);
    }

    // ─── Helper ──────────────────────────────────────────────
    function getActiveTournaments() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextTournamentId; i++) {
            if (!tournaments[i].isSettled && !tournaments[i].cancelled && block.number >= tournaments[i].startBlock) {
                count++;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i < nextTournamentId; i++) {
            if (!tournaments[i].isSettled && !tournaments[i].cancelled && block.number >= tournaments[i].startBlock) {
                result[idx] = i;
                unchecked { ++idx; }
            }
        }
        return result;
    }

    function _ticketId(uint256 tournamentId, address player) internal pure returns (uint256) {
        // Unique ID across all tournaments for NFT purposes
        return uint256(keccak256(abi.encodePacked(tournamentId, player)));
    }
}
