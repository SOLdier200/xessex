/**
 * Merkle tree library for XESS claim system.
 * Uses keccak256 to match on-chain: solana_program::keccak::hashv
 *
 * V1: Leaf = hash(wallet || epoch || amount || index)
 * V2: Leaf = hash(userKey || epoch || amount || index || salt)
 */

import { keccak_256 } from "js-sha3";
import { PublicKey } from "@solana/web3.js";

// ==================== V1 Types (wallet-based) ====================

export type LeafInput = {
  wallet: string;        // base58 pubkey
  epoch: bigint;         // u64
  amountAtomic: bigint;  // u64
  index: number;         // u32
};

// ==================== V2 Types (wallet-based identity) ====================

export type LeafInputV2 = {
  userKey32: Buffer;     // 32 bytes - wallet pubkey bytes (not keccak hash)
  epoch: bigint;         // u64
  amountAtomic: bigint;  // u64
  index: number;         // u32
  salt32: Buffer;        // 32 bytes - per-(epoch, wallet) secret
};

export function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

export function keccak256(buf: Buffer): Buffer {
  const hash = keccak_256.create();
  hash.update(buf);
  return Buffer.from(hash.arrayBuffer());
}

/**
 * V1: Compute leaf hash matching on-chain:
 * hashv([wallet_bytes, epoch_le_u64, amount_le_u64, index_le_u32])
 */
export function leafHash(input: LeafInput): Buffer {
  const walletPk = new PublicKey(input.wallet);
  const data = Buffer.concat([
    walletPk.toBuffer(),
    u64le(input.epoch),
    u64le(input.amountAtomic),
    u32le(input.index),
  ]);
  return keccak256(data);
}

/**
 * DEPRECATED: V2 originally used keccak256(userId).
 * Now V2 uses wallet pubkey bytes directly.
 * Keeping for backward compatibility with old epochs.
 */
export function userKey32FromUserId(userId: string): Buffer {
  const hash = keccak_256.create();
  hash.update(userId);
  return Buffer.from(hash.arrayBuffer());
}

/**
 * V2 (wallet-based): Convert wallet pubkey to 32-byte user key.
 * userKey = wallet.toBytes() → 32 bytes (no hashing)
 */
export function userKey32FromWallet(walletBase58: string): Buffer {
  const pk = new PublicKey(walletBase58);
  return pk.toBuffer();
}

/**
 * V2: Compute leaf hash matching on-chain claim_v2:
 * hashv([wallet_pubkey, epoch_le_u64, amount_le_u64, index_le_u32, salt])
 *
 * userKey32 should be wallet.toBytes() (32 bytes), not keccak hash.
 */
export function leafHashV2(input: LeafInputV2): Buffer {
  if (input.userKey32.length !== 32) throw new Error("userKey32 must be 32 bytes");
  if (input.salt32.length !== 32) throw new Error("salt32 must be 32 bytes");

  const data = Buffer.concat([
    input.userKey32,           // 32 bytes
    u64le(input.epoch),        // 8 bytes
    u64le(input.amountAtomic), // 8 bytes
    u32le(input.index),        // 4 bytes
    input.salt32,              // 32 bytes
  ]);
  return keccak256(data);
}

/**
 * Generate a cryptographically secure 32-byte salt.
 */
export function generateSalt32(): Buffer {
  const crypto = require("crypto");
  return crypto.randomBytes(32);
}

/**
 * Parent hash: keccak256(left || right)
 */
export function parentHash(left: Buffer, right: Buffer): Buffer {
  return keccak256(Buffer.concat([left, right]));
}

export function toHex32(b: Buffer): string {
  if (b.length !== 32) throw new Error("expected 32 bytes");
  return b.toString("hex");
}

export function fromHex32(hex: string): Buffer {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length !== 64) throw new Error("expected 64 hex chars");
  return Buffer.from(h, "hex");
}

/**
 * Builds a binary merkle tree with "duplicate-last" padding.
 * If odd number of nodes at any layer, last node is duplicated.
 */
export function buildMerkle(leaves: Buffer[]): { root: Buffer; layers: Buffer[][] } {
  if (leaves.length === 0) throw new Error("no leaves");
  const layers: Buffer[][] = [leaves];

  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i];
      const right = prev[i + 1] ?? prev[i]; // duplicate last if odd
      next.push(parentHash(left, right));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];
  return { root, layers };
}

/**
 * Returns proof buffers for leaf index i: sibling at each layer.
 * Works with duplicate-last padding.
 */
export function getProof(layers: Buffer[][], leafIndex: number): Buffer[] {
  let idx = leafIndex;
  const proof: Buffer[] = [];

  for (let layer = 0; layer < layers.length - 1; layer++) {
    const nodes = layers[layer];
    const isRight = (idx & 1) === 1;
    const pairIndex = isRight ? idx - 1 : idx + 1;

    const sibling = nodes[pairIndex] ?? nodes[idx]; // if missing, duplicate self
    proof.push(sibling);

    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a proof matches the expected root.
 * Used for testing/debugging.
 */
export function verifyProof(
  leaf: Buffer,
  proof: Buffer[],
  root: Buffer,
  leafIndex: number
): boolean {
  let node = leaf;
  let idx = leafIndex;

  for (const sibling of proof) {
    const isRight = (idx & 1) === 1;
    const [left, right] = isRight ? [sibling, node] : [node, sibling];
    node = parentHash(left, right);
    idx = Math.floor(idx / 2);
  }

  return node.equals(root);
}

/**
 * Convert hex proof array to number[][] for Anchor instruction.
 */
export function proofHexToVec(proofHex: string[]): number[][] {
  return proofHex.map(hex => {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    const buf = Buffer.from(h, "hex");
    return [...buf];
  });
}
