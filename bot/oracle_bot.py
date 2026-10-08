"""
CupNightOracle Bot — AI Judge for FIFA Tournaments
Runs on Hermes Python runtime, connects to Telegram & WhatsApp simultaneously.
Verifies player-submitted scores via Vision OCR, cross-checks both players, 
then triggers smart contract payouts when verified.

## Flow:
1. Player sends FC27 post-match screenshot to bot → Downloads image to `/tmp/review.png`
2. Hermes calls Vision AI + OCR pipeline locally (RTX 3090 GPU)
3. Extracts score "4–2", player gamertags, tournament name from the PNG
4. Matches entry against blockchain via Wagmi/etherspy
5. If both players submit matching scores → auto-claims winner
6. If mismatch → flags for manual review (Hermes admin)
7. Calls `releaseFunds()` on `CupNightOracle.sol` to distribute USDC winnings

## Architecture:
- Telegram + WhatsApp clients run in parallel event loops
- Vision OCR uses local Ollama (LLaVA or Qwen-VL) via Hermes CLI — no third-party cloud OCR
- Smart contract interacts via Wagmi + Base Sepolia testnet
"""

from telethon import TelegramClient
from pywhatkit import send_whatsapp_message
import base64
import json
import os
from web3 import Web3
from datetime import datetime, timezone, timedelta
from decimal import Decimal


# ─── Configuration (load from `.env`) ─────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")  # @CupNightOracleBot
WHATSAPP_PHONE   = os.getenv("WHATSAPP_PHONE_NUMBER")  # +XX... for pywhatkit outbound
TELEGRAM_API_ID  = os.getenv("TELEGRAM_API_ID")  
TELEGRAM_API_HASH= os.getenv("TELEGRAM_API_HASH")
USDC_ADDRESS     = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # Base USDC on dev env
CONTRACT_ADDR    = os.getenv("CUPNIGHT_CONTRACT_ADDRESS")
WAGMI_PROVIDER   = "https://sepolia.base.org"
Hermes_VISION_CLI_PATH = "/usr/local/bin/hermes-vision-ocr"  # Local binary or Hermes skill invocation


# ─── Web3 Setup ──────────────────────────────────────────
w3 = Web3(Web3.HTTPProvider(WAGMI_PROVIDER))
abi = json.loads(open('CupNightOracle.sol.abi').read()) if os.path.exists('CupNightOracle.sol.abi') else []
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDR), abi=abi)

# ─── State Tracking ──────────────────────────────────────
# Map wallet address ↔ WhatsApp/Telegram user IDs for dual routing
_wallet_to_phone = {}   # { '0xABC...': '+971 58 XXXXXXX' }
_wallet_to_tg = {}      # { '0xABC...': tg_user_id }


class CupNightOracleBot:
    def __init__(self):
        self.tg_client = TelegramClient('cupnight_session', TELEGRAM_API_ID, TELEGRAM_API_HASH)
        self.matches_pending = {}  # { tournamentId: [player1_data, player2_data] }

    # ─── Telegram Listener ────────────────────────────────
    def register_tg_handlers(self):
        @self.tg_client.on_new_message(chats=["@CupNightOracleBot"], func=lambda msg: True)  # Replace with actual telegram_chat_id or chat invite link
        async def message_handler(event):
            sender = event.sender_id
            user_msg = event.message.text.lower()

            if user_msg == '/join':
                # Return wallet connect instructions + stream link input prompt
                await self.tg_client.send_message(sender, "🏆 Cup Night Circuit: connect your MetaMask wallet at https://app.cupnight.io/join")
            
            elif user_msg.startswith('/enter '):
                parts = user_msg.split()
                # Validate tournament city + entry amount in USDC
                await self.handle_join_via_blockchain(sender, parts[1], int(parts[2]))

            elif user_msg.startswith('/stream '):
                stream_url = user_msg.split(' ', 1)[1]
                await self.tg_client.send_message(sender, f"📺 Stream link noted: {stream_url}. Press `/join` to register.")

            # ─── OCR Proof Submission ──────────────────────
            elif event.message.media and hasattr(event.message.media, 'document'):
                doc = event.message.media.document
                if doc.mime_type in ['image/png', 'image/jpeg']:
                    await self.handle_score_proof(sender, event.message)

    # ─── WhatsApp Mirror ──────────────────────────────────
    def register_whatsapp_handler(self):
        """WhatsApp mirrors join + proof submission for regions where TG isn't used."""
        pass  # pywhatkit has limited inbound. Use official WA Business API or WABA bot for full loopback

    # ─── Vision OCR (Local RTX 3090) ──────────────────────
    async def handle_score_proof(self, user_id, event):
        """Download image, run local Vision AI + Hermes OCR, return parsed results."""
        
        file = await event.get_media()  # Image PNG/JPG of post-match stats
        
        with open('/tmp/review.png', 'wb') as f:
            f.write(file)
        
        result = self.run_vision_ocr('/tmp/review.png')

        expected_keys = ['win_team_name', 'loss_team_name', 'score_a', 'score_b']
        extracted = result.get('extracted_data', {})

        for key in expected_keys:
            if key not in extracted:
                return await self.tg_client.send_message(
                    user_id, "❌ Screenshot unclear. Please resend a clean post-match stats screen.")

        score_a = int(extracted['score_a'])
        score_b = int(extracted['score_b'])
        player1_name = extracted.get('win_team_name', 'Unknown')
        player2_name = extracted.get('loss_team_name', 'Unknown')

        # Store for comparison in pending pool (both players submit)
        match_id = self.tournament_id_from_sender(user_id)
        
        if match_id not in self.matches_pending:
            self.matches_pending[match_id] = []

        self.matches_pending[match_id].append({
            'user_id': user_id,
            'player_name': player1_name if score_a > score_b else player2_name,
            'score_a': score_a,
            'score_b': score_b,
            'winner': player1_name if score_a > score_b else player2_name,
        })

        # If both players submitted for this match → auto judge!
        if len(self.matches_pending[match_id]) >= 2:
            await self.verify_match_result(match_id)

    # ─── Vision AI OCR Pipeline ─────────────────────────────
    def run_vision_ocr(self, image_path):
        """Call local Hermes CLI vision pipeline on RTX 3090 — no cloud dependency."""
        
        payload = {
            'image_base64': base64.b64encode(open(image_path, 'rb').read()).decode('utf-8'),
            'prompt': "Extract from FC27 Post-Match Stats: winning player gamertag, losing player gamertag, final score (winner_score - loser_score). Return JSON only.",
        }

        response = os.system(f'{Hermes_VISION_CLI_PATH} --base64 {payload["image_base64"]}')
        
        # Parse OCR text or use LLaVA/Qwen-VL direct output via Python subprocess
        pass  # Implementation depends on exact Hermes CLI spec for vision calls

    async def verify_match_result(self, match_id):
        players = self.matches_pending[match_id]
        player1 = players[0]
        player2 = players[1]

        if (player1['score_a'] == player2['score_a'] and 
            player1['score_b'] == player2['score_b']):
            
            # ✅ Scores verified — Hermes triggers smart contract payout
            self.tg_client.send_message(player1['user'], f"✅ Match result confirmed: {player1['winner']} wins!")

            await self.call_contract_verify_winner(
                match_id,
                Web3.to_checksum_address(self.player_to_wallet(player1['user_id'])),
                player1['winner']
            )
        else:
            # ❌ Dispute triggered — flag for manual review
            await self.tg_client.send_message(player1['user'], "⚠️ Mismatch detected. Hermes is reviewing both screenshots.")
        
        del self.matches_pending[match_id]

    async def call_contract_verify_winner(self, tournament_id, winner_addr, winner_name):
        """Call `releaseFunds()` and trigger payout."""
        
        # Prepare transaction data for wagmi / eth_call
        tx = await contract.functions.confirmWinner(
            tournament_id,
            winner_addr,
            [winner_addr]  # Player list for validation
        ).build_transaction({
            'from': Web3.to_checksum_address(os.getenv('HERMES_ORACLE_ADDRESS')),
            'gasPrice': w3.eth.gas_price,
        })

        # Submit signed transaction...
        pass  # Needs private key / secure vault (see Phase 1.5 setup)

    # ─── Admin Interface (`joinTournament`) ──────────────
    async def handle_join_via_blockchain(self, user_id, city_name, entry_amount_usdc):
        """Parse city name + USDC amount, call `createTournament()` + `joinTournament()`."""
        
        # Fetch wallet address from Telegram user ↔ wallet mapping (Phase 1.4)
        wallet_addr = self.tg_user_to_wallet(user_id)

        tx_hash = await contract.functions.joinTournament(
            int(city_name),  # tournamentId mapped to city
            entry_amount_usdc * 1_000_000,  # USDC has 6 decimals
            {'from': Web3.to_checksum_address(wallet_addr)}
        ).transact()

        return tx_hash.hex()


# ─── Launch Server ──────────────────────────────────────
if __name__ == "__main__":
    bot = CupNightOracleBot()
    bot.register_tg_handlers()  # Telegram parallel loop
    bot.register_whatsapp_handler()  # WhatsApp parallel loop
    
    print("🤖 Cup Night Oracle Bot running. Waiting for FC27 screenshots...")
    run_forever()
