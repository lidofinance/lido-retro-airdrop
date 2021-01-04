const fs = require('fs')
const path = require('path')

require('@nomiclabs/hardhat-web3')
require('@nomiclabs/hardhat-truffle5')
require('@nomiclabs/hardhat-ganache')
require('@nomiclabs/hardhat-etherscan')

const NETWORK_NAME = getNetworkName()
const ETH_ACCOUNT_NAME = process.env.ETH_ACCOUNT_NAME

const accounts = readJson(`./accounts.json`) || {
  eth: { dev: 'remote' },
  etherscan: { apiKey: undefined },
  infura: { projectId: undefined }
}

const forkConfig = getForkConfig(process.env.FORK_BLOCK, accounts)

const getNetConfig = (networkName, ethAccountName) => {
  const netState = readJson(`./deployed-${networkName}.json`) || {}
  const ethAccts = accounts.eth || {}
  const base = {
    accounts: ethAccountName === 'remote'
      ? 'remote'
      : ethAccts[ethAccountName] || ethAccts[networkName] || ethAccts.dev || 'remote',
    ensAddress: netState.ensAddress,
    timeout: 60000
  }
  const dev = {
    ...base,
    url: 'http://localhost:8545',
    chainId: 1337,
    gas: 8000000 // the same as in Görli
  }
  const byNetName = {
    hardhat: {
      forking: forkConfig
    },
    'mainnet-fork': {
      url: 'http://localhost:8545',
      chainId: 1,
      timeout: 60000
    },
    dev,
    mainnet: {
      ...base,
      url: 'https://mainnet.infura.io/v3/' + accounts.infura.projectId,
      chainId: 1,
      timeout: 60000 * 10
    }
  }
  const netConfig = byNetName[networkName]
  return netConfig ? { [networkName]: netConfig } : {}
}

const solcSettings = {
  optimizer: {
    enabled: true,
    runs: 200
  },
  evmVersion: 'constantinople'
}

module.exports = {
  defaultNetwork: NETWORK_NAME,
  networks: getNetConfig(NETWORK_NAME, ETH_ACCOUNT_NAME),
  solidity: {
    compilers: [
      {
        version: '0.6.11',
        settings: solcSettings
      }
    ]
  },
  etherscan: accounts.etherscan,
  mocha: {
    timeout: forkConfig ? 120000 : 20000
  }
}

function getNetworkName() {
  if (process.env.HARDHAT_NETWORK) {
    // Hardhat passes the network to its subprocesses via this env var
    return process.env.HARDHAT_NETWORK
  }
  const networkArgIndex = process.argv.indexOf('--network')
  return networkArgIndex !== -1 && networkArgIndex + 1 < process.argv.length
    ? process.argv[networkArgIndex + 1]
    : process.env.NETWORK_NAME || 'hardhat'
}

function getForkConfig(forkBlock, accounts) {
  const url = accounts.archiveMainnetNode || ('https://mainnet.infura.io/v3/' + accounts.infura.projectId)
  if (forkBlock === 'latest') {
    return { url }
  }
  if (+forkBlock > 0) {
    return { url, blockNumber: +forkBlock }
  }
  return undefined
}

function readJson(fileName) {
  let data
  try {
    const filePath = path.join(__dirname, fileName)
    data = fs.readFileSync(filePath)
  } catch (err) {
    return null
  }
  return JSON.parse(data)
}
