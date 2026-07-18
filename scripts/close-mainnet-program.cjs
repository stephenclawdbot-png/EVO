/**
 * Close the active EVO mainnet program and reclaim rent.
 * Run: node scripts/close-mainnet-program.cjs
 *
 * Requires: evo-deployer.json wallet keypair (upgrade authority) at:
 *   C:\Users\napol\.config\solana\evo-deployer.json
 */
const fs = require('fs');
const path = require('path');
const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');

const BPF_LOADER_UPGRADEABLE = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');

const PROGRAM_ID = new PublicKey('7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc');
const PROGRAM_DATA = new PublicKey('GFyp4c2oD5guefkAHF8M3xxKyvzVafuX7inyJGUd4wZy');

const WALLET_KEYPAIR_PATH = 'C:\\Users\\napol\\.config\\solana\\evo-deployer.json';

async function main() {
  const secret = JSON.parse(fs.readFileSync(WALLET_KEYPAIR_PATH, 'utf8'));
  const wallet = Keypair.fromSecretKey(Buffer.from(secret));

  console.log('Wallet pubkey:', wallet.publicKey.toBase58());
  console.log('Program ID:', PROGRAM_ID.toBase58());
  console.log('ProgramData:', PROGRAM_DATA.toBase58());

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // Sanity check
  const walletBalance = await connection.getBalance(wallet.publicKey);
  console.log(`Wallet balance: ${walletBalance} lamports (~${(walletBalance/LAMPORTS_PER_SOL).toFixed(6)} SOL)`);

  const programDataInfo = await connection.getAccountInfo(PROGRAM_DATA);
  if (!programDataInfo) {
    console.error('ERROR: ProgramData account is null — already closed?');
    process.exit(1);
  }
  console.log(`ProgramData lamports: ${programDataInfo.lamports} (~${(programDataInfo.lamports/LAMPORTS_PER_SOL).toFixed(6)} SOL)  size=${programDataInfo.data.length}`);

  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    console.error('ERROR: Program account is null');
    process.exit(1);
  }
  console.log(`Program lamports: ${programInfo.lamports} (~${(programInfo.lamports/LAMPORTS_PER_SOL).toFixed(6)} SOL)`);

  const expectedRefund = programDataInfo.lamports + programInfo.lamports;
  console.log(`Expected refund: ${expectedRefund} lamports (~${(expectedRefund/LAMPORTS_PER_SOL).toFixed(6)} SOL)`);

  // Build Close instruction: BpfUpgradeableLoader::Close (variant 5)
  // Account layout (per Solana CLI solana-program/src/program/bpf_loader_upgradeable.rs):
  //   [0] program_data (writable) — account being closed
  //   [1] recipient (writable) — where lamports go
  //   [2] authority (signer) — upgrade authority
  //   [3] program (writable) — also closed
  const closeIxData = Buffer.alloc(4);
  closeIxData.writeUInt32LE(5, 0); // variant 5 = Close

  const closeIx = new TransactionInstruction({
    programId: BPF_LOADER_UPGRADEABLE,
    data: closeIxData,
    keys: [
      { pubkey: PROGRAM_DATA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: true },
    ],
  });

  const tx = new Transaction().add(closeIx);
  tx.feePayer = wallet.publicKey;

  console.log('\nSubmitting close transaction...');
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log('SUCCESS! Signature:', sig);
    console.log(`https://solscan.io/tx/${sig}`);
  } catch (err) {
    console.error('Transaction failed:', err.message);
    if (err.logs) console.error('Logs:\n' + err.logs.join('\n'));
    process.exit(1);
  }

  // Verify
  const newBalance = await connection.getBalance(wallet.publicKey);
  console.log(`\nNew wallet balance: ${newBalance} lamports (~${(newBalance/LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
  const programAfter = await connection.getAccountInfo(PROGRAM_DATA);
  console.log(`ProgramData after close: ${programAfter ? 'STILL EXISTS' : 'CLOSED (null)'}`);
}

main().catch(e => { console.error(e); process.exit(1); });