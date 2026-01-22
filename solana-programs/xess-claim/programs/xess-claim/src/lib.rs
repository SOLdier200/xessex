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

/* ----------------------------- Merkle ----------------------------- */

fn leaf_hash(claimer: Pubkey, epoch: u64, amount: u64, index: u32) -> [u8; 32] {
    let epoch_b = epoch.to_le_bytes();
    let amt_b = amount.to_le_bytes();
    let idx_b = index.to_le_bytes();
    solana_program::keccak::hashv(&[claimer.as_ref(), &epoch_b, &amt_b, &idx_b]).to_bytes()
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
}
