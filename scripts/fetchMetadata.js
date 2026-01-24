import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import pkg from "@metaplex-foundation/mpl-token-metadata";

const { fetchDigitalAsset } = pkg;

const umi = createUmi("https://api.devnet.solana.com");

const mint = "DYW4Q416BWgwrjLFvr3uVB9HDddkzzGj1RquerMkbZBu";

const run = async () => {
  const asset = await fetchDigitalAsset(umi, mint);

  console.log(
    JSON.stringify(
      asset,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
};

run();
