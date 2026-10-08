# Hermes Oracle Bot Logic (Screenshot-to-Vault)

Since Cup Night Circuit is fully autonomous and uses crypto rails, we don't rely on a web form for score reporting. Instead, the **Hermes Bot** acts as the "Judge" and "Oracle." It verifies evidence sent via WhatsApp or Telegram and triggers the Smart Contract.

## 1. The Verification Workflow
*   **Input:** A player uploads a screenshot of the FC 27 "Post-Match Stats" screen to the bot DM.
*   **Mechanism:** Hermes uses `Vision AI + OCR` to read gamertags, match scores, and possession stats directly from the pixels.
*   **Validation:** The bot checks if:
    1.  The player is already 'joined' in the contract for this Night ID.
    2.  The timestamp of the screenshot is within the expected play window.
    3.  The data matches the opponent's report (or flags a dispute).

## 2. Step-by-Step Technical Flow

### Phase A: Connection & Registration
1. **Player** DMs `/join London` on WhatsApp/TG.
2. **Bot** responds: "Select your wallet to register."
3. **Player** connects MetaMask/RainbowKit -> Wallet address is linked to their Telegram/WhatsApp ID in the database (or encrypted IPFS).
4. **Bot** tells them to deposit entry fee (e.g., 0.05 USDC) into the Night's contract vault.

### Phase B: Match Reporting
1. **Player A & Player B** play their match on their physical consoles.
2. **Player A** takes a screenshot of the goal summary or stats screen -> Sends to Bot DM: "Match 1 Win."
3. **Hermes (Vision AI):** 
    - Analyzes image: Reads Player A's Gamertag vs Player B's Gamertag.
    - Reads Score: e.g., "Goals 4-2".
    - Checks timestamp against the scheduled match window.
4. **Validation:** 
    - If score is valid -> Bot sends a private message to **Player B**: "You reported 2 goals for Match 1. Reply 'YES' to confirm."
    - **If Player B replies 'YES':** Both results auto-confirm.

### Phase C: Handling Disputes (The "Cheater" Check)
*Scenario:* Player A sends "4-2". Player B sends "5-3".
*Action:* Hermes immediately detects the mismatch (>0 difference in goals). 
*Response:* Bot DMs both players: "Dispute detected. Results do not match."
*Resolution:* 
1.  **Bot Logic:** If both disagree, request a photo of the *physical screen*.
2.  **Hermes Role:** I visually inspect the TV/monitor photos via `vision_analyze` to confirm which gamer has more goals.
3.  **Finality:** Once one is verified as the winner (or if they draw), Hermes calls the smart contract's `confirmWinner` function.

## 3. Smart Contract Integration Trigger
When a valid match result is reached, Hermes executes the following via `web3.py` or `ethers.js`:

```python
# Pseudocode for Hermes Oracle logic
def process_screenshot(player_wallet, screenshot_bytes, match_id):
    # 1. Extract data from image
    data = vision_ai.read_fc_stats(screenshot_bytes)
    
    # 2. Check against opponent's submission (from DB)
    if data.is_match(opponent_submission):
        verify_and_confirm_winner(match_id)
    else:
        log_dispute_and_request_photo()

def verify_and_confirm_winner(tournament_id, winner_wallet):
    # 3. Call the Solidity Contract to release funds
    contract.functions.confirmWinner(
        tournament_id,
        winner_wallet
    ).transact()
```

## 4. Automation Scheduling
*   **Start Times:** Bot runs a cron job that checks `chain.link` or current block time against UTC/London/NY/Tokyo offsets.
*   **Activation:** Exactly at the localized 8 PM time, the bot broadcasts a message: "Cup Night [City] is OPEN! Deposit your entry fee now."

## 5. Integration with Telegram/WhatsApp
We will use `Telethon` (for TG) and `pywhatkit`/`WhatsAPI` wrappers (for WA). 
*   **Telegram** is preferred for the bot interactions because it supports Markdown formatting, inline buttons (for "Confirm Winner"), and larger file uploads by default.
*   **WhatsApp** will be used as a fallback mirror or for notifications due to its massive penetration in global markets.
