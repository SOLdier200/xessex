use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AKRLZssgxwQwC2gGgUtYtcU7JrhDyEfk1FHqQkZnFUax");

#[program]
pub mod xess_claim {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = admin;
        cfg.xess_mint = ctx.accounts.xess_mint.key();
        cfg.vault_authority_bump = ctx.bumps.vault_authority;
        Ok(())
    }

    pub fn set_epoch_root(ctx: Context<SetEpochRoot>, epoch: u64, root: [u8; 32]) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, XessError::NotAdmin);

        let e = &mut ctx.accounts.epoch_root;
        e.epoch = epoch;
        e.root = root;
        e.bump = ctx.bumps.epoch_root;
        Ok(())
    }

    pub fn set_admin(ctx: Context<SetAdmin>, new_admin: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, XessError::NotAdmin);
        ctx.accounts.config.admin = new_admin;
        Ok(())
    }

    pub fn set_mint(ctx: Context<SetMint>, new_mint: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, XessError::NotAdmin);
        ctx.accounts.config.xess_mint = new_mint;
        Ok(())
    }

    pub fn claim(
        ctx: Context<Claim>,
        epoch: u64,
        amount: u64,
        index: u32,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        require_eq!(ctx.accounts.epoch_root.epoch, epoch, XessError::BadEpoch);

        let leaf = leaf_hash(ctx.accounts.claimer.key(), epoch, amount, index);
        let ok = verify_merkle(leaf, &proof, ctx.accounts.epoch_root.root, index);
        require!(ok, XessError::BadProof);

        // Receipt PDA prevents double-claim (init happens once per epoch+user)
        let r = &mut ctx.accounts.receipt;
        r.epoch = epoch;
        r.claimer = ctx.accounts.claimer.key();
        r.amount = amount;
        r.index = index;
        r.bump = ctx.bumps.receipt;

        require_keys_eq!(ctx.accounts.vault_ata.mint, ctx.accounts.config.xess_mint, XessError::BadMint);
        require_keys_eq!(ctx.accounts.user_ata.mint, ctx.accounts.config.xess_mint, XessError::BadMint);

        let cfg_key = ctx.accounts.config.key();
        let seeds: &[&[u8]] = &[
            b"vault_authority",
            cfg_key.as_ref(),
            &[ctx.accounts.config.vault_authority_bump],
        ];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_ata.to_account_info(),
            to: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let signer_seeds = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    /// V2 claim instruction: allows claiming with userKey instead of wallet pubkey.
    /// Receipt PDA is keyed by (epoch, user_key) instead of (epoch, wallet).
    /// Anyone with the correct salt can claim to any wallet they control.
    pub fn claim_v2(
        ctx: Context<ClaimV2>,
        epoch: u64,
        amount: u64,
        index: u32,
        user_key: [u8; 32],   // keccak256(userId)
        salt: [u8; 32],       // per-(epoch, user) secret
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        require_eq!(ctx.accounts.epoch_root.epoch, epoch, XessError::BadEpoch);

        // Verify user_ata belongs to claimer (prevent routing to wrong wallet)
        require_keys_eq!(ctx.accounts.user_ata.owner, ctx.accounts.claimer.key(), XessError::BadOwner);

        let leaf = leaf_hash_v2(user_key, epoch, amount, index, salt);
        let ok = verify_merkle(leaf, &proof, ctx.accounts.epoch_root.root, index);
        require!(ok, XessError::BadProof);

        // Receipt PDA prevents double-claim (init happens once per epoch+user_key)
        let r = &mut ctx.accounts.receipt_v2;
        r.epoch = epoch;
        r.user_key = user_key;
        r.claimed_to = ctx.accounts.claimer.key();
        r.amount = amount;
        r.index = index;
        r.bump = ctx.bumps.receipt_v2;

        require_keys_eq!(ctx.accounts.vault_ata.mint, ctx.accounts.config.xess_mint, XessError::BadMint);
        require_keys_eq!(ctx.accounts.user_ata.mint, ctx.accounts.config.xess_mint, XessError::BadMint);

        // Verify vault_ata belongs to vault_authority (defense in depth)
        require_keys_eq!(ctx.accounts.vault_ata.owner, ctx.accounts.vault_authority.key(), XessError::BadOwner);

        let cfg_key = ctx.accounts.config.key();
        let seeds: &[&[u8]] = &[
            b"vault_authority",
            cfg_key.as_ref(),
            &[ctx.accounts.config.vault_authority_bump],
        ];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault_ata.to_account_info(),
            to: ctx.accounts.user_ata.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let signer_seeds = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

/* ----------------------------- Accounts ----------------------------- */

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub xess_mint: Pubkey,
    pub vault_authority_bump: u8,
}
impl Config {
    pub const SIZE: usize = 32 + 32 + 1;
}

#[account]
pub struct EpochRoot {
    pub epoch: u64,
    pub root: [u8; 32],
    pub bump: u8,
}
impl EpochRoot {
    pub const SIZE: usize = 8 + 32 + 1;
}

#[account]
pub struct Receipt {
    pub epoch: u64,
    pub claimer: Pubkey,
    pub amount: u64,
    pub index: u32,
    pub bump: u8,
}
impl Receipt {
    pub const SIZE: usize = 8 + 32 + 8 + 4 + 1;
}

/// V2 Receipt: keyed by (epoch, user_key) instead of (epoch, wallet)
#[account]
pub struct ReceiptV2 {
    pub epoch: u64,
    pub user_key: [u8; 32],   // keccak256(userId) - who earned this
    pub claimed_to: Pubkey,   // which wallet received tokens
    pub amount: u64,
    pub index: u32,
    pub bump: u8,
}
impl ReceiptV2 {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 4 + 1;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Config::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: PDA signer only
    #[account(
        seeds = [b"vault_authority", config.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub xess_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct SetEpochRoot<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = payer,
        space = 8 + EpochRoot::SIZE,
        seeds = [b"epoch_root", epoch.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_root: Account<'info, EpochRoot>,

    pub admin: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetMint<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct Claim<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: PDA signer used for token transfer
    #[account(
        seeds = [b"vault_authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [b"epoch_root", epoch.to_le_bytes().as_ref()],
        bump = epoch_root.bump
    )]
    pub epoch_root: Account<'info, EpochRoot>,

    #[account(
        init,
        payer = claimer,
        space = 8 + Receipt::SIZE,
        seeds = [b"receipt", epoch.to_le_bytes().as_ref(), claimer.key().as_ref()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// V2 Claim: Receipt PDA keyed by (epoch, user_key) instead of (epoch, wallet)
#[derive(Accounts)]
#[instruction(epoch: u64, amount: u64, index: u32, user_key: [u8; 32])]
pub struct ClaimV2<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,

    /// CHECK: PDA signer used for token transfer
    #[account(
        seeds = [b"vault_authority", config.key().as_ref()],
        bump = config.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [b"epoch_root", epoch.to_le_bytes().as_ref()],
        bump = epoch_root.bump
    )]
    pub epoch_root: Account<'info, EpochRoot>,

    #[account(
        init,
        payer = claimer,
        space = 8 + ReceiptV2::SIZE,
        seeds = [b"receipt_v2", epoch.to_le_bytes().as_ref(), user_key.as_ref()],
        bump
    )]
    pub receipt_v2: Account<'info, ReceiptV2>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut)]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/* ----------------------------- Merkle ----------------------------- */

/// V1 leaf hash: hash(wallet || epoch || amount || index)
fn leaf_hash(claimer: Pubkey, epoch: u64, amount: u64, index: u32) -> [u8; 32] {
    let epoch_b = epoch.to_le_bytes();
    let amt_b = amount.to_le_bytes();
    let idx_b = index.to_le_bytes();
    solana_program::keccak::hashv(&[claimer.as_ref(), &epoch_b, &amt_b, &idx_b]).to_bytes()
}

/// V2 leaf hash: hash(user_key || epoch || amount || index || salt)
fn leaf_hash_v2(user_key: [u8; 32], epoch: u64, amount: u64, index: u32, salt: [u8; 32]) -> [u8; 32] {
    solana_program::keccak::hashv(&[
        &user_key,                  // 32 bytes
        &epoch.to_le_bytes(),       // 8 bytes
        &amount.to_le_bytes(),      // 8 bytes
        &index.to_le_bytes(),       // 4 bytes
        &salt,                      // 32 bytes
    ]).to_bytes()
}

fn verify_merkle(mut node: [u8; 32], proof: &[[u8; 32]], root: [u8; 32], mut index: u32) -> bool {
    for p in proof.iter() {
        let (left, right) = if (index & 1) == 0 { (node, *p) } else { (*p, node) };
        node = solana_program::keccak::hashv(&[&left, &right]).to_bytes();
        index >>= 1;
    }
    node == root
}

/* ----------------------------- Errors ----------------------------- */

#[error_code]
pub enum XessError {
    #[msg("Not admin")]
    NotAdmin,
    #[msg("Bad epoch")]
    BadEpoch,
    #[msg("Bad merkle proof")]
    BadProof,
    #[msg("Bad mint")]
    BadMint,
    #[msg("Bad token account owner")]
    BadOwner,
}
