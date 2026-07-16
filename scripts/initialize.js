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

  const programId = new PublicKey("2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR");

  const [protocolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol")],
    programId
  );
  console.log("Protocol config PDA:", protocolConfig.toBase58());

  const treasury = new PublicKey("G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ");
  const creationFee = 67_890_000;

  const discriminator = Buffer.from([188, 233, 252, 106, 134, 146, 202, 91]);
  const treasuryBytes = treasury.toBuffer();
  const feeBytes = Buffer.alloc(8);
  feeBytes.writeBigUInt64LE(BigInt(creationFee));
  const data = Buffer.concat([discriminator, treasuryBytes, feeBytes]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: protocolConfig, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  console.log("Sending initialize_protocol transaction...");
  const tx = new Transaction().add(instruction);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log("SUCCESS! Signature:", sig);
  console.log("Protocol initialized!");
  console.log("  Treasury:", treasury.toBase58());
  console.log("  Creation fee:", creationFee / 1e9, "SOL");
}

main().catch((e) => {
  console.error("ERROR:", e.message || e);
  process.exit(1);
});