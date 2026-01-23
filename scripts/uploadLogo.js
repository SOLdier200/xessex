import { PinataSDK } from "pinata-web3";
import fs from "fs";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: "example-gateway.mypinata.cloud"
});

async function main() {
  // Read your logo from the public folder
  const fileBuffer = fs.readFileSync("/home/sol/xessex/public/logo.png");

  const upload = await pinata.upload.file(fileBuffer, {
    fileName: "logo.png",
    contentType: "image/png"
  });

  console.log("CID:", upload.cid);
  console.log("Gateway URL:", `${pinata.config.pinataGateway}/ipfs/${upload.cid}`);
}

main();
