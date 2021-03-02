const path = require('path')
const fs = require('fs').promises
const BN = require('bn.js')

const daoUtils = require('../lib/src/dao')
const { getContract, setProvider } = require('../lib/src/abi')

const runOrWrapScript = require('./helpers/run-or-wrap-script')
const { log, yl, gr } = require('./helpers/log')
const { readNetworkState, assertRequiredNetworkState } = require('./helpers/persisted-network-state')
const { assert } = require('./helpers/assert')

const REQUIRED_NET_STATE = [
  'daoTokenAddress',
  'app:aragon-finance',
  'app:aragon-token-manager',
  'app:aragon-voting',
  'oneinch-rewards'
]

const FROM = process.env.FROM

async function main({ web3, artifacts }) {
  setProvider(web3.currentProvider)

  const netId = await web3.eth.net.getId()

  log.splitter()
  log(`Network ID: ${yl(netId)}`)

  const state = readNetworkState(network.name, netId)
  assertRequiredNetworkState(state, REQUIRED_NET_STATE)

  const airdropConfig = state['oneinch-rewards']

  const merkleFilePath = path.resolve(__dirname, '..', airdropConfig.merkleFile)
  const merkleData = JSON.parse(await fs.readFile(merkleFilePath))

  log.splitter()

  await proposeTransfer(state, airdropConfig.merkleDistributorAddress, merkleData, FROM)
}

async function proposeTransfer(state, merkleDistributorAddress, merkleData, holderAddress) {
  const [tokenManager, finance, voting] = await Promise.all([
    getContract('TokenManager').at(state['app:aragon-token-manager'].proxyAddress),
    getContract('Finance').at(state['app:aragon-finance'].proxyAddress),
    getContract('Voting').at(state['app:aragon-voting'].proxyAddress)
  ])

  log(`Using TokenManager:`, yl(tokenManager.address))
  log(`Using Finance:`, yl(finance.address))
  log(`Using Voting:`, yl(voting.address))

  const token = await getContract('ERC20').at(await tokenManager.token())
  log(`Using DAO token:`, yl(token.address))

  const airdrop = state['oneinch-rewards']
  log('Using MerkleDistributor address:', yl(merkleDistributorAddress))

  const transferAmount = new BN(merkleData.tokenTotal.replace(/^0x/, ''), 16)
  const totalSupply = await token.totalSupply()
  const totalSupplyPercentageBP = transferAmount.muln(10000).div(totalSupply)

  log(`Transfer amount: ${yl(transferAmount.toString())} (${totalSupplyPercentageBP / 100}% of total supply)`)

  const payment = {
    tokenAddress: token.address,
    recipient: merkleDistributorAddress,
    amount: transferAmount.toString(),
    reference: `transfer to the airdrop distributor contract`
  }

  const { result: txResult, voteId } = await daoUtils.proposePayment(
    voting,
    tokenManager,
    finance,
    payment,
    { from: holderAddress }
  )

  log(`Vote ID:`, yl(voteId))

  return { txResult, voteId, transferAmount }
}

module.exports = runOrWrapScript(main, module)
module.exports.proposeTransfer = proposeTransfer
