const runOrWrapScript = require('./helpers/run-or-wrap-script')
const { log, yl, gr } = require('./helpers/log')
const { readNetworkState, assertRequiredNetworkState, persistNetworkState } = require('./helpers/persisted-network-state')
const { assert } = require('./helpers/assert')

const REQUIRED_NET_STATE = [
  'daoTokenAddress',
  'airdrop-1-retro'
]

const FROM = process.env.FROM

async function main({ web3, artifacts }) {
  const netId = await web3.eth.net.getId()

  log.splitter()
  log(`Network ID: ${yl(netId)}`)

  const state = readNetworkState(network.name, netId)
  assertRequiredNetworkState(state, REQUIRED_NET_STATE)

  const merkleFilePath = path.resolve(__dirname, '..', state['airdrop-1-retro'].merkleFile)
  const merkleData = JSON.parse(await fs.readFile(merkleFilePath))

  log.splitter()

  const distributor = await deployDistributor(merkleData, state.daoTokenAddress, FROM)
  state['airdrop-1-retro'].merkleDistributorAddress = distributor.addresses

  persistNetworkState(network.name, netId, state)
}

async function deployDistributor(merkleData, daoTokenAddress, deployerAccount) {
  log(`Using DAO token:`, yl(daoTokenAddress))
  log(`Using Merkle tree root:`, yl(merkleData.merkleRoot))

  const distributor = await log.deploy('MerkleDistributor',
    artifacts.require('MerkleDistributor').new(
      daoTokenAddress,
      merkleData.merkleRoot,
      { from: deployerAccount }
    )
  )

  return distributor
}

module.exports = runOrWrapScript(main, module)
module.exports.deployDistributor = deployDistributor
