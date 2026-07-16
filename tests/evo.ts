import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { assert, expect } from "chai";
import { Evo } from "../target/types/evo";

const SOL = (lamports: number) => new BN(lamports * LAMPORTS_PER_SOL);
const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");
// EVOAccount::SPACE from programs/evo/src/state/evo.rs
const EVO_SPACE = 1109;

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

  // Constants
  const CREATION_FEE = SOL(0.05);
  const MINT_PRICE = SOL(0.001);
  const LOCK_AMOUNT = SOL(0.01);
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
    ...overrides,
  });

  const airdrop = async (kp: Keypair, sol: number) => {
    const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
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
      await airdrop(creator, 10);
      await airdrop(buyer, 10);
      await airdrop(other, 5);
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
      assert.equal(
        evoBalance,
        LOCK_AMOUNT.toNumber() + rent,
        "EVO PDA should hold lock + rent"
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
      const FEED = SOL(0.005);
      const evoBefore = await program.account.evoAccount.fetch(evoPk);
      const evoBalBefore = await lamportsOf(evoPk);
      const ownerBefore = await lamportsOf(other.publicKey);
      const prevLocked = evoBefore.lockedLamports.toNumber();
      const prevFeedCount = evoBefore.feedCount;

      await program.methods
        .feed(FEED)
        .accounts({ evo: evoPk, feeder: other.publicKey })
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
          .feed(SOL(0.001))
          .accounts({ evo: evoPk, feeder: buyer.publicKey })
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

      await program.methods
        .transfer(buyer.publicKey)
        .accounts({ evo: evoPk, currentOwner: other.publicKey })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.owner.toBase58(), buyer.publicKey.toBase58());
      assert.equal(evo.lockedLamports.toNumber(), lockedBefore.toNumber(), "locked unchanged");
      assert.isFalse(evo.isListed, "transfer should clear listing");
      const evoBalAfter = await lamportsOf(evoPk);
      assert.equal(evoBalAfter, evoBalBefore, "EVO balance unchanged on transfer");
    });

    it("rejects transfer by non-owner", async () => {
      try {
        await program.methods
          .transfer(other.publicKey)
          .accounts({ evo: evoPk, currentOwner: other.publicKey })
          .signers([other])
          .rpc();
        assert.fail("non-owner should not transfer");
      } catch (e) {
        expect(e.message).to.match(/not the owner|0x4/i);
      }
    });

    it("lists the EVO for sale", async () => {
      const PRICE = SOL(0.1);
      await program.methods
        .list(PRICE)
        .accounts({ evo: evoPk, seller: buyer.publicKey })
        .signers([buyer])
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.isTrue(evo.isListed);
      assert.equal(evo.listPriceLamports.toNumber(), PRICE.toNumber());
    });

    it("rejects double listing", async () => {
      try {
        await program.methods
          .list(SOL(0.2))
          .accounts({ evo: evoPk, seller: buyer.publicKey })
          .signers([buyer])
          .rpc();
        assert.fail("should not double-list");
      } catch (e) {
        expect(e.message).to.match(/already listed|0x7/i);
      }
    });

    it("buys: seller gets price-royalty, creator gets royalty, owner changes, locked unchanged", async () => {
      const PRICE = SOL(0.1);
      const royalty = Math.floor((PRICE.toNumber() * ROYALTY_BPS) / 10000);
      const sellerProceeds = PRICE.toNumber() - royalty;

      const sellerBefore = await lamportsOf(buyer.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);
      const buyerBefore = await lamportsOf(other.publicKey);
      const lockedBefore = (await program.account.evoAccount.fetch(evoPk)).lockedLamports;

      await program.methods
        .buy()
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          seller: buyer.publicKey,
          creator: creator.publicKey,
          buyer: other.publicKey,
          treasury: treasury.publicKey,
        })
        .signers([other])
        .rpc();

      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.owner.toBase58(), other.publicKey.toBase58(), "buyer is now owner");
      assert.isFalse(evo.isListed, "buy clears listing");
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
          .buy()
          .accounts({
            evo: evoPk,
            collectionConfig: collectionPk,
            seller: buyer.publicKey,
            creator: creator.publicKey,
            treasury: treasury.publicKey,
            buyer: other.publicKey,
          })
          .signers([other])
          .rpc();
        assert.fail("should not buy unlisted EVO");
      } catch (e) {
        expect(e.message).to.match(/not listed|0x6/i);
      }
    });
  });

  // ============================================================
  // LIFECYCLE: reveal + evolve
  // ============================================================
  describe("Lifecycle (Evolution collection)", () => {
    const NAME = "evo1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;
    const FEED_THRESHOLD = SOL(0.005); // 0.005 SOL per stage

    before(async () => {
      revealAuthority = Keypair.generate();
      await airdrop(revealAuthority, 1);
      collectionPk = collectionPda(NAME);
    });

    it("creates an Evolution collection with reveal authority", async () => {
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
            lifecycleType: { evolution: {} },
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
      assert.deepEqual(cfg.lifecycleType, { evolution: {} });
      assert.equal(cfg.maxStates, 3);
      assert.equal(cfg.revealAuthority.toBase58(), revealAuthority.publicKey.toBase58());
      assert.isFalse(cfg.isRevealed);
      assert.deepEqual(cfg.randomnessPolicy, { batchReveal: {} });
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
          .revealCollection(Buffer.from(Array(32).fill(2)))
          .accounts({ collection: collectionPk, authority: other.publicKey })
          .signers([other])
          .rpc();
        assert.fail("non-authority should not reveal");
      } catch (e) {
        expect(e.message).to.match(/reveal authority|0x1d/i);
      }
    });

    it("reveals the collection with entropy from the authority", async () => {
      await program.methods
        .revealCollection(Buffer.from(Array(32).fill(42)))
        .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
        .signers([revealAuthority])
        .rpc();
      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      assert.isTrue(cfg.isRevealed);
      assert.equal(cfg.revealEntropy[0], 42);
    });

    it("rejects double reveal", async () => {
      try {
        await program.methods
          .revealCollection(Buffer.from(Array(32).fill(99)))
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
          .evolve()
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve without feeding");
      } catch (e) {
        expect(e.message).to.match(/conditions not met|0x1b/i);
      }
    });

    it("evolves to state 1 after feeding the threshold", async () => {
      await program.methods
        .feed(FEED_THRESHOLD)
        .accounts({ evo: evoPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();
      await program.methods
        .evolve()
        .accounts({ evo: evoPk, collection: collectionPk })
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 1, "advanced to state 1");
      assert.equal(evo.feedCount, 1);
    });

    it("rejects evolve when feed below cumulative threshold for state 2", async () => {
      try {
        await program.methods
          .evolve()
          .accounts({ evo: evoPk, collection: collectionPk })
          .rpc();
        assert.fail("should not evolve (need 2x threshold for state 2)");
      } catch (e) {
        expect(e.message).to.match(/conditions not met|0x1b/i);
      }
    });

    it("evolves to state 2 after feeding enough cumulative total", async () => {
      await program.methods
        .feed(FEED_THRESHOLD)
        .accounts({ evo: evoPk, feeder: buyer.publicKey })
        .signers([buyer])
        .rpc();
      await program.methods
        .evolve()
        .accounts({ evo: evoPk, collection: collectionPk })
        .rpc();
      const evo = await program.account.evoAccount.fetch(evoPk);
      assert.equal(evo.currentState, 2, "advanced to state 2");
    });
  });

  // ============================================================
  // BURN FEE DESTINATION (shatter fee to incinerator)
  // ============================================================
  describe("Burn fee destination", () => {
    const NAME = "burn1";
    let collectionPk: PublicKey;
    let evoPk: PublicKey;
    const EVO_ID = 0;

    before(async () => {
      // Fund the incinerator so the account "exists" — Solana doesn't persist
      // lamport changes to zero-balance accounts via direct manipulation.
      // On mainnet the incinerator already has lamports; localnet starts empty.
      await provider.sendAndConfirm(
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: INCINERATOR,
            lamports: 10000000,
          })
        )
      );

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
          defaultLifecycle()
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

    it("sends the shatter fee to the incinerator on shatter", async () => {
      const evo = await program.account.evoAccount.fetch(evoPk);
      const locked = evo.lockedLamports.toNumber();
      const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);

      const cfg = await program.account.collectionConfig.fetch(collectionPk);
      console.log("    stored fee_destination:", JSON.stringify(cfg.shatterFeeDestination));

      const incineratorBefore = await lamportsOf(INCINERATOR);
      const ownerBefore = await lamportsOf(buyer.publicKey);
      const creatorBefore = await lamportsOf(creator.publicKey);
      const treasuryBefore = await lamportsOf(treasury.publicKey);
      const evoBalBefore = await lamportsOf(evoPk);

      await program.methods
        .shatter(EVO_ID)
        .accounts({
          evo: evoPk,
          collectionConfig: collectionPk,
          owner: buyer.publicKey,
          creator: creator.publicKey,
          treasury: treasury.publicKey,
          incinerator: INCINERATOR,
        })
        .signers([buyer])
        .rpc();
      const incineratorAfter = await lamportsOf(INCINERATOR);
      const ownerAfter = await lamportsOf(buyer.publicKey);
      const creatorAfter = await lamportsOf(creator.publicKey);
      const treasuryAfter = await lamportsOf(treasury.publicKey);
      console.log(`    burn test: locked=${locked} fee=${fee} evoBefore=${evoBalBefore}`);
      console.log(`    incinerator delta=${incineratorAfter - incineratorBefore} owner delta=${ownerAfter - ownerBefore} creator delta=${creatorAfter - creatorBefore} treasury delta=${treasuryAfter - treasuryBefore}`);
      assert.equal(incineratorAfter - incineratorBefore, fee, "incinerator received burned fee");
    });
  });
});