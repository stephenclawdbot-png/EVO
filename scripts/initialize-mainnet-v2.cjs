const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, SystemMessage } = require('@solana/web3.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function anchorDiscriminator(name) {
  return crypto.createHash('sha256').update(`global:${name}`).digest().slice(0, 8);
}

async function main() {
  const rpc = 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  const deployerKey = JSON.parse(
    fs.readFileSync(path.join(require('os').homedir(), '.config/solana/evo-deployer.json'), 'utf8')
  );
  const wallet = Keypair.fromSecretKey(Uint8Array.from(deployerKey));
  console.log('Deployer:', wallet.publicKey.toBase58());

  const balance = await connection.getBalance(wallet.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');

  const PROGRAM_ID = new PublicKey('HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei');

  // Protocol config PDA: seeds = ["protocol"]
  const [protocolConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    PROGRAM_ID
  );
  console.log('Protocol config PDA:', protocolConfigPda.toBase58());

  // Check if already initialized
  const existing = await connection.getAccountInfo(protocolConfigPda);
  if (existing) {
    console.log('Protocol already initialized! Account exists with', existing.lamports, 'lamports');
    return;
  }

  // Build instruction data: discriminator + treasury(32) + treasury_authority(32) + creation_fee(8)
  const discriminator = anchorDiscriminator('initialize_protocol');
  const treasury = wallet.publicKey.toBuffer();
  const treasuryAuthority = wallet.publicKey.toBuffer();
  const creationFee = BigInt(45_900_000);

  const data = Buffer.concat([
    discriminator,
    treasury,
    treasuryAuthority,
    Buffer.from(creationFee.toString(16).padStart(16, '0'), 'hex'),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: protocolConfigPda, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  console.log('Sending initialize_protocol transaction...');

  const tx = new Transaction().add(instruction);
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  console.log('Protocol initialized! TX:', sig);
  console.log('Verify: https://solscan.io/tx/' + sig);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });