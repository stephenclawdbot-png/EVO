// Create a collection on-chain — generic script for any creator.
// Usage: npx tsx scripts/create-collection.ts
// Edit the constants below for your collection.
// Run: npx tsx scripts/create-collection.ts

import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import {
  PROGRAM_ID,
  PROTOCOL_PDA,
  readProtocolConfig,
  getCollectionPDA,
  createCreateCollectionIx,
} from '../src/lib/evo-program';

const COLLECTION_NAME = 'MyCollection';  // CHANGE THIS to your collection name
const SUPPLY_CAP = 108;
const SHATTER_FEE_BPS = 500;      // 5%
const TRADE_ROYALTY_BPS = 500;    // 5%
const MINT_PRICE = 0.05 * LAMPORTS_PER_SOL;   // 0.05 SOL → creator
const LOCK_AMOUNT = 0.05 * LAMPORTS_PER_SOL;  // 0.05 SOL → floor

async function main() {
  const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Load keypair
  const keypairPath = path.join(process.env.USERPROFILE!, '.config', 'solana', 'evo-deployer.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  console.log('Payer:', payer.publicKey.toBase58());
  const balance = await conn.getBalance(payer.publicKey);
  console.log('Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  // Read protocol config
  const proto = await readProtocolConfig(conn);
  if (!proto) {
    console.error('Protocol not initialized!');
    process.exit(1);
  }
  console.log('Protocol treasury:', proto.treasury.toBase58());
  console.log('Creation fee:', proto.creationFeeLamports / LAMPORTS_PER_SOL, 'SOL');

  // Check if collection already exists
  const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
  const existing = await conn.getAccountInfo(collectionPda);
  if (existing) {
    console.log('Collection already exists at:', collectionPda.toBase58());
    console.log('Skipping creation.');
    return;
  }

  // Check we have enough balance
  const totalCost = proto.creationFeeLamports + 0.001 * LAMPORTS_PER_SOL;
  if (balance < totalCost) {
    console.error(`Insufficient balance. Need ~${totalCost / LAMPORTS_PER_SOL} SOL, have ${balance / LAMPORTS_PER_SOL} SOL`);
    process.exit(1);
  }

  // Build instruction
  const ix = createCreateCollectionIx(
    payer.publicKey,
    proto.treasury,
    COLLECTION_NAME,
    SUPPLY_CAP,
    SHATTER_FEE_BPS,
    'Treasury',
    TRADE_ROYALTY_BPS,
    'Creator',
    MINT_PRICE,
    LOCK_AMOUNT,
    '',  // metadata_uri — empty for now, update via update_metadata
    {    // lifecycle — Static by default
      lifecycleType: 'Static',
      maxStates: 1,
      revealAuthority: payer.publicKey,
      randomnessPolicy: 'None',
      manifestRoot: new Uint8Array(32),
      evolveTradeThreshold: 0,
      evolveFeedThreshold: 0,
      evolveHoldSeconds: 0,
      evolveLockedThreshold: 0,
      transitionPolicyHash: new Uint8Array(32),
      burnDestination: new PublicKey('1nc1nerator11111111111111111111111111111111'),
      artworkManifestHash: new Uint8Array(32),
    },
  );

  console.log('Instruction data length:', ix.data.length);

  const tx = new Transaction().add(ix);
  tx.feePayer = payer.publicKey;
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  console.log('Creating collection...');
  console.log('  Name:', COLLECTION_NAME);
  console.log('  Supply cap:', SUPPLY_CAP);
  console.log('  Shatter fee:', SHATTER_FEE_BPS / 100, '%');
  console.log('  Trade royalty:', TRADE_ROYALTY_BPS / 100, '%');
  console.log('  Mint price:', MINT_PRICE / LAMPORTS_PER_SOL, 'SOL');
  console.log('  Lock amount:', LOCK_AMOUNT / LAMPORTS_PER_SOL, 'SOL');
  console.log('  Collection PDA:', collectionPda.toBase58());

  const sig = await sendAndConfirmTransaction(conn, tx, [payer]);
  console.log('✅ Collection created!');
  console.log('Signature:', sig);
  console.log('Explorer: https://solscan.io/tx/' + sig);
}

main().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});