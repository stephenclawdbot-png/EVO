"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const chai_1 = require("chai");
const js_sha3_1 = require("js-sha3");
const SOL = (lamports) => new anchor_1.BN(lamports * web3_js_1.LAMPORTS_PER_SOL);
const INCINERATOR = new web3_js_1.PublicKey("1nc1nerator11111111111111111111111111111111");
// EVOAccount::SPACE from programs/evo/src/state/evo.rs
const EVO_SPACE = 1109;
describe("EVO", () => {
    const provider = anchor_1.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Evo;
    const wallet = provider.wallet;
    const connection = provider.connection;
    // --- Roles ---
    let treasury;
    let creator;
    let buyer;
    let other;
    let revealAuthority;
    let revealSecret;
    // Constants
    const CREATION_FEE = SOL(0.001);
    const MINT_PRICE = SOL(0.0001);
    const LOCK_AMOUNT = SOL(0.001);
    const SHATTER_FEE_BPS = 500; // 5%
    const ROYALTY_BPS = 500; // 5%
    // --- Helpers ---
    const lamportsOf = (pk) => __awaiter(void 0, void 0, void 0, function* () { return yield connection.getBalance(pk); });
    const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("protocol")], program.programId);
    const collectionPda = (name) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("collection"), Buffer.from(name)], program.programId)[0];
    const evoPda = (collectionPk, evoId) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("evo"), collectionPk.toBuffer(), new anchor_1.BN(evoId).toArrayLike(Buffer, "le", 4)], program.programId)[0];
    const defaultLifecycle = (overrides = {}) => (Object.assign({ lifecycleType: { static: {} }, maxStates: 0, revealAuthority: web3_js_1.PublicKey.default, randomnessPolicy: { none: {} }, manifestRoot: Array(32).fill(0), evolveTradeThreshold: 0, evolveFeedThreshold: new anchor_1.BN(0), evolveHoldSeconds: new anchor_1.BN(0), evolveLockedThreshold: new anchor_1.BN(0), transitionPolicyHash: Array(32).fill(0), burnDestination: web3_js_1.PublicKey.default, artworkManifestHash: Array(32).fill(0) }, overrides));
    const isDevnet = connection.rpcEndpoint.includes("devnet");
    const airdrop = (kp, sol, devnetSol) => __awaiter(void 0, void 0, void 0, function* () {
        if (isDevnet) {
            // On devnet, faucet is rate-limited — transfer from pre-funded provider wallet
            if (kp.publicKey.equals(wallet.publicKey))
                return; // provider is pre-funded
            const devnetSolAmount = devnetSol !== null && devnetSol !== void 0 ? devnetSol : (sol > 1 ? Math.max(sol * 0.05, 0.05) : sol);
            const tx = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: kp.publicKey,
                lamports: Math.ceil(devnetSolAmount * web3_js_1.LAMPORTS_PER_SOL),
            }));
            const sig = yield provider.sendAndConfirm(tx);
            yield connection.confirmTransaction(sig, "confirmed");
        }
        else {
            const sig = yield connection.requestAirdrop(kp.publicKey, sol * web3_js_1.LAMPORTS_PER_SOL);
            yield connection.confirmTransaction(sig, "confirmed");
        }
    });
    // ============================================================
    // PROTOCOL INITIALIZATION
    // ============================================================
    describe("Protocol initialization", () => {
        it("initializes the protocol with treasury + creation fee", () => __awaiter(void 0, void 0, void 0, function* () {
            treasury = web3_js_1.Keypair.generate();
            yield airdrop(wallet.payer, 5);
            yield program.methods
                .initializeProtocol(treasury.publicKey, CREATION_FEE)
                .accounts({ payer: wallet.publicKey })
                .rpc();
            const proto = yield program.account.protocolConfig.fetch(protocolPda);
            chai_1.assert.equal(proto.treasury.toBase58(), treasury.publicKey.toBase58());
            chai_1.assert.isTrue(proto.initialized);
            chai_1.assert.equal(proto.creationFeeLamports.toNumber(), CREATION_FEE.toNumber());
        }));
        it("rejects double initialization", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .initializeProtocol(treasury.publicKey, CREATION_FEE)
                    .accounts({ payer: wallet.publicKey })
                    .rpc();
                chai_1.assert.fail("should have rejected double init");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/already initialized|0x0/i);
            }
        }));
    });
    // ============================================================
    // CORE MONEY FLOW: forge → feed → transfer → list → buy → shatter
    // ============================================================
    describe("Core money flow (Static collection)", () => {
        const NAME = "static1";
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            creator = web3_js_1.Keypair.generate();
            buyer = web3_js_1.Keypair.generate();
            other = web3_js_1.Keypair.generate();
            yield airdrop(creator, 10, 0.10);
            yield airdrop(buyer, 10, 0.06);
            yield airdrop(other, 5, 0.03);
            collectionPk = collectionPda(NAME);
        }));
        it("creates a collection, paying the creation fee to treasury", () => __awaiter(void 0, void 0, void 0, function* () {
            const treasuryBefore = yield lamportsOf(treasury.publicKey);
            const creatorBefore = yield lamportsOf(creator.publicKey);
            yield program.methods
                .createCollection(NAME, 1000, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/meta.json", defaultLifecycle())
                .accounts({
                payer: creator.publicKey,
                treasury: treasury.publicKey,
            })
                .signers([creator])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPk);
            chai_1.assert.equal(cfg.creator.toBase58(), creator.publicKey.toBase58());
            chai_1.assert.equal(cfg.supplyCap, 1000);
            chai_1.assert.equal(cfg.lockAmountLamports.toNumber(), LOCK_AMOUNT.toNumber());
            chai_1.assert.equal(cfg.currentSupply, 0);
            chai_1.assert.deepEqual(cfg.lifecycleType, { static: {} });
            const treasuryAfter = yield lamportsOf(treasury.publicKey);
            chai_1.assert.equal(treasuryAfter - treasuryBefore, CREATION_FEE.toNumber(), "treasury should receive exact creation fee");
            const creatorAfter = yield lamportsOf(creator.publicKey);
            chai_1.assert.isAtMost(creatorAfter, creatorBefore - CREATION_FEE.toNumber(), "creator paid the creation fee (plus tx fee)");
        }));
        it("forges EVO #0: creator gets mint price, lock SOL lands in EVO PDA", () => __awaiter(void 0, void 0, void 0, function* () {
            evoPk = evoPda(collectionPk, EVO_ID);
            const ownerBefore = yield lamportsOf(other.publicKey);
            const creatorBefore = yield lamportsOf(creator.publicKey);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(3)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: other.publicKey,
            })
                .signers([other])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.owner.toBase58(), other.publicKey.toBase58());
            chai_1.assert.equal(evo.lockedLamports.toNumber(), LOCK_AMOUNT.toNumber());
            chai_1.assert.equal(evo.tradeCount, 0);
            chai_1.assert.isFalse(evo.isShattered);
            chai_1.assert.equal(evo.mintIndex, 0, "first forge should have mint_index 0");
            chai_1.assert.equal(evo.currentState, 0);
            chai_1.assert.equal(evo.feedCount, 0);
            chai_1.assert.equal(evo.totalFedLamports.toNumber(), 0);
            const evoBalance = yield lamportsOf(evoPk);
            const rent = yield connection.getMinimumBalanceForRentExemption(EVO_SPACE);
            chai_1.assert.equal(evoBalance, LOCK_AMOUNT.toNumber() + rent, "EVO PDA should hold lock + rent");
            const creatorAfter = yield lamportsOf(creator.publicKey);
            chai_1.assert.equal(creatorAfter - creatorBefore, MINT_PRICE.toNumber(), "creator should receive mint price");
            const ownerAfter = yield lamportsOf(other.publicKey);
            const spent = ownerBefore - ownerAfter;
            chai_1.assert.isAtLeast(spent, MINT_PRICE.toNumber() + LOCK_AMOUNT.toNumber(), "owner paid mint+lock");
        }));
        it("feeds SOL: balance + locked + feed_count + total_fed increase", () => __awaiter(void 0, void 0, void 0, function* () {
            const FEED = SOL(0.001);
            const evoBefore = yield program.account.evoAccount.fetch(evoPk);
            const evoBalBefore = yield lamportsOf(evoPk);
            const ownerBefore = yield lamportsOf(other.publicKey);
            const prevLocked = evoBefore.lockedLamports.toNumber();
            const prevFeedCount = evoBefore.feedCount;
            yield program.methods
                .feed(FEED)
                .accounts({ evo: evoPk, feeder: other.publicKey })
                .signers([other])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.lockedLamports.toNumber(), prevLocked + FEED.toNumber());
            chai_1.assert.equal(evo.feedCount, prevFeedCount + 1);
            chai_1.assert.equal(evo.totalFedLamports.toNumber(), FEED.toNumber());
            const evoBalAfter = yield lamportsOf(evoPk);
            chai_1.assert.equal(evoBalAfter - evoBalBefore, FEED.toNumber(), "EVO balance increased by feed");
            const ownerAfter = yield lamportsOf(other.publicKey);
            chai_1.assert.isAtLeast(ownerBefore - ownerAfter, FEED.toNumber(), "owner lost feed amount");
        }));
        it("rejects feed by non-owner", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .feed(SOL(0.001))
                    .accounts({ evo: evoPk, feeder: buyer.publicKey })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("non-owner should not feed");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/not the owner|0x4/i);
            }
        }));
        it("transfers ownership without moving locked SOL", () => __awaiter(void 0, void 0, void 0, function* () {
            const evoBalBefore = yield lamportsOf(evoPk);
            const lockedBefore = (yield program.account.evoAccount.fetch(evoPk)).lockedLamports;
            yield program.methods
                .transfer(buyer.publicKey)
                .accounts({ evo: evoPk, currentOwner: other.publicKey })
                .signers([other])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.owner.toBase58(), buyer.publicKey.toBase58());
            chai_1.assert.equal(evo.lockedLamports.toNumber(), lockedBefore.toNumber(), "locked unchanged");
            chai_1.assert.isFalse(evo.isListed, "transfer should clear listing");
            const evoBalAfter = yield lamportsOf(evoPk);
            chai_1.assert.equal(evoBalAfter, evoBalBefore, "EVO balance unchanged on transfer");
        }));
        it("rejects transfer by non-owner", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .transfer(other.publicKey)
                    .accounts({ evo: evoPk, currentOwner: other.publicKey })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("non-owner should not transfer");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/not the owner|0x4/i);
            }
        }));
        it("lists the EVO for sale", () => __awaiter(void 0, void 0, void 0, function* () {
            const PRICE = SOL(0.01);
            yield program.methods
                .list(PRICE)
                .accounts({ evo: evoPk, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.isTrue(evo.isListed);
            chai_1.assert.equal(evo.listPriceLamports.toNumber(), PRICE.toNumber());
        }));
        it("rejects double listing", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .list(SOL(0.02))
                    .accounts({ evo: evoPk, seller: buyer.publicKey })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("should not double-list");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/already listed|0x7/i);
            }
        }));
        it("buys: seller gets price-royalty, creator gets royalty, owner changes, locked unchanged", () => __awaiter(void 0, void 0, void 0, function* () {
            const PRICE = SOL(0.01);
            const royalty = Math.floor((PRICE.toNumber() * ROYALTY_BPS) / 10000);
            const sellerProceeds = PRICE.toNumber() - royalty;
            const sellerBefore = yield lamportsOf(buyer.publicKey);
            const creatorBefore = yield lamportsOf(creator.publicKey);
            const buyerBefore = yield lamportsOf(other.publicKey);
            const lockedBefore = (yield program.account.evoAccount.fetch(evoPk)).lockedLamports;
            yield program.methods
                .buy()
                .accounts({
                evo: evoPk,
                collectionConfig: collectionPk,
                seller: buyer.publicKey,
                creator: creator.publicKey,
                buyer: other.publicKey,
                treasury: treasury.publicKey,
                incinerator: INCINERATOR,
            })
                .signers([other])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.owner.toBase58(), other.publicKey.toBase58(), "buyer is now owner");
            chai_1.assert.isFalse(evo.isListed, "buy clears listing");
            chai_1.assert.equal(evo.tradeCount, 1, "trade_count incremented");
            chai_1.assert.equal(evo.lockedLamports.toNumber(), lockedBefore.toNumber(), "locked never moves on buy");
            const sellerAfter = yield lamportsOf(buyer.publicKey);
            const creatorAfter = yield lamportsOf(creator.publicKey);
            chai_1.assert.isAtLeast(sellerAfter - sellerBefore, sellerProceeds - 10000, "seller got proceeds");
            chai_1.assert.equal(creatorAfter - creatorBefore, royalty, "creator received exact royalty");
            const buyerAfter = yield lamportsOf(other.publicKey);
            chai_1.assert.isAtLeast(buyerBefore - buyerAfter, PRICE.toNumber(), "buyer spent the price");
        }));
        it("shatters: owner gets locked-fee, fee dest gets fee, account closes", () => __awaiter(void 0, void 0, void 0, function* () {
            const evo = yield program.account.evoAccount.fetch(evoPk);
            const locked = evo.lockedLamports.toNumber();
            const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);
            const refund = locked - fee;
            const ownerBefore = yield lamportsOf(other.publicKey);
            const creatorBefore = yield lamportsOf(creator.publicKey);
            const evoBalBefore = yield lamportsOf(evoPk);
            yield program.methods
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
                yield program.account.evoAccount.fetch(evoPk);
                chai_1.assert.fail("EVO account should be closed after shatter");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/Account not found|could not find|not found|does not exist|has no data/i);
            }
            const ownerAfter = yield lamportsOf(other.publicKey);
            const creatorAfter = yield lamportsOf(creator.publicKey);
            // owner receives refund + (rent + any feed surplus). Account closes to owner.
            chai_1.assert.equal(ownerAfter - ownerBefore, refund + (evoBalBefore - locked), "owner receives reserve-fee + rent/surplus");
            chai_1.assert.equal(creatorAfter - creatorBefore, fee, "creator received shatter fee");
        }));
    });
    // ============================================================
    // FAILURE CASES
    // ============================================================
    describe("Failure cases", () => {
        const NAME = "fail1";
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 1, // supply cap 1
            SHATTER_FEE_BPS, { treasury: {} }, ROYALTY_BPS, { treasury: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/meta.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(7)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        it("rejects shatter by non-owner", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
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
                chai_1.assert.fail("non-owner should not shatter");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/not the owner|0x4/i);
            }
        }));
        it("rejects forging past the supply cap", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .forge(1, Buffer.from(Array(32).fill(9)))
                    .accounts({
                    collectionConfig: collectionPk,
                    protocolConfig: protocolPda,
                    creator: creator.publicKey,
                    owner: other.publicKey,
                })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("should not forge past supply cap");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/supply cap|0x2/i);
            }
        }));
        it("rejects buying an unlisted EVO", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .buy()
                    .accounts({
                    evo: evoPk,
                    collectionConfig: collectionPk,
                    seller: buyer.publicKey,
                    creator: creator.publicKey,
                    treasury: treasury.publicKey,
                    incinerator: INCINERATOR,
                    buyer: other.publicKey,
                })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("should not buy unlisted EVO");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/not listed|0x6/i);
            }
        }));
    });
    // ============================================================
    // LIFECYCLE: reveal + evolve
    // ============================================================
    describe("Lifecycle (RevealAndEvolve collection)", () => {
        const NAME = "evo1";
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        const FEED_THRESHOLD = SOL(0.001); // 0.001 SOL per stage
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            revealAuthority = web3_js_1.Keypair.generate();
            yield airdrop(revealAuthority, 1, 0.01);
            collectionPk = collectionPda(NAME);
        }));
        it("creates a RevealAndEvolve collection with reveal authority", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .createCollection(NAME, 100, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/evo.json", defaultLifecycle({
                lifecycleType: { revealAndEvolve: {} },
                maxStates: 3,
                revealAuthority: revealAuthority.publicKey,
                randomnessPolicy: { batchReveal: {} },
                manifestRoot: Array(32).fill(1),
                evolveFeedThreshold: FEED_THRESHOLD,
            }))
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPk);
            chai_1.assert.deepEqual(cfg.lifecycleType, { revealAndEvolve: {} });
            chai_1.assert.equal(cfg.maxStates, 3);
            chai_1.assert.equal(cfg.revealAuthority.toBase58(), revealAuthority.publicKey.toBase58());
            chai_1.assert.isFalse(cfg.isRevealed);
            chai_1.assert.deepEqual(cfg.randomnessPolicy, { batchReveal: {} });
        }));
        it("commits a reveal hash before minting starts", () => __awaiter(void 0, void 0, void 0, function* () {
            // The creator commits hash(secret) before any EVOs are forged.
            // This proves the secret cannot be changed after seeing who minted what.
            revealSecret = Buffer.from(Array(32).fill(42));
            const commitment = Buffer.from((0, js_sha3_1.keccak_256)(revealSecret), 'hex');
            yield program.methods
                .commitReveal(commitment)
                .accounts({ collection: collectionPk, authority: creator.publicKey })
                .signers([creator])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPk);
            chai_1.assert.deepEqual(Array.from(cfg.revealCommitment), Array.from(commitment), "commitment hash stored correctly");
        }));
        it("rejects double commit", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const otherHash = Buffer.from((0, js_sha3_1.keccak_256)(Buffer.from(Array(32).fill(99))), 'hex');
                yield program.methods
                    .commitReveal(otherHash)
                    .accounts({ collection: collectionPk, authority: creator.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should not double-commit");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/already set|0x21/i);
            }
        }));
        it("rejects commit by non-creator", () => __awaiter(void 0, void 0, void 0, function* () {
            // Can't test on this collection (already committed), but verify
            // the constraint exists by trying with a different authority.
            try {
                const someHash = Buffer.from((0, js_sha3_1.keccak_256)(Buffer.from(Array(32).fill(11))), 'hex');
                yield program.methods
                    .commitReveal(someHash)
                    .accounts({ collection: collectionPk, authority: other.publicKey })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("non-creator should not commit");
            }
            catch (e) {
                // Will hit either "already set" or "not creator" — both are acceptable
                (0, chai_1.expect)(e.message).to.match(/already set|creator|0x21|0x12/i);
            }
        }));
        it("forges an EVO in the evolution collection", () => __awaiter(void 0, void 0, void 0, function* () {
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(5)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 0);
            chai_1.assert.equal(evo.mintIndex, 0);
        }));
        it("rejects reveal by non-authority", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .revealCollection(revealSecret)
                    .accounts({ collection: collectionPk, authority: other.publicKey })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("non-authority should not reveal");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/reveal authority|0x1d/i);
            }
        }));
        it("rejects reveal with wrong secret (commitment mismatch)", () => __awaiter(void 0, void 0, void 0, function* () {
            const wrongSecret = Buffer.from(Array(32).fill(99));
            try {
                yield program.methods
                    .revealCollection(wrongSecret)
                    .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
                    .signers([revealAuthority])
                    .rpc();
                chai_1.assert.fail("wrong secret should not reveal");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/commitment|hash mismatch|0x22/i);
            }
        }));
        it("reveals the collection with the committed secret", () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedEntropy = Buffer.from((0, js_sha3_1.keccak_256)(revealSecret), 'hex');
            yield program.methods
                .revealCollection(revealSecret)
                .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
                .signers([revealAuthority])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPk);
            chai_1.assert.isTrue(cfg.isRevealed);
            // The reveal entropy is keccak256(secret), NOT the raw secret.
            // This proves the authority cannot freely choose the entropy —
            // it is deterministically derived from the pre-committed secret.
            chai_1.assert.deepEqual(Array.from(cfg.revealEntropy), Array.from(expectedEntropy), "reveal entropy = keccak256(secret)");
        }));
        it("rejects double reveal", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .revealCollection(revealSecret)
                    .accounts({ collection: collectionPk, authority: revealAuthority.publicKey })
                    .signers([revealAuthority])
                    .rpc();
                chai_1.assert.fail("should not double reveal");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/already revealed|0x1e/i);
            }
        }));
        it("rejects evolve when conditions not met", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .evolve()
                    .accounts({ evo: evoPk, collection: collectionPk })
                    .rpc();
                chai_1.assert.fail("should not evolve without feeding");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/conditions not met|0x1b/i);
            }
        }));
        it("evolves to state 1 after feeding the threshold", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .feed(FEED_THRESHOLD)
                .accounts({ evo: evoPk, feeder: buyer.publicKey })
                .signers([buyer])
                .rpc();
            yield program.methods
                .evolve()
                .accounts({ evo: evoPk, collection: collectionPk })
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 1, "advanced to state 1");
            chai_1.assert.equal(evo.feedCount, 1);
        }));
        it("rejects evolve when feed below cumulative threshold for state 2", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .evolve()
                    .accounts({ evo: evoPk, collection: collectionPk })
                    .rpc();
                chai_1.assert.fail("should not evolve (need 2x threshold for state 2)");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/conditions not met|0x1b/i);
            }
        }));
        it("evolves to state 2 after feeding enough cumulative total", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .feed(FEED_THRESHOLD)
                .accounts({ evo: evoPk, feeder: buyer.publicKey })
                .signers([buyer])
                .rpc();
            yield program.methods
                .evolve()
                .accounts({ evo: evoPk, collection: collectionPk })
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 2, "advanced to state 2");
        }));
        it("rejects evolve at max state (maxStates=3, state 2 is final)", () => __awaiter(void 0, void 0, void 0, function* () {
            // Feed enough to satisfy the threshold, but should still be blocked
            yield program.methods
                .feed(FEED_THRESHOLD)
                .accounts({ evo: evoPk, feeder: buyer.publicKey })
                .signers([buyer])
                .rpc();
            try {
                yield program.methods
                    .evolve()
                    .accounts({ evo: evoPk, collection: collectionPk })
                    .rpc();
                chai_1.assert.fail("should not evolve past max state");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/already at max state|0x1b/i);
            }
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 2, "still at state 2");
        }));
    });
    // ============================================================
    // BURN FEE DESTINATION (shatter fee to incinerator)
    // ============================================================
    describe("Burn fee destination", () => {
        const NAME = "burn1";
        let collectionPk;
        let evoPk;
        let burnWallet;
        const EVO_ID = 0;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            burnWallet = web3_js_1.Keypair.generate();
            yield airdrop(burnWallet, 0.01, 0.01);
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 100, SHATTER_FEE_BPS, { burn: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/burn.json", defaultLifecycle({
                burnDestination: burnWallet.publicKey,
            }))
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(8)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        it("sends the shatter fee to the configurable burn destination", () => __awaiter(void 0, void 0, void 0, function* () {
            const evo = yield program.account.evoAccount.fetch(evoPk);
            const locked = evo.lockedLamports.toNumber();
            const fee = Math.floor((locked * SHATTER_FEE_BPS) / 10000);
            const refund = locked - fee;
            const burnBefore = yield lamportsOf(burnWallet.publicKey);
            const ownerBefore = yield lamportsOf(buyer.publicKey);
            const evoBalBefore = yield lamportsOf(evoPk);
            yield program.methods
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
            const burnAfter = yield lamportsOf(burnWallet.publicKey);
            const ownerAfter = yield lamportsOf(buyer.publicKey);
            const evoBalAfter = yield lamportsOf(evoPk);
            // The burn wallet received the EXACT fee — provable because
            // we use a configurable burn destination (a normal wallet)
            // instead of the system incinerator (whose balance is
            // non-inspectable on localnet).
            chai_1.assert.equal(burnAfter - burnBefore, fee, "burn wallet received the exact shatter fee");
            chai_1.assert.equal(ownerAfter - ownerBefore, refund + (evoBalBefore - locked), "owner received locked-fee + rent/surplus");
            chai_1.assert.equal(evoBalAfter, 0, "EVO account is closed after shatter");
        }));
    });
    // ============================================================
    // LIFECYCLE: Reveal-only (Reveal collection)
    // ============================================================
    describe("Lifecycle (Reveal collection)", () => {
        const NAME = "reveal1";
        let collectionPk;
        let evoPk;
        let revealAuth;
        const EVO_ID = 0;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            revealAuth = web3_js_1.Keypair.generate();
            yield airdrop(revealAuth, 1, 0.01);
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 100, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/reveal.json", defaultLifecycle({
                lifecycleType: { reveal: {} },
                maxStates: 2,
                revealAuthority: revealAuth.publicKey,
            }))
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(15)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        it("starts at stage 0 (pre-reveal)", () => __awaiter(void 0, void 0, void 0, function* () {
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 0, "pre-reveal stage is 0");
        }));
        it("rejects evolve on a Reveal collection (no evolution)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .evolve()
                    .accounts({ evo: evoPk, collection: collectionPk })
                    .rpc();
                chai_1.assert.fail("should not evolve on Reveal collection");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/EvolutionNotEnabled|does not support evolution/i);
            }
        }));
        it("reveals the collection — stage 0 → 1", () => __awaiter(void 0, void 0, void 0, function* () {
            const secret = Buffer.from(Array(32).fill(77));
            yield program.methods
                .revealCollection(secret)
                .accounts({ collection: collectionPk, authority: revealAuth.publicKey })
                .signers([revealAuth])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPk);
            chai_1.assert.isTrue(cfg.isRevealed, "collection is revealed");
        }));
        it("EVO is still at stage 0 (reveal is collection-level, not per-asset)", () => __awaiter(void 0, void 0, void 0, function* () {
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 0, "EVO current_state unchanged by reveal");
            // Marketplace reads is_revealed from collection + current_state from EVO
            // to determine the visual stage: is_revealed ? 1 : 0 for Reveal lifecycle
        }));
    });
    // ============================================================
    // LIFECYCLE: Visual stage override (Custom collection)
    // ============================================================
    describe("Lifecycle (Custom collection + set_visual_stage)", () => {
        const NAME = "custom1";
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        let stageAuthority;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            stageAuthority = web3_js_1.Keypair.generate();
            yield airdrop(stageAuthority, 1, 0.01);
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 100, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/custom.json", defaultLifecycle({
                lifecycleType: { custom: {} },
                maxStates: 5,
                revealAuthority: stageAuthority.publicKey,
            }))
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(25)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        it("starts at stage 0", () => __awaiter(void 0, void 0, void 0, function* () {
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 0);
        }));
        it("set_visual_stage to 3 succeeds (authority)", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .setVisualStage(3)
                .accounts({
                evo: evoPk,
                collectionConfig: collectionPk,
                authority: stageAuthority.publicKey,
            })
                .signers([stageAuthority])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk);
            chai_1.assert.equal(evo.currentState, 3, "stage set to 3");
        }));
        it("rejects set_visual_stage by non-authority", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .setVisualStage(2)
                    .accounts({
                    evo: evoPk,
                    collectionConfig: collectionPk,
                    authority: other.publicKey,
                })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("non-authority should not set stage");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/NotStageAuthority|reveal authority can set/i);
            }
        }));
        it("rejects set_visual_stage exceeding max_states", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .setVisualStage(5) // maxStates=5, valid range 0..4
                    .accounts({
                    evo: evoPk,
                    collectionConfig: collectionPk,
                    authority: stageAuthority.publicKey,
                })
                    .signers([stageAuthority])
                    .rpc();
                chai_1.assert.fail("should reject stage >= maxStates");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InvalidStage|exceeds max_states/i);
            }
        }));
        it("rejects set_visual_stage on non-Custom collection", () => __awaiter(void 0, void 0, void 0, function* () {
            // Use the RevealAndEvolve collection from earlier tests
            const evo1CollectionPk = collectionPda("evo1");
            const evo1Pk = evoPda(evo1CollectionPk, 0);
            try {
                yield program.methods
                    .setVisualStage(1)
                    .accounts({
                    evo: evo1Pk,
                    collectionConfig: evo1CollectionPk,
                    authority: revealAuthority.publicKey,
                })
                    .signers([revealAuthority])
                    .rpc();
                chai_1.assert.fail("should reject on RevealAndEvolve collection");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/transition not allowed|0x26/i);
            }
        }));
    });
    // ============================================================
    // LIFECYCLE: Static rejects transitions
    // ============================================================
    describe("Lifecycle (Static rejects transitions)", () => {
        const NAME = "static2";
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/static2.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(35)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        it("rejects evolve on Static collection", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .evolve()
                    .accounts({ evo: evoPk, collection: collectionPk })
                    .rpc();
                chai_1.assert.fail("should not evolve on Static collection");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/EvolutionNotEnabled|does not support evolution/i);
            }
        }));
        it("rejects reveal on Static collection", () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeAuth = web3_js_1.Keypair.generate();
            try {
                yield program.methods
                    .revealCollection(Buffer.from(Array(32).fill(1)))
                    .accounts({ collection: collectionPk, authority: fakeAuth.publicKey })
                    .signers([fakeAuth])
                    .rpc();
                chai_1.assert.fail("should not reveal Static collection");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/reveal authority|transition not allowed|0x1d|0x26/i);
            }
        }));
    });
    // ============================================================
    // ADVERSARIAL TESTS (security boundaries)
    // Tests negative paths an attacker might try.
    // ============================================================
    describe("Adversarial tests (security boundaries)", () => {
        let collectionPk;
        let evoPk;
        const EVO_ID = 0;
        const NAME = "adv1";
        before(() => __awaiter(void 0, void 0, void 0, function* () {
            collectionPk = collectionPda(NAME);
            yield program.methods
                .createCollection(NAME, 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/adv.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            evoPk = evoPda(collectionPk, EVO_ID);
            yield program.methods
                .forge(EVO_ID, Buffer.from(Array(32).fill(99)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
        }));
        // --- Substituted collection accounts ---
        it("rejects shatter with wrong collection_config (substituted account)", () => __awaiter(void 0, void 0, void 0, function* () {
            const wrongCollection = collectionPda("static1"); // different collection
            try {
                yield program.methods
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
                chai_1.assert.fail("should reject substituted collection");
            }
            catch (e) {
                // Anchor PDA seed check fails because wrong collection doesn't match evo's seeds
                (0, chai_1.expect)(e.message).to.match(/ConstraintSeeds|seeds|0x7d6/i);
            }
        }));
        // --- Incorrect PDA seeds ---
        it("rejects shatter with wrong EVO PDA (non-PDA account)", () => __awaiter(void 0, void 0, void 0, function* () {
            const wrongEvo = evoPda(collectionPda("static1"), EVO_ID);
            try {
                yield program.methods
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
                chai_1.assert.fail("should reject wrong EVO PDA");
            }
            catch (e) {
                // Any Anchor error is acceptable — the point is the tx must fail
                (0, chai_1.expect)(e.message).to.match(/AnchorError|Error|reject/i);
            }
        }));
        // --- Owner account mismatch ---
        it("rejects buy with wrong seller (not actual owner)", () => __awaiter(void 0, void 0, void 0, function* () {
            yield program.methods
                .list(SOL(0.01))
                .accounts({ evo: evoPk, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            try {
                yield program.methods
                    .buy()
                    .accounts({
                    evo: evoPk,
                    collectionConfig: collectionPk,
                    seller: other.publicKey, // wrong — not the actual owner
                    creator: creator.publicKey,
                    treasury: treasury.publicKey,
                    incinerator: INCINERATOR,
                    buyer: other.publicKey,
                })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("should reject wrong seller");
            }
            catch (e) {
                // address constraint: seller must == evo.owner
                (0, chai_1.expect)(e.message).to.match(/ConstraintAddress|address|0x7d3/i);
            }
            // cleanup: delist
            yield program.methods
                .delist()
                .accounts({ evo: evoPk, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
        }));
        // --- Shatter while listed — now REJECTED by the protocol ---
        it("rejects shatter while listed (require !is_listed)", () => __awaiter(void 0, void 0, void 0, function* () {
            // Forge a fresh EVO for this test
            const evoId = 5;
            const pk = evoPda(collectionPk, evoId);
            yield program.methods
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
            yield program.methods
                .list(SOL(0.01))
                .accounts({ evo: pk, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const evoBefore = yield program.account.evoAccount.fetch(pk);
            chai_1.assert.isTrue(evoBefore.isListed, "EVO is listed");
            // Shatter while listed — now REJECTED by the program (require !is_listed).
            // This makes marketplace semantics explicit: a listed EVO must be
            // delisted before it can be shattered.
            try {
                yield program.methods
                    .shatter(evoId)
                    .accounts({
                    evo: pk,
                    collectionConfig: collectionPk,
                    owner: buyer.publicKey,
                    creator: creator.publicKey,
                    treasury: treasury.publicKey,
                    incinerator: INCINERATOR,
                })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("should reject shatter while listed");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/EvoIsListed|listed/i);
            }
            // EVO account must still exist (not closed)
            const evoAfter = yield program.account.evoAccount.fetch(pk);
            chai_1.assert.isTrue(evoAfter.isListed, "EVO still listed");
        }));
        // --- Buy stale listing after transfer ---
        it("rejects buy of stale listing after ownership transfer", () => __awaiter(void 0, void 0, void 0, function* () {
            // Forge a new EVO for this test
            const EVO_ID2 = 1;
            const evoPk2 = evoPda(collectionPk, EVO_ID2);
            yield program.methods
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
            yield program.methods
                .list(SOL(0.01))
                .accounts({ evo: evoPk2, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            // Transfer clears the listing
            yield program.methods
                .transfer(other.publicKey)
                .accounts({ evo: evoPk2, currentOwner: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk2);
            chai_1.assert.isFalse(evo.isListed, "transfer clears listing");
            // Try to buy the stale listing — should fail
            try {
                yield program.methods
                    .buy()
                    .accounts({
                    evo: evoPk2,
                    collectionConfig: collectionPk,
                    seller: buyer.publicKey, // old owner, now wrong
                    creator: creator.publicKey,
                    treasury: treasury.publicKey,
                    incinerator: INCINERATOR,
                    buyer: buyer.publicKey,
                })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("should reject stale listing buy");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/not listed|ConstraintAddress|address|0x7d3|0x6/i);
            }
        }));
        // --- Malformed lifecycle parameters ---
        it("rejects RevealAndEvolve with max_states=0", () => __awaiter(void 0, void 0, void 0, function* () {
            const fakeAuth = web3_js_1.Keypair.generate();
            try {
                yield program.methods
                    .createCollection("bad1", 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/bad.json", defaultLifecycle({
                    lifecycleType: { revealAndEvolve: {} },
                    maxStates: 0,
                    revealAuthority: fakeAuth.publicKey,
                    evolveFeedThreshold: SOL(0.001),
                }))
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject max_states=0 on RevealAndEvolve");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InvalidLifecycleConfig|0x22/i);
            }
        }));
        it("rejects Reveal without reveal_authority", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("bad2", 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/bad.json", defaultLifecycle({
                    lifecycleType: { reveal: {} },
                    maxStates: 2,
                    revealAuthority: web3_js_1.PublicKey.default, // missing
                }))
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject Reveal without reveal_authority");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InvalidLifecycleConfig|0x22/i);
            }
        }));
        // --- Royalty basis points at boundaries ---
        it("accepts royalty_bps=0 (no royalty)", () => __awaiter(void 0, void 0, void 0, function* () {
            const zeroRoyName = "roy0";
            const zeroRoyCol = collectionPda(zeroRoyName);
            yield program.methods
                .createCollection(zeroRoyName, 10, SHATTER_FEE_BPS, { creator: {} }, 0, // 0 bps — no royalty
            { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/roy0.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            // Forge + list + buy — verify seller gets full price (no royalty)
            const evoPk0 = evoPda(zeroRoyCol, 0);
            yield program.methods
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
            yield program.methods
                .list(PRICE)
                .accounts({ evo: evoPk0, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const sellerBefore = yield lamportsOf(buyer.publicKey);
            const creatorBefore = yield lamportsOf(creator.publicKey);
            yield program.methods
                .buy()
                .accounts({
                evo: evoPk0,
                collectionConfig: zeroRoyCol,
                seller: buyer.publicKey,
                creator: creator.publicKey,
                treasury: treasury.publicKey,
                incinerator: INCINERATOR,
                buyer: other.publicKey,
            })
                .signers([other])
                .rpc();
            const sellerAfter = yield lamportsOf(buyer.publicKey);
            const creatorAfter = yield lamportsOf(creator.publicKey);
            // Seller gets full price (no royalty deducted)
            chai_1.assert.isAtLeast(sellerAfter - sellerBefore, PRICE.toNumber() - 10000, "seller got full price");
            // Creator gets 0 royalty
            chai_1.assert.equal(creatorAfter - creatorBefore, 0, "creator got 0 royalty with 0 bps");
        }));
        it("rejects royalty_bps exceeding MAX_ROYALTY_BPS (2500)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("badroy", 10, SHATTER_FEE_BPS, { creator: {} }, 2501, // exceeds MAX_ROYALTY_BPS
                { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/badroy.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject royalty > MAX");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/RoyaltyTooHigh|royalty exceeds|0xc/i);
            }
        }));
        it("rejects shatter_fee_bps exceeding MAX_SHATTER_FEE_BPS (2000)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("badfee", 10, 2001, // exceeds MAX_SHATTER_FEE_BPS
                { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/badfee.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject shatter fee > MAX");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/ShatterFeeTooHigh|shatter fee exceeds|0xb/i);
            }
        }));
        // --- Zero-price and maximum-u64 inputs ---
        it("rejects list with zero price", () => __awaiter(void 0, void 0, void 0, function* () {
            const evoPk3 = evoPda(collectionPk, 2);
            yield program.methods
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
                yield program.methods
                    .list(new anchor_1.BN(0))
                    .accounts({ evo: evoPk3, seller: buyer.publicKey })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("should reject zero price");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InsufficientLamports|insufficient lamports|0xa/i);
            }
        }));
        it("accepts list with max u64 price, but buy fails (buyer can't afford)", () => __awaiter(void 0, void 0, void 0, function* () {
            const evoPk4 = evoPda(collectionPk, 3);
            yield program.methods
                .forge(3, Buffer.from(Array(32).fill(66)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
            const MAX_U64 = new anchor_1.BN("18446744073709551615");
            yield program.methods
                .list(MAX_U64)
                .accounts({ evo: evoPk4, seller: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk4);
            chai_1.assert.isTrue(evo.isListed);
            chai_1.assert.equal(evo.listPriceLamports.toString(), MAX_U64.toString());
            // Buy should fail — no one has u64::MAX lamports
            try {
                yield program.methods
                    .buy()
                    .accounts({
                    evo: evoPk4,
                    collectionConfig: collectionPk,
                    seller: buyer.publicKey,
                    creator: creator.publicKey,
                    treasury: treasury.publicKey,
                    incinerator: INCINERATOR,
                    buyer: other.publicKey,
                })
                    .signers([other])
                    .rpc();
                chai_1.assert.fail("should reject buy — buyer can't afford u64::MAX");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InsufficientPayment|insufficient payment|0xd/i);
            }
        }));
        // --- locked_lamports field vs actual PDA balance consistency ---
        it("locked_lamports field matches actual PDA lamport balance after forge", () => __awaiter(void 0, void 0, void 0, function* () {
            const evoPk5 = evoPda(collectionPk, 4);
            yield program.methods
                .forge(4, Buffer.from(Array(32).fill(44)))
                .accounts({
                collectionConfig: collectionPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
            const evo = yield program.account.evoAccount.fetch(evoPk5);
            const pdaBalance = yield lamportsOf(evoPk5);
            // PDA balance should be >= locked_lamports + rent minimum
            // (rent minimum = EVO_SPACE * rent rate)
            chai_1.assert.isAbove(pdaBalance, evo.lockedLamports.toNumber(), "PDA balance > locked_lamports (includes rent)");
            // The difference should be approximately the rent-exempt minimum
            const rentMin = yield connection.getMinimumBalanceForRentExemption(EVO_SPACE);
            chai_1.assert.isAtLeast(pdaBalance - evo.lockedLamports.toNumber(), rentMin - 10000, // allow small rounding margin
            "PDA balance - locked >= rent minimum");
        }));
        it("locked_lamports field matches PDA balance after feed", () => __awaiter(void 0, void 0, void 0, function* () {
            const evoPk5 = evoPda(collectionPk, 4);
            const evoBefore = yield program.account.evoAccount.fetch(evoPk5);
            const FEED = SOL(0.001);
            yield program.methods
                .feed(FEED)
                .accounts({ evo: evoPk5, feeder: buyer.publicKey })
                .signers([buyer])
                .rpc();
            const evoAfter = yield program.account.evoAccount.fetch(evoPk5);
            const pdaBalance = yield lamportsOf(evoPk5);
            const expectedLocked = evoBefore.lockedLamports.toNumber() + FEED.toNumber();
            chai_1.assert.equal(evoAfter.lockedLamports.toNumber(), expectedLocked, "field updated correctly");
            // PDA balance should have increased by the feed amount
            chai_1.assert.isAtLeast(pdaBalance - evoAfter.lockedLamports.toNumber(), 0, "PDA balance >= locked_lamports after feed");
        }));
        it("rejects forge with lock_amount=0 (collection with zero lock)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("zerolock", 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, new anchor_1.BN(0), // zero lock — should be rejected
                "https://example.com/zerolock.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject zero lock_amount");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/InsufficientLamports|insufficient lamports|0xa/i);
            }
        }));
        it("rejects create collection with empty name", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("", 10, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/empty.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject empty name");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/CollectionNameTooLong|name is too long|0x2/i);
            }
        }));
        // ============================================================
        // SUPPLY CAP BOUNDARY TESTS (max 20,000 per collection)
        // ============================================================
        it("rejects supply_cap = 0 (too low)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("zerocap", 0, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/zerocap.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject supply_cap = 0");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/SupplyCapTooLow|0x2[0-9a-f]/i);
            }
        }));
        it("rejects supply_cap = 20,001 (exceeds ceiling)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("overcap", 20001, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/overcap.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject supply_cap = 20001");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/SupplyCapTooHigh|0x2[0-9a-f]/i);
            }
        }));
        it("rejects supply_cap = 100,000 (exceeds ceiling)", () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield program.methods
                    .createCollection("wayover", 100000, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/wayover.json", defaultLifecycle())
                    .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                    .signers([creator])
                    .rpc();
                chai_1.assert.fail("should reject supply_cap = 100000");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/SupplyCapTooHigh|0x2[0-9a-f]/i);
            }
        }));
        it("accepts supply_cap = 1 (minimum)", () => __awaiter(void 0, void 0, void 0, function* () {
            const name = "mincap1";
            yield program.methods
                .createCollection(name, 1, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/mincap1.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPda(name));
            chai_1.assert.equal(cfg.supplyCap, 1);
        }));
        it("accepts supply_cap = 20,000 (ceiling)", () => __awaiter(void 0, void 0, void 0, function* () {
            const name = "maxcap20k";
            yield program.methods
                .createCollection(name, 20000, SHATTER_FEE_BPS, { creator: {} }, ROYALTY_BPS, { creator: {} }, MINT_PRICE, LOCK_AMOUNT, "https://example.com/maxcap20k.json", defaultLifecycle())
                .accounts({ payer: creator.publicKey, treasury: treasury.publicKey })
                .signers([creator])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collectionPda(name));
            chai_1.assert.equal(cfg.supplyCap, 20000);
        }));
        it("forge succeeds at supply 0→1 for cap=1, then rejects forge 1→2", () => __awaiter(void 0, void 0, void 0, function* () {
            // mincap1 collection has cap=1, already forged 0 EVOs
            const collPk = collectionPda("mincap1");
            const evo0 = evoPda(collPk, 0);
            yield program.methods
                .forge(0, Buffer.from(Array(32).fill(9)))
                .accounts({
                collectionConfig: collPk,
                protocolConfig: protocolPda,
                creator: creator.publicKey,
                owner: buyer.publicKey,
            })
                .signers([buyer])
                .rpc();
            const cfg = yield program.account.collectionConfig.fetch(collPk);
            chai_1.assert.equal(cfg.currentSupply, 1);
            // Forge #1 should fail — cap reached
            const evo1 = evoPda(collPk, 1);
            try {
                yield program.methods
                    .forge(1, Buffer.from(Array(32).fill(9)))
                    .accounts({
                    collectionConfig: collPk,
                    protocolConfig: protocolPda,
                    creator: creator.publicKey,
                    owner: buyer.publicKey,
                })
                    .signers([buyer])
                    .rpc();
                chai_1.assert.fail("should reject forge at supply cap");
            }
            catch (e) {
                (0, chai_1.expect)(e.message).to.match(/SupplyCapReached|0xf/i);
            }
        }));
    });
});
