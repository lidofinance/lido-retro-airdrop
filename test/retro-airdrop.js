const path = require('path')
const fs = require('fs')
const BN = require('bn.js')
const { getEvents } = require('@aragon/contract-helpers-test')

const daoUtils = require('../lib/src/dao')
const { getContract, setProvider } = require('../lib/src/abi')

const { deployDistributor } = require('../scripts/01-deploy-distributor')
const { proposeTransfer } = require('../scripts/02-propose-transfer')
const { readNetworkState } = require('../scripts/helpers/persisted-network-state')
const { assert } = require('../scripts/helpers/assert')

contract('Voting for LDO token transfer', (addresses) => {
  const [whale] = addresses

  const holders = [
    '0x3e40d73eb977dc6a537af587d48316fee66e9c8c',
    '0xb8d83908aab38a159f3da47a59d84db8e1838712',
    '0xa2dfc431297aee387c05beef507e5335e684fbcd',
    '0x1597d19659f3de52abd475f7d2314dcca29359bd',
    '0x695c388153bea0fbe3e1c049c149bad3bc917740',
    '0x945755de7eac99008c8c57bda96772d50872168b',
    '0xad4f7415407b83a081a0bee22d05a8fdc18b42da',
    '0xfea88380baff95e85305419eb97247981b1a8eee',
    '0x0f89d54b02ca570de82f770d33c7b7cf7b3c3394',
    '0x9bb75183646e2a0dc855498bacd72b769ae6ced3',
    '0x447f95026107aaed7472a0470931e689f51e0e42',
    '0x1f3813fe7ace2a33585f1438215c7f42832fb7b3',
    '0xc24da173a250e9ca5c54870639ebe5f88be5102d',
    '0xb842afd82d940ff5d8f6ef3399572592ebf182b0',
    '0x91715128a71c9c734cdc20e5edeeea02e72e428e',
    '0x8b1674a617f103897fb82ec6b8eb749ba0b9765b',
    '0x8d689476eb446a1fb0065bffac32398ed7f89165',
    '0x9849c2c1b73b41aee843a002c332a2d16aaab611'
  ]

  const state = readNetworkState('mainnet', 1)
  const merkleFilePath = path.resolve(__dirname, '..', state['airdrop-1-retro'].merkleFile)
  const merkleData = JSON.parse(fs.readFileSync(merkleFilePath))

  let token, voting, distributor, transferAmount, voteId

  before(async () => {
    setProvider(web3.currentProvider)

    console.log('impersonating holders...')
    await Promise.all(holders.map(impersonate))

    token = await getContract('ERC20').at(state.daoTokenAddress)
    voting = await daoUtils.getVoting(web3, state['app:aragon-voting'].proxyAddress)
  })

  it(`somebody deploys the MerkleDistributor contract`, async () => {
    distributor = await deployDistributor(merkleData, state.daoTokenAddress, whale)
  })

  it(`DAO holder proposes a token transfer to the MerkleDistributor address`, async () => {
    const result = await proposeTransfer(state, distributor.address, merkleData, holders[0])
    transferAmount = result.transferAmount
    voteId = result.voteId
  })

  // need to reach >50% support to execute immediately
  for (const holder of holders) {
    it(`DAO holder ${holder} supports the transfer`, async () => {
      const voteOpts = { voteId, supports: true, executesIfDecided: false }
      await daoUtils.castVote(voting, voteOpts, { from: holder })
    })
  }

  it(`the transfer executes`, async () => {
    assert.equal(await voting.canExecute(voteId), true, 'can execute vote')
    await voting.executeVote(voteId, { from: whale })
    assert.bnEqual(await token.balanceOf(distributor.address), transferAmount, 'distributor balance')
  })

  const ONE_TENTH_ETHER = new BN(web3.utils.toWei('0.1', 'ether'))

  for (const account of Object.keys(merkleData.claims)) {
    it(`recipient ${account} claims their tokens`, async () => {
      const claimData = merkleData.claims[account]
      const expectedAmount = new BN(claimData.amount.replace(/^0x/, ''), 16)

      const amountTokens = web3.utils.fromWei(expectedAmount, 'ether')
      console.log(`      index ${claimData.index}, amount ${amountTokens}`)

      const balanceBefore = await token.balanceOf(account)
      await impersonate(account)

      const code = await web3.eth.getCode(account)
      if (code !== '0x') {
        const balance = await web3.eth.getBalance(account)
        if (new BN(balance).lt(ONE_TENTH_ETHER)) {
          console.log(`skipping the contract: insufficient balance`)
          return
        }
      }

      const result = await distributor.claim(
        claimData.index,
        account,
        expectedAmount.toString(),
        claimData.proof,
        { from: account }
      )

      const events = getEvents(result, 'Claimed')
      assert.equal(events.length, 1, 'total 1 Claimed event')

      const { args: evtArgs } = events[0]

      assert.addressEqual(evtArgs.account, account, `address ${account}: claimed account`)
      assert.bnEqual(evtArgs.index, claimData.index, `address ${account}: claimed index`)
      assert.bnEqual(evtArgs.amount, expectedAmount, `address ${account}: claimed amount`)

      const balanceAfter = await token.balanceOf(account)
      assert.bnEqual(balanceAfter, expectedAmount.add(balanceBefore), `address ${account}: balance`)
    })
  }

  async function impersonate(account) {
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account]
    })
    try {
      await web3.eth.sendTransaction({
        from: whale,
        to: account,
        value: web3.utils.toWei('10', 'ether')
      })
    } catch (err) {
      console.log(`failed to send ETH to account ${account}`)
    }
  }
})
