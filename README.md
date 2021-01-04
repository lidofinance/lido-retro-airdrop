# lido-retro-airdrop

Lido Merkle airdrop. Uses contract code from the [Uniswap airdrop].

[Uniswap airdrop]: https://github.com/Uniswap/merkle-distributor/tree/c3255bf/contracts

#### 1. Install the dependencies

```text
yarn
```

#### 2. Prepare the secrets

Copy `accounts-sample.json` to `accounts.json` and specify your archive mainnet node endpoint which
will be needed in the next step.

#### 3. Run the tests

This will fork the mainnet, deploy the airdrop, start and accept DAO voting for transferring tokens
to the airdrop contract:

```text
FORK_BLOCK=11588328 yarn test
```

Specify the recent `FORK_BLOCK` that has at least 8 confirmations.

#### 4. Deploy the airdrop contract

```text
NETWORK_NAME=mainnet FROM=<deployer-account> yarn hardhat run scripts/01-deploy-distributor.js
```

#### 5. Start DAO voting for populating the airdrop w/ tokens

```text
NETWORK_NAME=mainnet FROM=<dao-holder-account> yarn hardhat run scripts/02-propose-transfer.js
```
