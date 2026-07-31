# Extract evm/ into its own repository
From a fresh clone of EVO (preserves history of the evm/ folder):
```bash
git clone https://github.com/stephenclawdbot-png/EVO evo-evm-split
cd evo-evm-split
git subtree split --prefix=evm -b evm-only
mkdir ../evo-evm && cd ../evo-evm && git init
git pull ../evo-evm-split evm-only
# create the empty GitHub repo (e.g. stephenclawdbot-png/evo-evm), then:
git remote add origin https://github.com/stephenclawdbot-png/evo-evm.git
git push -u origin main
```
Then in the new repo: `forge init --force`, add OpenZeppelin + Chainlink,
move contracts/ into Foundry's src/, write tests before ANY deploy.
