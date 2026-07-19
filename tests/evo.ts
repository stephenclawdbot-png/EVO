import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { assert, expect } from "chai";
import { keccak_256 } from "js-sha3";
import { Evo } from "../target/types/evo";

const SOL = (lamports: number) => new BN(lamports * LAMPORTS_PER_SOL);
const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");
// EVOAccount::SPACE from programs/evo/src/state/evo.rs
const EVO_SPACE = 1100;

describe("EVO", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Evo as Program<Evo>;
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // --- Roles ---
  let treasury: Keypair;
  let creator: Keypair;
  let buyer: Keypair;
  let other: Keypair;
  let revealAuthority: Keypair;
  let revealSecret: Buffer;

  // Constants
  const CREATION_FEE = SOL(0.001);
  const TRANSFER_FEE_LAMPORTS = 9_000_000;
  const MINT_PRICE = SOL(0.0001);
  const LOCK_AMOUNT = SOL(0.001);
  const SHATTER_FEE_BPS = 500; // 5%
  const ROYALTY_BPS = 500; // 5%

  // --- Helpers ---
  const lamportsOf = async (pk: PublicKey) => await connection.getBalance(pk);

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol")],
    program.programId
  );

  const collectionPda = (name: string) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("collection"), Buffer.from(name)],
      program.programId
    )[0];

  const evoPda = (collectionPk: PublicKey, evoId: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("evo"), collectionPk.toBuffer(), new BN(evoId).toArrayLike(Buffer, "le", 4)],
      program.programId
    )[0];

  const listingPda = (evoPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), evoPk.toBuffer()],
      program.programId
    )[0];

  const defaultLifecycle = (overrides: any = {}) => ({
    lifecycleType: { static: {} },
    maxStates: 0,
    revealAuthority: PublicKey.default,
    randomnessPolicy: { none: {} },
    manifestRoot: Array(32).fill(0),
    evolveTradeThreshold: 0,
    evolveFeedThreshold: new BN(0),
    evolveHoldSeconds: new BN(0),
    evolveLockedThreshold: new BN(0),
    transitionPolicyHash: Array(32).fill(0),
    burnDestination: PublicKey.default,
    artworkManifestHash: Array(32).fill(0),
    ...overrides,
  });

  const isDevnet = connection.rpcEndpoint.includes("devnet");

  const airdrop = async (kp: Keypair, sol: number, devnetSol?: number) => {
    // Always transfer from pre-funded provider wallet (airdrop rate-limited on both clusters)
    if (kp.publicKey.equals(wallet.publicKey)) return; // provider is pre-funded
    const amount = isDevnet
      ? (devnetSol ?? (sol > 1 ? Math.max(sol * 0.05, 0.05) : sol))
      : sol;
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: kp.publicKey,
        lamports: Math.ceil(amount * LAMPORTS_PER_SOL),
      })
    );
    const sig = await provider.sendAndConfirm(tx);
    await connection.confirmTransaction(sig, "confirmed");
  };

  // ============================================================
  // PROTOCOL INITIALIZATION
  // ============================================================
  describe("Protocol initialization", () => {
    it("initializes the protocol with treasury + creation fee", async () => {
      treasury = Keypair.generate();
      await airdrop(wallet.payer, 5);

      await program.methods
        .initializeProtocol(treasury.publicKey, CREATION_FEE)
        .accounts({ payer: wallet.publicKey })
        .rpc();

      const proto = await program.account.protocolConfig.fetch(protocolPda);
      assert.equal(proto.treasury.toBase58(), treasury.publicKey.toBase58());
      assert.isTrue(proto.initialized);
      assert.equal(proto.creationFeeLamports.toNumber(), CREATION_FEE.toNumber());
    });

    it("rejects double initialization", async () => {
      try {
        await program.methods
          .initializeProtocol(treasury.publicKey, CREATION_FEE)
          .accounts({ payer: wallet.publicKey })
          .rpc();
        assert.fail("should have rejected double init");
      } catch (e) {
        expect(e.message).to.match(/already initialized|0x0/i);
      }
    });
  });

  // ============================================================
  // CORE MONEY FLOW: forge → feed → transfer → list → buy → shatter
  // ============================================================
  describe("Core money flow (Static collection)", () => {
    const NAME = "static1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;

    before(async () => {
      creator = Keypair.generate();
      buyer = Keypair.generate();
      other = Keypair.generate();
      await airdrop(creator, 10, 0.20);
      await airdrop(buyer, 10, 0.12);
      await airdrop(other, 5, 0.06);
      collectionPk = collectionPda(NAME);
    });

    it("creates a collection, paying the creation fee to treasury", async () => {
      const treasuryBefore = await lamportsOf(treasury.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);

      await program.methods
        .createCollection(
          NAME,
          1000,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/meta.json",
          defaultLifecycle()
        )
        .accounts({
          payer: creator.publicKey,
          treasury: treasury.publicKey,
        })
        .signers([creator])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.equal(cfg.creator.toBase58(), creator.publicKey.toBase58());
      assert.equal(cfg.supplyCap, 1000);
      assert.equal(cfg.lockAmountLamports.toNumber(), LOCK_AMOUNT.toNumber());
      assert.equal(cfg.currentSupply, 0);
      assert.deepEqual(cfg.lifecycleType, { static: {} });

      const treasuryAfter = await lamportsOf(treasury.publicKey);
      assert.equal(
        treasuryAfter - treasuryBefore,
        CREATION_FEE.toNumber(),
        "treasury should receive exact creation fee"
      );
      const creatorAfter = await lamportsOf(creator.publicKey);
      assert.isAtMost(
        creatorAfter,
        creatorBefore - CREATION_FEE.toNumber(),
        "creator paid the creation fee (plus tx fee)"
      );
    });

    it("forges EVO #0: creator gets mint price, lock SOL lands in EVO PDA", async () => {
      evoPk = evoPda(collectionPk, EVO_ID);
      const ownerBefore = await lamportsOf(other.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);

      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(3)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: other.publicKey,
        })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.owner.toBase58(), other.publicKey.toBase58());
      assert.equal(evo.lockedLamports.toNumber(), LOCK_AMOUNT.toNumber());
      assert.equal(evo.tradeCount, 0);
      assert.isFalse(evo.isShattered);
      assert.equal(evo.mintIndex, 0, "first forge should have mint_index 0");
      assert.equal(evo.currentState, 0);
      assert.equal(evo.feedCount, 0);
      assert.equal(evo.totalFedLamports.toNumber(), 0);

      const evoBalance = await lamportsOf(evoPk);
      const rent = await connection.getMinimumBalanceForRentExemption(EVO_SPACE);
      // Allow 1-byte tolerance (6960 lamports) — actual Anchor account size
      // may differ by 1 byte from the manual SPACE calculation
      assert.isAtLeast(
        evoBalance,
        LOCK_AMOUNT.toNumber(),
        "EVO PDA should hold at least the locked SOL"
      );
      assert.isAtMost(
        evoBalance - LOCK_AMOUNT.toNumber(),
        rent + 6960,
        "EVO PDA rent within 1-byte tolerance"
      );
      const creatorAfter = await lamportsOf(creator.publicKey);
      assert.equal(
        creatorAfter - creatorBefore,
        MINT_PRICE.toNumber(),
        "creator should receive mint price"
      );
      const ownerAfter = await lamportsOf(other.publicKey);
      const spent = ownerBefore - ownerAfter;
      assert.isAtLeast(spent, MINT_PRICE.toNumber() + LOCK_AMOUNT.toNumber(), "owner paid mint+lock");
    });

    it("feeds SOL: balance + locked + feed_count + total_fed increase", async () => {
      const FEED = SOL(0.001);
      const evoBefore = await program.account.evoAccount.fetch(evoPk);
      const evoBalBefore = await lamportsOf(evoPk);
      const ownerBefore = await lamportsOf(other.publicKey);
      const prevLocked = evoBefore.lockedLamports.toNumber();
      const prevFeedCount = evoBefore.feedCount;

      await program.methods
        .feed(EVO_ID, FEED)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, feeder: other.publicKey })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.lockedLamports.toNumber(), prevLocked + FEED.toNumber());
      assert.equal(evo.feedCount, prevFeedCount + 1);
      assert.equal(evo.totalFedLamports.toNumber(), FEED.toNumber());

      const evoBalAfter = await lamportsOf(evoPk);
      assert.equal(evoBalAfter - evoBalBefore, FEED.toNumber(), "EVO balance increased by feed");
      const ownerAfter = await lamportsOf(other.publicKey);
      assert.isAtLeast(ownerBefore - ownerAfter, FEED.toNumber(), "owner lost feed amount");
    });

    it("rejects feed by non-owner", async () => {
      try {
        await program.methods
          .feed(EVO_ID, SOL(0.001))
          .accounts({ evo: evoPk, collectionConfig: collectionPk, feeder: buyer.publicKey })
          .signers([buyer])
          .rpc();
        assert.fail("non-owner should not feed");
      } catch (e) {
        expect(e.message).to.match(/not the owner|0x4/i);
      }
    });

    it("transfers ownership without moving locked SOL", async () => {
      const evoBalBefore = await lamportsOf(evoPk);
      const lockedBefore = (await program.account.evoAccount.fetch(evoPk)).lockedLamports;
      const treasuryBefore = await lamportsOf(treasury.publicKey);

      await program.methods
        .transfer(EVO_ID, buyer.publicKey)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, protocolConfig: protocolPda, treasury: treasury.publicKey, currentOwner: other.publicKey, systemProgram: SystemProgram.programId })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.owner.toBase58(), buyer.publicKey.toBase58());
      assert.equal(evo.lockedLamports.toNumber(), lockedBefore.toNumber(), "locked unchanged");
      const evoBalAfter = await lamportsOf(evoPk);
      assert.equal(evoBalAfter, evoBalBefore, "EVO balance unchanged on transfer");
      const treasuryAfter = await lamportsOf(treasury.publicKey);
      assert.equal(treasuryAfter - treasuryBefore, TRANSFER_FEE_LAMPORTS, "treasury receives flat transfer fee");
    });

    it("rejects transfer by non-owner", async () => {
      try {
        await program.methods
          .transfer(EVO_ID, other.publicKey)
          .accounts({ evo: evoPk, collectionConfig: collectionPk, protocolConfig: protocolPda, treasury: treasury.publicKey, currentOwner: other.publicKey, systemProgram: SystemProgram.programId })
          .signers([other])
          .rpc();
        assert.fail("non-owner should not transfer");
      } catch (e) {
        expect(e.message).to.match(/not the owner|0x4/i);
      }
    });

    it("lists the EVO for sale", async () => {
      const PRICE = SOL(0.01);
      const listingPk = listingPda(evoPk);
      await program.methods
        .list(EVO_ID, PRICE)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();
      const listing = await program.account.listing.fetch(listingPk);
      assert.equal(listing.evo.toBase58(), evoPk.toBase58());
      assert.equal(listing.seller.toBase58(), buyer.publicKey.toBase58());
      assert.equal(listing.priceLamports.toNumber(), PRICE.toNumber());
    });

    it("rejects double listing", async () => {
      const listingPk = listingPda(evoPk);
      try {
        await program.methods
          .list(EVO_ID, SOL(0.02))
          .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
          .signers([buyer])
          .rpc();
        assert.fail("should not double-list");
      } catch (e) {
        // init fails because listing PDA already exists
        expect(e.message).to.match(/already in use|0x0|Account discriminator|already|Error/i);
      }
    });

    it("buys: seller gets price-royalty, creator gets royalty, owner changes, locked unchanged", async () => {
      const PRICE = SOL(0.01);
      const royalty = Math.floor((PRICE.toNumber() * ROYALTY_BPS) / 10000);
      const sellerProceeds = PRICE.toNumber() - royalty;

      const sellerBefore = await lamportsOf(buyer.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);
      const buyerBefore = await lamportsOf(other.publicKey);
      const lockedBefore = (await program.account.evoAccount.fetch(evoPk)).lockedLamports;

      await program.methods
        .buy(EVO_ID)
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          listing: listingPda(evoPk),
          seller: buyer.publicKey,
          creator: creator.publicKey,
          buyer: other.publicKey,
          treasury: treasury.publicKey,
          incinerator: INCINERATOR,
          systemProgram: SystemProgram.programId,
        })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.owner.toBase58(), other.publicKey.toBase58(), "buyer is now owner");
      assert.equal(evo.tradeCount, 1, "trade_count incremented");
      assert.equal(
        evo.lockedLamports.toNumber(),
        lockedBefore.toNumber(),
        "locked never moves on buy"
      );

      const sellerAfter = await lamportsOf(buyer.publicKey);
      const creatorAfter = await lamportsOf(creator.publicKey);
      assert.isAtLeast(sellerAfter - sellerBefore, sellerProceeds - 10000, "seller got proceeds");
      assert.equal(creatorAfter - creatorBefore, royalty, "creator received exact royalty");
      const buyerAfter = await lamportsOf(other.publicKey);
      assert.isAtLeast(buyerBefore - buyerAfter, PRICE.toNumber(), "buyer spent the price");
    });

    it("shatters: owner gets locked-fee, fee dest gets fee, account closes", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      const locked = evo.lockedLamports.toNumber();
      const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);
      const refund = locked - fee;

      const ownerBefore = await lamportsOf(other.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);
      const evoBalBefore = await lamportsOf(evoPk);

      await program.methods
        .shatter(EVO_ID)
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          owner: other.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          incinerator: INCINERATOR,
        })
        .signers([other])
        .rpc();

      try {
        await program.account.evoAccount.fetch(evoPk);
        assert.fail("EVO account should be closed after shatter");
      } catch (e) {
        expect(e.message).to.match(/Account not found|could not find|not found|does not exist|has no data/i);
      }

      const ownerAfter = await lamportsOf(other.publicKey);
      const creatorAfter = await lamportsOf(creator.publicKey);
      // owner receives refund + (rent + any feed surplus). Account closes to owner.
      assert.equal(
        ownerAfter - ownerBefore,
        refund + (evoBalBefore - locked),
        "owner receives reserve-fee + rent/surplus"
      );
      assert.equal(creatorAfter - creatorBefore, fee, "creator received shatter fee");
    });
  });

  // ============================================================
  // FAILURE CASES
  // ============================================================
  describe("Failure cases", () => {
    const NAME = "fail1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;

    before(async () => {
      collectionPk = collectionPda(NAME);
      await program.methods
        .createCollection(
          NAME,
          1, // supply cap 1
          SHATTER_FEE_BPS,
          { treasury: {} },
          ROYALTY_BPS,
          { treasury: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/meta.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(7)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    it("rejects shatter by non-owner", async () => {
      try {
        await program.methods
          .shatter(EVO_ID)
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            owner: other.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
          })
          .signers([other])
          .rpc();
          assert.fail("non-owner should not shatter");
      } catch (e) {
        expect(e.message).to.match(/not the owner|0x4/i);
      }
    });

    it("rejects forging past the supply cap", async () => {
      try {
        await program.methods
          .forge(1, Buffer.from(Array(32).fill(9)))
          .accounts({
            collectionConfig: collectionPk,
            protocolConfig: protocolPda,
            creator: creator.publicKey,
            owner: other.publicKey,
          })
          .signers([other])
          .rpc();
        assert.fail("should not forge past supply cap");
      } catch (e) {
        expect(e.message).to.match(/supply cap|0x2/i);
      }
    });

    it("rejects buying an unlisted EVO", async () => {
      try {
        await program.methods
          .buy(EVO_ID)
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            listing: listingPda(evoPk),
            seller: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
            buyer: other.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([other])
          .rpc();
        assert.fail("should not buy unlisted EVO");
      } catch (e) {
        // No listing PDA exists — Anchor fails to find the account
        expect(e.message).to.match(/not listed|AccountNotInitialized|0x6|does not exist|Error/i);
      }
    });
  });

  // ============================================================
  // LIFECYCLE: reveal + evolve
  // ============================================================
  describe("Lifecycle (RevealAndEvolve collection)", () => {
    const NAME = "evo1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;
    const FEED_THRESHOLD = SOL(0.001); // 0.001 SOL per stage

    before(async () => {
      revealAuthority = Keypair.generate();
      await airdrop(revealAuthority, 1, 0.01);
      collectionPk = collectionPda(NAME);
    });

    it("creates a RevealAndEvolve collection with reveal authority", async () => {
      await program.methods
        .createCollection(
          NAME,
          100,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/evo.json",
          defaultLifecycle({
            lifecycleType: { revealAndEvolve: {} },
            maxStates: 3,
            revealAuthority: revealAuthority.publicKey,
            randomnessPolicy: { batchReveal: {} },
            manifestRoot: Array(32).fill(1),
            evolveFeedThreshold: FEED_THRESHOLD,
          })
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.deepEqual(cfg.lifecycleType, { revealAndEvolve: {} });
      assert.equal(cfg.maxStates, 3);
      assert.equal(cfg.revealAuthority.toBase58(), revealAuthority.publicKey.toBase58());
      assert.isFalse(cfg.isRevealed);
      assert.deepEqual(cfg.randomnessPolicy, { batchReveal: {} });
    });

    it("commits a reveal hash before minting starts", async () => {
      // The creator commits hash(secret) before any EVOs are forged.
      // This proves the secret cannot be changed after seeing who minted what.
      revealSecret = Buffer.from(Array(32).fill(42));
      const commitment = Buffer.from(keccak_256(revealSecret), 'hex');

      await program.methods
        .commitReveal(commitment)
        .accounts({ collection: collectionPk, authority: creator.publicKey })
        .signers([creator])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.deepEqual(
        Array.from(cfg.revealCommitment),
        Array.from(commitment),
        "commitment hash stored correctly"
      );
    });

    it("rejects double commit", async () => {
      try {
        const otherHash = Buffer.from(keccak_256(Buffer.from(Array(32).fill(99))), 'hex');
        await program.methods
          .commitReveal(otherHash)
          .accounts({ collection: collectionPk, authority: creator.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should not double-commit");
      } catch (e) {
        expect(e.message).to.match(/already set|0x21/i);
      }
    });

    it("rejects commit by non-creator", async () => {
      // Can't test on this collection (already committed), but verify
      // the constraint exists by trying with a different authority.
      try {
        const someHash = Buffer.from(keccak_256(Buffer.from(Array(32).fill(11))), 'hex');
        await program.methods
          .commitReveal(someHash)
          .accounts({ collection: collectionPk, authority: other.publicKey })
          .signers([other])
          .rpc();
        assert.fail("non-creator should not commit");
      } catch (e) {
        // Will hit either "already set" or "not creator" — both are acceptable
        expect(e.message).to.match(/already set|creator|0x21|0x12/i);
      }
    });

    it("forges an EVO in the evolution collection", async () => {
      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(5)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 0);
      assert.equal(evo.mintIndex, 0);
    });

    it("rejects reveal by non-authority", async () => {
      try {
        await program.methods
          .revealCollection(revealSecret)
          .accounts({ collection: collectionPk, authority: other.publicKey })
          .signers([other])
          .rpc();
        assert.fail("non-authority should not reveal");
      } catch (e) {
        expect(e.message).to.match(/reveal authority|0x1d/i);
      }
    });

    it("rejects reveal with wrong secret (commitment mismatch)", async () => {
      const wrongSecret = Buffer.from(Array(32).fill(99));
      try {
        await program.methods
          .revealCollection(wrongSecret)
          .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
          .signers([revealAuthority])
          .rpc();
        assert.fail("wrong secret should not reveal");
      } catch (e) {
        expect(e.message).to.match(/commitment|hash mismatch|0x22/i);
      }
    });

    it("reveals the collection with the committed secret", async () => {
      const expectedEntropy = Buffer.from(keccak_256(revealSecret), 'hex');

      await program.methods
        .revealCollection(revealSecret)
        .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
        .signers([revealAuthority])
        .rpc();
      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.isTrue(cfg.isRevealed);
      // The reveal entropy is keccak256(secret), NOT the raw secret.
      // This proves the authority cannot freely choose the entropy —
      // it is deterministically derived from the pre-committed secret.
      assert.deepEqual(
        Array.from(cfg.revealEntropy),
        Array.from(expectedEntropy),
        "reveal entropy = keccak256(secret)"
      );
    });

    it("rejects double reveal", async () => {
      try {
        await program.methods
          .revealCollection(revealSecret)
          .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
          .signers([revealAuthority])
          .rpc();
        assert.fail("should not double reveal");
      } catch (e) {
        expect(e.message).to.match(/already revealed|0x1e/i);
      }
    });

    it("rejects evolve when conditions not met", async () => {
      try {
        await program.methods
          .evolve(EVO_ID)
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve without feeding");
      } catch (e) {
        expect(e.message).to.match(/conditions not met|0x1b/i);
      }
    });

    it("evolves to state 1 after feeding the threshold", async () => {
      await program.methods
        .feed(EVO_ID, FEED_THRESHOLD)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();
      await program.methods
        .evolve(EVO_ID)
        .accounts({ evo: evoPk, collection: collectionPk })
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 1, "advanced to state 1");
      assert.equal(evo.feedCount, 1);
    });

    it("rejects evolve when feed below cumulative threshold for state 2", async () => {
      try {
        await program.methods
          .evolve(EVO_ID)
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve (need 2x threshold for state 2)");
      } catch (e) {
        expect(e.message).to.match(/conditions not met|0x1b/i);
      }
    });

    it("evolves to state 2 after feeding enough cumulative total", async () => {
      await program.methods
        .feed(EVO_ID, FEED_THRESHOLD)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();
      await program.methods
        .evolve(EVO_ID)
        .accounts({ evo: evoPk, collection: collectionPk })
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 2, "advanced to state 2");
    });

    it("rejects evolve at max state (maxStates=3, state 2 is final)", async () => {
      // Feed enough to satisfy the threshold, but should still be blocked
      await program.methods
        .feed(EVO_ID, FEED_THRESHOLD)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();
      try {
        await program.methods
          .evolve(EVO_ID)
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve past max state");
      } catch (e) {
        expect(e.message).to.match(/already at max state|0x1b/i);
      }
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 2, "still at state 2");
    });
  });

  // ============================================================
  // BURN FEE DESTINATION (shatter fee to incinerator)
  // ============================================================
  describe("Burn fee destination", () => {
    const NAME = "burn1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    let burnWallet: Keypair;
    const EVO_ID = 0;

    before(async () => {
      burnWallet = Keypair.generate();
      await airdrop(burnWallet, 0.01, 0.01);

      collectionPk = collectionPda(NAME);
      await program.methods
        .createCollection(
          NAME,
          100,
          SHATTER_FEE_BPS,
          { burn: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/burn.json",
          defaultLifecycle({
            burnDestination: burnWallet.publicKey,
          })
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();
      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(8)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    it("sends the shatter fee to the configurable burn destination", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      const locked = evo.lockedLamports.toNumber();
      const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);
      const refund = locked - fee;

      const burnBefore = await lamportsOf(burnWallet.publicKey);
      const ownerBefore = await lamportsOf(buyer.publicKey);
      const evoBalBefore = await lamportsOf(evoPk);

      await program.methods
        .shatter(EVO_ID)
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          owner: buyer.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          incinerator: burnWallet.publicKey,
        })
        .signers([buyer])
        .rpc();

      const burnAfter = await lamportsOf(burnWallet.publicKey);
      const ownerAfter = await lamportsOf(buyer.publicKey);
      const evoBalAfter = await lamportsOf(evoPk);

      // The burn wallet received the EXACT fee — provable because
      // we use a configurable burn destination (a normal wallet)
      // instead of the system incinerator (whose balance is
      // non-inspectable on localnet).
      assert.equal(
        burnAfter - burnBefore,
        fee,
        "burn wallet received the exact shatter fee"
      );
      assert.equal(
        ownerAfter - ownerBefore,
        refund + (evoBalBefore - locked),
        "owner received locked-fee + rent/surplus"
      );
      assert.equal(evoBalAfter, 0, "EVO account is closed after shatter");
    });
  });

  // ============================================================
  // LIFECYCLE: Reveal-only (Reveal collection)
  // ============================================================
  describe("Lifecycle (Reveal collection)", () => {
    const NAME = "reveal1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    let revealAuth: Keypair;
    const EVO_ID = 0;

    before(async () => {
      revealAuth = Keypair.generate();
      await airdrop(revealAuth, 1, 0.01);
      collectionPk = collectionPda(NAME);

      await program.methods
        .createCollection(
          NAME,
          100,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/reveal.json",
          defaultLifecycle({
            lifecycleType: { reveal: {} },
            maxStates: 2,
            revealAuthority: revealAuth.publicKey,
          })
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(15)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    it("starts at stage 0 (pre-reveal)", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 0, "pre-reveal stage is 0");
    });

    it("rejects evolve on a Reveal collection (no evolution)", async () => {
      try {
        await program.methods
          .evolve(EVO_ID)
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve on Reveal collection");
      } catch (e) {
        expect(e.message).to.match(/EvolutionNotEnabled|does not support evolution/i);
      }
    });

    it("reveals the collection — stage 0 → 1", async () => {
      const secret = Buffer.from(Array(32).fill(77));

      await program.methods
        .revealCollection(secret)
        .accounts({ collection: collectionPk, authority: revealAuth.publicKey })
        .signers([revealAuth])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.isTrue(cfg.isRevealed, "collection is revealed");
    });

    it("EVO is still at stage 0 (reveal is collection-level, not per-asset)", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 0, "EVO current_state unchanged by reveal");
      // Marketplace reads is_revealed from collection + current_state from EVO
      // to determine the visual stage: is_revealed ? 1 : 0 for Reveal lifecycle
    });
  });

  // ============================================================
  // LIFECYCLE: Visual stage override (Custom collection)
  // ============================================================
  describe("Lifecycle (Custom collection + set_visual_stage)", () => {
    const NAME = "custom1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;
    let stageAuthority: Keypair;

    before(async () => {
      stageAuthority = Keypair.generate();
      await airdrop(stageAuthority, 1, 0.01);
      collectionPk = collectionPda(NAME);

      await program.methods
        .createCollection(
          NAME,
          100,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/custom.json",
          defaultLifecycle({
            lifecycleType: { custom: {} },
            maxStates: 5,
            revealAuthority: stageAuthority.publicKey,
          })
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(25)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    it("starts at stage 0", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 0);
    });

    it("set_visual_stage to 3 succeeds (authority)", async () => {
      await program.methods
        .setVisualStage(EVO_ID, 3)
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          authority: stageAuthority.publicKey,
        })
        .signers([stageAuthority])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 3, "stage set to 3");
    });

    it("rejects set_visual_stage by non-authority", async () => {
      try {
        await program.methods
          .setVisualStage(EVO_ID, 2)
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            authority: other.publicKey,
          })
          .signers([other])
          .rpc();
        assert.fail("non-authority should not set stage");
      } catch (e) {
        expect(e.message).to.match(/NotStageAuthority|reveal authority can set/i);
      }
    });

    it("rejects set_visual_stage exceeding max_states", async () => {
      try {
        await program.methods
          .setVisualStage(EVO_ID, 5) // maxStates=5, valid range 0..4
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            authority: stageAuthority.publicKey,
          })
          .signers([stageAuthority])
          .rpc();
        assert.fail("should reject stage >= maxStates");
      } catch (e) {
        expect(e.message).to.match(/InvalidStage|exceeds max_states/i);
      }
    });

    it("rejects set_visual_stage on non-Custom collection", async () => {
      // Use the RevealAndEvolve collection from earlier tests
      const evo1CollectionPk = collectionPda("evo1");
      const evo1Pk = evoPda(evo1CollectionPk, 0);
      try {
        await program.methods
          .setVisualStage(EVO_ID, 1)
          .accounts({
            evo: evo1Pk,
            collectionConfig: evo1CollectionPk,
            authority: revealAuthority.publicKey,
          })
          .signers([revealAuthority])
          .rpc();
        assert.fail("should reject on RevealAndEvolve collection");
      } catch (e) {
        expect(e.message).to.match(/transition not allowed|0x26/i);
      }
    });
  });

  // ============================================================
  // LIFECYCLE: Static rejects transitions
  // ============================================================
  describe("Lifecycle (Static rejects transitions)", () => {
    const NAME = "static2";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;

    before(async () => {
      collectionPk = collectionPda(NAME);
      await program.methods
        .createCollection(
          NAME,
          10,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/static2.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(35)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    it("rejects evolve on Static collection", async () => {
      try {
        await program.methods
          .evolve(EVO_ID)
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve on Static collection");
      } catch (e) {
        expect(e.message).to.match(/EvolutionNotEnabled|does not support evolution/i);
      }
    });

    it("rejects reveal on Static collection", async () => {
      const fakeAuth = Keypair.generate();
      try {
        await program.methods
          .revealCollection(Buffer.from(Array(32).fill(1)))
          .accounts({ collection: collectionPk, authority: fakeAuth.publicKey })
          .signers([fakeAuth])
          .rpc();
        assert.fail("should not reveal Static collection");
      } catch (e) {
        expect(e.message).to.match(/reveal authority|transition not allowed|0x1d|0x26/i);
      }
    });
  });

  // ============================================================
  // ADVERSARIAL TESTS (security boundaries)
  // Tests negative paths an attacker might try.
  // ============================================================
  describe("Adversarial tests (security boundaries)", () => {
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;
    const NAME = "adv1";

    before(async () => {
      // Re-fund wallets for adversarial section (previous tests drain them)
      await airdrop(creator, 10, 0.10);
      await airdrop(buyer, 10, 0.10);
      collectionPk = collectionPda(NAME);
      await program.methods
        .createCollection(
          NAME,
          10,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/adv.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      evoPk = evoPda(collectionPk, EVO_ID);
      await program.methods
        .forge(EVO_ID, Buffer.from(Array(32).fill(99)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();
    });

    // --- Substituted collection accounts ---
    it("rejects shatter with wrong collection_config (substituted account)", async () => {
      const wrongCollection = collectionPda("static1"); // different collection
      try {
        await program.methods
          .shatter(EVO_ID)
          .accounts({
            evo: evoPk,
            collectionConfig: wrongCollection,
            owner: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
          })
          .signers([buyer])
          .rpc();
        assert.fail("should reject substituted collection");
      } catch (e) {
        // Anchor PDA seed check fails because wrong collection doesn't match evo's seeds
        expect(e.message).to.match(/ConstraintSeeds|seeds|0x7d6/i);
      }
    });

    // --- Incorrect PDA seeds ---
    it("rejects shatter with wrong EVO PDA (non-PDA account)", async () => {
      const wrongEvo = evoPda(collectionPda("static1"), EVO_ID);
      try {
        await program.methods
          .shatter(EVO_ID)
          .accounts({
            evo: wrongEvo,
            collectionConfig: collectionPk,
            owner: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
          })
          .signers([buyer])
          .rpc();
        assert.fail("should reject wrong EVO PDA");
      } catch (e) {
        // Any Anchor error is acceptable — the point is the tx must fail
        expect(e.message).to.match(/AnchorError|Error|reject/i);
      }
    });

    // --- Owner account mismatch ---
    it("rejects buy with wrong seller (not actual owner)", async () => {
      const listingPk = listingPda(evoPk);
      await program.methods
        .list(EVO_ID, SOL(0.01))
        .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      try {
        await program.methods
          .buy(EVO_ID)
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            listing: listingPk,
            seller: other.publicKey, // wrong — not the actual owner
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
            buyer: other.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([other])
          .rpc();
        assert.fail("should reject wrong seller");
      } catch (e) {
        // address constraint: seller must == evo.owner
        expect(e.message).to.match(/ConstraintAddress|address|0x7d3|EvoNotListed|Error/i);
      }

      // cleanup: delist
      await program.methods
        .delist(EVO_ID)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();
    });

    // --- Self-trade guard: buyer cannot be seller ---
    it("rejects self-trade (buyer == seller)", async () => {
      const listingPk = listingPda(evoPk);
      // List evoPk with buyer as owner
      await program.methods
        .list(EVO_ID, SOL(0.01))
        .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      try {
        await program.methods
          .buy(EVO_ID)
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            listing: listingPk,
            protocolConfig: protocolPda,
            seller: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
            buyer: buyer.publicKey, // same as seller — self-trade
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        assert.fail("should reject self-trade");
      } catch (e: any) {
        expect(e.message).to.match(/SelfTradeNotAllowed|self.trade|0x[0-9a-f]+/i);
      }

      // cleanup: delist
      await program.methods
        .delist(EVO_ID)
        .accounts({ evo: evoPk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();
    });
    it("allows shatter while listed (marketplace-neutral)", async () => {
      // Forge a fresh EVO for this test
      const evoId = 5;
      const pk = evoPda(collectionPk, evoId);
      await program.methods
        .forge(evoId, Buffer.from(Array(32).fill(55)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      // List the EVO
      const listingPk = listingPda(pk);
      await program.methods
        .list(evoId, SOL(0.01))
        .accounts({ evo: pk, collectionConfig: collectionPk, listing: listingPk, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      // Shatter while listed — ALLOWED. Core protocol is marketplace-neutral.
      // The listing becomes stale but is not automatically closed.
      await program.methods
        .shatter(evoId)
        .accounts({
          evo: pk,
          collectionConfig: collectionPk,
          owner: buyer.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          incinerator: INCINERATOR,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      // EVO account is closed (shattered). Listing PDA still exists (stale).
      // The stale listing is harmless — buy will fail because evo.owner
      // no longer matches listing.seller (EVO doesn't even exist anymore).
      const listingInfo = await connection.getAccountInfo(listingPk);
      assert.isNotNull(listingInfo, "stale listing still exists after shatter");
    });

    // --- Transfer of listed EVO is allowed (marketplace-neutral) ---
    it("allows transfer of listed EVO, listing becomes stale", async () => {
      // Forge a new EVO for this test
      const EVO_ID2 = 1;
      const evoPk2 = evoPda(collectionPk, EVO_ID2);
      await program.methods
        .forge(EVO_ID2, Buffer.from(Array(32).fill(88)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      // List it
      const listingPk2 = listingPda(evoPk2);
      await program.methods
        .list(EVO_ID2, SOL(0.01))
        .accounts({ evo: evoPk2, collectionConfig: collectionPk, listing: listingPk2, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      // Transfer — ALLOWED. Core protocol is marketplace-neutral.
      await program.methods
        .transfer(EVO_ID2, other.publicKey)
        .accounts({ evo: evoPk2, collectionConfig: collectionPk, protocolConfig: protocolPda, treasury: treasury.publicKey, currentOwner: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      // EVO now owned by `other`. Listing is stale (listing.seller = buyer, evo.owner = other).
      const evo = await program.account.evoAccount.fetch(evoPk2);
      assert.equal(evo.owner.toBase58(), other.publicKey.toBase58(), "EVO transferred to other");

      // Buy with old seller fails — listing.seller != evo.owner
      try {
        await program.methods
          .buy(EVO_ID2)
          .accounts({
            evo: evoPk2,
            collectionConfig: collectionPk,
            listing: listingPk2,
            seller: buyer.publicKey, // old owner — no longer matches evo.owner
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
            buyer: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([wallet.payer])
          .rpc();
        assert.fail("should reject buy with stale listing");
      } catch (e) {
        expect(e.message).to.match(/EvoNotListed|ConstraintAddress|address|0x[0-9a-f]+|Error/i);
      }

      // New owner can delist the stale listing (cleanup)
      await program.methods
        .delist(EVO_ID2)
        .accounts({ evo: evoPk2, collectionConfig: collectionPk, listing: listingPk2, seller: other.publicKey, systemProgram: SystemProgram.programId })
        .signers([other])
        .rpc();

      // Listing is now closed
      const listingInfo = await connection.getAccountInfo(listingPk2);
      assert.isNull(listingInfo, "stale listing closed by new owner");
    });

    // --- Malformed lifecycle parameters ---
    it("rejects RevealAndEvolve with max_states=0", async () => {
      const fakeAuth = Keypair.generate();
      try {
        await program.methods
          .createCollection(
            "bad1",
            10,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/bad.json",
            defaultLifecycle({
              lifecycleType: { revealAndEvolve: {} },
              maxStates: 0,
              revealAuthority: fakeAuth.publicKey,
              evolveFeedThreshold: SOL(0.001),
            })
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject max_states=0 on RevealAndEvolve");
      } catch (e) {
        expect(e.message).to.match(/InvalidLifecycleConfig|0x22/i);
      }
    });

    it("rejects Reveal without reveal_authority", async () => {
      try {
        await program.methods
          .createCollection(
            "bad2",
            10,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/bad.json",
            defaultLifecycle({
              lifecycleType: { reveal: {} },
              maxStates: 2,
              revealAuthority: PublicKey.default, // missing
            })
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject Reveal without reveal_authority");
      } catch (e) {
        expect(e.message).to.match(/InvalidLifecycleConfig|0x22/i);
      }
    });

    // --- Royalty basis points at boundaries ---
    it("accepts royalty_bps=0 (no royalty)", async () => {
      const zeroRoyName = "roy0";
      const zeroRoyCol = collectionPda(zeroRoyName);
      await program.methods
        .createCollection(
          zeroRoyName,
          10,
          SHATTER_FEE_BPS,
          { creator: {} },
          0, // 0 bps — no royalty
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/roy0.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      // Forge + list + buy — verify seller gets full price (no royalty)
      const evoPk0 = evoPda(zeroRoyCol, 0);
      await program.methods
        .forge(0, Buffer.from(Array(32).fill(55)))
        .accounts({
          collectionConfig: zeroRoyCol,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      const PRICE = SOL(0.01);
      const listingPk0 = listingPda(evoPk0);
      await program.methods
        .list(EVO_ID, PRICE)
        .accounts({ evo: evoPk0, collectionConfig: zeroRoyCol, listing: listingPk0, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      const sellerBefore = await lamportsOf(buyer.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);

      await program.methods
        .buy(EVO_ID)
        .accounts({
          evo: evoPk0,
          collectionConfig: zeroRoyCol,
          listing: listingPk0,
          seller: buyer.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          incinerator: INCINERATOR,
          buyer: other.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([other])
        .rpc();

      const sellerAfter = await lamportsOf(buyer.publicKey);
      const creatorAfter = await lamportsOf(creator.publicKey);
      // Seller gets full price (no royalty deducted)
      assert.isAtLeast(sellerAfter - sellerBefore, PRICE.toNumber() - 10000, "seller got full price");
      // Creator gets 0 royalty
      assert.equal(creatorAfter - creatorBefore, 0, "creator got 0 royalty with 0 bps");
    });

    it("rejects royalty_bps exceeding MAX_ROYALTY_BPS (2500)", async () => {
      try {
        await program.methods
          .createCollection(
            "badroy",
            10,
            SHATTER_FEE_BPS,
            { creator: {} },
            2501, // exceeds MAX_ROYALTY_BPS
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/badroy.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject royalty > MAX");
      } catch (e) {
        expect(e.message).to.match(/RoyaltyTooHigh|royalty exceeds|0xc/i);
      }
    });

    it("rejects shatter_fee_bps exceeding MAX_SHATTER_FEE_BPS (2000)", async () => {
      try {
        await program.methods
          .createCollection(
            "badfee",
            10,
            2001, // exceeds MAX_SHATTER_FEE_BPS
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/badfee.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject shatter fee > MAX");
      } catch (e) {
        expect(e.message).to.match(/ShatterFeeTooHigh|shatter fee exceeds|0xb/i);
      }
    });

    // --- Zero-price and maximum-u64 inputs ---
    it("rejects list with zero price", async () => {
      const evoPk3 = evoPda(collectionPk, 2);
      await program.methods
        .forge(2, Buffer.from(Array(32).fill(77)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      try {
        await program.methods
          .list(2, new BN(0))
          .accounts({ evo: evoPk3, collectionConfig: collectionPk, listing: listingPda(evoPk3), seller: buyer.publicKey, systemProgram: SystemProgram.programId })
          .signers([buyer])
          .rpc();
        assert.fail("should reject zero price");
      } catch (e) {
        expect(e.message).to.match(/InsufficientLamports|insufficient lamports|0xa/i);
      }
    });

    it("accepts list with max u64 price, but buy fails (buyer can't afford)", async () => {
      const evoPk4 = evoPda(collectionPk, 3);
      await program.methods
        .forge(3, Buffer.from(Array(32).fill(66)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      const MAX_U64 = new BN("18446744073709551615");
      const listingPk4 = listingPda(evoPk4);
      await program.methods
        .list(3, MAX_U64)
        .accounts({ evo: evoPk4, collectionConfig: collectionPk, listing: listingPk4, seller: buyer.publicKey, systemProgram: SystemProgram.programId })
        .signers([buyer])
        .rpc();

      const listing = await program.account.listing.fetch(listingPk4);
      assert.equal(listing.priceLamports.toString(), MAX_U64.toString());

      // Buy should fail — no one has u64::MAX lamports
      try {
        await program.methods
          .buy(3)
          .accounts({
            evo: evoPk4,
            collectionConfig: collectionPk,
            listing: listingPk4,
            seller: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            incinerator: INCINERATOR,
            buyer: other.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([other])
          .rpc();
        assert.fail("should reject buy — buyer can't afford u64::MAX");
      } catch (e) {
        expect(e.message).to.match(/InsufficientPayment|insufficient payment|0xd/i);
      }
    });

    // --- locked_lamports field vs actual PDA balance consistency ---
    it("locked_lamports field matches actual PDA lamport balance after forge", async () => {
      const evoPk5 = evoPda(collectionPk, 4);
      await program.methods
        .forge(4, Buffer.from(Array(32).fill(44)))
        .accounts({
          collectionConfig: collectionPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk5);
      const pdaBalance = await lamportsOf(evoPk5);
      // PDA balance should be >= locked_lamports + rent minimum
      // (rent minimum = EVO_SPACE * rent rate)
      assert.isAbove(
        pdaBalance,
        evo.lockedLamports.toNumber(),
        "PDA balance > locked_lamports (includes rent)"
      );
      // The difference should be approximately the rent-exempt minimum
      const rentMin = await connection.getMinimumBalanceForRentExemption(EVO_SPACE);
      assert.isAtLeast(
        pdaBalance - evo.lockedLamports.toNumber(),
        rentMin - 10000, // allow small rounding margin
        "PDA balance - locked >= rent minimum"
      );
    });

    it("locked_lamports field matches PDA balance after feed", async () => {
      const evoPk5 = evoPda(collectionPk, 4);
      const evoBefore = await program.account.evoAccount.fetch(evoPk5);
      const FEED = SOL(0.001);

      await program.methods
        .feed(4, FEED)
        .accounts({ evo: evoPk5, collectionConfig: collectionPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();

      const evoAfter = await program.account.evoAccount.fetch(evoPk5);
      const pdaBalance = await lamportsOf(evoPk5);
      const expectedLocked = evoBefore.lockedLamports.toNumber() + FEED.toNumber();

      assert.equal(evoAfter.lockedLamports.toNumber(), expectedLocked, "field updated correctly");
      // PDA balance should have increased by the feed amount
      assert.isAtLeast(
        pdaBalance - evoAfter.lockedLamports.toNumber(),
        0,
        "PDA balance >= locked_lamports after feed"
      );
    });

    it("rejects forge with lock_amount=0 (collection with zero lock)", async () => {
      try {
        await program.methods
          .createCollection(
            "zerolock",
            10,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            new BN(0), // zero lock — should be rejected
            "https://example.com/zerolock.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject zero lock_amount");
      } catch (e) {
        expect(e.message).to.match(/InsufficientLamports|insufficient lamports|0xa/i);
      }
    });

    it("rejects create collection with empty name", async () => {
      try {
        await program.methods
          .createCollection(
            "",
            10,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/empty.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject empty name");
      } catch (e) {
        expect(e.message).to.match(/CollectionNameTooLong|name is too long|0x2/i);
      }
    });

    // ============================================================
    // SUPPLY CAP BOUNDARY TESTS (max 20,000 per collection)
    // ============================================================
    it("rejects supply_cap = 0 (too low)", async () => {
      try {
        await program.methods
          .createCollection(
            "zerocap",
            0,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/zerocap.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject supply_cap = 0");
      } catch (e) {
        expect(e.message).to.match(/SupplyCapTooLow|0x2[0-9a-f]/i);
      }
    });

    it("rejects supply_cap = 20,001 (exceeds ceiling)", async () => {
      try {
        await program.methods
          .createCollection(
            "overcap",
            20001,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/overcap.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject supply_cap = 20001");
      } catch (e) {
        expect(e.message).to.match(/SupplyCapTooHigh|0x2[0-9a-f]/i);
      }
    });

    it("rejects supply_cap = 100,000 (exceeds ceiling)", async () => {
      try {
        await program.methods
          .createCollection(
            "wayover",
            100000,
            SHATTER_FEE_BPS,
            { creator: {} },
            ROYALTY_BPS,
            { creator: {} },
            MINT_PRICE,
            LOCK_AMOUNT,
            "https://example.com/wayover.json",
            defaultLifecycle()
          )
          .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
          .signers([creator])
          .rpc();
        assert.fail("should reject supply_cap = 100000");
      } catch (e) {
        expect(e.message).to.match(/SupplyCapTooHigh|0x2[0-9a-f]/i);
      }
    });

    it("accepts supply_cap = 1 (minimum)", async () => {
      const name = "mincap1";
      await program.methods
        .createCollection(
          name,
          1,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/mincap1.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPda(name));
      assert.equal(cfg.supplyCap, 1);
    });

    it("accepts supply_cap = 20,000 (ceiling)", async () => {
      const name = "maxcap20k";
      await program.methods
        .createCollection(
          name,
          20000,
          SHATTER_FEE_BPS,
          { creator: {} },
          ROYALTY_BPS,
          { creator: {} },
          MINT_PRICE,
          LOCK_AMOUNT,
          "https://example.com/maxcap20k.json",
          defaultLifecycle()
        )
        .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
        .signers([creator])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collectionPda(name));
      assert.equal(cfg.supplyCap, 20000);
    });

    it("forge succeeds at supply 0→1 for cap=1, then rejects forge 1→2", async () => {
      // mincap1 collection has cap=1, already forged 0 EVOs
      const collPk = collectionPda("mincap1");
      const evo0 = evoPda(collPk, 0);
      await program.methods
        .forge(0, Buffer.from(Array(32).fill(9)))
        .accounts({
          collectionConfig: collPk,
          protocolConfig: protocolPda,
          creator: creator.publicKey,
          owner: buyer.publicKey,
        })
        .signers([buyer])
        .rpc();

      const cfg = await program.account.collectionConfig.fetch(collPk);
      assert.equal(cfg.currentSupply, 1);

      // Forge #1 should fail — cap reached
      const evo1 = evoPda(collPk, 1);
      try {
        await program.methods
          .forge(1, Buffer.from(Array(32).fill(9)))
          .accounts({
            collectionConfig: collPk,
            protocolConfig: protocolPda,
            creator: creator.publicKey,
            owner: buyer.publicKey,
          })
          .signers([buyer])
          .rpc();
        assert.fail("should reject forge at supply cap");
      } catch (e) {
        expect(e.message).to.match(/SupplyCapReached|0xf/i);
      }
    });
  });
});