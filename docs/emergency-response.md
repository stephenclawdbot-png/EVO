# EVO — Emergency Response Plan

> Because EVO launches as an unaudited beta, our response plan matters
> almost as much as our testing. This document defines severity levels,
> response procedures, and communication protocols for incidents.

---

## Severity Classification

### Severity 1 — Critical (funds at risk)

A bug that could cause loss of user SOL, unauthorized withdrawal, or
protocol insolvency (locked_lamports inconsistent with PDA balance).

**Examples:**
- locked_lamports can be bypassed or manipulated
- shatter sends SOL to wrong recipient
- buy sends SOL to wrong party
- reserve invariant violation discovered on mainnet
- upgrade authority key compromised

**Response:**
1. **Pause frontend** — take down the web app immediately
2. **Warn users** — post advisory on all channels: "DO NOT FORGE/SHATTER/BUY EVOs — critical bug discovered"
3. **Disable new mints if possible** — if the bug is in forge, create_collection owner can delist or the team can upgrade to pause
4. **Publish advisory** — GitHub issue with details + recommended user actions
5. **Ship patch** — fix the bug, test locally, upgrade program on mainnet
6. **Post-mortem** — document root cause, timeline, and prevention measures

**Timeline:** Patch within hours. Communication within minutes.

### Severity 2 — High (broken functionality, no direct fund loss)

A bug that breaks core functionality but does not directly cause fund loss.

**Examples:**
- forge/feed/shatter fails for valid inputs
- transfer doesn't update ownership correctly
- evolve triggers at wrong threshold
- listing/buy marketplace broken
- reveal/evolve lifecycle transitions broken

**Response:**
1. **Hotfix** — diagnose, fix, test locally
2. **Upgrade** — deploy patched program to mainnet
3. **Notify community** — post update explaining what broke, what was fixed, and that funds are safe
4. **Monitor** — watch for recurrence after upgrade

**Timeline:** Patch within 24 hours. Communication within hours.

### Severity 3 — Medium (cosmetic or edge case)

A bug that affects non-critical behavior or only triggers in rare edge cases.

**Examples:**
- metadata URI doesn't update
- visual stage display incorrect (off-chain rendering issue)
- royalty calculation rounding edge case
- admin function (set_visual_stage, update_metadata) fails

**Response:**
1. **Scheduled fix** — add to next release batch
2. **Document** — create GitHub issue tracking the bug
3. **Notify if visible** — mention in community updates if users would notice

**Timeline:** Fix in next scheduled release (days to weeks).

---

## Response Infrastructure

### Upgrade Authority
- **Kept during beta** — the team retains upgrade authority so bugs can be patched
- **Key security:** upgrade authority key must be stored securely (hardware wallet recommended)
- **Never share the key** — even with team members; use multisig if team needs shared access

### Communication Channels
| Channel | Purpose |
|---|---|
| GitHub Issues | Technical advisories + post-mortems |
| X / Twitter | Public announcements (short form) |
| Discord / Telegram | Community warnings + Q&A |
| Frontend banner | In-app warning for active users |

### Frontend Kill Switch
- The frontend can be taken down immediately via Vercel
- A static "maintenance" page should be prepared in advance
- The page should display: "EVO is temporarily paused. Do not interact with the program. Details: [GitHub link]"

### Program-Level Pause (future)
- Currently, there is no pause instruction in the EVO program
- If the beta reveals repeated issues, consider adding a `pause` instruction (gated by upgrade authority) that blocks forge/feed/shatter/buy
- This is a Phase 2 improvement, not required for beta launch

---

## Post-Incident Procedure

After any Severity 1 or 2 incident:

1. **Post-mortem document** — created as a GitHub issue or docs/post-mortem-*.md
2. **Root cause analysis** — what happened, why it wasn't caught by tests
3. **Test gap** — add adversarial test case covering the discovered edge case
4. **Process improvement** — update testing checklist if needed
5. **Community update** — transparent summary of what happened and what was fixed

---

## Pre-Beta Checklist

Before opening public mint:

- [ ] Emergency response plan reviewed by team
- [ ] Frontend kill switch tested (Vercel takedown < 5 minutes)
- [ ] Static maintenance page prepared
- [ ] Communication channels set up (GitHub, Twitter, Discord/Telegram)
- [ ] Upgrade authority key secured (hardware wallet)
- [ ] Conservative parameters set (low mint price, low lock amount)
- [ ] "BETA — UNAUDITED" labeling visible on all user-facing pages
- [ ] Monitoring set up for: failed transactions, invariant violations, unusual balance changes