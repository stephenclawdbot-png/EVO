const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const fs = require("fs");

async function main() {
  const keypairData = JSON.parse(
    fs.readFileSync("C:\\Users\\napol\\.config\\solana\\evo-deployer.json", "utf-8")
  );
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Payer:", payer.publicKey.toBase58());

  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  const programId = new PublicKey("7EbK3gcPnMvA7NYb5YdXRMEBQQrMkij4dv5RckYkYmFK");

  // Collection params
  const name = "Z";
  const supplyCap = 2000;
  const shatterFeeBps = 100;    // 1%
  const shatterFeeDest = 0;     // Treasury
  const tradeRoyaltyBps = 500;  // 5%
  const royaltyDest = 0;        // Treasury

  // PDAs
  const [collectionConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection"), Buffer.from(name, "utf-8")],
    programId
  );
  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol")],
    programId
  );
  console.log("Collection config PDA:", collectionConfig.toBase58());
  console.log("Protocol config PDA:", protocolConfig.toBase58());

  const treasury = new PublicKey("G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ");

  // Build instruction data (Borsh)
  const discriminator = Buffer.from([156, 251, 92, 54, 233, 2, 16, 82]);
  const nameBytes = Buffer.from(name, "utf-8");
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBytes.length);
  const supplyCapBytes = Buffer.alloc(4);
  supplyCapBytes.writeUInt32LE(supplyCap);
  const shatterFeeBytes = Buffer.alloc(2);
  shatterFeeBytes.writeUInt16LE(shatterFeeBps);
  const shatterDestByte = Buffer.from([shatterFeeDest]);
  const royaltyBytes = Buffer.alloc(2);
  royaltyBytes.writeUInt16LE(tradeRoyaltyBps);
  const royaltyDestByte = Buffer.from([royaltyDest]);

  const data = Buffer.concat([
    discriminator,
    nameLen, nameBytes,
    supplyCapBytes,
    shatterFeeBytes, shatterDestByte,
    royaltyBytes, royaltyDestByte,
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: collectionConfig, isSigner: false, isWritable: true },
      { pubkey: protocolConfig, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  console.log(`Creating collection "${name}" (supply: ${supplyCap}, shatter: ${shatterFeeBps}bps, royalty: ${tradeRoyaltyBps}bps)...`);
  const tx = new Transaction().add(instruction);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log("SUCCESS! Signature:", sig);
  console.log(`Collection "${name}" created!`);
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});