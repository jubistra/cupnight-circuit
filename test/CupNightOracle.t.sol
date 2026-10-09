// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CupNightOracle.sol";

contract CupNightOracleTest is Test {
    CupNightOracle public oracle;
    MockUSDC public usdc;
    
    address owner = address(this); // Test contract IS the owner
    address oracle_addr = makeAddr("oracle");
    address player1 = makeAddr("player1");
    address player2 = makeAddr("player2");
    
    uint256 constant ENTRY_FEE = 1000 * 1e6; // 1000 USDC
    
    function setUp() public {
        // Deploy mock USDC (ERC20)
        usdc = new MockUSDC();
        
        // Deploy contract — test contract (address(this)) becomes owner
        oracle = new CupNightOracle(address(usdc));
        oracle.setOracle(oracle_addr);
        
        // Mint USDC to players
        usdc.mint(player1, 10000 * 1e6);
        usdc.mint(player2, 10000 * 1e6);
    }
    
    function test_CreateTournament() public {
        uint64 startBlock = uint64(block.number + 1);
        uint64 endBlock = uint64(block.number + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        assertEq(oracle.nextTournamentId(), 2);
    }
    
    function test_EntryAndNFTMint() public {
        uint64 startBlock = uint64(block.number + 1);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Enter tournament
        vm.roll(startBlock + 10);
        vm.startPrank(player1);
        usdc.approve(address(oracle), ENTRY_FEE);
        oracle.joinTournament(1, ENTRY_FEE);
        
        // Verify entry via tuple destructuring (auto-generated getter returns tuple)
        (uint256 id, string memory city, uint64 startBlk, uint64 endBlk, address winner, bool settled, bool cancelled, uint256 pool, uint8 maxP, uint8 currP) = oracle.tournaments(1);
        assertEq(id, 1);
        assertEq(pool, ENTRY_FEE);
        assertTrue(!settled);
    }
    
    function test_ConfirmWinner() public {
        uint64 startBlock = uint64(block.number + 1);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Both players join
        vm.roll(startBlock + 10);
        for (uint i = 1; i <= 2; i++) {
            address player = i == 1 ? player1 : player2;
            vm.startPrank(player);
            usdc.approve(address(oracle), ENTRY_FEE);
            oracle.joinTournament(1, ENTRY_FEE);
        }
        vm.stopPrank(); // Stop the prank from the loop
        
        // Oracle confirms winner (simulated FC27 stat verification)
        address[] memory players = new address[](2);
        players[0] = player1;
        players[1] = player2;
        
        vm.prank(oracle_addr);
        oracle.confirmWinner(1, player1, players);
        
        // Directly check tournament state via external getter
        (uint256 id, string memory city, uint64 startBlk, uint64 endBlk, address winner, bool settled, bool cancelled, uint256 pool, uint8 maxP, uint8 currP) = oracle.tournaments(1);
        assertEq(id, 1);
        assertEq(winner, player1);
        assertTrue(settled);
    }
    
    function test_EntryFailsBeforeStart() public {
        uint64 startBlock = uint64(block.number + 100);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Approve first, then expectRevert on the joinTournament call
        vm.startPrank(player1);
        usdc.approve(address(oracle), ENTRY_FEE);
        vm.stopPrank();
        
        vm.expectRevert(bytes("Tournament not started"));
        vm.prank(player1);
        oracle.joinTournament(1, ENTRY_FEE);
    }
    
    function test_EntryClosed() public {
        uint64 startBlock = uint64(block.number + 100);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Approve first, then expectRevert on joinTournament
        vm.roll(endBlock + 10);
        vm.startPrank(player1);
        usdc.approve(address(oracle), ENTRY_FEE);
        vm.stopPrank();
        
        vm.expectRevert(bytes("Entry window closed"));
        vm.prank(player1);
        oracle.joinTournament(1, ENTRY_FEE);
    }
    
    function test_PoolFull() public {
        uint64 startBlock = uint64(block.number + 100);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2); // max 2 players
        
        // Activate tournament
        vm.roll(startBlock);
        
        // Both players join
        for (uint i = 1; i <= 2; i++) {
            address player = i == 1 ? player1 : player2;
            vm.startPrank(player);
            usdc.approve(address(oracle), ENTRY_FEE);
            oracle.joinTournament(1, ENTRY_FEE);
        }
        vm.stopPrank();
        
        // Verify pool is full (currentPlayers == maxPlayers)
        (,,, ,,,,, uint8 maxP, uint8 currP) = oracle.tournaments(1);
        assertEq(currP, maxP);
    }
    
    function test_GetActiveTournaments() public {
        uint64 startBlock = uint64(block.number + 100);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Not active yet (before start)
        uint256[] memory active = oracle.getActiveTournaments();
        assertEq(active.length, 0);
        
        // Activate it
        vm.roll(startBlock);
        active = oracle.getActiveTournaments();
        assertEq(active.length, 1);
        assertEq(active[0], 1);
    }
    
    function test_WinnerWithdrawal() public {
        uint64 startBlock = uint64(block.number + 100);
        uint64 endBlock = uint64(startBlock + 100);
        
        oracle.createTournament("Dubai", startBlock, endBlock, 2);
        
        // Both players join
        vm.roll(startBlock + 10);
        for (uint i = 1; i <= 2; i++) {
            address player = i == 1 ? player1 : player2;
            vm.startPrank(player);
            usdc.approve(address(oracle), ENTRY_FEE);
            oracle.joinTournament(1, ENTRY_FEE);
        }
        vm.stopPrank(); // Stop the prank from the loop
        
        // Oracle confirms winner (already sets isSettled = true internally)
        address[] memory players = new address[](2);
        players[0] = player1;
        players[1] = player2;
        
        vm.prank(oracle_addr);
        oracle.confirmWinner(1, player1, players);
        
        // Now winner can withdraw (tournament is already settled)
        uint256 balBefore = usdc.balanceOf(player1);
        vm.prank(player1);
        oracle.withdrawWinnings(1);
        // withdrawWinnings sends t.totalPool (entire pool) to winner
        assertEq(usdc.balanceOf(player1), balBefore + ENTRY_FEE * 2);
    }
}

// Mock USDC contract for testing
contract MockUSDC is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    string public name = "Mock USDC";
    string public symbol = "USDC";
    
    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
    
    function transfer(address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[sender] >= amount);
        require(allowance[sender][msg.sender] >= amount);
        balanceOf[sender] -= amount;
        allowance[sender][msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
}
