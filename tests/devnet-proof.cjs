/**
 * EVO Devnet End-to-End Proof Test
 *
 * Tests the complete lifecycle on Solana devnet:
 *   1. Initialize protocol
 *   2. Create collection with manifest hash committed on-chain
 *   3. Commit reveal secret
 *   4. Forge EVO #0 and #1
 *   5. Verify ownership on-chain
 *   6. Reveal collection
 *   7. Feed + evolve EVO #1
 *   8. List + buy (trade) EVO #0
 *   9. Shatter EVO #0 and verify SOL return
 *  10. Verify manifest hash matches on-chain commitment
 *
 * Usage:
 *   node tests/devnet-proof.cjs
 *
 * Requires:
 *   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
 *   ANCHOR_WALLET=~/.config/solana/evo-deployer.json
 */

const anchor = require("@coral-xyz/anchor");
const {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} = require("@solana/web3.js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { keccak_256 } = require("js-sha3");

// ─── Constants ─────────────────────────────────────────────
const PROGRAM_ID = new PublicKey(
  "7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc"
);
const INCINERATOR = new PublicKey(
  "1nc1nerator11111111111111111111111111111111"
);
const EVO_SPACE = 1109;

const CREATION_FEE = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
const MINT_PRICE = 0.0001 * LAMPORTS_PER_SOL; // 0.0001 SOL
const LOCK_AMOUNT = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL
const SHATTER_FEE_BPS = 500; // 5%
const ROYALTY_BPS = 500; // 5%
const FEED_THRESHOLD = 0.001 * LAMPORTS_PER_SOL; // 0.001 SOL

const COLLECTION_NAME = "devproof2";
const SUPPLY_CAP = 5;
const MAX_STATES = 2; // Genesis + Evolved

const MANIFEST_URL =
  "https://raw.githubusercontent.com/stephenclawdbot-png/EVO/main/tests/devnet-assets/manifest.json";
const MANIFEST_HASH = Buffer.from(
  "89b0813f32fdfa62e59c03ba76b13a2a00821115baf1c0b2361389d76f6e00c1",
  "hex"
);

// ─── Results tracking ──────────────────────────────────────
const results = [];
function record(step, expected, actual, txSig, extra = {}) {
  const pass = JSON.stringify(expected) === JSON.stringify(actual);
  const entry = {
    step,
    expected: typeof expected === "object" ? JSON.stringify(expected) : String(expected),
    actual: typeof actual === "object" ? JSON.stringify(actual) : String(actual),
    pass,
    txSig: txSig || null,
    ...extra,
  };
  results.push(entry);
  const status = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`\n[${status}] ${step}`);
  if (txSig) console.log(`  tx: ${txSig}`);
  console.log(`  expected: ${entry.expected}`);
  console.log(`  actual:   ${entry.actual}`);
  if (extra.note) console.log(`  note: ${extra.note}`);
  return entry;
}

function lamportsToSol(l) { return (l / LAMPORTS_PER_SOL).toFixed(6); }

// ─── PDA helpers ───────────────────────────────────────────
const protocolPda = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol")],
  PROGRAM_ID
)[0];

const collectionPda = (name) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("collection"), Buffer.from(name)],
    PROGRAM_ID
  )[0];

const evoPda = (collectionPk, evoId) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("evo"), collectionPk.toBuffer(), Buffer.from(new anchor.BN(evoId).toArray("le", 4))],
    PROGRAM_ID
  )[0];

// ─── Sleep helper ──────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  EVO Devnet End-to-End Proof Test");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Program: ${PROGRAM_ID.toBase58()}`);
  console.log(`  Network: ${process.env.ANCHOR_PROVIDER_URL || "default"}`);
  console.log(`  Collection: ${COLLECTION_NAME}`);
  console.log(`  Manifest hash: ${MANIFEST_HASH.toString("hex")}`);
  console.log("═══════════════════════════════════════════════════\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Evo
    ? anchor.workspace.Evo
    : new anchor.Program(
        JSON.parse(
          fs.readFileSync(path.join(__dirname, "..", "target", "idl", "evo.json"), "utf8")
        ),
        PROGRAM_ID,
        provider
      );

  const wallet = provider.wallet;
  const connection = provider.connection;
  const deployerPk = wallet.publicKey;

  console.log(`Deployer: ${deployerPk.toBase58()}`);
  const balance = await connection.getBalance(deployerPk);
  console.log(`Balance: ${lamportsToSol(balance)} SOL\n`);

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("❌ Insufficient SOL. Need at least 0.1 SOL for testing.");
    process.exit(1);
  }

  // Generate keypairs
  const buyer = Keypair.generate();
  const revealAuthority = Keypair.generate();
  const revealSecret = crypto.randomBytes(32);
  const commitment = Buffer.from(keccak_256(revealSecret), "hex");

  console.log(`Buyer: ${buyer.publicKey.toBase58()}`);
  console.log(`Reveal Authority: ${revealAuthority.publicKey.toBase58()}`);
  console.log(`Reveal commitment: ${commitment.toString("hex")}\n`);

  // If protocol already initialized, fetch the existing treasury address
  let treasury = Keypair.generate();
  const protoInfo = await connection.getAccountInfo(protocolPda);
  if (protoInfo) {
    const proto = await program.account.protocolConfig.fetch(protocolPda);
    const existingTreasury = proto.treasury;
    console.log(`Protocol already initialized. Treasury: ${existingTreasury.toBase58()}`);
    // We can't sign for the existing treasury, but we don't need to —
    // it's just a SystemAccount that receives fees, not a signer.
    // We'll use its address for the collection creation.
    treasury = { publicKey: existingTreasury };
  }

  // Fund buyer and reveal authority
  console.log("─ Funding test wallets ─");
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: deployerPk,
      toPubkey: buyer.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    }),
    SystemProgram.transfer({
      fromPubkey: deployerPk,
      toPubkey: revealAuthority.publicKey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    })
  );
  const fundSig = await provider.sendAndConfirm(fundTx);
  await sleep(2000);
  const buyerBal = await connection.getBalance(buyer.publicKey);
  const revealBal = await connection.getBalance(revealAuthority.publicKey);
  record(
    "Fund buyer + reveal authority",
    true,
    buyerBal > 0 && revealBal > 0,
    fundSig,
    { buyerBalance: lamportsToSol(buyerBal), revealAuthBalance: lamportsToSol(revealBal) }
  );

  const collPk = collectionPda(COLLECTION_NAME);
  const evo0Pk = evoPda(collPk, 0);
  const evo1Pk = evoPda(collPk, 1);

  // ═══════════════════════════════════════════════════════
  // STEP 1: Initialize Protocol (if not already done)
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 1: Initialize Protocol ─");
  let protocolSig = null;
  try {
    const protoInfo = await connection.getAccountInfo(protocolPda);
    if (protoInfo) {
      console.log("  Protocol already initialized, skipping");
      record("Initialize protocol", "already exists", "already exists", null);
    } else {
      protocolSig = await program.methods
        .initializeProtocol(treasury.publicKey, new anchor.BN(CREATION_FEE))
        .accounts({
          protocolConfig: protocolPda,
          payer: deployerPk,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      await sleep(2000);
      const proto = await program.account.protocolConfig.fetch(protocolPda);
      record(
        "Initialize protocol",
        true,
        proto.initialized && proto.treasury.toBase58() === treasury.publicKey.toBase58(),
        protocolSig,
        { treasury: proto.treasury.toBase58(), creationFee: lamportsToSol(proto.creationFeeLamports.toNumber()) }
      );
    }
  } catch (e) {
    record("Initialize protocol", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 2: Create Collection with manifest hash
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 2: Create Collection ─");
  const lifecycleParams = {
    lifecycleType: { revealAndEvolve: {} },
    maxStates: MAX_STATES,
    revealAuthority: revealAuthority.publicKey,
    randomnessPolicy: { batchReveal: {} },
    manifestRoot: Array(32).fill(1),
    evolveTradeThreshold: 0,
    evolveFeedThreshold: new anchor.BN(FEED_THRESHOLD),
    evolveHoldSeconds: new anchor.BN(0),
    evolveLockedThreshold: new anchor.BN(0),
    transitionPolicyHash: Array(32).fill(0),
    burnDestination: PublicKey.default,
    artworkManifestHash: Array.from(MANIFEST_HASH),
  };

  let createSig = null;
  try {
    // Check if collection already exists
    const collInfo = await connection.getAccountInfo(collPk);
    if (collInfo) {
      console.log("  Collection already exists, skipping creation");
      record("Create collection", "already exists", "already exists", null);
    } else {
      createSig = await program.methods
        .createCollection(
          COLLECTION_NAME,
          SUPPLY_CAP,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          new anchor.BN(MINT_PRICE),
          new anchor.BN(LOCK_AMOUNT),
          MANIFEST_URL,
          lifecycleParams
        )
        .accounts({
          collectionConfig: collPk,
          protocolConfig: protocolPda,
          treasury: treasury.publicKey,
          payer: deployerPk,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      await sleep(2000);
    }

    const cfg = await program.account.collectionConfig.fetch(collPk);
    record(
      "Create collection - name",
      COLLECTION_NAME,
      cfg.name,
      createSig
    );
    record(
      "Create collection - supply cap",
      SUPPLY_CAP,
      cfg.supplyCap,
      null
    );
    record(
      "Create collection - creator",
      deployerPk.toBase58(),
      cfg.creator.toBase58(),
      null
    );
    record(
      "Create collection - lifecycle type",
      "revealAndEvolve",
      Object.keys(cfg.lifecycleType)[0],
      null
    );
    record(
      "Create collection - max states",
      MAX_STATES,
      cfg.maxStates,
      null
    );
    record(
      "Create collection - manifest hash",
      MANIFEST_HASH.toString("hex"),
      Buffer.from(cfg.artworkManifestHash).toString("hex"),
      null
    );
    record(
      "Create collection - metadata URI",
      MANIFEST_URL,
      cfg.metadataUri,
      null
    );
  } catch (e) {
    record("Create collection", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: Commit Reveal
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 3: Commit Reveal ─");
  let commitSig = null;
  try {
    const cfgBefore = await program.account.collectionConfig.fetch(collPk);
    if (cfgBefore.revealCommitment.some((b) => b !== 0)) {
      console.log("  Reveal already committed, skipping");
      record("Commit reveal", "already committed", "already committed", null);
    } else {
      commitSig = await program.methods
        .commitReveal(commitment)
        .accounts({
          collection: collPk,
          authority: deployerPk,
        })
        .rpc();
      await sleep(2000);
      const cfg = await program.account.collectionConfig.fetch(collPk);
      record(
        "Commit reveal - commitment stored",
        commitment.toString("hex"),
        Buffer.from(cfg.revealCommitment).toString("hex"),
        commitSig
      );
    }
  } catch (e) {
    record("Commit reveal", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: Forge EVO #0 and #1
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 4: Forge EVOs ─");
  const resonanceSeed = Buffer.from(Array(32).fill(7));

  for (const evoId of [0, 1]) {
    const evoPk = evoId === 0 ? evo0Pk : evo1Pk;
    try {
      const evoInfo = await connection.getAccountInfo(evoPk);
      if (evoInfo) {
        console.log(`  EVO #${evoId} already exists, skipping`);
        record(`Forge EVO #${evoId}`, "already exists", "already exists", null);
      } else {
        const forgeSig = await program.methods
          .forge(evoId, resonanceSeed)
          .accounts({
            evo: evoPk,
            collectionConfig: collPk,
            protocolConfig: protocolPda,
            creator: deployerPk,
            owner: buyer.publicKey,
          })
          .signers([buyer])
          .rpc();
        await sleep(2000);
        record(`Forge EVO #${evoId}`, "success", "success", forgeSig);
      }
    } catch (e) {
      record(`Forge EVO #${evoId}`, "success", `error: ${e.message}`, null);
      console.error(e);
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: Verify Ownership
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 5: Verify Ownership ─");
  try {
    const evo0 = await program.account.evoAccount.fetch(evo0Pk);
    record(
      "EVO #0 owner",
      buyer.publicKey.toBase58(),
      evo0.owner.toBase58(),
      null
    );
    record(
      "EVO #0 locked lamports",
      LOCK_AMOUNT,
      evo0.lockedLamports.toNumber(),
      null
    );
    record(
      "EVO #0 current state",
      0,
      evo0.currentState,
      null
    );
    record(
      "EVO #0 is shattered",
      false,
      evo0.isShattered,
      null
    );

    const evo1 = await program.account.evoAccount.fetch(evo1Pk);
    record(
      "EVO #1 owner",
      buyer.publicKey.toBase58(),
      evo1.owner.toBase58(),
      null
    );
    record(
      "EVO #1 locked lamports",
      LOCK_AMOUNT,
      evo1.lockedLamports.toNumber(),
      null
    );
    record(
      "EVO #1 current state",
      0,
      evo1.currentState,
      null
    );
  } catch (e) {
    record("Verify ownership", "fetch success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 6: Reveal Collection
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 6: Reveal Collection ─");
  try {
    const cfgBefore = await program.account.collectionConfig.fetch(collPk);
    if (cfgBefore.isRevealed) {
      console.log("  Collection already revealed, skipping");
      record("Reveal collection", "already revealed", "already revealed", null);
    } else {
      const revealSig = await program.methods
        .revealCollection(revealSecret)
        .accounts({
          collection: collPk,
          authority: revealAuthority.publicKey,
        })
        .signers([revealAuthority])
        .rpc();
      await sleep(2000);
      const cfg = await program.account.collectionConfig.fetch(collPk);
      record(
        "Reveal collection - is revealed",
        true,
        cfg.isRevealed,
        revealSig
      );
      const expectedEntropy = Buffer.from(keccak_256(revealSecret), "hex");
      record(
        "Reveal collection - entropy matches keccak256(secret)",
        expectedEntropy.toString("hex"),
        Buffer.from(cfg.revealEntropy).toString("hex"),
        null
      );
    }
  } catch (e) {
    record("Reveal collection", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 7: Feed + Evolve EVO #1
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 7: Feed + Evolve EVO #1 ─");
  try {
    const evo1Before = await program.account.evoAccount.fetch(evo1Pk);
    const prevState = evo1Before.currentState;

    // Feed
    const feedSig = await program.methods
      .feed(new anchor.BN(FEED_THRESHOLD))
      .accounts({ evo: evo1Pk, feeder: buyer.publicKey })
      .signers([buyer])
      .rpc();
    await sleep(2000);
    const evo1Fed = await program.account.evoAccount.fetch(evo1Pk);
    record(
      "Feed EVO #1 - feed count",
      evo1Before.feedCount + 1,
      evo1Fed.feedCount,
      feedSig
    );
    record(
      "Feed EVO #1 - total fed",
      evo1Before.totalFedLamports.toNumber() + FEED_THRESHOLD,
      evo1Fed.totalFedLamports.toNumber(),
      null
    );

    // Evolve
    const evolveSig = await program.methods
      .evolve(1)
      .accounts({ evo: evo1Pk, collection: collPk })
      .rpc();
    await sleep(2000);
    const evo1Evolved = await program.account.evoAccount.fetch(evo1Pk);
    record(
      "Evolve EVO #1 - state advanced",
      prevState + 1,
      evo1Evolved.currentState,
      evolveSig
    );
  } catch (e) {
    record("Feed + Evolve EVO #1", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 8: List + Buy (Trade) EVO #0
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 8: Trade EVO #0 ─");
  try {
    const TRADE_PRICE = 0.002 * LAMPORTS_PER_SOL; // 0.002 SOL

    // List
    const listSig = await program.methods
      .list(new anchor.BN(TRADE_PRICE))
      .accounts({ evo: evo0Pk, seller: buyer.publicKey })
      .signers([buyer])
      .rpc();
    await sleep(2000);
    const evo0Listed = await program.account.evoAccount.fetch(evo0Pk);
    record(
      "List EVO #0 - is listed",
      true,
      evo0Listed.isListed,
      listSig
    );
    record(
      "List EVO #0 - price",
      TRADE_PRICE,
      evo0Listed.listPriceLamports.toNumber(),
      null
    );

    // Buy (deployer buys from buyer)
    const sellerBefore = await connection.getBalance(buyer.publicKey);
    const creatorBefore = await connection.getBalance(deployerPk);
    const buyerBefore = await connection.getBalance(deployerPk);

    const buySig = await program.methods
      .buy(0)
      .accounts({
        evo: evo0Pk,
        collectionConfig: collPk,
        protocolConfig: protocolPda,
        seller: buyer.publicKey,
        creator: deployerPk,
        buyer: deployerPk,
        treasury: treasury.publicKey,
        incinerator: INCINERATOR,
      })
      .rpc();
    await sleep(2000);
    const evo0Bought = await program.account.evoAccount.fetch(evo0Pk);
    record(
      "Buy EVO #0 - new owner (deployer)",
      deployerPk.toBase58(),
      evo0Bought.owner.toBase58(),
      buySig
    );
    record(
      "Buy EVO #0 - not listed",
      false,
      evo0Bought.isListed,
      null
    );
    record(
      "Buy EVO #0 - trade count",
      1,
      evo0Bought.tradeCount,
      null
    );

    const sellerAfter = await connection.getBalance(buyer.publicKey);
    const royalty = Math.floor((TRADE_PRICE * ROYALTY_BPS) / 10000);
    const sellerProceeds = TRADE_PRICE - royalty;
    const sellerReceived = sellerAfter - sellerBefore;
    record(
      "Buy EVO #0 - seller received proceeds",
      true,
      sellerReceived >= sellerProceeds - 10000,
      null,
      { sellerReceived: lamportsToSol(sellerReceived), expectedMin: lamportsToSol(sellerProceeds), royalty: lamportsToSol(royalty) + " SOL to creator" }
    );
  } catch (e) {
    record("Trade EVO #0", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 9: Shatter EVO #0 and verify SOL return
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 9: Shatter EVO #0 ─");
  try {
    const evo0 = await program.account.evoAccount.fetch(evo0Pk);
    const locked = evo0.lockedLamports.toNumber();
    const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);
    const expectedRefund = locked - fee;

    const ownerBefore = await connection.getBalance(deployerPk);

    const shatterSig = await program.methods
      .shatter(0)
      .accounts({
        evo: evo0Pk,
        collectionConfig: collPk,
        protocolConfig: protocolPda,
        owner: deployerPk,
        creator: deployerPk,
        treasury: treasury.publicKey,
        incinerator: INCINERATOR,
      })
      .rpc();
    await sleep(2000);

    const ownerAfter = await connection.getBalance(deployerPk);
    const received = ownerAfter - ownerBefore;
    // Owner receives: refund + rent + feed surplus (account closes to owner)
    record(
      "Shatter EVO #0 - SOL returned to owner",
      true,
      received >= expectedRefund,
      shatterSig,
      { received: lamportsToSol(received), expectedMin: lamportsToSol(expectedRefund), fee: lamportsToSol(fee), note: "includes rent + locked refund - fee" }
    );

    // Verify account is closed
    const evo0Info = await connection.getAccountInfo(evo0Pk);
    record(
      "Shatter EVO #0 - account closed",
      null,
      evo0Info,
      null,
      { note: evo0Info ? "STILL EXISTS" : "closed (null)" }
    );
  } catch (e) {
    record("Shatter EVO #0", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 10: Verify Manifest Hash
  // ═══════════════════════════════════════════════════════
  console.log("\n─ Step 10: Verify Manifest Hash ─");
  try {
    // Fetch on-chain hash
    const cfg = await program.account.collectionConfig.fetch(collPk);
    const onChainHash = Buffer.from(cfg.artworkManifestHash).toString("hex");

    // Fetch manifest from GitHub
    const https = require("https");
    const fetchManifest = (url) =>
      new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
          res.on("error", reject);
        });
      });

    let manifestJson = null;
    try {
      const raw = await fetchManifest(MANIFEST_URL);
      manifestJson = raw;
      const fetchedHash = crypto
        .createHash("sha256")
        .update(raw)
        .digest("hex");

      record(
        "Manifest hash - on-chain vs fetched",
        onChainHash,
        fetchedHash,
        null,
        { onChain: onChainHash, fetched: fetchedHash, match: onChainHash === fetchedHash }
      );
    } catch (fetchErr) {
      record(
        "Manifest hash - fetch from GitHub",
        "200 OK",
        `error: ${fetchErr.message}`,
        null,
        { note: "GitHub raw URL may not be available yet (propagation delay)" }
      );
    }

    // Tamper test: modify manifest and verify mismatch
    if (manifestJson) {
      const tampered = manifestJson.replace('"DevTest Genesis"', '"TAMPERED"');
      const tamperedHash = crypto
        .createHash("sha256")
        .update(tampered)
        .digest("hex");
      record(
        "Manifest tamper detection - tampered hash != on-chain",
        true,
        tamperedHash !== onChainHash,
        null,
        { tamperedHash, onChainHash }
      );
    }
  } catch (e) {
    record("Verify manifest hash", "success", `error: ${e.message}`, null);
    console.error(e);
  }

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TEST SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log("");

  if (failed > 0) {
    console.log("  Failed steps:");
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`    ❌ ${r.step}: expected ${r.expected}, got ${r.actual}`);
    });
  }

  // Write results to file
  const resultsFile = path.join(__dirname, "devnet-proof-results.json");
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n  Results saved to: ${resultsFile}`);

  // Print all transaction signatures
  const txSigs = results.filter((r) => r.txSig).map((r) => ({ step: r.step, sig: r.txSig }));
  if (txSigs.length > 0) {
    console.log("\n  Transaction signatures:");
    txSigs.forEach((t) => console.log(`    ${t.step}: ${t.sig}`));
  }

  console.log("\n═══════════════════════════════════════════════════\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});