const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

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

  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'target', 'idl', 'evo.json'), 'utf8'));
  const programId = new PublicKey('HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei');
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), { commitment: 'confirmed' });
  const program = new anchor.Program(idl, programId, provider);

  const treasury = wallet.publicKey;
  const treasuryAuthority = wallet.publicKey;
  const creationFee = 45_900_000;

  console.log('Initializing protocol...');
  console.log('  Treasury:', treasury.toBase58());
  console.log('  Treasury Authority:', treasuryAuthority.toBase58());
  console.log('  Creation Fee:', creationFee, 'lamports (', creationFee / 1e9, 'SOL)');

  const tx = await program.methods
    .initializeProtocol(treasury, treasuryAuthority, creationFee)
    .accounts({
      payer: wallet.publicKey,
      systemProgram: new PublicKey('11111111111111111111111111111111'),
    })
    .signers([wallet])
    .rpc();

  console.log('Protocol initialized! TX:', tx);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });