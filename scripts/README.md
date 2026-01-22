Here’s a polished version you can drop straight into your repo.

Xessex Token Operations — README
A complete operational toolkit for creating, managing, distributing, and securing the Xessex (XESS) token on Solana.
All scripts are organized for safety, clarity, and repeatable execution.

Directory Structure
Code
/home/sol/
└── xessex/
    └── scripts/
        ├── mintToken.devnet.js
        ├── mintToken.mainnet.js
        ├── coldWalletTransfer.devnet.js
        ├── coldWalletTransfer.mainnet.js
        ├── interactiveSend.devnet.js
        ├── interactiveSend.mainnet.js
        ├── whereIsMyToken.devnet.js
        ├── whereIsMyToken.mainnet.js
        ├── keypairToMnemonic.js
        ├── encryptPrivateKey.js
        ├── decryptEncryptedPrivateKey.js
        └── README.md

/home/sol/.config/xessex/
    ├── treasury.devnet.json
    ├── treasury.mainnet.json
    └── any-other-keypairs.json
Keypair Storage
All custom keypairs (treasury, cold wallets, etc.) live in:

Code
/home/sol/.config/xessex/
This keeps sensitive material out of the repo and separate from scripts.

Your Solana CLI keypair remains in:

Code
~/.config/solana/id.json
Scripts Overview
Below is a description of every script and when to use it.

1. Minting Scripts
mintToken.devnet.js
Creates a devnet mint, mints full supply, and sets metadata.
Used for testing.

Run:

Code
node scripts/mintToken.devnet.js
mintToken.mainnet.js
Creates the real mainnet mint, mints full supply, and sets metadata.
Authorities remain unrevoked until you manually confirm everything.

Run:

Code
node scripts/mintToken.mainnet.js
2. Cold Wallet Transfer Scripts
coldWalletTransfer.devnet.js
Transfers a fixed amount (e.g., 150M) to your devnet cold wallet.
Creates treasury keypair if missing.

Run:

Code
node scripts/coldWalletTransfer.devnet.js
coldWalletTransfer.mainnet.js
Same as above, but for mainnet.

Run:

Code
node scripts/coldWalletTransfer.mainnet.js
3. Interactive Senders
These scripts let you choose:

Destination wallet

Amount

Whether to send to treasury

Treasury amount

interactiveSend.devnet.js
Run:

Code
node scripts/interactiveSend.devnet.js
interactiveSend.mainnet.js
Run:

Code
node scripts/interactiveSend.mainnet.js
4. Token Supply Explorer
whereIsMyToken.devnet.js
Shows every wallet holding your devnet XESS tokens.

Run:

Code
node scripts/whereIsMyToken.devnet.js
whereIsMyToken.mainnet.js
Same as above, but for mainnet.

Run:

Code
node scripts/whereIsMyToken.mainnet.js
5. Keypair Utilities
keypairToMnemonic.js
Converts a keypair JSON into a mnemonic phrase that restores the same wallet.

Edit the script to point to the keypair file, then run:

Code
node scripts/keypairToMnemonic.js
encryptPrivateKey.js
Encrypts a keypair using AES‑256‑GCM with a password.
Outputs a safe JSON blob you can store anywhere.

Run:

Code
node scripts/encryptPrivateKey.js
decryptEncryptedPrivateKey.js
Decrypts the encrypted JSON blob and restores the private key.

Run:

Code
node scripts/decryptEncryptedPrivateKey.js
Operational Flow (Recommended)
Devnet Testing
Mint devnet token

Test transfers

Test treasury logic

Test interactive sender

Verify supply with whereIsMyToken.devnet.js

Mainnet Launch
Run mintToken.mainnet.js

Verify mint + metadata

Distribute supply using interactive sender

Verify supply with whereIsMyToken.mainnet.js

Revoke authorities (separate script if needed)

Safety Notes
Never store private keys in the repo

Always verify addresses before sending

Always test on devnet first

Only revoke mint/update authorities when 100% ready
